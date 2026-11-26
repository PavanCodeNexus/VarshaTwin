# VarshaTwin — Climate Digital Twin of India
Track 2: Multiverse of Monsoon · Team: [team name] · Members: [name 1], [name 2]

A small, convolution-only neural twin of India's daily weather. It rolls forward from 3 days of state and branches into alternate universes when a local shock is applied.

## Highlights
- Stable multi-step rollouts (no NaN/Inf, rain never negative)
- Shocks start local and spread outward; zero shock changes nothing
- Live dashboard: Shock Studio, Multiverse Compare, Trust Panel, Impact Pack
- Offline, CPU-only inference

## Results (validation 2020-2021)
| Day | Metric | Repeat yesterday | Climatology | VarshaTwin |
|---|---|---|---|---|
| 1 | RMSE | [ ] | [ ] | [ ] |
| 4 | RMSE | [ ] | [ ] | [ ] |
| 8 | RMSE | [ ] | [ ] | [ ] |
| 4 | Heavy-rain hit rate | [ ] | [ ] | [ ] |

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
