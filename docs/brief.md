# 2-Page Brief — Outline (export to PDF, max 2 pages)

Page 1 and 2 are read by a person and worth 15 points. Use real numbers from `eval.py`.

## Header
Team name, project name (VarshaTwin), GitHub repo link.

## Page 1 — Model design
1. **USP (2-3 lines):** what makes our twin different (local-by-design model, live Shock Studio, Trust Panel).
2. **Architecture:** small diagram of TwinNet (inputs 22 channels -> residual blocks -> delta). Say why convolution-only: shocks stay local first.
3. **Training:** data split (train 2005-2019, validate 2020-21), multi-step rollout loss, rain weighting, anti-blur loss.
4. **How we prevent drift:** residual prediction, zero-init head, clamping, multi-step training.
5. **How we prevent blur:** gradient loss, spatial-std check (give the ratio).
6. **Results table:** day 1 / 4 / 8 vs "repeat yesterday" and climatology (RMSE + heavy-rain hits).
7. **Failure modes (be honest):** e.g. cyclones, rain extremes at long lead, boundary regions, shocks outside training range.

## Page 2 — Visualization and impact
1. **Dashboard screenshots:** Prime vs Alternate universe, difference map.
2. **Live coupling:** state clearly that every number comes from `/simulate`.
3. **Impact use case:** e.g. heatwave / heavy-rain risk and crop-stress proxy; who uses it and how.
4. **Unique features:** Shock Studio, Multiverse Compare, Trust Panel, Ensemble Fog, Auto-Narrator.
5. **Limits and next steps:** what the twin cannot do, what we'd add with more time.

## Rules
- No claims we haven't measured.
- Mention no hardcoded dates, no weather APIs, offline CPU inference.
