"""Data loading, normalization, 366-day training climatology, and sliding windows for VarshaTwin."""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
import pandas as pd
import xarray as xr

CHANNELS = ("t2m", "tp", "u10", "v10", "msl", "tcwv")
NC, NLAT, NLON = 6, 32, 36
LAT = np.arange(6.5, 37.5 + 1e-9, 1.0, dtype=np.float32)
LON = np.arange(65.5, 100.5 + 1e-9, 1.0, dtype=np.float32)
# Cumulative days per month in a 366-day leap calendar (matches monsoon_r1.stats._doy_index 0..365)
_LEAP_CUM_DAYS = np.array([0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335], dtype=np.int32)
TRAIN_END_YEAR = 1999 + 20  # 2019 inclusive (2005-2019 train, 2020-2021 validation)


def doy_index_from_month_day(months: np.ndarray, days: np.ndarray) -> np.ndarray:
    """Map calendar (month 1..12, day 1..31) to 0..365 index where Feb 29 has slot 59."""
    return _LEAP_CUM_DAYS[months - 1] + (days - 1)


def doy_sincos_from_doy(doy: np.ndarray | int | float) -> np.ndarray:
    """Compute [sin(2*pi*doy/365), cos(2*pi*doy/365)] matching monsoon_r1.contract.doy_sincos."""
    angle = 2.0 * np.pi * np.asarray(doy, dtype=np.float32) / 365.0
    return np.stack([np.sin(angle), np.cos(angle)], axis=-1).astype(np.float32)


def sincos_to_doy_index(sin_val: float, cos_val: float) -> int:
    """Recover 0..365 climatology slot from doy_sincos [sin, cos] sent on the wire."""
    angle = float(np.arctan2(sin_val, cos_val))
    if angle < 0.0:
        angle += 2.0 * np.pi
    doy_365 = angle * 365.0 / (2.0 * np.pi)
    # Map 1..365 continuous day-of-year onto 0..365 leap-calendar slot
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
    # Fill any empty slot (if any) from neighbors before circular smoothing
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
    ds = xr.open_dataset(nc_path)
    data = np.asarray(ds["data"].values, dtype=np.float32)
    data[:, 1] = np.maximum(data[:, 1], 0.0)  # Physical precipitation is never negative
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
