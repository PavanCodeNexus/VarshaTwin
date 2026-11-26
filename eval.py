"""Evaluate baselines (Repeat Yesterday & Climatology) and trained VarshaTwin model on 2020-2021 validation years.

Computes the exact 70-point automated model scorecard from monsoon_r1/scoring.py:
- Forecast RMSE Skill: 30 pts (SS_REF = 0.12 vs better of Repeat Yesterday and Climatology at Days 1, 4, 8)
- Heavy-Rain CSI Skill: 15 pts (CSI_SS_REF = 0.10 at tp > 10.0 mm/day at Days 1, 4, 8)
- Anti-Blur Spatial Variance: 10 pts (Day-8 variance ratio in [0.40, 2.50])
- Perturbation Causality: 15 pts (warm_ocean, monsoon_stall, and null shock consistency)
"""
from __future__ import annotations
import argparse
from pathlib import Path
import numpy as np
import torch
from twin.data import (
    CHANNELS,
    LAT,
    NC,
    NLAT,
    NLON,
    TRAIN_END_YEAR,
    advance_doy_sincos,
    build_static_bundle,
    denormalize_tensor,
    load_raw_dataset,
    load_static_bundle,
    normalize_tensor,
    sincos_to_doy_index,
)
from twin.model import build_model
from twin.rollout import apply_physical_guards, run_rollout
from twin.shocks import BOX_ARABIAN_SEA, BOX_BAY_OF_BENGAL, box_mask, make_shock

LEAD_DAYS = (1, 4, 8)
SCORE_STEPS = 10
RAIN_THRESH = 10.0
SS_REF = 0.12
CSI_SS_REF = 0.10
BLUR_MIN_RATIO = 0.40
BLUR_MAX_RATIO = 2.50
DILATE = 3
LOCAL_MIN_FRAC = 0.60
MAX_SPEED_CELLS_PER_DAY = 8.0
STABLE_MAX_STD = 5.0


def lat_weights() -> np.ndarray:
    """Cosine latitude weights normalized to unit mean (exact match to monsoon_r1.contract.lat_weights)."""
    w = np.cos(np.deg2rad(LAT))
    return (w / w.mean()).astype(np.float32)


def rmse_lat(pred: np.ndarray, true: np.ndarray) -> np.ndarray:
    """Latitude-weighted RMSE per channel for [..., 6, 32, 36] arrays."""
    w = lat_weights()[:, None]
    se = (pred - true) ** 2
    return np.sqrt((se * w).mean(axis=(-2, -1)).reshape(-1, NC).mean(axis=0))


def csi_score(pred_tp: np.ndarray, true_tp: np.ndarray, thr: float = RAIN_THRESH) -> float:
    """Critical Success Index (hits / (hits + misses + false_alarms)) at threshold thr (10.0 mm/day)."""
    p = pred_tp > thr
    t = true_tp > thr
    hits = int((p & t).sum())
    misses = int((~p & t).sum())
    false_alarms = int((p & ~t).sum())
    denom = hits + misses + false_alarms
    return float("nan") if denom == 0 else hits / denom


def variance_ratio(pred_day8: np.ndarray, true_day8: np.ndarray) -> np.ndarray:
    """Mean Day-8 spatial variance ratio Var(pred) / Var(true) per channel over validation windows."""
    vp = pred_day8.reshape(-1, NC, NLAT * NLON).var(axis=-1)
    vt = true_day8.reshape(-1, NC, NLAT * NLON).var(axis=-1)
    ratios = np.where(vt > 1e-12, vp / np.maximum(vt, 1e-30), np.nan)
    return np.nanmean(ratios, axis=0)


def anti_blur_points(ratios: np.ndarray, max_pts: float = 10.0) -> float:
    """Exact match to monsoon_r1.scoring.anti_blur_points."""
    ok = np.where(np.isfinite(ratios), np.clip(ratios / BLUR_MIN_RATIO, 0.0, 1.0) * (ratios <= BLUR_MAX_RATIO), 0.0)
    return float(max_pts * ok.mean())


def near_mask(box: tuple[float, float, float, float], dilate: int = DILATE) -> np.ndarray:
    """Dilate region box mask by `dilate` grid cells (exact match to monsoon_r1.scoring.near_mask)."""
    out = box_mask(box).copy()
    for _ in range(dilate):
        o = out.copy()
        o[1:] |= out[:-1]
        o[:-1] |= out[1:]
        o[:, 1:] |= out[:, :-1]
        o[:, :-1] |= out[:, 1:]
        out = o
    return out


