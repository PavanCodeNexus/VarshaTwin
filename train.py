"""Fast vectorized training pipeline for VarshaTwin (Level 1 local conv and Levels 2/3 VarshaTwinNet).

Pre-normalizes the 170 MB archive once in memory and slices batch windows directly on tensor indices,
eliminating per-item Python DataLoader overhead (10x faster epochs on CPU).
"""
from __future__ import annotations
import argparse
import time
from pathlib import Path
import numpy as np
import torch
from twin.data import (
    TRAIN_END_YEAR,
    build_static_bundle,
    load_raw_dataset,
    load_static_bundle,
    normalize_tensor,
)
from twin.losses import compute_rollout_loss
from twin.model import build_model


def set_seed(seed: int = 42) -> None:
    """Set deterministic seeds for reproducible training."""
    np.random.seed(seed)
    torch.manual_seed(seed)


def rollout_normalized_batch(
    model: torch.nn.Module,
    window_norm: torch.Tensor,
    clim_norm_seq: torch.Tensor,
    doy_sincos_seq: torch.Tensor,
    static_norm: torch.Tensor,
) -> torch.Tensor:
    """Autoregressively roll model forward for H steps in normalized space -> [B, H, 6, 32, 36]."""
    horizon = clim_norm_seq.shape[1]
    preds = []
    cur_win = window_norm
    for k in range(horizon):
        next_norm = model.forward_step(
            cur_win,
            clim_norm_seq[:, k],
            static_norm,
            doy_sincos_seq[:, k],
            step_k=k,
        )
        preds.append(next_norm)
        cur_win = torch.cat([cur_win[:, 1:], next_norm.unsqueeze(1)], dim=1)
    return torch.stack(preds, dim=1)


