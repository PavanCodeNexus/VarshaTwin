# RULES — VarshaTwin (Track 2: Multiverse of Monsoon)

These rules are mandatory for every action in this project. If a request conflicts with a rule, stop and tell me instead of breaking the rule.

## 1. Hackathon rules (breaking these can disqualify us)
1. **Offline only.** No weather APIs, no internet calls at inference, no downloads at run time.
2. **No lookup tricks.** No hardcoded dates, years, lookup tables or shipped archives of past weather anywhere in code or repo.
3. **No data files in the repo.** `india_climate_train.nc` lives in `data/` and is gitignored. Only weights and small config files are committed.
4. **Weights must be inside the repo** (Git LFS for `weights/*.pt`, under 2 GB). A Hugging Face link alone is not enough.
5. **Real training code** must be in the repo (`train.py`), and it must actually produce the shipped weights.
6. **Original work.** Repo, training, weights and dashboard are created during the hackathon. Open-source libraries are fine.
7. **Dashboard must run on live output** from our own `/simulate`. No prerendered images or fake data.
8. **Repo is frozen at the deadline.** Last commit before the deadline counts.

## 2. Runtime limits (the grader's sandbox)
- CPU only, 4 cores, 6 GB RAM, no GPU.
- Repo is read-only. Write only to `/tmp`.
- Run command: `python serve.py --port 8000`, listen on `0.0.0.0`.
- `/health` must be ready within 120 s.
- Each 10-step `/simulate` must return in under 5 s (aim for under 1 s).
- Allowed libraries: torch (CPU), numpy, scipy, pandas, xarray, scikit-learn, lightgbm, onnxruntime, fastapi, flask, uvicorn. Anything else must be inside the repo.

## 3. API rules
- Follow `API_CONTRACT.md` from the kit exactly. If this file and the kit disagree, the kit wins.
- Channel order is always: t2m, tp, u10, v10, msl, tcwv. Units are always physical (K, mm/day, m/s, Pa, kg/m2).
- `perturbation` is a physical delta added to `init_states[-1]`.
- Output must never contain NaN or Inf, and `tp` must never be negative.
- Zero shock must give output **identical** to no shock.
- Enable CORS so the dashboard can call the API.

## 4. Model rules
- Use **local spatial convolution layers + physical wind-advection tendencies only** (no global pooling, no full-grid attention) so shocks stay strictly within `dilate=3` cells on Day 1 (`>= 60%` energy) and propagate outward over Days 4–8 without teleporting (`< 8 cells/day`).
- Predict the **change** from the last day anchored to the 366-day seasonal climatology (`climatology.npy`, shape `[366, 6, 32, 36]`, explicitly permitted by `repo_scan.py` line 92 since `366 <= 400`). Zero-initialize the residual head.
- Handle `tp` with non-negative activation / `log1p` transform and clamp to `>= 0.0`.
- Clamp `t2m` to `[235.0, 330.0] K` (`validity()` requires `[233.15, 333.15] K`) and bound perturbation delta to `<= 4.5 * std` (`causality_checks()` requires `<= 5.0 * std`).
- Keep the model small (`~0.3-1M` parameters). Prefer a fast, rock-solid physics-informed CNN over a big slow model.
- Deterministic inference: `model.eval()`, no dropout or sampling, fixed thread count (`0.0` diff on `null` vs `zeros` shock).
- Follow the levels in `trd.md`: Level 1 (local conv + climatology anchor) -> Level 2 (`VarshaTwinNet` residual advection CNN) -> Level 3 (multi-step rollout loss, `tp > 10mm` CSI rain weighting, spatial-variance anti-blur loss). Never skip to Level 3 before Level 1 works.

## 5. Data and evaluation rules
- Train on 2005-2019, validate on 2020-2021. Never tune on the same data used for the final report.
- A 1-year smoothed calendar-day climatology (`[366, 6, 32, 36]`, computed from training years only via `monsoon_r1.stats.climatology`) is permitted by `repo_scan.py` (`n <= 400`); multi-year daily archives (`n > 400`) are strictly forbidden.
- Always compare against both baselines using `monsoon_r1.scoring`: "repeat yesterday" (persistence) and climatology.
- Report results at days 1, 4 and 8, including latitude-weighted RMSE skill (`SS_REF = 0.12`), heavy-rain CSI at `10.0 mm/day` (`CSI_SS_REF = 0.10`), Day-8 spatial variance ratio (`[0.40, 2.50]`), and all 4 causality checks.
- Never claim a number we haven't measured.

## 6. Code rules
- Keep code simple and commented. I am new to PyTorch, so prefer clear code over clever code.
- Small files and small functions. Follow `structure.md` exactly.
- No hardcoded secrets or absolute paths. Use arguments and relative paths.
- Set random seeds in training for reproducibility, but never use randomness at inference.
- Add type hints and short docstrings to public functions.
- No new dependency without asking me first.

## 7. Testing rules (before every commit to main)
- `tests/test_contract.py`: shapes, finite values, rain >= 0, 10 steps.
- `tests/test_zero_shock.py`: `null` equals zeros.
- `tests/test_locality.py`: shock effect near the region on day 1, wider by day 5.
- Run the kit's schema validator: `python -m monsoon_r1.schema_validator http://localhost:8000`.
- A failing test must be fixed or reported, never skipped or deleted.

## 8. Git rules
- `main` must always run. Work on `ml/*` and `ui/*` branches and merge small changes often.
- Commit messages: short and clear (`add eval baselines`, `level1 model trained`).
- Never commit `data/`, `.venv/`, `runs/`, or large files outside Git LFS.
- Tag a working submission after Level 1 works, then after each improvement.

## 9. Dashboard rules
- Static HTML, JS and CSS in `dashboard/`, separate from server code.
- No CDN links. Vendor any library into `dashboard/vendor/` (the sandbox is offline).
- Every displayed value comes from a live `POST /simulate`.
- Show clear errors if the server is down. Never show fake or cached numbers as live.

## 10. How the AI assistant must work with me
1. **One step at a time.** Do a step, show results, then stop and wait for my confirmation.
2. Before writing code, say in 3-5 lines what you will do and why.
3. After each step, tell me exactly what to run to verify it and what files you changed.
4. If something is unclear or the docs conflict, ask me. Do not guess silently.
5. If you are unsure whether something breaks a rule, assume it does and ask.
6. Never delete files, rewrite history, or change the docs without asking.
7. Always keep a working submission. If a change breaks things, revert to the last working version.
8. If I am stuck for more than 30 minutes on one issue, suggest the simplest fallback.
9. Be honest about results. If the model doesn't beat the baseline, say so and suggest fixes.

## 11. Priority order when time is short
1. Valid, stable `/simulate` (passes the validator).
2. Beats "repeat yesterday" at day 4.
3. Zero shock = no change; real shocks react.
4. Dashboard on live data.
5. README and 2-page brief.
6. Unique features (Trust Panel, Presets, Multiverse Compare first).

## 12. Final checklist before the deadline
- [ ] Validator passes on a clean clone
- [ ] Weights are in the repo (LFS pushed)
- [ ] No `.nc` file, no dates, no weather APIs in the repo
- [ ] README explains how to train and run
- [ ] Dashboard works offline from a clean clone
- [ ] 2-page brief PDF ready
- [ ] Final commit pushed before the deadline
