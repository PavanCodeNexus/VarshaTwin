"""Test repository integrity against all monsoon_r1.repo_scan anti-cheat and code-health checks."""
from __future__ import annotations
import re
import subprocess
import zipfile
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent

EXTERNAL_WEATHER = [
    r"open-meteo", r"openweathermap", r"api\.weather", r"weatherapi", r"visualcrossing", r"tomorrow\.io",
    r"api\.met\.no", r"meteomatics", r"worldweatheronline", r"power\.larc\.nasa", r"cdsapi",
    r"cds\.climate\.copernicus", r"gcp-public-data-arco-era5", r"weatherbench2", r"mosdac",
    r"noaa-gfs", r"imdlib", r"nomads\.ncep", r"mausam\.imd",
]
DATE_RE = re.compile(r"\b(?:19|20)\d{2}[-/]?(?:0[1-9]|1[0-2])[-/]?(?:0[1-9]|[12]\d|3[01])\b")
DATETIME_CALL = re.compile(r"(?:date|datetime|Timestamp)\(\s*['\"]?(?:19|20)\d{2}")
DATA_EXT = {".nc", ".nc4", ".grib", ".grib2", ".zarr"}


def _npy_shape(fobj) -> tuple[int, ...] | None:
    try:
        v = np.lib.format.read_magic(fobj)
        fn = np.lib.format.read_array_header_1_0 if v == (1, 0) else np.lib.format.read_array_header_2_0
        return fn(fobj)[0]
    except Exception:
        return None


def test_repo_anti_cheat_and_health() -> None:
    """Verify git-tracked files contain zero forbidden weather APIs, date literals, or raw data archives."""
    tracked_out = subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True)
    tracked_files = [ROOT / line.strip() for line in tracked_out.splitlines() if line.strip()]
    assert tracked_files, "No git-tracked files found"

    inference_py = [ROOT / "serve.py"] + sorted((ROOT / "twin").glob("*.py"))
    for p in inference_py:
        text = p.read_text(errors="ignore")
        for pat in EXTERNAL_WEATHER:
            assert not re.search(pat, text, re.I), f"Forbidden weather pattern '{pat}' in {p.relative_to(ROOT)}"
        dates = DATE_RE.findall(text)
        assert len(dates) == 0, f"Hardcoded date literal(s) {dates} in {p.relative_to(ROOT)}"
        assert not DATETIME_CALL.search(text), f"Hardcoded datetime call in {p.relative_to(ROOT)}"
        assert not re.search(r"streamlit|gradio|dash\(|plotly|matplotlib\.pyplot", text, re.I), (
            f"UI import found inside inference module {p.relative_to(ROOT)}"
        )

    for p in tracked_files:
        if not p.is_file():
            continue
        assert p.suffix not in DATA_EXT, f"Climate data file tracked in git: {p.relative_to(ROOT)}"
        if p.suffix == ".npz":
            with zipfile.ZipFile(p) as z:
                for name in z.namelist():
                    if name.endswith(".npy"):
                        with z.open(name) as f:
                            s = _npy_shape(f)
                            assert s is not None, f"Corrupt .npy header for {name} in {p.relative_to(ROOT)}"
                            if len(s) >= 3 and tuple(s[-2:]) == (32, 36):
                                assert s[0] <= 400, f"Multi-year archive in {p.relative_to(ROOT)}: shape {s}"

    train_text = (ROOT / "train.py").read_text(errors="ignore")
    assert ".backward(" in train_text and "optimizer.step" in train_text, "train.py missing real training loop"
    assert (ROOT / "weights" / "twin.pt").stat().st_size > 1024, "weights/twin.pt missing or <= 1 KB"
    assert (ROOT / "weights" / "static_fields.npz").stat().st_size > 1024, "weights/static_fields.npz <= 1 KB"
    assert (ROOT / "README.md").is_file(), "README.md missing"
    print(f"PASS test_repo_scan.py (scanned {len(tracked_files)} tracked files, 0 anti-cheat flags)")


if __name__ == "__main__":
    test_repo_anti_cheat_and_health()
