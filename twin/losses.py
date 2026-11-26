"""Loss functions for VarshaTwin: Latitude-weighted MSE, Heavy-Rain CSI Boost, and Spatial Anti-Blur Loss."""
from __future__ import annotations
import numpy as np
import torch
from twin.data import LAT, LOG1P_TP_SCALE, NC

# Channel weights emphasizing precipitation (tp), temperature (t2m), moisture (tcwv), and winds
CHANNEL_WEIGHTS = (1.2, 1.8, 1.0, 1.0, 1.0, 1.2)
HEAVY_RAIN_NORM_THRESH = float(np.log1p(10.0) / LOG1P_TP_SCALE)  # 10.0 mm/day in normalized log1p space


def get_lat_weights_torch(device: torch.device) -> torch.Tensor:
    """Cosine latitude weights [1, 1, 32, 1] matching monsoon_r1.scoring.rmse_lat."""
    w = np.cos(np.deg2rad(LAT))
    w = (w / w.mean()).astype(np.float32)
    return torch.from_numpy(w).to(device).view(1, 1, -1, 1)


def spatial_grad_loss(pred: torch.Tensor, target: torch.Tensor, lat_w: torch.Tensor) -> torch.Tensor:
    """L1 difference of horizontal & vertical spatial gradients to prevent multi-step blurring."""
    dx_p = pred[..., :, 1:] - pred[..., :, :-1]
    dx_t = target[..., :, 1:] - target[..., :, :-1]
    dy_p = pred[..., 1:, :] - pred[..., :-1, :]
    dy_t = target[..., 1:, :] - target[..., :-1, :]
    loss_x = (torch.abs(dx_p - dx_t) * lat_w).mean()
    loss_y = (torch.abs(dy_p - dy_t) * lat_w[..., :-1, :]).mean()
    return 0.5 * (loss_x + loss_y)


def spatial_std_loss(pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    """Penalize collapse of spatial standard deviation across the 32x36 map (anti-blur)."""
    std_p = torch.sqrt(pred.flatten(-2).var(dim=-1) + 1e-6)
    std_t = torch.sqrt(target.flatten(-2).var(dim=-1) + 1e-6)
    return torch.mean(torch.abs(std_p - std_t) / (std_t + 1e-4))


def compute_rollout_loss(
    pred_norm_seq: torch.Tensor,
    target_norm_seq: torch.Tensor,
    grad_weight: float = 0.15,
    std_weight: float = 0.10,
    heavy_rain_boost: float = 1.5,
) -> dict[str, torch.Tensor]:
    """Compute total multi-step rollout loss on normalized predictions [B, H, 6, 32, 36]."""
    device = pred_norm_seq.device
    lat_w = get_lat_weights_torch(device).unsqueeze(1)  # [1, 1, 1, 32, 1]
    ch_w = torch.tensor(CHANNEL_WEIGHTS, dtype=torch.float32, device=device).view(1, 1, NC, 1, 1)

    sq_err = (pred_norm_seq - target_norm_seq) ** 2
    # Boost weight on wet pixels where true or predicted precipitation exceeds 10 mm/day (CSI threshold)
    true_tp = target_norm_seq[:, :, 1:2]
    pred_tp = pred_norm_seq[:, :, 1:2]
    heavy_mask = ((true_tp >= HEAVY_RAIN_NORM_THRESH) | (pred_tp >= HEAVY_RAIN_NORM_THRESH)).float()
    rain_mult = 1.0 + heavy_rain_boost * heavy_mask

    weighted_sq = sq_err * lat_w * ch_w
    weighted_sq[:, :, 1:2] = weighted_sq[:, :, 1:2] * rain_mult
    mse_loss = weighted_sq.mean()

    g_loss = spatial_grad_loss(pred_norm_seq, target_norm_seq, lat_w)
    s_loss = spatial_std_loss(pred_norm_seq, target_norm_seq)
    total = mse_loss + grad_weight * g_loss + std_weight * s_loss
    return {"total": total, "mse": mse_loss.detach(), "grad": g_loss.detach(), "std": s_loss.detach()}
