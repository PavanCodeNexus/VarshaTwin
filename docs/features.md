# Features

## Must have (needed to qualify)
| # | Feature | Acceptance criteria |
|---|---|---|
| M1 | `/health` + `/simulate` API | Matches API_CONTRACT.md; validator passes |
| M2 | Stable 10+ step rollout | No NaN/Inf, rain >= 0, 10 steps under 5 s |
| M3 | Beats "repeat yesterday" at day 4 | Lower error on 2020-21 validation |
| M4 | Shock response | Non-zero shock changes output; zero shock changes nothing |
| M5 | Live map dashboard | Calls `/simulate`, shows variables and day slider |
| M6 | README + 2-page brief | Train/run steps, drift/blur/failure modes, impact page |

## Should have (scoring boosters)
| # | Feature | Acceptance criteria |
|---|---|---|
| S1 | Heavy-rain skill | Rain-weighted loss; heavy-rain hit rate above baselines |
| S2 | Anti-blur | Predicted spatial std at day 8 close to real std |
| S3 | Locality | Most of the shock effect stays near the box on day 1, wider by day 5 |
| S4 | Impact module | One live risk map (heatwave or heavy rain) from your own rollout |

## Unique features (Merged Claude + Option C: "Disaster Multiverse Command Center")
| # | Feature | What it does | Effort |
|---|---|---|---|
| U1 | **Interactive Shock Studio** | Draw any custom lat/lon box on India (`6.5°N–37.5°N, 65.5°E–100.5°E`), pick channels (`t2m, tp, u10, v10, msl, tcwv`) & strength, or trigger exact grader shocks (`warm_ocean`, `monsoon_stall`, `null`) live | Medium |
| U2 | **Multiverse Split-Screen & Ripple Wavefront** | Side-by-side Timeline Prime vs. Branched Multiverse + Dynamic Delta Map ($\Delta = \text{Shock} - \text{Prime}$) with overlaid wind vectors `(u10, v10)` and a live **Wavefront Propagation Chart** (energy inside vs. outside the 3-cell dilated shock zone over Days 1–10) | Medium |
| U3 | **Live Grader Trust & Causality Panel** | Executes the exact `monsoon_r1.scoring` checks live in the UI: `No NaN/Inf`, `Rain >= 0`, `t2m in [-40, 60]°C`, `Zero-Shock == 0.0`, `Day-1 Locality >= 60%`, `Days 4-8 Outward Propagation > 1.5x`, `No Teleport (< 5%)`, `Stable (<= 5 std)` | Easy |
| U4 | **3-Hazard Disaster Command Center (Option C)** | **Tab 1: Flood & Cyclone Surge Risk** (`tp > 10 mm/day` CSI hotspots + low `msl` depression tracking + coastal wind surge)<br>**Tab 2: Heatwave & Wet-Bulb Thermal Stress** (combines `t2m` + column moisture `tcwv` into a lethal Heat-Moisture Stress Index)<br>**Tab 3: Kharif Agro-Climatic Drought & Crop Stress** (10-day cumulative rainfall anomaly $\Delta \sum \text{tp}$ + vapor deficit across India's major agricultural zones) | Medium |
| U5 | **Deterministic Policy Co-Pilot & Auto-Narrator** | Follows the winning *"Data → Prediction → Simulation → Decision Support"* pipeline: rule-based, zero-LLM situational briefing & regional advisory generated from the live delta tensor | Easy |
| U6 | **Monte Carlo Ensemble & Uncertainty Studio** | Runs $N$ deterministic micro-perturbed `/simulate` rollouts live from the dashboard to map **Monte Carlo Uncertainty Spread ($\sigma$)** and **Heavy-Rain Exceedance Probability ($P(\text{tp} > 10\text{ mm/day})$)** (while keeping single `/simulate` calls 100% deterministic so `null_consistent` passes!) | Easy |
| U7 | **What-If Scenario Engine & Official Grader Presets** | Instant buttons for official grader shocks (`Warm Bay +3K/+15% tcwv`, `Arabian Sea Monsoon Stall -40% wind`, `Null Control`) PLUS climate what-ifs (`El Niño SST & Moisture Anomaly`, `Monsoon Onset Delay`, `Bay of Bengal Cyclogenesis -1200 Pa`, `Indo-Gangetic Heat Dome +4.5K`) | Easy |
| U8 | **2D + 3D Isometric Orographic Terrain & Plume View** | Pure offline HTML5 Canvas toggle between 2D grid map and an **Interactive 3D Isometric Terrain View** displaying India's `orography_m` (Himalayas & Western Ghats elevation) with floating rainfall plumes, shock ripples, and wind vectors | Medium |

**Build order for uniques:** U3 -> U7 -> U2 -> U4 -> U5 -> U8 -> U1 -> U6.
**Visual Design System (`ui-ux-pro-max`):** Dark Operations Command Center (`#0F172A` background, `#1B2336` glassmorphic cards, `#22C55E` live telemetry accents, `#EF4444` hazard alerts, `Fira Code` + `Fira Sans` typography, high-contrast accessible colormaps, zero emojis/all crisp SVG icons).

## Could have (only if time remains)
- Export scenario as PNG/CSV.
- Compare two different shocks.
- Model card in the dashboard footer.

## Demo script (5 minutes)
1. Prime rollout (30 s) -> 2. Judge's shock via Shock Studio (90 s) -> 3. Multiverse Compare + Narrator (60 s) -> 4. Impact Pack (60 s) -> 5. Trust Panel + limits (60 s).
