"""Test perturbation causality & locality: Day-1 >= 60% inside dilate=3, outward propagation Days 4-8, 0% teleportation."""
from __future__ import annotations
import sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from eval import causality_checks
from twin.data import doy_sincos_from_doy, load_static_bundle
from twin.infer import simulate
from twin.shocks import BOX_ARABIAN_SEA, BOX_BAY_OF_BENGAL, build_box_shock, make_shock


def test_shock_locality_and_propagation() -> None:
    """Verify full 15.0 / 15.0 causality points across warm_ocean, monsoon_stall, and custom Shock Studio boxes."""
    rng = np.random.default_rng(42)
    base_val = np.array([298.0, 6.0, 4.0, 2.5, 100400.0, 42.0], dtype=np.float32)[:, None, None]
    st = (base_val + rng.normal(0.0, 1.0, (3, 6, 32, 36)).astype(np.float32)).astype(np.float32)
    st[:, 1] = np.abs(st[:, 1])
    st[:, 5] = np.abs(st[:, 5])
    doy_sc = doy_sincos_from_doy(165).tolist()

    sb = load_static_bundle()
    std = sb["std"]

    base_out = simulate(st, doy_sc, steps=10, perturbation=None)
    warm_out = simulate(st, doy_sc, steps=10, perturbation=make_shock("warm_ocean", st[-1]))
    stall_out = simulate(st, doy_sc, steps=10, perturbation=make_shock("monsoon_stall", st[-1]))

    cw = causality_checks(base_out, warm_out, BOX_BAY_OF_BENGAL, std)
    cm = causality_checks(base_out, stall_out, BOX_ARABIAN_SEA, std)

    for name, res in (("warm_ocean", cw), ("monsoon_stall", cm)):
        assert res["finite"], f"{name} produced non-finite values"
        assert res["nonzero"], f"{name} produced zero response"
        assert res["localized"], f"{name} failed Day-1 locality: near_frac_day1={res['near_frac_day1']}"
        assert res["propagates"], f"{name} failed outward propagation: {res}"
        assert res["stable"], f"{name} exceeded 5.0 std stability bound"

    # Also test a custom Shock Studio region in Central India
    custom_box = (16.0, 24.0, 75.0, 83.0)
    custom_pert = build_box_shock(*custom_box, channel="t2m", delta_val=3.0)
    custom_out = simulate(st, doy_sc, steps=10, perturbation=custom_pert)
    cc = causality_checks(base_out, custom_out, custom_box, std)
    assert all(cc[k] for k in ("finite", "nonzero", "localized", "propagates", "stable")), f"Custom shock failed: {cc}"

    print(f"PASS test_locality.py (warm_ocean={cw}, monsoon_stall={cm}, custom_central={cc} -> 15.0 / 15.0 pts)")


if __name__ == "__main__":
    test_shock_locality_and_propagation()
