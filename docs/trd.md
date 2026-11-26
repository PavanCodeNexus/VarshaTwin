# TRD — Technical Requirements

## 1. Stack
| Layer | Choice | Why |
|---|---|---|
| Language | Python 3 | Allowed libs available |
| ML | PyTorch (CPU) | Allowed; small CNN |
| Data | numpy, xarray, pandas | Allowed |
| Server | FastAPI + uvicorn | Allowed, simple, fast |
| Dashboard | Vanilla HTML/JS + Canvas | Works offline, no build step |
| Extras | scikit-learn, lightgbm, onnxruntime available | Optional |

Anything not in the allowed list must be inside the repo.

## 2. API (plain nested JSON lists, physical units)
- `POST /health` -> `{"status":"ready","model_name":"..."}`
- `POST /simulate`
  - in: `init_states [3,6,32,36]`, `doy_sincos [2]`, `steps`, `perturbation [6,32,36] | null`
  - out: `rollout [steps,6,32,36]`, `inference_ms`
- Channel order: t2m, tp, u10, v10, msl, tcwv.
- Day-of-year for step k: rotate the (sin, cos) angle by `2*pi/365.25` per day.
- Enable CORS so the dashboard can call the server.
- Read API_CONTRACT.md from the kit as the final authority.

## 3. Model requirements
- Residual CNN (see architecture.md): about 0.3-1M parameters, 64 channels, 4 blocks.
- tp handled in log1p space; output clamped to >= 0.
- Deterministic: `model.eval()`, no dropout/sampling, fixed thread count.

## 4. Training spec
| Item | Setting |
|---|---|
| Optimizer | AdamW, lr 1e-3, cosine decay, weight decay 1e-4 |
| Batch | 16-32 |
| Epochs | 20-50, early stop on validation day-4 error |
| Rollout loss | start at 1 step, grow to 4, then 8 steps (curriculum) |
| Loss | MSE on normalized variables + extra weight on rain + small gradient loss |
| Compute | CPU laptop ok; free Kaggle/Colab GPU optional for training only |

**Levels (so you can always submit):**
1. **Level 1:** a single 5x5 conv layer (linear local model) -> gets you into PyTorch and gives a safe submission.
2. **Level 2:** the residual CNN, 1-step training.
3. **Level 3:** multi-step rollout loss + rain weighting + anti-blur loss.

## 5. Evaluation protocol (`eval.py` — Exact `monsoon_r1/scoring.py` mirror)
- **Baselines:** repeat yesterday (persistence) and 366-day smoothed climatology (`stats.py`: 15-day circular running mean).
- **Latitude-weighted RMSE Skill (30 pts):**
  - Evaluated at lead days **1, 4, and 8** across all 6 channels using `w = cos(deg2rad(LAT)) / mean(cos(deg2rad(LAT)))`.
  - Skill score `SS = 1 - RMSE_model / min(RMSE_persist, RMSE_clim)`.
  - Full 30 points earned at mean `SS >= 0.12` (`SS_REF = 0.12`).
- **Heavy-Rain CSI Skill (15 pts):**
  - Threshold: **`RAIN_THRESH = 10.0` mm/day** at lead days **1, 4, and 8**.
  - `CSI = hits / (hits + misses + false_alarms)`.
  - `CSI_skill = (CSI_model - max(CSI_persist, CSI_clim)) / (1 - max(CSI_persist, CSI_clim))`.
  - Full 15 points earned at mean `CSI_skill >= 0.10` (`CSI_SS_REF = 0.10`).
- **Anti-Blur Check (10 pts):**
  - Ratio of predicted to real spatial variance at **Day 8** per channel (`BLUR_MIN_RATIO = 0.40`, `BLUR_MAX_RATIO = 2.50`). Any ratio in `[0.40, 2.50]` earns full 10/10 points!