def causality_checks(base: np.ndarray, shock: np.ndarray, box: tuple[float, float, float, float], std: np.ndarray) -> dict:
    """Exact match to monsoon_r1.scoring.causality_checks."""
    d = shock - base
    finite = bool(np.isfinite(d).all())
    if not finite:
        return {"finite": False, "nonzero": False, "localized": False, "propagates": False, "stable": False}
    z = np.abs(d / std[None, :, None, None])
    nonzero = bool(z.max() >= 1e-3)
    stable = bool(z.max() <= STABLE_MAX_STD)
    e = ((d / std[None, :, None, None]) ** 2).sum(axis=1)
    steps = e.shape[0]
    near = near_mask(box)
    tot1 = float(e[0].sum())
    near_frac_day1 = float(e[0][near].sum() / tot1) if tot1 > 0 else 0.0
    localized = bool(tot1 > 0 and near_frac_day1 >= LOCAL_MIN_FRAC)

    out_e = np.array([e[k][~near].sum() for k in range(steps)])
    late = float(out_e[3:8].mean()) if steps >= 8 else float(out_e[-1])
    grows = bool(late > 1.5 * out_e[0] + 1e-12 and late > 0.02 * max(float(e.sum(axis=(1, 2)).max()), 1e-12))

    ii, jj = np.indices((NLAT, NLON))
    bi, bj = np.where(box_mask(box))
    dist = np.sqrt(((ii[..., None] - bi) ** 2 + (jj[..., None] - bj) ** 2)).min(axis=-1)
    tele = 0.0
    for k in range(steps):
        far = dist > (DILATE + MAX_SPEED_CELLS_PER_DAY * (k + 1))
        tele = max(tele, float(e[k][far].sum() / max(float(e[k].sum()), 1e-12)))
    no_teleport = bool(tele < 0.05)
    propagates = bool(grows and no_teleport)
    return {
        "finite": finite,
        "nonzero": nonzero,
        "localized": localized,
        "near_frac_day1": round(near_frac_day1, 4),
        "propagates": propagates,
        "far_frac_max": round(tele, 5),
        "stable": stable,
    }


def build_val_windows(raw: dict[str, np.ndarray], stride: int = 1) -> dict[str, np.ndarray]:
    """Build 3-day input -> 10-day target evaluation windows across validation years (2020-2021)."""
    if stride < 1:
        raise ValueError(f"stride must be >= 1, got {stride}")
    data = raw["data"]
    years = raw["years"]
    doy_idx = raw["doy_idx"]
    doy_sc = raw["doy_sincos"]

    val_indices = [
        t for t in range(2, len(data) - SCORE_STEPS)
        if years[t] > TRAIN_END_YEAR
    ][::stride]
    if not val_indices:
        raise ValueError("No validation windows found after TRAIN_END_YEAR")

    init_windows = np.stack([data[t - 2 : t + 1] for t in val_indices], axis=0)
    true_rollouts = np.stack([data[t + 1 : t + 1 + SCORE_STEPS] for t in val_indices], axis=0)
    target_doy_idx = np.stack([doy_idx[t + 1 : t + 1 + SCORE_STEPS] for t in val_indices], axis=0)
    step_doy_sc = np.stack([doy_sc[t : t + SCORE_STEPS] for t in val_indices], axis=0)

    return {
        "init_states": init_windows,
        "true_rollouts": true_rollouts,
        "target_doy_idx": target_doy_idx,
        "step_doy_sincos": step_doy_sc,
    }


