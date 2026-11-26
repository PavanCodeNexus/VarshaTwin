"""Data loading, normalization, 366-day training climatology, physics features, and PyTorch dataset."""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
import torch
from torch.utils.data import Dataset

CHANNELS = ("t2m", "tp", "u10", "v10", "msl", "tcwv")
NC, NLAT, NLON = 6, 32, 36
LAT = np.arange(6.5, 37.5 + 1e-9, 1.0, dtype=np.float32)
LON = np.arange(65.5, 100.5 + 1e-9, 1.0, dtype=np.float32)
_LEAP_CUM_DAYS = np.array([0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335], dtype=np.int32)
TRAIN_END_YEAR = 1999 + 20  # 2019 inclusive (2005-2019 train, 2020-2021 validation)
LOG1P_TP_SCALE = 2.0
ORO_SCALE_M = 2000.0


def doy_index_from_month_day(months: np.ndarray, days: np.ndarray) -> np.ndarray:
    """Map calendar (month 1..12, day 1..31) to 0..365 index where Feb 29 has slot 59."""
    return _LEAP_CUM_DAYS[months - 1] + (days - 1)


def doy_sincos_from_doy(doy: np.ndarray | int | float) -> np.ndarray:
    """Compute [sin(2*pi*doy/365), cos(2*pi*doy/365)] matching monsoon_r1.contract.doy_sincos."""
    angle = 2.0 * np.pi * np.asarray(doy, dtype=np.float32) / 365.0
    return np.stack([np.sin(angle), np.cos(angle)], axis=-1).astype(np.float32)


def advance_doy_sincos(sin_val: float, cos_val: float, step_days: int = 1) -> tuple[float, float]:
    """Rotate (sin, cos) day-of-year vector forward by step_days (2*pi/365 per day)."""
    delta = 2.0 * np.pi * float(step_days) / 365.0
    ca, sa = float(np.cos(delta)), float(np.sin(delta))
    return sin_val * ca + cos_val * sa, cos_val * ca - sin_val * sa


def sincos_to_doy_index(sin_val: float, cos_val: float) -> int:
    """Recover 0..365 climatology slot from doy_sincos [sin, cos] sent on the wire."""
    angle = float(np.arctan2(sin_val, cos_val))
    if angle < 0.0:
        angle += 2.0 * np.pi
    doy_365 = angle * 365.0 / (2.0 * np.pi)
    idx = int(np.round(doy_365 * 366.0 / 365.0)) - 1
    return idx % 366


def compute_climatology(data: np.ndarray, doy_idx: np.ndarray, smooth_days: int = 15) -> np.ndarray:
    """Compute [366, 6, 32, 36] smoothed daily climatology from training split (mirrors monsoon_r1.stats)."""
    clim = np.zeros((366, NC, NLAT, NLON), dtype=np.float64)
    cnt = np.zeros(366, dtype=np.float64)
    for i, k in enumerate(doy_idx):
        clim[k] += data[i]
        cnt[k] += 1.0
    clim /= np.maximum(cnt, 1.0)[:, None, None, None]
    for k in range(366):
        if cnt[k] == 0:
            clim[k] = 0.5 * (clim[(k - 1) % 366] + clim[(k + 1) % 366])
    half = smooth_days // 2
    out = np.zeros_like(clim)
    for k in range(366):
        out[k] = np.mean([clim[(k + o) % 366] for o in range(-half, half + 1)], axis=0)
    out[:, 1] = np.maximum(out[:, 1], 0.0)
    return out.astype(np.float32)


def load_raw_dataset(nc_path: str | Path) -> dict[str, np.ndarray]:
    """Load india_climate_train.nc and return arrays for data, static fields, and time indices."""
    import pandas as pd
    import xarray as xr

    ds = xr.open_dataset(nc_path)
    data = np.asarray(ds["data"].values, dtype=np.float32)
    data[:, 1] = np.maximum(data[:, 1], 0.0)
    if "static" in ds:
        static = np.asarray(ds["static"].values, dtype=np.float32)
    else:
        static = np.zeros((2, NLAT, NLON), dtype=np.float32)
    t_index = pd.DatetimeIndex(ds["time"].values)
    ds.close()

    years = np.asarray(t_index.year, dtype=np.int32)
    months = np.asarray(t_index.month, dtype=np.int32)
    days = np.asarray(t_index.day, dtype=np.int32)
    doy_365 = np.asarray(t_index.dayofyear, dtype=np.int32)
    doy_idx = doy_index_from_month_day(months, days)
    doy_sc = doy_sincos_from_doy(doy_365)

    return {
        "data": data,
        "static": static,
        "years": years,
        "doy_idx": doy_idx,
        "doy_365": doy_365,
        "doy_sincos": doy_sc,
    }


