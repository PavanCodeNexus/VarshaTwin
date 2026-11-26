# Repository Structure

```
varsha-twin/
├── serve.py                # API entrypoint (root, required)
├── train.py                # Training entrypoint (required: real training code)
├── eval.py                 # Baselines + metrics on validation years
├── requirements.txt
├── README.md               # How to train and run
├── .gitattributes          # Git LFS: weights/*.pt
├── .gitignore              # data/*.nc, __pycache__, runs/
├── twin/                   # Core library
│   ├── data.py             # Load .nc, normalize (stats.json), build windows
│   ├── model.py            # TwinNet (residual CNN)
│   ├── losses.py           # weighted MSE, rain weighting, gradient/blur loss
│   ├── rollout.py          # autoregressive loop + stability guards
│   ├── shocks.py           # shock presets, region masks
│   └── infer.py            # load weights, simulate(init, doy, steps, perturbation)
├── weights/
│   ├── twin.pt             # trained weights (LFS)
│   └── static_fields.npz   # land_sea_mask, orography_m (bundled with model)
├── dashboard/              # Separate from server code
│   ├── index.html
│   ├── app.js              # calls POST /simulate live
│   ├── style.css
│   ├── presets.json        # named scenarios
│   └── vendor/             # any JS libs, vendored (no CDN, offline)
├── tests/
│   ├── test_contract.py    # shapes, no NaN, rain >= 0
│   ├── test_zero_shock.py  # null == zeros perturbation
│   └── test_locality.py    # shock stays local, then spreads
├── notebooks/              # optional exploration (keep out of final path)
└── docs/                   # prd, trd, architecture, features, database
```

## Conventions
- **Data is never committed.** Put `india_climate_train.nc` in `data/` (gitignored).
- Weights go through Git LFS (`git lfs track "weights/*.pt"`).
- Static fields (land-sea mask, orography) are bundled with the model in `weights/`.
- `serve.py` writes only to `/tmp`.
- No hardcoded dates, years or lookup tables anywhere in code.

## Git workflow (2 people)
- `main` always runs. Work on `ml/*` and `ui/*` branches.
- Person A owns `twin/`, `train.py`, `eval.py`. Person B owns `serve.py`, `dashboard/`, `tests/`.
- Commit small and often; the last commit before the deadline counts.