- **Perturbation Causality Check (15 pts):**
  - Tested on `warm_ocean` (`+3K t2m, +15% tcwv` in Bay of Bengal `lat 8..20, lon 82..94`) and `monsoon_stall` (`-40% u10, -40% v10` in Arabian Sea `lat 8..20, lon 65..75`) + `null` shock:
    1. `null_consistent`: `max(|a - b| / std) <= 1e-3`
    2. `nonzero`: `max(|shock - base| / std) >= 1e-3`
    3. `localized`: Day-1 energy inside `near_mask(box, dilate=3)` `>= 60%` (`LOCAL_MIN_FRAC = 0.60`)
    4. `propagates`: Mean outside energy at Days 4–8 `> 1.5 * Day-1 outside energy` AND `> 2%` of peak total energy, with `< 5%` energy beyond `dist > 3 + 8*(k+1)` cells (`no_teleport`)
    5. `stable`: `max(|shock - base| / std) <= 5.0` (`STABLE_MAX_STD = 5.0`)
- **Repo Integrity Scan (15 pts):**
  - Verified directly with `python -c "from monsoon_r1.repo_scan import scan; print(scan('.'))"`: 8 pts anti-cheat + 7 pts code health (`3.0` training pipeline + `2.0` server separate from UI + `1.0` frontend present + `0.5` README + `0.5` checkpoint).

## 6. Tests (must pass before every push to main)
| Test | Check |
|---|---|
| `test_contract.py` | shapes `(10, 6, 32, 36)`, finite values, `tp >= 0`, `t2m` in `[233.15, 333.15] K`, accepts both list and `b64` inputs |
| `test_zero_shock.py` | output with `null` equals output with zeros (`max_diff == 0.0 <= 1e-3 * std`) |
| `test_locality.py` | runs `monsoon_r1.scoring.causality_checks` on `warm_ocean` and `monsoon_stall` and asserts all 15/15 pts |
| `test_repo_scan.py` | runs `monsoon_r1.repo_scan.scan('.')` and asserts `15.0 / 15.0` points with 0 flags |
| `schema_validator` | `python -m monsoon_r1.schema_validator http://localhost:8000` passes in `< 1 s` per call |

## 6a. Performance budget
- Model load under 10 s, `/simulate` 10 steps under 0.5 s target on CPU, memory under 1 GB.

## 7. Repo-scan compliance checklist
- [ ] No weather APIs, no network calls, no `imdlib`/`cdsapi`/`open-meteo` strings in inference modules
- [ ] No hardcoded dates (`YYYY-MM-DD`) or `date()`/`datetime()` calls in inference files
- [ ] No raw `.nc` data files or multi-year archives (`n > 400`) committed (note: 366-day `climatology.npy` has `n = 366 <= 400` and is explicitly allowed by `repo_scan.py` line 92!)
- [ ] Real training code present (`train.py` with `.backward()` and `optimizer.step()`, not imported by `serve.py`)
- [ ] No UI imports (`matplotlib`, `plotly`, `streamlit`) inside `serve.py` or modules imported by `serve.py`
- [ ] Weights in repo (`weights/twin.pt` > 1 KB)

## 8. Setup commands
```bash
git init && git lfs install && git lfs track "weights/*.pt"
python -m venv .venv && source .venv/bin/activate
pip install torch numpy xarray netcdf4 pandas fastapi uvicorn requests
python train.py --data data/india_climate_train.nc
python serve.py --port 8000
python -m monsoon_r1.schema_validator http://localhost:8000
```

## 9. Brief (2 pages)
- Page 1: VarshaTwinNet Physics-Anchored Residual Advection-CNN design, how drift/blur/teleportation are prevented, validation table vs persistence & climatology, honest failure modes.
- Page 2: Disaster Multiverse Command Center screenshots, 3-hazard impact engine (Flood/Cyclone, Heatwave Wet-Bulb, Kharif Agro-Moisture Stress) + Policy Co-Pilot.

## 10. Confirmed Kit Specifications (Resolved from `yug-monsoon-kit`)
- **Heavy-rain threshold:** `10.0 mm/day` (CSI metric at Days 1, 4, 8; `CSI_SS_REF = 0.10`).
- **Exact lat/lon grid:** `32 x 36` (`1° x 1°`), `LAT = 6.5°N .. 37.5°N`, `LON = 65.5°E .. 100.5°E`.
- **Wire formats:** Nested JSON lists (canonical) and `{"b64": ..., "shape": [...]}` (both tested by `schema_validator.py`).
