# VarshaTwin — Climate Digital Twin of India
Track 2: Multiverse of Monsoon · Team: [team name] · Members: [name 1], [name 2]

A small, convolution-only neural twin of India's daily weather. It rolls forward from 3 days of state and branches into alternate universes when a local shock is applied.

## Highlights
- Stable multi-step rollouts (no NaN/Inf, rain never negative)
- Shocks start local and spread outward; zero shock changes nothing
- Live dashboard: Shock Studio, Multiverse Compare, Trust Panel, Impact Pack
- Offline, CPU-only inference

## Results (Validation 2020–2021, 721 daily windows — `VarshaTwin-L3`)
| Lead Day | Channel | Repeat Yesterday RMSE | Climatology RMSE | Best Baseline | VarshaTwin-L3 RMSE | Skill (`SS`) |
|---|---|---|---|---|---|---|
| **Day 1** | `t2m` (K) | 1.0265 | 1.7582 | 1.0265 | **0.9278** | **`+9.61%`** |
| **Day 1** | `tp` (mm/day) | 6.3258 | 6.7814 | 6.3258 | **5.5602** | **`+12.10%`** |
| **Day 1** | `u10` (m/s) | 1.0905 | 1.6631 | 1.0905 | **0.9824** | **`+9.91%`** |
| **Day 1** | `v10` (m/s) | 1.1105 | 1.4603 | 1.1105 | **0.9445** | **`+14.95%`** |
| **Day 1** | `msl` (Pa) | 198.3688 | 282.0193 | 198.3688 | **172.9340** | **`+12.82%`** |
| **Day 1** | `tcwv` (kg/m²) | 3.7467 | 6.4711 | 3.7467 | **3.2930** | **`+12.11%`** |
| **Day 4** | `t2m` (K) | 1.9183 | 1.7591 | 1.7591 | **1.5759** | **`+10.41%`** |
| **Day 4** | `tp` (mm/day) | 9.2488 | 6.7742 | 6.7742 | **6.7435** | **`+0.45%`** |
| **Day 4** | `u10` (m/s) | 2.0166 | 1.6638 | 1.6638 | **1.5528** | **`+6.67%`** |
| **Day 4** | `v10` (m/s) | 1.9453 | 1.4597 | 1.4597 | **1.3891** | **`+4.84%`** |
| **Day 4** | `msl` (Pa) | 341.6328 | 281.4563 | 281.4563 | **261.5359** | **`+7.08%`** |
| **Day 4** | `tcwv` (kg/m²) | 7.5082 | 6.4707 | 6.4707 | **5.8606** | **`+9.43%`** |
| **Day 8** | `t2m` (K) | 2.2484 | 1.7585 | 1.7585 | **1.7358** | **`+1.29%`** |
| **Day 8** | `tp` (mm/day) | 9.3623 | 6.7720 | 6.7720 | **6.7878** | `-0.23%` |
| **Day 8** | `u10` (m/s) | 2.2265 | 1.6640 | 1.6640 | **1.6641** | `0.00%` |
| **Day 8** | `v10` (m/s) | 1.9897 | 1.4580 | 1.4580 | **1.4592** | `-0.08%` |
| **Day 8** | `msl` (Pa) | 378.9117 | 281.4127 | 281.4127 | **280.7948** | **`+0.22%`** |
| **Day 8** | `tcwv` (kg/m²) | 8.3519 | 6.4747 | 6.4747 | **6.4835** | `-0.14%` |

### Heavy-Rain CSI (`tp > 10.0 mm/day`), Anti-Blur & Perturbation Causality
| Metric | Repeat Yesterday | Climatology | Best Baseline | VarshaTwin-L3 | Score / Status |
|---|---|---|---|---|---|
| **Day 1 Heavy-Rain CSI** | `0.4290` | `0.2673` | `0.4290` | **`0.4522`** | **`+4.06%` CSI Skill** |
| **Day 4 Heavy-Rain CSI** | `0.2176` | `0.2676` | `0.2676` | **`0.2914`** | **`+3.25%` CSI Skill** |
| **Day 8 Heavy-Rain CSI** | `0.2033` | `0.2678` | `0.2678` | **`0.2842`** | **`+2.24%` CSI Skill** |
| **Day-8 Spatial Variance Ratio** | `1.01..2.66` | `0.55..1.02` | `[0.40, 2.50]` | **`0.59..1.02`** (all 6 ch) | **`10.00 / 10.00 pts`** |
| **Perturbation Causality** | — | — | 4 checks × 2 shocks + null | **`100% Pass`** (`near_day1=1.0, far=0.0`) | **`15.00 / 15.00 pts`** |

## Setup
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
git lfs install && git lfs pull
```

## Train
Place `india_climate_train.nc` in `data/` (not committed), then:
```bash
python train.py --data data/india_climate_train.nc
python eval.py --data data/india_climate_train.nc
```

## Run the server
```bash
python serve.py --port 8000
python -m monsoon_r1.schema_validator http://localhost:8000
```

## Run the dashboard
Open `dashboard/index.html` in a browser (server must be running on port 8000).

## Repository layout
See `docs/structure.md`.

## Rules we followed
No weather APIs, no hardcoded dates, no data files in the repo, offline CPU inference, weights included.

## Declared libraries and models
PyTorch (CPU), numpy, xarray, pandas, fastapi, uvicorn. Model: TwinNet (residual CNN, trained from scratch during the hackathon).

## Known limitations
[Fill from the brief: cyclones, extreme rain at long lead, shocks beyond training range]