def build_static_bundle(
    nc_path: str | Path = "data/india_climate_train.nc",
    stats_path: str | Path = "data/stats.json",
    out_path: str | Path = "weights/static_fields.npz",
) -> dict[str, np.ndarray]:
    """Extract static geography + 2005-2019 training climatology + channel stats into weights/static_fields.npz."""
    raw = load_raw_dataset(nc_path)
    train_mask = raw["years"] <= TRAIN_END_YEAR
    train_data = raw["data"][train_mask]
    train_doy_idx = raw["doy_idx"][train_mask]

    clim = compute_climatology(train_data, train_doy_idx, smooth_days=15)
    if Path(stats_path).is_file():
        st = json.loads(Path(stats_path).read_text())
        mean = np.asarray(st["mean"], dtype=np.float32)
        std = np.asarray(st["std"], dtype=np.float32)
    else:
        mean = train_data.mean(axis=(0, 2, 3)).astype(np.float32)
        std = train_data.std(axis=(0, 2, 3)).astype(np.float32)

    out_p = Path(out_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        out_p,
        land_sea_mask=raw["static"][0],
        orography_m=raw["static"][1],
        climatology=clim,
        mean=mean,
        std=std,
    )
    return {"raw": raw, "climatology": clim, "mean": mean, "std": std}


def load_static_bundle(bundle_path: str | Path = "weights/static_fields.npz") -> dict[str, np.ndarray]:
    """Load precomputed static fields, 366-day training climatology, and normalization stats."""
    z = np.load(bundle_path)
    lsm = np.asarray(z["land_sea_mask"], dtype=np.float32)
    oro = np.asarray(z["orography_m"], dtype=np.float32)
    static_norm = np.stack([np.clip(lsm, 0.0, 1.0), oro / ORO_SCALE_M], axis=0).astype(np.float32)
    return {
        "land_sea_mask": lsm,
        "orography_m": oro,
        "static_norm": static_norm,
        "climatology": np.asarray(z["climatology"], dtype=np.float32),
        "mean": np.asarray(z["mean"], dtype=np.float32),
        "std": np.asarray(z["std"], dtype=np.float32),
    }


def normalize_tensor(x: torch.Tensor, mean: torch.Tensor, std: torch.Tensor) -> torch.Tensor:
    """Normalize physical tensor [..., 6, 32, 36]: log1p for tp (ch 1), z-score for other 5 channels."""
    m = mean.view(*([1] * (x.ndim - 3)), NC, 1, 1)
    s = std.view(*([1] * (x.ndim - 3)), NC, 1, 1)
    out = (x - m) / s
    tp_norm = torch.log1p(torch.clamp(x[..., 1, :, :], min=0.0)) / LOG1P_TP_SCALE
    out = out.clone()
    out[..., 1, :, :] = tp_norm
    return out


def denormalize_tensor(x_norm: torch.Tensor, mean: torch.Tensor, std: torch.Tensor) -> torch.Tensor:
    """Invert normalize_tensor back to physical units [..., 6, 32, 36] with non-negative tp."""
    m = mean.view(*([1] * (x_norm.ndim - 3)), NC, 1, 1)
    s = std.view(*([1] * (x_norm.ndim - 3)), NC, 1, 1)
    out = x_norm * s + m
    tp_phys = torch.expm1(torch.clamp(x_norm[..., 1, :, :] * LOG1P_TP_SCALE, min=0.0, max=12.0))
    out = out.clone()
    out[..., 1, :, :] = torch.clamp(tp_phys, min=0.0)
    return out


