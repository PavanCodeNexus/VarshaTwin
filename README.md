# VarshaTwin — Climate Digital Twin of India
Track 2: Multiverse of Monsoon · Team: [team name] · Members: [name 1], [name 2]

A small, convolution-only neural twin of India's daily weather. It rolls forward from 3 days of state and branches into alternate universes when a local shock is applied.

## Highlights
- Stable multi-step rollouts (no NaN/Inf, rain never negative)
- Shocks start local and spread outward; zero shock changes nothing
- Live dashboard: Shock Studio, Multiverse Compare, Trust Panel, Impact Pack
- Offline, CPU-only inference

## Results (Validation 2020–2021, 721 daily windows)
| Lead Day | Metric | Repeat Yesterday | Climatology (2005–2019) | VarshaTwin |
|---|---|---|---|---|
| Day 1 | Mean Lat-Weighted RMSE (`t2m` K / `tp` mm / `u10` / `v10` / `msl` Pa / `tcwv`) | `1.03 / 6.33 / 1.09 / 1.11 / 198.4 / 3.75` | `1.76 / 6.78 / 1.66 / 1.46 / 282.0 / 6.47` | *[Step 4]* |
| Day 4 | Mean Lat-Weighted RMSE (`t2m` K / `tp` mm / `u10` / `v10` / `msl` Pa / `tcwv`) | `1.92 / 9.25 / 2.02 / 1.95 / 341.6 / 7.51` | `1.76 / 6.77 / 1.66 / 1.46 / 281.5 / 6.47` | *[Step 4]* |
| Day 8 | Mean Lat-Weighted RMSE (`t2m` K / `tp` mm / `u10` / `v10` / `msl` Pa / `tcwv`) | `2.25 / 9.36 / 2.23 / 1.99 / 378.9 / 8.35` | `1.76 / 6.77 / 1.66 / 1.46 / 281.4 / 6.47` | *[Step 4]* |
| Day 1 / 4 / 8 | Heavy-Rain CSI (`tp > 10.0 mm/day`) | `0.4290 / 0.2176 / 0.2033` | `0.2673 / 0.2676 / 0.2678` | *[Step 4]* |

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
