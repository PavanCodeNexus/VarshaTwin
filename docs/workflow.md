# Workflow — Step-by-Step Build Plan

Rule: finish a step, verify it, commit, then move on. After every step the repo must still run.

| Step | Task | Done when | Owner |
|---|---|---|---|
| 0 | Read all docs, kit, API_CONTRACT.md | Summary + open items listed | Both |
| 1 | Repo skeleton, load data, `eval.py` baselines | Baseline table printed (repeat yesterday, climatology) | A |
| 2 | Run starter `serve.py` + validator | Validator passes with placeholder | B |
| 3 | `data.py`: normalization, windows, train/val split | Batch shapes correct, no NaN | A |
| 4 | **Level 1** model (single 5x5 conv), `train.py` | Weights saved, loss goes down | A |
| 5 | `infer.py` + `rollout.py` + guards; plug into `serve.py` | Validator passes with real model, **commit and tag v1** | A+B |
| 6 | Evaluate Level 1 vs baselines (days 1, 4, 8) | Table in README | A |
| 7 | **Level 2** residual CNN | Beats Level 1 on validation | A |
| 8 | **Level 3**: multi-step loss, rain weight, anti-blur | Stable 10+ steps, blur ratio checked | A |
| 9 | Tests: contract, zero shock, locality | All pass | B |
| 10 | Dashboard v1: map, day slider, shock sliders (live API) | Works from clean clone, offline | B |
| 11 | Impact module + Trust Panel + Presets | Live from `/simulate` | B |
| 12 | Multiverse Compare, Narrator, Ensemble Fog | Demo-ready | B |
| 13 | Final training run, pick best checkpoint | Weights pushed via LFS | A |
| 14 | README, brief PDF, demo rehearsal x3 | See brief.md and demo.md | Both |
| 15 | Freeze: final checklist from rules.md | Pushed before deadline | Both |

## Sleep and buffer
- Plan a 2-3 hour nap in the middle (while a training run is going).
- Hours 21-24: no new features, only fixes, README, brief, rehearsal.

## Fallback rule
If a step takes more than 90 minutes, go back to the last tagged working version and use the simpler option:
- Level 2/3 not working -> ship Level 1.
- Fancy dashboard feature not working -> ship the basic map with Trust Panel.