def _gather_batch(
    t_idx: np.ndarray,
    horizon: int,
    data_norm: torch.Tensor,
    clim_norm: torch.Tensor,
    doy_idx_all: np.ndarray,
    doy_sc_all: torch.Tensor,
    device: torch.device,
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
    """Vectorized batch gather of 3-day input windows and H-step targets in normalized space."""
    in_offsets = np.array([-2, -1, 0], dtype=np.int64)
    out_offsets = np.arange(1, horizon + 1, dtype=np.int64)
    step_offsets = np.arange(0, horizon, dtype=np.int64)

    in_idx = torch.from_numpy(t_idx[:, None] + in_offsets[None, :])       # [B, 3]
    out_idx = torch.from_numpy(t_idx[:, None] + out_offsets[None, :])     # [B, H]
    sc_idx = torch.from_numpy(t_idx[:, None] + step_offsets[None, :])     # [B, H]
    clim_slots = torch.from_numpy(doy_idx_all[t_idx[:, None] + out_offsets[None, :]]).long()

    win_norm = data_norm[in_idx].to(device)
    target_norm = data_norm[out_idx].to(device)
    target_clim_norm = clim_norm[clim_slots].to(device)
    doy_sc = doy_sc_all[sc_idx].to(device)
    return win_norm, target_norm, target_clim_norm, doy_sc


def train_model(
    data_path: str = "data/india_climate_train.nc",
    out_weights: str = "weights/twin.pt",
    level: int = 1,
    hidden_dim: int = 48,
    epochs: int = 8,
    batch_size: int = 64,
    lr: float = 3e-3,
    rollout_steps: int = 4,
) -> dict:
    """Train Level 1, 2, or 3 VarshaTwin model on 2005-2019 and validate on 2020-2021."""
    set_seed(42)
    torch.set_num_threads(4)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    static_npz = Path("weights/static_fields.npz")
    if not static_npz.is_file():
        build_static_bundle(nc_path=data_path, out_path=static_npz)
    sb = load_static_bundle(static_npz)
    raw = load_raw_dataset(data_path)

    mean_cpu = torch.from_numpy(sb["mean"])
    std_cpu = torch.from_numpy(sb["std"])
    static_t = torch.from_numpy(sb["static_norm"]).to(device)

    # Pre-normalize entire 6,209-day archive and 366-day climatology once
    data_norm = normalize_tensor(torch.from_numpy(raw["data"]), mean_cpu, std_cpu)
    clim_norm = normalize_tensor(torch.from_numpy(sb["climatology"]), mean_cpu, std_cpu)
    doy_idx_all = raw["doy_idx"]
    doy_sc_all = torch.from_numpy(raw["doy_sincos"])
    years = raw["years"]

    max_h = max(rollout_steps, 4)
    max_t = len(years) - max_h
    train_indices = np.array(
        [t for t in range(2, max_t) if years[t] <= TRAIN_END_YEAR and years[t + max_h] <= TRAIN_END_YEAR],
        dtype=np.int64,
    )
    val_indices = np.array([t for t in range(2, max_t) if years[t] > TRAIN_END_YEAR], dtype=np.int64)

    model = build_model(level=level, hidden_dim=hidden_dim).to(device)
    n_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(
        f"=== Training VarshaTwin (Level {level}, params={n_params:,}, device={device}, steps={rollout_steps}) ===",
        flush=True,
    )

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=max(epochs, 1), eta_min=lr * 0.1)

    grad_w = 0.15 if level >= 3 else 0.05
    std_w = 0.10 if level >= 3 else 0.02
    rain_boost = 1.8 if level >= 3 else 0.5

    best_val_loss = float("inf")
    best_epoch = 0
    out_p = Path(out_weights)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(42)

    for epoch in range(1, epochs + 1):
        t0 = time.perf_counter()
        if level >= 3 and epochs >= 6:
            cur_steps = 2 if epoch <= 2 else (4 if epoch <= 4 else rollout_steps)
            epoch_train_idx = train_indices[(epoch - 1) % 3 :: 3]
        else:
            cur_steps = 1 if level == 2 else rollout_steps
            epoch_train_idx = train_indices

        perm = rng.permutation(epoch_train_idx)
        model.train()
        tr_loss_sum, tr_batches = 0.0, 0
        for start in range(0, len(perm), batch_size):
            t_batch = perm[start : start + batch_size]
            win_n, target_n, clim_n, doy_sc = _gather_batch(
                t_batch, cur_steps, data_norm, clim_norm, doy_idx_all, doy_sc_all, device
            )
            optimizer.zero_grad()
            pred_n = rollout_normalized_batch(model, win_n, clim_n, doy_sc, static_t)
            losses = compute_rollout_loss(
                pred_n, target_n, grad_weight=grad_w, std_weight=std_w, heavy_rain_boost=rain_boost
            )
            loss = losses["total"]
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=2.0)
            optimizer.step()

            tr_loss_sum += float(loss.item())
            tr_batches += 1

        scheduler.step()
        tr_loss = tr_loss_sum / max(tr_batches, 1)

        model.eval()
        val_loss_sum, val_batches = 0.0, 0
        with torch.no_grad():
            for start in range(0, len(val_indices), batch_size):
                t_batch = val_indices[start : start + batch_size]
                win_n, target_n, clim_n, doy_sc = _gather_batch(
                    t_batch, max_h, data_norm, clim_norm, doy_idx_all, doy_sc_all, device
                )
                pred_n = rollout_normalized_batch(model, win_n, clim_n, doy_sc, static_t)
                v_losses = compute_rollout_loss(
                    pred_n, target_n, grad_weight=grad_w, std_weight=std_w, heavy_rain_boost=rain_boost
                )
                val_loss_sum += float(v_losses["total"].item())
                val_batches += 1

        val_loss = val_loss_sum / max(val_batches, 1)
        dt_s = time.perf_counter() - t0
        saved_mark = ""
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_epoch = epoch
            ckpt = {
                "model_name": f"VarshaTwin-L{level}",
                "level": level,
                "hidden_dim": hidden_dim,
                "state_dict": model.state_dict(),
                "mean": sb["mean"].tolist(),
                "std": sb["std"].tolist(),
                "best_epoch": best_epoch,
                "best_val_loss": best_val_loss,
            }
            torch.save(ckpt, out_p)
            saved_mark = " *saved*"

        print(
            f"Epoch {epoch:02d}/{epochs:02d} (H={cur_steps}) | "
            f"train_loss={tr_loss:.4f} | val_loss={val_loss:.4f} | {dt_s:.1f}s{saved_mark}",
            flush=True,
        )

    print(f"Done! Best checkpoint: {out_p} (epoch {best_epoch}, val_loss={best_val_loss:.4f})", flush=True)
    return {"best_epoch": best_epoch, "best_val_loss": best_val_loss, "weights": str(out_p)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/india_climate_train.nc")
    ap.add_argument("--out", default="weights/twin.pt")
    ap.add_argument("--level", type=int, default=1)
    ap.add_argument("--hidden-dim", type=int, default=48)
    ap.add_argument("--epochs", type=int, default=6)
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--lr", type=float, default=3e-3)
    ap.add_argument("--steps", type=int, default=4)
    args = ap.parse_args()
    train_model(
        data_path=args.data,
        out_weights=args.out,
        level=args.level,
        hidden_dim=args.hidden_dim,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        rollout_steps=args.steps,
    )
