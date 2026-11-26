# Demo Guide (desk review: live demo + technical Q&A)

Judges apply a **new shock on the spot**, review the impact extension and ask about model design and limits.

## Before the demo
- [ ] Server running: `python serve.py --port 8000`
- [ ] Dashboard open, API connected (green Trust Panel)
- [ ] Backup: 5-minute screen recording, laptop charged, hotspot off (we are offline anyway)
- [ ] One person drives the demo, the other answers questions

## 5-minute script
| Time | What to show |
|---|---|
| 0:00 | One line: "A Climate Digital Twin of India that branches into alternate universes." |
| 0:30 | Timeline Prime: 10-day rollout, day slider |
| 1:30 | Judge's shock: draw a box in Shock Studio, pick variable + strength, run live |
| 2:30 | Multiverse Compare: Prime vs Alternate, difference map, ripple chart |
| 3:15 | Auto-Narrator summary + Impact Pack (heatwave / rain risk) |
| 4:00 | Trust Panel: zero shock identical, no NaN, rain >= 0, locality |
| 4:30 | Honest limits + next steps |

## Likely questions and answer outlines
| Question | Answer outline |
|---|---|
| Why a CNN? | Local operations let shocks start near the source and spread, like real physics |
| How do you stop drift? | Residual prediction, multi-step training, clamping, rain in log space |
| How do you stop blur? | Gradient loss and spatial-std check (give the number) |
| Does zero shock change anything? | No; show the Trust Panel test |
| Why not a bigger model? | CPU only, 5 s limit, small data; speed and stability matter |
| What are the limits? | Cyclones, extreme rain at long lead, shocks beyond training range |
| How do you know it's not hardcoded? | No data or dates in repo; show the repo and training code |
| What would you do next? | More training years, ensemble, physics constraints |

## If something breaks
- API down: show the backup recording and explain.
- Slow response: lower steps to 5 and say so.
- Never invent numbers. Say "we measured X; we have not tested Y."
