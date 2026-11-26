# API Quick Reference (summary — the kit's API_CONTRACT.md is the final authority)

## Run
`python serve.py --port 8000` (listen on `0.0.0.0`)

## POST /health
Response: `{"status": "ready", "model_name": "VarshaTwin-v1"}`
Must be ready within 120 s of start.

## POST /simulate
Request:
```json
{
  "init_states": "[3, 6, 32, 36] nested lists, physical units",
  "doy_sincos": [0.42, -0.91],
  "steps": 10,
  "perturbation": "[6, 32, 36] nested lists, or null"
}
```
Response:
```json
{
  "rollout": "[steps, 6, 32, 36]",
  "inference_ms": 142.5
}
```

## Channels (in order)
| Index | Name | Unit |
|---|---|---|
| 0 | t2m | K |
| 1 | tp | mm/day |
| 2 | u10 | m/s |
| 3 | v10 | m/s |
| 4 | msl | Pa |
| 5 | tcwv | kg/m2 |

## Semantics (Confirmed from `yug-monsoon-kit/docs/R1_CONTRACT.md`)
- **Grid:** `32 x 36` cells of `1° x 1°`, centers `lat 6.5..37.5` (south → north), `lon 65.5..100.5` (west → east).
- **Wire formats:** Must accept **BOTH** canonical nested JSON lists AND compact `{"b64": "...", "shape": [...]}` float32 payloads (tested by `monsoon_r1.schema_validator`). Always return nested JSON lists in `rollout`.
- `init_states` are the last 3 consecutive days (`[3, 6, 32, 36]`, oldest first); forecast `rollout[k]` is day `k+1` after `init_states[-1]`.
- `perturbation` = physical delta `[6, 32, 36]` added to `init_states[-1]` before step 1 (`null` = no shock).
- `doy_sincos` = `[sin(2*pi*doy/365), cos(2*pi*doy/365)]` for the **LAST input day** (`init_states[-1]`).
- Each 10-step answer must return in **under 5.0 s** wall time (target `< 0.3 s` on CPU).

## Hidden grader requests (8 blind calls)
- **5 real windows (post 2023-01-10):** monsoon onset, heavy rain, heatwave, cyclone, winter disturbance.
- **3 shocks on a real window (from `monsoon_r1/scoring.py`):**
  1. `warm_ocean`: `+3.0 K` on `t2m` AND `+15%` of current `tcwv` over Bay of Bengal (`lat 8..20, lon 82..94`).
  2. `monsoon_stall`: `-40%` of current `u10` AND `-40%` of current `v10` over Arabian Sea (`lat 8..20, lon 65..75`).
  3. `null`: `perturbation = zeros` (max difference vs `perturbation = null` must be `<= 1e-3 * std`; ours is `0.0`).

## Local checks
```bash
python -m monsoon_r1.schema_validator http://localhost:8000
python -c "from monsoon_r1.repo_scan import scan; import json; print(json.dumps(scan('.'), indent=2))"
```

## Output guarantees (ours)
- Shape `[steps, 6, 32, 36]`, finite floats, `tp >= 0`, `t2m` strictly within `[233.15, 333.15] K` (`[-40°C, +60°C]`).
- Deterministic: same input -> identical output (`0.0` diff on `null` vs `zeros`).