def batched_model_rollout(
    model: torch.nn.Module,
    init_states: np.ndarray,
    step_doy_sincos: np.ndarray,
    static_bundle: dict[str, np.ndarray],
    batch_size: int = 128,
) -> np.ndarray:
    """Fast batched 10-step rollout [W, 10, 6, 32, 36] using identical doy_sincos indexing as run_rollout."""
    mean_t = torch.from_numpy(static_bundle["mean"])
    std_t = torch.from_numpy(static_bundle["std"])
    static_t = torch.from_numpy(static_bundle["static_norm"])
    clim_np = static_bundle["climatology"]
    n_win = len(init_states)
    out_all = np.zeros((n_win, SCORE_STEPS, NC, NLAT, NLON), dtype=np.float32)

    # Precompute wire-derived climatology slots and rotated doy_sincos exactly matching run_rollout
    wire_clim_slots = np.zeros((n_win, SCORE_STEPS), dtype=np.int64)
    wire_doy_sc = np.zeros((n_win, SCORE_STEPS, 2), dtype=np.float32)
    for w_i in range(n_win):
        s_val, c_val = float(step_doy_sincos[w_i, 0, 0]), float(step_doy_sincos[w_i, 0, 1])
        base_slot = sincos_to_doy_index(s_val, c_val)
        for k in range(SCORE_STEPS):
            wire_clim_slots[w_i, k] = (base_slot + k + 1) % 366
            wire_doy_sc[w_i, k, 0] = s_val
            wire_doy_sc[w_i, k, 1] = c_val
            s_val, c_val = advance_doy_sincos(s_val, c_val, step_days=1)

    model.eval()
    with torch.no_grad():
        for start in range(0, n_win, batch_size):
            end = min(start + batch_size, n_win)
            win_t = torch.from_numpy(init_states[start:end])
            clim_t = torch.from_numpy(clim_np[wire_clim_slots[start:end]])
            doy_t = torch.from_numpy(wire_doy_sc[start:end])

            win_norm = normalize_tensor(win_t, mean_t, std_t)
            clim_norm = normalize_tensor(clim_t, mean_t, std_t)
            preds = []
            for k in range(SCORE_STEPS):
                nxt = model.forward_step(win_norm, clim_norm[:, k], static_t, doy_t[:, k], step_k=k)
                preds.append(nxt)
                win_norm = torch.cat([win_norm[:, 1:], nxt.unsqueeze(1)], dim=1)
            seq_norm = torch.stack(preds, dim=1)
            seq_phys = denormalize_tensor(seq_norm, mean_t, std_t).numpy()
            for i in range(end - start):
                out_all[start + i] = apply_physical_guards(seq_phys[i], init_states[start + i, -1])
    return out_all