def _spatial_grad(field: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
    """Compute strictly local 1-hop central finite differences (df/dx east-west, df/dy south-north)."""
    padded = torch.nn.functional.pad(field, (1, 1, 1, 1), mode="replicate")
    df_dx = 0.5 * (padded[..., 1:-1, 2:] - padded[..., 1:-1, :-2])
    df_dy = 0.5 * (padded[..., 2:, 1:-1] - padded[..., :-2, 1:-1])
    return df_dx, df_dy


def build_step_features_torch(
    window_norm: torch.Tensor,
    clim_next_norm: torch.Tensor,
    static_norm: torch.Tensor,
    doy_sincos: torch.Tensor,
) -> torch.Tensor:
    """Assemble 32-channel local physics input tensor [B, 32, 32, 36] for VarshaTwinNet.

    Channels:
      0..17 (18): 3 days x 6 normalized state channels
      18..23 (6): anomaly relative to next day's seasonal climatology (last_norm - clim_next_norm)
      24..27 (4): physical advection/convergence/orographic tendencies (-u.grad(T), -u.grad(q), -div(u), u.grad(oro))
      28..29 (2): static geography (land_sea_mask, normalized orography_m)
      30..31 (2): day-of-year [sin, cos] broadcast
    """
    bsz = window_norm.shape[0]
    dyn_18 = window_norm.reshape(bsz, 3 * NC, NLAT, NLON)
    last = window_norm[:, -1]  # [B, 6, 32, 36]
    anom_6 = last - clim_next_norm

    t_norm = last[:, 0:1]
    u_norm = last[:, 2:3]
    v_norm = last[:, 3:4]
    q_norm = last[:, 5:6]
    oro = static_norm[1:2].unsqueeze(0).expand(bsz, -1, -1, -1)

    dt_dx, dt_dy = _spatial_grad(t_norm)
    dq_dx, dq_dy = _spatial_grad(q_norm)
    du_dx, _ = _spatial_grad(u_norm)
    _, dv_dy = _spatial_grad(v_norm)
    doro_dx, doro_dy = _spatial_grad(oro)

    adv_t = -(u_norm * dt_dx + v_norm * dt_dy)
    adv_q = -(u_norm * dq_dx + v_norm * dq_dy)
    conv_uv = -(du_dx + dv_dy)
    oro_lift = u_norm * doro_dx + v_norm * doro_dy
    phys_4 = torch.cat([adv_t, adv_q, conv_uv, oro_lift], dim=1)

    stat_2 = static_norm.unsqueeze(0).expand(bsz, -1, -1, -1)
    doy_2 = doy_sincos.view(bsz, 2, 1, 1).expand(bsz, 2, NLAT, NLON)

    return torch.cat([dyn_18, anom_6, phys_4, stat_2, doy_2], dim=1)


class ClimateRolloutDataset(Dataset):
    """Sliding-window dataset returning 3-day input windows and multi-step rollout targets."""

    def __init__(
        self,
        raw: dict[str, np.ndarray],
        climatology: np.ndarray,
        split: str = "train",
        rollout_steps: int = 4,
    ) -> None:
        super().__init__()
        self.data = raw["data"]
        self.doy_idx = raw["doy_idx"]
        self.doy_sincos = raw["doy_sincos"]
        self.climatology = climatology
        self.rollout_steps = rollout_steps

        years = raw["years"]
        max_t = len(self.data) - rollout_steps
        if split == "train":
            self.indices = [
                t for t in range(2, max_t)
                if years[t] <= TRAIN_END_YEAR and years[t + rollout_steps] <= TRAIN_END_YEAR
            ]
        elif split == "val":
            self.indices = [t for t in range(2, max_t) if years[t] > TRAIN_END_YEAR]
        else:
            self.indices = list(range(2, max_t))

    def __len__(self) -> int:
        return len(self.indices)

    def __getitem__(self, idx: int) -> dict[str, torch.Tensor]:
        t = self.indices[idx]
        h = self.rollout_steps
        init_st = torch.from_numpy(self.data[t - 2 : t + 1])                # [3, 6, 32, 36]
        target_st = torch.from_numpy(self.data[t + 1 : t + 1 + h])          # [h, 6, 32, 36]
        t_doy_idx = self.doy_idx[t + 1 : t + 1 + h]
        target_clim = torch.from_numpy(self.climatology[t_doy_idx])         # [h, 6, 32, 36]
        doy_sc = torch.from_numpy(self.doy_sincos[t : t + h])               # [h, 2]
        return {
            "init_states": init_st,
            "target_states": target_st,
            "target_clim": target_clim,
            "doy_sincos": doy_sc,
        }
