"""Inference singleton loading weights/twin.pt and weights/static_fields.npz once at startup."""
from __future__ import annotations
from pathlib import Path
import numpy as np
import torch
from twin.data import load_static_bundle
from twin.model import build_model
from twin.rollout import run_rollout

_ROOT = Path(__file__).resolve().parent.parent
_WEIGHTS_PATH = _ROOT / "weights" / "twin.pt"
_STATIC_PATH = _ROOT / "weights" / "static_fields.npz"

_MODEL: torch.nn.Module | None = None
_STATIC_BUNDLE: dict[str, np.ndarray] | None = None
_MODEL_NAME: str = "VarshaTwin-v1"


def _ensure_loaded() -> None:
    """Load model checkpoint and static fields into memory on first call (deterministic CPU mode)."""
    global _MODEL, _STATIC_BUNDLE, _MODEL_NAME
    if _MODEL is not None and _STATIC_BUNDLE is not None:
        return
    torch.set_num_threads(4)
    _STATIC_BUNDLE = load_static_bundle(_STATIC_PATH)
    ckpt = torch.load(_WEIGHTS_PATH, map_location="cpu", weights_only=True)
    level = int(ckpt.get("level", 1))
    hidden_dim = int(ckpt.get("hidden_dim", 48))
    model = build_model(level=level, hidden_dim=hidden_dim)
    model.load_state_dict(ckpt["state_dict"])
    model.eval()
    _MODEL = model
    _MODEL_NAME = str(ckpt.get("model_name", f"VarshaTwin-L{level}"))


def get_model_name() -> str:
    """Return loaded checkpoint's model name for /health."""
    _ensure_loaded()
    return _MODEL_NAME


def simulate(
    init_states: np.ndarray,
    doy_sincos: list[float],
    steps: int = 10,
    perturbation: np.ndarray | None = None,
) -> np.ndarray:
    """Run deterministic 10-step rollout [steps, 6, 32, 36] in physical units."""
    _ensure_loaded()
    assert _MODEL is not None and _STATIC_BUNDLE is not None
    return run_rollout(_MODEL, init_states, doy_sincos, steps, perturbation, _STATIC_BUNDLE)


if _WEIGHTS_PATH.is_file() and _STATIC_PATH.is_file():
    _ensure_loaded()
