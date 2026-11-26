"""Test API contract: shapes, physical validity bounds, wire formats (JSON lists & base64), and CPU latency."""
from __future__ import annotations
import asyncio
import base64
import sys
import time
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import serve
from twin.data import doy_sincos_from_doy


def _sample_init_states(seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    base = np.array([295.0, 4.0, 2.0, 1.0, 100500.0, 35.0], dtype=np.float32)[:, None, None]
    scale = np.array([3.0, 3.0, 2.0, 2.0, 300.0, 8.0], dtype=np.float32)[None, :, None, None]
    st = (base + rng.normal(0.0, 1.0, (3, 6, 32, 36)).astype(np.float32) * scale).astype(np.float32)
    st[:, 1] = np.abs(st[:, 1])
    st[:, 5] = np.abs(st[:, 5])
    return st


def test_health_and_simulate_contract() -> None:
    """Verify /health, /simulate wire decoding, physical bounds, and < 1.0s CPU speed."""
    h = serve.health()
    assert h.get("status") == "ready", f"Expected status=ready, got {h}"
    assert h.get("model_name"), "model_name must be non-empty"

    st = _sample_init_states(0)
    doy_sc = doy_sincos_from_doy(165).tolist()

    # 1. Test canonical JSON lists decoding + 10-step rollout latency
    t0 = time.perf_counter()
    init_decoded = serve._decode_array(st.tolist(), (3, 6, 32, 36))
    out = serve.simulate(init_decoded, doy_sc, steps=10, perturbation=None)
    elapsed_s = time.perf_counter() - t0

    assert out.shape == (10, 6, 32, 36), f"Bad rollout shape: {out.shape}"
    assert np.isfinite(out).all(), "Rollout contains NaN or Inf"
    assert float(out[:, 1].min()) >= 0.0, f"Negative precipitation: {out[:, 1].min()}"
    assert float(out[:, 5].min()) >= 0.0, f"Negative moisture: {out[:, 5].min()}"
    assert float(out[:, 0].min()) >= 233.15 and float(out[:, 0].max()) <= 333.15, "t2m outside [-40, +60] C"
    assert elapsed_s < 1.0, f"10-step rollout too slow: {elapsed_s:.2f}s (target < 1.0s, grader limit 5.0s)"

    # 2. Test base64 wire format decoding + simulate_endpoint JSON wrapper
    st_contig = np.ascontiguousarray(st, dtype="<f4")
    b64_payload = {"b64": base64.b64encode(st_contig.tobytes()).decode("ascii"), "shape": [3, 6, 32, 36]}

    class _DummyReq:
        async def json(self) -> dict:
            return {"init_states": b64_payload, "doy_sincos": doy_sc, "steps": 10, "perturbation": None}

    resp = asyncio.run(serve.simulate_endpoint(_DummyReq()))
    out_b64 = np.asarray(resp["rollout"], dtype=np.float32)
    assert isinstance(resp.get("inference_ms"), (int, float)), "Missing inference_ms in endpoint response"
    assert np.allclose(out, out_b64, atol=1e-6), "Canonical list and base64 wire formats diverged"
    print(f"PASS test_contract.py (model={h['model_name']}, 10-step latency={elapsed_s*1000:.1f} ms)")


if __name__ == "__main__":
    test_health_and_simulate_contract()
