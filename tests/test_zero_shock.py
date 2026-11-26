"""Test zero-shock invariance (perturbation=None vs perturbation=zeros) and repeat determinism."""
from __future__ import annotations
import sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from twin.data import doy_sincos_from_doy, load_static_bundle
from twin.infer import simulate


def test_zero_shock_and_determinism() -> None:
    """Verify null perturbation equals all-zeros perturbation (max diff == 0.0 <= 1e-3 * std)."""
    rng = np.random.default_rng(7)
    base = np.array([296.0, 5.0, 2.5, 1.2, 100600.0, 38.0], dtype=np.float32)[:, None, None]
    st = (base + rng.normal(0.0, 1.0, (3, 6, 32, 36)).astype(np.float32)).astype(np.float32)
    st[:, 1] = np.abs(st[:, 1])
    st[:, 5] = np.abs(st[:, 5])
    doy_sc = doy_sincos_from_doy(170).tolist()

    out_none = simulate(st, doy_sc, steps=10, perturbation=None)
    out_zeros = simulate(st, doy_sc, steps=10, perturbation=np.zeros((6, 32, 36), dtype=np.float32))
    out_repeat = simulate(st, doy_sc, steps=10, perturbation=None)

    sb = load_static_bundle()
    std = sb["std"][None, :, None, None]
    norm_diff = float(np.max(np.abs(out_none - out_zeros) / std))
    repeat_diff = float(np.max(np.abs(out_none - out_repeat)))

    assert norm_diff <= 1e-6, f"Zero shock changed output: max normalized diff = {norm_diff}"
    assert repeat_diff == 0.0, f"Repeat calls not deterministic: max diff = {repeat_diff}"
    print(f"PASS test_zero_shock.py (null vs zeros diff={norm_diff:.2e}, repeat diff={repeat_diff:.2e})")


if __name__ == "__main__":
    test_zero_shock_and_determinism()
