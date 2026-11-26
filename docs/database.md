# Database / Data Model

**No traditional database is used.** The sandbox is offline, the repo is read-only (only `/tmp` is writable), and the grader sends all inputs per request. Data lives in files and in memory.

## 1. Source dataset (Confirmed from `yug-monsoon-kit`)
| Item | Value |
|---|---|
| File | `data/india_climate_train.nc` (NOT committed; gitignored) |
| Period | `2005-01-01` to `2021-12-31`, daily (`6,209` days) |
| Grid | `32 x 36` (`1° x 1°`), `LAT = 6.5°N .. 37.5°N`, `LON = 65.5°E .. 100.5°E` |
| Dynamic channels (order) | `0: t2m` (K), `1: tp` (mm/day), `2: u10` (m/s), `3: v10` (m/s), `4: msl` (Pa), `5: tcwv` (kg/m²) |
| Static channels (`static` var) | `0: land_sea_mask` (`0..1`), `1: orography_m` (meters, `geopotential / 9.80665`) |
| Stats | `data/stats.json` (mean/std per channel, bundled inside `weights/twin.pt`) |

## 2. Tensors
| Name | Shape | Notes |
|---|---|---|
| `X_window` | `[3, 6, 32, 36]` | last 3 consecutive days, oldest first, physical units |
| `static` | `[2, 32, 36]` | `land_sea_mask`, `orography_m` bundled in `weights/static_fields.npz` |
| `climatology` | `[366, 6, 32, 36]` | 15-day smoothed calendar-day climatology (`n=366 <= 400`, explicitly permitted by `repo_scan.py` line 92) |
| `doy_sincos` | `[2]` | `[sin(2*pi*doy/365), cos(2*pi*doy/365)]` for the last input day (`init_states[-1]`) |
| `perturbation` | `[6, 32, 36]` or `null` | physical delta added to `init_states[-1]` |
| `rollout` | `[steps, 6, 32, 36]` | physical units (`steps=10` for evaluation) |
| Model input | `[32, 32, 36]` | 18 dynamic + 6 clim anomaly + 4 physical advection/convergence/orographic tendencies + 2 static + 2 doy |
| Model output | `[6, 32, 36]` | normalized residual delta + climatology relaxation |

## 3. Splits
| Split | Years | Use |
|---|---|---|
| Train | `2005-2019` | fit `VarshaTwinNet` weights & compute training climatology |
| Validation | `2020-2021` | evaluate exact `monsoon_r1.scoring` metrics (Days 1, 4, 8 RMSE skill, `tp > 10mm` CSI skill, Day-8 variance ratio, causality) |
| Final Checkpoint | `2005-2021` | optional full-archive fine-tune after hyperparameters are locked on 2020-2021 |

Windows are built by sliding over time; day-of-year is computed from the time coordinate inside `data.py` only during training (zero hardcoded dates in inference code).

## 4. Files
| File | Content |
|---|---|
| `weights/twin.pt` | `state_dict` + normalization stats + architecture config |
| `weights/static_fields.npz` | `land_sea_mask [32,36]`, `orography_m [32,36]`, `climatology [366,6,32,36]` |
| `dashboard/presets.json` | scenario presets + 3 sample validation 3-day windows (`monsoon_onset`, `cyclone_bay`, `heatwave_may`) for instant live dashboard testing |
| `runs/` (gitignored) | training logs and evaluation scorecards |

## 4a. Official Grader Shock Boxes (`monsoon_r1/contract.py` & `scoring.py`)
```json
[
  {
    "id": "warm_ocean",
    "name": "Grader Shock 1: Warm Bay of Bengal (+3K, +15% Moisture)",
    "region": {"lat_min": 8.0, "lat_max": 20.0, "lon_min": 82.0, "lon_max": 94.0},
    "effects": [{"channel": "t2m", "mode": "add", "value": 3.0}, {"channel": "tcwv", "mode": "mul_delta", "value": 0.15}]
  },
  {
    "id": "monsoon_stall",
    "name": "Grader Shock 2: Arabian Sea Monsoon Stall (-40% Wind)",
    "region": {"lat_min": 8.0, "lat_max": 20.0, "lon_min": 65.0, "lon_max": 75.0},
    "effects": [{"channel": "u10", "mode": "mul_delta", "value": -0.40}, {"channel": "v10", "mode": "mul_delta", "value": -0.40}]
  }
]
```

## 5. Runtime state
- In-memory only: loaded model, stats, static fields.
- Optional LRU cache of recent `/simulate` results in memory. Never write to disk outside `/tmp`.
