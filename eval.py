"""Evaluate baselines (Repeat Yesterday & Climatology) and models on 2020-2021 validation years.

Mirrors the exact metrics from monsoon_r1/scoring.py:
- Latitude-weighted RMSE and Skill Score (SS) at lead days 1, 4, 8 (SS_REF = 0.12 for 30/30 pts)
- Heavy-rain Critical Success Index (CSI) at 10.0 mm/day at lead days 1, 4, 8 (CSI_SS_REF = 0.10 for 15/15 pts)
- Day-8 spatial variance ratio (BLUR_MIN_RATIO = 0.40 .. 2.50 for 10/10 pts)
"""
from __future__ import annotations
import argparse
from pathlib import Path
import numpy as np
from twin.data import CHANNELS, LAT, NC, NLAT, NLON, TRAIN_END_YEAR, build_static_bundle

LEAD_DAYS = (1, 4, 8)
SCORE_STEPS = 10
RAIN_THRESH = 10.0
SS_REF = 0.12
CSI_SS_REF = 0.10
BLUR_MIN_RATIO = 0.40
BLUR_MAX_RATIO = 2.50


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


def build_val_windows(raw: dict[str, np.ndarray], stride: int = 5) -> dict[str, np.ndarray]:
    """Build 3-day input -> 10-day target evaluation windows across validation years (2020-2021)."""
    data = raw["data"]
    years = raw["years"]
    doy_idx = raw["doy_idx"]
    doy_sc = raw["doy_sincos"]

    val_indices = [
        t
        for t in range(2, len(data) - SCORE_STEPS)
        if years[t] > TRAIN_END_YEAR
    ][::stride]

    init_windows = np.stack([data[t - 2 : t + 1] for t in val_indices], axis=0)  # [W, 3, 6, 32, 36]
    true_rollouts = np.stack([data[t + 1 : t + 1 + SCORE_STEPS] for t in val_indices], axis=0)  # [W, 10, 6, 32, 36]
    target_doy_idx = np.stack([doy_idx[t + 1 : t + 1 + SCORE_STEPS] for t in val_indices], axis=0)  # [W, 10]
    last_doy_sc = np.stack([doy_sc[t] for t in val_indices], axis=0)  # [W, 2]

    return {
        "init_states": init_windows,
        "true_rollouts": true_rollouts,
        "target_doy_idx": target_doy_idx,
        "last_doy_sincos": last_doy_sc,
    }


def evaluate_baselines(nc_path: str = "data/india_climate_train.nc", stride: int = 5) -> None:
    """Compute and print Repeat Yesterday (Persistence) and Climatology baseline metrics on 2020-2021."""
    bundle = build_static_bundle(nc_path=nc_path)
    raw = bundle["raw"]
    clim = bundle["climatology"]

    val = build_val_windows(raw, stride=stride)
    init_states = val["init_states"]
    true_rollouts = val["true_rollouts"]
    target_doy_idx = val["target_doy_idx"]
    n_win = len(init_states)

    # 1. Persistence ("Repeat Yesterday"): repeat init_states[:, -1] for all 10 steps
    persist_rollouts = np.repeat(init_states[:, -1:, :, :, :], SCORE_STEPS, axis=1)

    # 2. Climatology: lookup 2005-2019 smoothed climatology for each target day
    clim_rollouts = clim[target_doy_idx]  # [W, 10, 6, 32, 36]

    print(f"=== VarshaTwin Baseline Evaluation (Validation 2020-2021, {n_win} windows, stride={stride}) ===")
    print(f"Static bundle saved to: weights/static_fields.npz (climatology shape={clim.shape})\n")

    print("| Lead Day | Channel | Repeat Yesterday RMSE | Climatology RMSE | Better Baseline |")
    print("|---|---|---|---|---|")
    for lead in LEAD_DAYS:
        k = lead - 1
        rp = rmse_lat(persist_rollouts[:, k], true_rollouts[:, k])
        rc = rmse_lat(clim_rollouts[:, k], true_rollouts[:, k])
        for c, ch_name in enumerate(CHANNELS):
            winner = "Repeat Yesterday" if rp[c] <= rc[c] else "Climatology"
            print(f"| Day {lead} | `{ch_name}` | {rp[c]:.4f} | {rc[c]:.4f} | {winner} |")

    print("\n### Heavy-Rain CSI (`tp > 10.0 mm/day`)")
    print("| Lead Day | Repeat Yesterday CSI | Climatology CSI | Best Reference CSI |")
    print("|---|---|---|---|")
    for lead in LEAD_DAYS:
        k = lead - 1
        cp = csi_score(persist_rollouts[:, k, 1], true_rollouts[:, k, 1])
        cc = csi_score(clim_rollouts[:, k, 1], true_rollouts[:, k, 1])
        best_c = max(cp, cc)
        print(f"| Day {lead} | {cp:.4f} | {cc:.4f} | {best_c:.4f} |")

    vr_p = variance_ratio(persist_rollouts[:, 7], true_rollouts[:, 7])
    vr_c = variance_ratio(clim_rollouts[:, 7], true_rollouts[:, 7])
    print("\n### Day-8 Spatial Variance Ratio (Target: 0.40 to 2.50)")
    for c, ch_name in enumerate(CHANNELS):
        print(f"- `{ch_name}`: Repeat Yesterday = {vr_p[c]:.3f}, Climatology = {vr_c[c]:.3f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/india_climate_train.nc")
    ap.add_argument("--stride", type=int, default=5)
    args = ap.parse_args()
    evaluate_baselines(nc_path=args.data, stride=args.stride)
