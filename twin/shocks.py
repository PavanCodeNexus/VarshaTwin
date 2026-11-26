"""Shock presets and custom counterfactual perturbation builders for VarshaTwin.

Matches the exact region boxes and grader shock definitions in monsoon_r1/contract.py and scoring.py,
plus extended What-If climate scenarios (El Nino SST, Monsoon Delay, Cyclogenesis, Heat Dome).
"""
from __future__ import annotations
import numpy as np
from twin.data import CHANNELS, LAT, LON, NC, NLAT, NLON

BOX_BAY_OF_BENGAL = (8.0, 20.0, 82.0, 94.0)
BOX_ARABIAN_SEA = (8.0, 20.0, 65.0, 75.0)
BOX_INDO_GANGETIC = (22.0, 31.0, 73.0, 88.0)


def box_mask(box: tuple[float, float, float, float]) -> np.ndarray:
    """Boolean mask [32, 36] for (lat_min, lat_max, lon_min, lon_max) in degrees."""
    la0, la1, lo0, lo1 = box
    return ((LAT >= la0) & (LAT <= la1))[:, None] & ((LON >= lo0) & (LON <= lo1))[None, :]


def make_shock(name: str, last_state: np.ndarray) -> np.ndarray:
    """Build physical perturbation delta [6, 32, 36] added to init_states[-1]."""
    d = np.zeros((NC, NLAT, NLON), dtype=np.float32)
    if name == "warm_ocean":
        # Official Grader Shock 1: +3.0 K t2m and +15% tcwv over Bay of Bengal
        m = box_mask(BOX_BAY_OF_BENGAL)
        d[0][m] = 3.0
        d[5][m] = 0.15 * last_state[5][m]
    elif name == "monsoon_stall":
        # Official Grader Shock 2: -40% of u10 and v10 over Arabian Sea
        m = box_mask(BOX_ARABIAN_SEA)
        d[2][m] = -0.40 * last_state[2][m]
        d[3][m] = -0.40 * last_state[3][m]
    elif name == "el_nino_sst":
        # What-If: Warm sea anomaly (+2.5 K) + reduced Arabian Sea moisture inflow (-20% tcwv, -25% u10)
        m_bob = box_mask(BOX_BAY_OF_BENGAL)
        m_as = box_mask(BOX_ARABIAN_SEA)
        d[0][m_bob | m_as] = 2.5
        d[5][m_as] = -0.20 * last_state[5][m_as]
        d[2][m_as] = -0.25 * last_state[2][m_as]
    elif name == "cyclone_depression":
        # What-If: Bay of Bengal deep depression (-900 Pa msl, +2.5 K, +25% moisture)
        m = box_mask((10.0, 18.0, 84.0, 92.0))
        d[0][m] = 2.5
        d[4][m] = -900.0
        d[5][m] = 0.25 * last_state[5][m]
    elif name == "heat_dome":
        # What-If: Indo-Gangetic Plains +4.5 K heat dome & -15% moisture
        m = box_mask(BOX_INDO_GANGETIC)
        d[0][m] = 4.5
        d[5][m] = -0.15 * last_state[5][m]
    elif name != "null":
        raise ValueError(f"Unknown shock preset: {name}")
    return d


def build_box_shock(
    lat_min: float,
    lat_max: float,
    lon_min: float,
    lon_max: float,
    channel: str | int,
    delta_val: float,
    last_state: np.ndarray | None = None,
    relative: bool = False,
) -> np.ndarray:
    """Build custom rectangular perturbation [6, 32, 36] for Shock Studio interactive controls."""
    c_idx = CHANNELS.index(channel) if isinstance(channel, str) else int(channel)
    d = np.zeros((NC, NLAT, NLON), dtype=np.float32)
    m = box_mask((lat_min, lat_max, lon_min, lon_max))
    if relative:
        if last_state is None:
            raise ValueError("last_state is required when relative=True")
        d[c_idx][m] = float(delta_val) * last_state[c_idx][m]
    else:
        d[c_idx][m] = float(delta_val)
    return d
