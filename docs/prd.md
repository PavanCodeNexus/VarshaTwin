# PRD — VarshaTwin (Track 2: Multiverse of Monsoon)

## 1. One-liner
A fast, physics-aware **Climate Digital Twin of India**: give it the last 3 days of weather, it rolls forward day by day (Timeline Prime), and it can branch into **alternate universes** when a local shock is applied (hotter Bay of Bengal, weaker monsoon wind).

## 2. Goal
- Pass the automated grader (Top 10 per track), then impress at the live desk review (Top 2).
- Score = Forecast skill 45 + Dynamics 25 + Repo check 15 + Brief 15.

## 3. Users
| User | Need |
|---|---|
| Automated grader | Valid, stable, fast `/simulate` responses passing all 8 hidden requests + `repo_scan.py` (15/15) |
| Desk-review judge | Live demo, new shock applied on the spot via Shock Studio, clear physics-anchored model explanation |
| National Disaster & Agro-Grid Planner (Option C Persona) | Multi-hazard counterfactual intelligence: Flood/Cyclone Surge, Heatwave Wet-Bulb Stress, and Kharif Crop Moisture Deficit + actionable Policy Co-Pilot advisories |

## 4. Must-pass gates (qualification — confirmed from `monsoon_r1/scoring.py`)
1. **Validity gate on all 8 requests:** shape `(10, 6, 32, 36)`, finite floats, `tp >= -1e-6`, `t2m` within `[233.15, 333.15] K` (`[-40, +60]°C`), response `< 5.0 s`.
2. **Beat "repeat yesterday" (persistence) at Day 4** on latitude-weighted RMSE.
3. **Non-zero localized response (`>= 60%` Day-1 energy within `dilate=3` cells)** to at least one shock, plus `null` consistency (`<= 1e-3 * std`).

## 5. In scope
- Training code, weights in repo (Git LFS ok, under 2 GB), `serve.py` at repo root.
- Dashboard (separate folder) running on **live** `/simulate` output.
- One impact module + unique features (see features.md).
- README and 2-page brief PDF.

## 6. Out of scope
- Weather APIs, internet at inference, shipped weather archives, hardcoded dates.
- GPU inference, large foundation models.

## 7. Hard constraints (from the rules)
- Offline sandbox: 6 GB RAM, 4 CPU cores, no GPU, repo read-only (write only to `/tmp`).
- `python serve.py --port 8000`, listen on `0.0.0.0`, `/health` ready within 120 s.
- Each 10-step answer in under 5 s.
- Repo, training, weights and dashboard must be created during the hackathon.
- Repo frozen at the deadline.

## 8. 24-hour plan (2 people)
| Hours | Person A (ML) | Person B (Server + Dashboard) |
|---|---|---|
| 0-2 | Install kit, load data, baselines (persistence, climatology) | Run starter `serve.py` + validator, create repo + LFS |
| 2-8 | Level 1 model (1 conv layer) -> first weights | Wire model into `/simulate`, CORS, `/health` |
| 8-14 | Level 2 CNN + rollout training | Dashboard map + shock sliders (live API) |
| 14-18 | Shock tests, blur/drift fixes | Impact module + multiverse compare view |
| 18-21 | Final training, pick best checkpoint | Trust panel, ensemble view, polish |
| 21-24 | README, brief page 1 | Brief page 2, demo rehearsal, freeze repo |

**Rule:** always keep a working submission. Commit a passing version after Level 1.

## 9. Risks and mitigations
| Risk | Mitigation |
|---|---|
| First time with PyTorch | Start with one conv layer; zero-init last layer so model starts = "repeat yesterday" |
| Rollouts blow up / blur | Multi-step training, clamping, spatial-std check |
| Fails to beat persistence at day 4 | Keep Level 1 as safe fallback; tune on 2020-21 validation |
| Time sink on dashboard | Canvas heatmap only, no fancy libraries |
| Repo-scan disqualification | No data files in repo, no dates in code, no weather APIs |

## 10. Definition of done
- [ ] Validator passes; 10-step request under 5 s locally
- [ ] Beats persistence at day 4 on 2020-21
- [ ] Zero shock gives identical output to no shock
- [ ] Dashboard works from a clean clone, offline
- [ ] README + 2-page PDF brief