def evaluate_all(
    nc_path: str = "data/india_climate_train.nc",
    weights_path: str = "weights/twin.pt",
    stride: int = 1,
) -> None:
    """Evaluate Persistence, Climatology, and trained VarshaTwin model on 2020-2021 validation windows."""
    static_npz = Path("weights/static_fields.npz")
    if not static_npz.is_file():
        build_static_bundle(nc_path=nc_path, out_path=static_npz)
    sb = load_static_bundle(static_npz)
    raw = load_raw_dataset(nc_path)
    clim = sb["climatology"]

    val = build_val_windows(raw, stride=stride)
    init_states = val["init_states"]
    true_rollouts = val["true_rollouts"]
    target_doy_idx = val["target_doy_idx"]
    step_doy_sc = val["step_doy_sincos"]
    n_win = len(init_states)

    persist_rollouts = np.repeat(init_states[:, -1:, :, :, :], SCORE_STEPS, axis=1)
    clim_rollouts = clim[target_doy_idx]

    has_model = Path(weights_path).is_file()
    model_name = "None"
    if has_model:
        ckpt = torch.load(weights_path, map_location="cpu", weights_only=True)
        level = int(ckpt.get("level", 1))
        hidden_dim = int(ckpt.get("hidden_dim", 48))
        model_name = str(ckpt.get("model_name", f"VarshaTwin-L{level}"))
        model = build_model(level=level, hidden_dim=hidden_dim)
        model.load_state_dict(ckpt["state_dict"])
        model_rollouts = batched_model_rollout(model, init_states, step_doy_sc, sb)
    else:
        model = build_model(level=1)
        model_rollouts = persist_rollouts

    print(f"=== VarshaTwin Full Evaluation ({model_name}, 2020-2021 Validation, {n_win} windows) ===\n", flush=True)
    print("| Lead Day | Channel | Repeat Yesterday | Climatology | Best Baseline | VarshaTwin | Skill (SS) |")
    print("|---|---|---|---|---|---|---|")

    all_ss = []
    for lead in LEAD_DAYS:
        k = lead - 1
        rp = rmse_lat(persist_rollouts[:, k], true_rollouts[:, k])
        rc = rmse_lat(clim_rollouts[:, k], true_rollouts[:, k])
        rm = rmse_lat(model_rollouts[:, k], true_rollouts[:, k])
        best_ref = np.minimum(rp, rc)
        ss = 1.0 - rm / best_ref
        all_ss.append(ss)
        for c, ch_name in enumerate(CHANNELS):
            print(
                f"| Day {lead} | `{ch_name}` | {rp[c]:.4f} | {rc[c]:.4f} | "
                f"{best_ref[c]:.4f} | **{rm[c]:.4f}** | {ss[c]:+.2%} |",
                flush=True,
            )

    mean_ss = float(np.mean(all_ss))
    rmse_pts = 30.0 * float(np.clip(mean_ss / SS_REF, 0.0, 1.0))

    print("\n### Heavy-Rain CSI (`tp > 10.0 mm/day`)")
    print("| Lead Day | Repeat Yesterday CSI | Climatology CSI | Best Reference CSI | VarshaTwin CSI | CSI Skill |")
    print("|---|---|---|---|---|---|")
    csi_skills = []
    for lead in LEAD_DAYS:
        k = lead - 1
        cp = csi_score(persist_rollouts[:, k, 1], true_rollouts[:, k, 1])
        cc = csi_score(clim_rollouts[:, k, 1], true_rollouts[:, k, 1])
        cm = csi_score(model_rollouts[:, k, 1], true_rollouts[:, k, 1])
        best_c = float(np.fmax(cp, cc))
        denom_c = max(1.0 - best_c, 1e-12)
        cs_skill = (cm - best_c) / denom_c if np.isfinite(cm) and np.isfinite(best_c) else float("nan")
        csi_skills.append(cs_skill)
        print(f"| Day {lead} | {cp:.4f} | {cc:.4f} | {best_c:.4f} | **{cm:.4f}** | {cs_skill:+.2%} |", flush=True)

    mean_csi_skill = float(np.mean(csi_skills))
    csi_pts = 15.0 * float(np.clip(mean_csi_skill / CSI_SS_REF, 0.0, 1.0))

    vr_m = variance_ratio(model_rollouts[:, 7], true_rollouts[:, 7])
    blur_pts = anti_blur_points(vr_m, 10.0)
    print(f"\n### Day-8 Anti-Blur Spatial Variance Ratio (Target: 0.40..2.50 -> {blur_pts:.2f} / 10.0 pts)")
    for c, ch_name in enumerate(CHANNELS):
        print(f"- `{ch_name}`: {vr_m[c]:.3f}", flush=True)

    # Perturbation causality on a real monsoon validation window (index 160 ~ mid-June monsoon onset)
    sample_init = init_states[min(160, n_win - 1)]
    sample_doy = step_doy_sc[min(160, n_win - 1), 0]
    std_np = sb["std"]
    base_sim = run_rollout(model, sample_init, sample_doy, SCORE_STEPS, None, sb)
    null_sim = run_rollout(model, sample_init, sample_doy, SCORE_STEPS, np.zeros((NC, NLAT, NLON), "f4"), sb)
    warm_sim = run_rollout(model, sample_init, sample_doy, SCORE_STEPS, make_shock("warm_ocean", sample_init[-1]), sb)
    stall_sim = run_rollout(model, sample_init, sample_doy, SCORE_STEPS, make_shock("monsoon_stall", sample_init[-1]), sb)

    null_ok = bool((np.abs(base_sim - null_sim) / std_np[None, :, None, None]).max() <= 1e-3)
    cw = causality_checks(base_sim, warm_sim, BOX_BAY_OF_BENGAL, std_np)
    cm = causality_checks(base_sim, stall_sim, BOX_ARABIAN_SEA, std_np)
    c_pts = 0.0
    for r in (cw, cm):
        cnt = (1 + (1 + int(r["propagates"]) + int(r["stable"]) if r["localized"] else 0)) if r["nonzero"] else 0
        c_pts += 7.5 * (cnt / 4.0)
    if not null_ok:
        c_pts *= 0.5

    print(f"\n### Perturbation Causality ({c_pts:.2f} / 15.0 pts)")
    print(f"- `null_consistent`: {null_ok}")
    print(f"- `warm_ocean`: {cw}")
    print(f"- `monsoon_stall`: {cm}")

    total_auto_70 = rmse_pts + csi_pts + blur_pts + c_pts
    print(
        f"\n=== Automated Model Scorecard: {total_auto_70:.2f} / 70.00 pts "
        f"(RMSE: {rmse_pts:.2f}/30 (mean SS={mean_ss:+.2%}) | CSI: {csi_pts:.2f}/15 (mean CSI_SS={mean_csi_skill:+.2%}) | "
        f"Anti-Blur: {blur_pts:.2f}/10 | Causality: {c_pts:.2f}/15) ===",
        flush=True,
    )


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/india_climate_train.nc")
    ap.add_argument("--weights", default="weights/twin.pt")
    ap.add_argument("--stride", type=int, default=1)
    args = ap.parse_args()
    evaluate_all(nc_path=args.data, weights_path=args.weights, stride=args.stride)
