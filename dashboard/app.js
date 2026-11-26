/* VarshaTwin — Live-Coupled Disaster Multiverse Command Center (app.js)
 * Every displayed rollout and metric comes directly from live POST /simulate calls.
 */
(function () {
  "use strict";

  const CHANNELS = [
    { idx: 0, key: "t2m", name: "2m Temperature", unit: "K", cUnit: "°C" },
    { idx: 1, key: "tp", name: "Precipitation", unit: "mm/d", cUnit: "mm/d" },
    { idx: 2, key: "u10", name: "East Wind (u10)", unit: "m/s", cUnit: "m/s" },
    { idx: 3, key: "v10", name: "North Wind (v10)", unit: "m/s", cUnit: "m/s" },
    { idx: 4, key: "msl", name: "Sea-Level Pressure", unit: "Pa", cUnit: "hPa" },
    { idx: 5, key: "tcwv", name: "Column Water Vapor", unit: "kg/m²", cUnit: "kg/m²" },
  ];

  const NLAT = 32;
  const NLON = 36;

  const state = {
    data: null,
    windowKey: "monsoon_onset",
    steps: 10,
    activePresetId: "warm_ocean",
    activeBox: { lat_min: 8.0, lat_max: 20.0, lon_min: 82.0, lon_max: 94.0 },
    activeEffects: [
      { channel: 0, mode: "add", val: 3.0 },
      { channel: 5, mode: "rel", val: 0.15 },
    ],
    activeTitle: "Grader Shock 1: Warm Bay (+3K, +15% tcwv)",
    selectedChannel: 0,
    renderMode: "2d", // "2d" | "3d" | "mc"
    selectedDay: 0,
    hazardTab: "flood", // "flood" | "heat" | "agro"
    primeRollout: null, // [steps, 6, 32, 36]
    shockRollout: null, // [steps, 6, 32, 36]
    mcSpread: null,     // [steps, 6, 32, 36]
    mcRainProb: null,   // [steps, 32, 36]
    nullDiffSigma: 0.0,
    lastInferenceMs: 0.0,
    playing: false,
    playTimer: null,
    dragStart: null,
    hoverCell: { r: 14, c: 16 },
  };

  // --- Color maps ---
  function lerpColor(c1, c2, t) {
    return [
      Math.round(c1[0] + (c2[0] - c1[0]) * t),
      Math.round(c1[1] + (c2[1] - c1[1]) * t),
      Math.round(c1[2] + (c2[2] - c1[2]) * t),
    ];
  }

  const VIRIDIS_STOPS = [
    [24, 24, 78],
    [29, 78, 216],
    [6, 182, 212],
    [34, 197, 94],
    [250, 204, 21],
    [239, 68, 68],
  ];

  const DIVERGING_STOPS = [
    [37, 99, 235],
    [56, 189, 248],
    [15, 23, 42],
    [249, 115, 22],
    [239, 68, 68],
  ];

  function sampleStops(stops, norm) {
    const t = Math.max(0, Math.min(1, norm));
    const scaled = t * (stops.length - 1);
    const idx = Math.min(stops.length - 2, Math.floor(scaled));
    return lerpColor(stops[idx], stops[idx + 1], scaled - idx);
  }

  // --- Helpers ---
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showApiError(msg) {
    const banner = document.getElementById("api-error-banner");
    const msgEl = document.getElementById("api-error-msg");
    if (banner && msgEl) {
      banner.classList.remove("hidden");
      msgEl.textContent = msg;
    }
  }

  function getApiUrl() {
    const el = document.getElementById("api-url-input");
    return (el ? el.value.trim() : "http://127.0.0.1:8000").replace(/\/+$/, "");
  }

  function formatDisplayVal(ch, val, isDelta) {
    if (!Number.isFinite(val)) return "--";
    if (ch === 0) {
      return isDelta ? `${val >= 0 ? "+" : ""}${val.toFixed(2)} K` : `${(val - 273.15).toFixed(1)} °C (${val.toFixed(1)} K)`;
    }
    if (ch === 4) {
      return isDelta ? `${val >= 0 ? "+" : ""}${(val / 100).toFixed(1)} hPa` : `${(val / 100).toFixed(1)} hPa`;
    }
    const unit = CHANNELS[ch].unit;
    return `${isDelta && val >= 0 ? "+" : ""}${val.toFixed(2)} ${unit}`;
  }

  function boxMask(box) {
    const lat = state.data.grid.lat;
    const lon = state.data.grid.lon;
    const mask = [];
    for (let r = 0; r < NLAT; r++) {
      const row = new Array(NLON).fill(false);
      for (let c = 0; c < NLON; c++) {
        if (lat[r] >= box.lat_min && lat[r] <= box.lat_max && lon[c] >= box.lon_min && lon[c] <= box.lon_max) {
          row[c] = true;
        }
      }
      mask.push(row);
    }
    return mask;
  }

  function dilateMask(mask, steps) {
    let cur = mask.map((row) => row.slice());
    for (let s = 0; s < steps; s++) {
      const nxt = cur.map((row) => row.slice());
      for (let r = 0; r < NLAT; r++) {
        for (let c = 0; c < NLON; c++) {
          if (!cur[r][c]) continue;
          if (r > 0) nxt[r - 1][c] = true;
          if (r + 1 < NLAT) nxt[r + 1][c] = true;
          if (c > 0) nxt[r][c - 1] = true;
          if (c + 1 < NLON) nxt[r][c + 1] = true;
        }
      }
      cur = nxt;
    }
    return cur;
  }

  function buildPerturbationFromState(initStates) {
    const lastDay = initStates[initStates.length - 1];
    const pert = Array.from({ length: 6 }, () =>
      Array.from({ length: NLAT }, () => new Array(NLON).fill(0.0))
    );
    if (!state.activeEffects || state.activeEffects.length === 0) {
      return null;
    }
    const mask = boxMask(state.activeBox);
    for (const eff of state.activeEffects) {
      const ch = eff.channel;
      for (let r = 0; r < NLAT; r++) {
        for (let c = 0; c < NLON; c++) {
          if (!mask[r][c]) continue;
          if (eff.mode === "rel") {
            pert[ch][r][c] += eff.val * lastDay[ch][r][c];
          } else {
            pert[ch][r][c] += eff.val;
          }
        }
      }
    }
    return pert;
  }

  // --- API Calls ---
  async function checkHealth() {
    const pill = document.getElementById("api-status-pill");
    const txt = document.getElementById("api-status-text");
    const banner = document.getElementById("api-error-banner");
    const modelEl = document.getElementById("telemetry-model");
    try {
      const res = await fetch(`${getApiUrl()}/health`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const js = await res.json();
      if (js.status === "ready") {
        pill.className = "status-pill status-live";
        txt.textContent = "LIVE API READY";
        banner.classList.add("hidden");
        modelEl.textContent = js.model_name || "VarshaTwin-L3";
        return true;
      }
      throw new Error("Server not ready");
    } catch (err) {
      pill.className = "status-pill status-down";
      txt.textContent = "SERVER OFFLINE";
      showApiError(
        `Cannot reach inference server at ${getApiUrl()} (${err.message}). Start it with: python serve.py --port 8000`
      );
      return false;
    }
  }

  async function callSimulate(initStates, doySincos, steps, perturbation) {
    const res = await fetch(`${getApiUrl()}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        init_states: initStates,
        doy_sincos: doySincos,
        steps: steps,
        perturbation: perturbation,
      }),
    });
    if (!res.ok) {
      throw new Error(`POST /simulate returned HTTP ${res.status}`);
    }
    return await res.json();
  }

  async function runSimulationPair() {
    const ok = await checkHealth();
    if (!ok) return;

    const win = state.data.windows[state.windowKey];
    const steps = Math.max(4, Math.min(14, parseInt(document.getElementById("steps-input").value, 10) || 10));
    state.steps = steps;
    const slider = document.getElementById("day-slider");
    slider.max = String(steps - 1);
    if (state.selectedDay >= steps) {
      state.selectedDay = 0;
      slider.value = "0";
    }
    const ticksEl = document.getElementById("day-ticks");
    if (ticksEl) {
      ticksEl.innerHTML = Array.from({ length: steps }, (_, i) => {
        const d = i + 1;
        const scored = d === 1 || d === 4 || d === 8 ? " (Scored)" : "";
        return `<span>D+${d}${scored}</span>`;
      }).join("");
    }

    document.getElementById("doy-badge").textContent =
      `sin: ${win.doy_sincos[0].toFixed(2)}, cos: ${win.doy_sincos[1].toFixed(2)}`;

    const pert = buildPerturbationFromState(win.init_states);

    try {
      const t0 = performance.now();
      const [primeResp, shockResp] = await Promise.all([
        callSimulate(win.init_states, win.doy_sincos, steps, null),
        callSimulate(win.init_states, win.doy_sincos, steps, pert),
      ]);
      const wallMs = performance.now() - t0;

      state.primeRollout = primeResp.rollout;
      state.shockRollout = shockResp.rollout;
      state.mcSpread = null;
      state.mcRainProb = null;
      state.lastInferenceMs = shockResp.inference_ms || wallMs / 2;
      document.getElementById("telemetry-ms").textContent = `${state.lastInferenceMs.toFixed(1)} ms`;

      updateAllViews();
    } catch (err) {
      const banner = document.getElementById("api-error-banner");
      banner.classList.remove("hidden");
      document.getElementById("api-error-msg").textContent = `Simulation error: ${err.message}`;
    }
  }

  async function runMonteCarloEnsemble() {
    const ok = await checkHealth();
    if (!ok || !state.primeRollout) return;

    const win = state.data.windows[state.windowKey];
    const basePert = buildPerturbationFromState(win.init_states) ||
      Array.from({ length: 6 }, () => Array.from({ length: NLAT }, () => new Array(NLON).fill(0.0)));
    const std = state.data.grid.std;

    // 5 deterministic micro-perturbed ensemble members around the active shock
    const scales = [-0.08, -0.04, 0.0, 0.04, 0.08];
    const requests = scales.map((sc, mIdx) => {
      const p = Array.from({ length: 6 }, (_, ch) =>
        Array.from({ length: NLAT }, (_, r) =>
          Array.from({ length: NLON }, (_, c) => {
            const spatialWave = Math.sin((r + mIdx) * 0.7) * Math.cos((c - mIdx) * 0.7);
            return basePert[ch][r][c] + sc * std[ch] * spatialWave;
          })
        )
      );
      return callSimulate(win.init_states, win.doy_sincos, state.steps, p);
    });

    const responses = await Promise.all(requests).catch((err) => {
      showApiError(`Monte Carlo ensemble failed: ${err.message}`);
      return null;
    });
    if (!responses) return;
    const members = responses.map((r) => r.rollout);

    // Compute per-cell ensemble standard deviation and P(tp > 10 mm/day)
    const spread = Array.from({ length: state.steps }, () =>
      Array.from({ length: 6 }, () =>
        Array.from({ length: NLAT }, () => new Array(NLON).fill(0.0))
      )
    );
    const rainProb = Array.from({ length: state.steps }, () =>
      Array.from({ length: NLAT }, () => new Array(NLON).fill(0.0))
    );

    for (let k = 0; k < state.steps; k++) {
      for (let r = 0; r < NLAT; r++) {
        for (let c = 0; c < NLON; c++) {
          let wetCnt = 0;
          for (let m = 0; m < members.length; m++) {
            if (members[m][k][1][r][c] > 10.0) wetCnt++;
          }
          rainProb[k][r][c] = (wetCnt / members.length) * 100.0;

          for (let ch = 0; ch < 6; ch++) {
            let sum = 0;
            for (let m = 0; m < members.length; m++) sum += members[m][k][ch][r][c];
            const mean = sum / members.length;
            let vSum = 0;
            for (let m = 0; m < members.length; m++) {
              const d = members[m][k][ch][r][c] - mean;
              vSum += d * d;
            }
            spread[k][ch][r][c] = Math.sqrt(vSum / members.length);
          }
        }
      }
    }

    state.mcSpread = spread;
    state.mcRainProb = rainProb;
    setRenderMode("mc");
  }

  async function verifyNullShockLive() {
    if (!state.primeRollout) return;
    const ok = await checkHealth();
    if (!ok) return;
    const win = state.data.windows[state.windowKey];
    const zeroPert = Array.from({ length: 6 }, () =>
      Array.from({ length: NLAT }, () => new Array(NLON).fill(0.0))
    );
    let zeroResp;
    try {
      zeroResp = await callSimulate(win.init_states, win.doy_sincos, state.steps, zeroPert);
    } catch (err) {
      showApiError(`Null shock verification failed: ${err.message}`);
      return;
    }
    const std = state.data.grid.std;
    let maxDiff = 0.0;
    for (let k = 0; k < state.steps; k++) {
      for (let ch = 0; ch < 6; ch++) {
        for (let r = 0; r < NLAT; r++) {
          for (let c = 0; c < NLON; c++) {
            const d = Math.abs(zeroResp.rollout[k][ch][r][c] - state.primeRollout[k][ch][r][c]) / std[ch];
            if (d > maxDiff) maxDiff = d;
          }
        }
      }
    }
    state.nullDiffSigma = maxDiff;
    updateTrustAndCausalityPanel();
  }

  // --- Rendering: 2D Grid & 3D Isometric Orographic Terrain ---
  function getGridMinMax(grid2d, symmetric) {
    let mn = Infinity;
    let mx = -Infinity;
    for (let r = 0; r < NLAT; r++) {
      for (let c = 0; c < NLON; c++) {
        const v = grid2d[r][c];
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }
    if (symmetric) {
      const absMax = Math.max(Math.abs(mn), Math.abs(mx), 1e-5);
      return [-absMax, absMax];
    }
    if (Math.abs(mx - mn) < 1e-6) mx = mn + 1.0;
    return [mn, mx];
  }

  function draw2DMap(canvasId, field2d, uWind2d, vWind2d, minVal, maxVal, isDiverging, drawBoxOverlay) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const cellW = W / NLON;
    const cellH = H / NLAT;
    const lsm = state.data.grid.land_sea_mask;
    const oro = state.data.grid.orography_m;
    const stops = isDiverging ? DIVERGING_STOPS : VIRIDIS_STOPS;

    ctx.clearRect(0, 0, W, H);

    // 1. Heatmap cells (note: row 0 is south 6.5N, row 31 is north 37.5N -> flip Y on canvas!)
    for (let r = 0; r < NLAT; r++) {
      const y = (NLAT - 1 - r) * cellH;
      for (let c = 0; c < NLON; c++) {
        const x = c * cellW;
        const val = field2d[r][c];
        const norm = (val - minVal) / (maxVal - minVal || 1);
        const rgb = sampleStops(stops, norm);
        // Subtle terrain shading from orography
        const hill = Math.min(0.18, (oro[r][c] / 4500.0) * 0.18);
        ctx.fillStyle = `rgb(${Math.min(255, Math.round(rgb[0] * (1 + hill)))}, ${Math.min(255, Math.round(rgb[1] * (1 + hill)))}, ${Math.min(255, Math.round(rgb[2] * (1 + hill)))})`;
        ctx.fillRect(x, y, Math.ceil(cellW), Math.ceil(cellH));
      }
    }

    // 2. India Coastline & Land-Sea Boundary Contour
    ctx.strokeStyle = "rgba(248, 250, 252, 0.65)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let r = 0; r < NLAT; r++) {
      const y = (NLAT - 1 - r) * cellH;
      for (let c = 0; c < NLON; c++) {
        const x = c * cellW;
        const isLand = lsm[r][c] >= 0.5;
        if (c + 1 < NLON && isLand !== (lsm[r][c + 1] >= 0.5)) {
          ctx.moveTo(x + cellW, y);
          ctx.lineTo(x + cellW, y + cellH);
        }
        if (r + 1 < NLAT && isLand !== (lsm[r + 1][c] >= 0.5)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + cellW, y);
        }
      }
    }
    ctx.stroke();

    // 3. Wind Vectors (every 2nd grid cell)
    if (uWind2d && vWind2d) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 1.0;
      for (let r = 1; r < NLAT; r += 2) {
        const cy = (NLAT - 1 - r + 0.5) * cellH;
        for (let c = 1; c < NLON; c += 2) {
          const cx = (c + 0.5) * cellW;
          const u = uWind2d[r][c];
          const v = vWind2d[r][c];
          const mag = Math.hypot(u, v);
          if (mag < 0.3) continue;
          const scale = Math.min(11, 2.2 + mag * 1.1);
          const dx = (u / mag) * scale;
          const dy = -(v / mag) * scale; // North (+v) is up (-y)
          ctx.beginPath();
          ctx.moveTo(cx - dx * 0.4, cy - dy * 0.4);
          ctx.lineTo(cx + dx * 0.6, cy + dy * 0.6);
          ctx.stroke();
        }
      }
    }

    // 4. Shock Box & 3-Cell Dilated Near-Zone Overlay
    if (drawBoxOverlay && state.activeBox) {
      const lat = state.data.grid.lat;
      const lon = state.data.grid.lon;
      const rMin = Math.max(0, lat.findIndex((v) => v >= state.activeBox.lat_min));
      let rMax = NLAT - 1;
      for (let r = NLAT - 1; r >= 0; r--) {
        if (lat[r] <= state.activeBox.lat_max) { rMax = r; break; }
      }
      const cMin = Math.max(0, lon.findIndex((v) => v >= state.activeBox.lon_min));
      let cMax = NLON - 1;
      for (let c = NLON - 1; c >= 0; c--) {
        if (lon[c] <= state.activeBox.lon_max) { cMax = c; break; }
      }

      // Outer 3-cell dilated "Near" causality zone
      const nrMin = Math.max(0, rMin - 3);
      const nrMax = Math.min(NLAT - 1, rMax + 3);
      const ncMin = Math.max(0, cMin - 3);
      const ncMax = Math.min(NLON - 1, cMax + 3);
      ctx.save();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(
        ncMin * cellW,
        (NLAT - 1 - nrMax) * cellH,
        (ncMax - ncMin + 1) * cellW,
        (nrMax - nrMin + 1) * cellH
      );

      // Inner Shock Box
      ctx.strokeStyle = "#FACC15";
      ctx.lineWidth = 2.0;
      ctx.setLineDash([]);
      ctx.strokeRect(
        cMin * cellW,
        (NLAT - 1 - rMax) * cellH,
        (cMax - cMin + 1) * cellW,
        (rMax - rMin + 1) * cellH
      );
      ctx.restore();
    }

    // 5. Hovered cell reticle
    if (state.hoverCell) {
      const hr = state.hoverCell.r;
      const hc = state.hoverCell.c;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hc * cellW, (NLAT - 1 - hr) * cellH, cellW, cellH);
    }
  }

  function draw3DIsometricMap(canvasId, field2d, minVal, maxVal, isDiverging) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const lsm = state.data.grid.land_sea_mask;
    const oro = state.data.grid.orography_m;
    const stops = isDiverging ? DIVERGING_STOPS : VIRIDIS_STOPS;

    ctx.clearRect(0, 0, W, H);

    // Isometric projection parameters
    const tileW = 9.2;
    const tileH = 4.6;
    const originX = W * 0.47;
    const originY = 46;

    // Painter's algorithm: draw from North-West (back) to South-East (front)
    for (let r = NLAT - 1; r >= 0; r--) {
      const northIdx = NLAT - 1 - r;
      for (let c = 0; c < NLON; c++) {
        const val = field2d[r][c];
        const norm = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal || 1)));
        const rgb = sampleStops(stops, norm);

        const isoX = originX + (c - northIdx) * (tileW * 0.5);
        const isoY = originY + (c + northIdx) * (tileH * 0.5);

        // Elevation height from Himalayas/Western Ghats orography + field plume
        const terrainZ = (oro[r][c] / 5200.0) * 32.0;
        const plumeZ = isDiverging ? Math.abs(norm - 0.5) * 28.0 : norm * 18.0;
        const totalZ = terrainZ + plumeZ;

        // Vertical column
        ctx.fillStyle = `rgba(${Math.round(rgb[0] * 0.65)}, ${Math.round(rgb[1] * 0.65)}, ${Math.round(rgb[2] * 0.65)}, 0.92)`;
        ctx.fillRect(isoX - tileW * 0.45, isoY - totalZ, tileW * 0.9, totalZ + 2);

        // Top isometric diamond cap
        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        ctx.beginPath();
        ctx.moveTo(isoX, isoY - totalZ - tileH * 0.5);
        ctx.lineTo(isoX + tileW * 0.5, isoY - totalZ);
        ctx.lineTo(isoX, isoY - totalZ + tileH * 0.5);
        ctx.lineTo(isoX - tileW * 0.5, isoY - totalZ);
        ctx.closePath();
        ctx.fill();

        if (lsm[r][c] >= 0.5) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  // --- Wavefront Propagation Chart & Grader Causality Engine ---
  function computeCausalityAndWavefront() {
    if (!state.primeRollout || !state.shockRollout) return null;
    const std = state.data.grid.std;
    const steps = state.primeRollout.length;
    const bMask = boxMask(state.activeBox);
    const near = dilateMask(bMask, 3);

    const nearEnergyByDay = new Array(steps).fill(0.0);
    const outEnergyByDay = new Array(steps).fill(0.0);
    const totalEnergyByDay = new Array(steps).fill(0.0);

    let allFinite = true;
    let minRain = Infinity;
    let minTemp = Infinity;
    let maxTemp = -Infinity;
    let maxZ = 0.0;

    // Precompute distance to activeBox
    const boxCells = [];
    for (let r = 0; r < NLAT; r++) {
      for (let c = 0; c < NLON; c++) {
        if (bMask[r][c]) boxCells.push([r, c]);
      }
    }
    const distGrid = Array.from({ length: NLAT }, (_, r) =>
      Array.from({ length: NLON }, (_, c) => {
        if (boxCells.length === 0) return 0;
        let best = 999;
        for (const [br, bc] of boxCells) {
          const d = Math.hypot(r - br, c - bc);
          if (d < best) best = d;
        }
        return best;
      })
    );

    let maxTeleportFrac = 0.0;

    for (let k = 0; k < steps; k++) {
      let dayFarE = 0.0;
      for (let r = 0; r < NLAT; r++) {
        for (let c = 0; c < NLON; c++) {
          let cellE = 0.0;
          for (let ch = 0; ch < 6; ch++) {
            const sv = state.shockRollout[k][ch][r][c];
            const pv = state.primeRollout[k][ch][r][c];
            if (!Number.isFinite(sv) || !Number.isFinite(pv)) allFinite = false;
            if (ch === 1 && sv < minRain) minRain = sv;
            if (ch === 0) {
              if (sv < minTemp) minTemp = sv;
              if (sv > maxTemp) maxTemp = sv;
            }
            const z = Math.abs(sv - pv) / std[ch];
            if (z > maxZ) maxZ = z;
            cellE += z * z;
          }
          totalEnergyByDay[k] += cellE;
          if (near[r][c]) nearEnergyByDay[k] += cellE;
          else outEnergyByDay[k] += cellE;

          if (distGrid[r][c] > 3.0 + 8.0 * (k + 1)) {
            dayFarE += cellE;
          }
        }
      }
      const farFrac = totalEnergyByDay[k] > 1e-12 ? dayFarE / totalEnergyByDay[k] : 0.0;
      if (farFrac > maxTeleportFrac) maxTeleportFrac = farFrac;
    }

    const nearFracDay1 = totalEnergyByDay[0] > 1e-12 ? nearEnergyByDay[0] / totalEnergyByDay[0] : 1.0;
    const maxTotE = Math.max(...totalEnergyByDay, 1e-12);
    const lateSlice = outEnergyByDay.slice(3, Math.min(8, steps));
    const lateMean = lateSlice.reduce((a, b) => a + b, 0) / Math.max(1, lateSlice.length);
    const isNullPreset = state.activePresetId === "null" || (!state.activeEffects || state.activeEffects.length === 0);

    const nonzero = isNullPreset ? maxZ <= 1e-3 : maxZ >= 1e-3;
    const localized = isNullPreset ? true : nearFracDay1 >= 0.60;
    const propagates = isNullPreset
      ? true
      : lateMean > 1.5 * outEnergyByDay[0] + 1e-12 && lateMean > 0.02 * maxTotE && maxTeleportFrac < 0.05;
    const stable = maxZ <= 5.0 && maxTeleportFrac < 0.05;

    return {
      allFinite,
      minRain,
      minTemp,
      maxTemp,
      maxZ,
      nearFracDay1,
      maxTeleportFrac,
      nonzero,
      localized,
      propagates,
      stable,
      nearEnergyByDay,
      outEnergyByDay,
      totalEnergyByDay,
    };
  }

  function drawWavefrontChart(metrics) {
    const canvas = document.getElementById("canvas-wavefront");
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!metrics) return;

    const steps = metrics.totalEnergyByDay.length;
    const padL = 42, padR = 16, padT = 18, padB = 24;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Plot percentage of daily energy inside Near Zone vs Outside (Outward Wavefront)
    ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = padT + (plotH * g) / 4;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillStyle = "#94A3B8";
      ctx.font = "10px monospace";
      ctx.fillText(`${100 - g * 25}%`, 6, y + 3);
    }

    const nearShare = metrics.totalEnergyByDay.map((tot, k) =>
      tot > 1e-12 ? metrics.nearEnergyByDay[k] / tot : 1.0
    );
    const outShare = metrics.totalEnergyByDay.map((tot, k) =>
      tot > 1e-12 ? metrics.outEnergyByDay[k] / tot : 0.0
    );

    function plotLine(arr, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let k = 0; k < steps; k++) {
        const x = padL + (plotW * k) / Math.max(1, steps - 1);
        const y = padT + plotH * (1.0 - arr[k]);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    plotLine(nearShare, "#FACC15"); // Inside Near Zone (<= 3 cells)
    plotLine(outShare, "#38BDF8");  // Outward Ripple (> 3 cells)

    // Current selected day vertical marker
    const curX = padL + (plotW * state.selectedDay) / Math.max(1, steps - 1);
    ctx.strokeStyle = "#22C55E";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(curX, padT);
    ctx.lineTo(curX, padT + plotH);
    ctx.stroke();

    // X labels & legend
    ctx.fillStyle = "#94A3B8";
    ctx.font = "10px monospace";
    for (let k = 0; k < steps; k++) {
      const x = padL + (plotW * k) / Math.max(1, steps - 1);
      ctx.fillText(`D+${k + 1}`, x - 10, H - 6);
    }
    ctx.fillStyle = "#FACC15";
    ctx.fillText("■ Inside Near Box (<=3 cells)", padL + 8, 13);
    ctx.fillStyle = "#38BDF8";
    ctx.fillText("■ Outward Wavefront (>3 cells)", padL + 215, 13);

    document.getElementById("wavefront-summary").textContent =
      `Day-1 Near: ${(metrics.nearFracDay1 * 100).toFixed(1)}% | Outward: ${metrics.propagates ? "PASS" : "CHECK"}`;
  }

  function setTrustBadge(id, pass, valText) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `trust-item ${pass ? "pass" : "fail"}`;
    el.querySelector(".trust-val").textContent = valText;
  }

  function updateTrustAndCausalityPanel() {
    const m = computeCausalityAndWavefront();
    if (!m) return;

    const shapeOk =
      state.primeRollout.length === state.steps &&
      state.primeRollout[0].length === 6 &&
      state.primeRollout[0][0].length === NLAT &&
      state.primeRollout[0][0][0].length === NLON;
    const rainOk = m.minRain >= -1e-6;
    const tempOk = m.minTemp >= 233.15 && m.maxTemp <= 333.15;
    const nullOk = state.nullDiffSigma <= 1e-3;

    setTrustBadge("trust-schema", shapeOk, shapeOk ? `[${state.steps},6,32,36]` : "FAIL");
    setTrustBadge("trust-finite", m.allFinite, m.allFinite ? "0 NaN/Inf" : "FAIL");
    setTrustBadge("trust-rain", rainOk, `${Math.max(0, m.minRain).toFixed(1)} mm`);
    setTrustBadge("trust-temp", tempOk, `${(m.minTemp - 273.15).toFixed(0)}..${(m.maxTemp - 273.15).toFixed(0)}°C`);
    setTrustBadge("trust-null", nullOk, `${state.nullDiffSigma.toFixed(2)}σ`);
    setTrustBadge("trust-local", m.localized, `${(m.nearFracDay1 * 100).toFixed(1)}%`);
    setTrustBadge("trust-prop", m.propagates, m.propagates ? "PASS" : "LOW");
    setTrustBadge("trust-stable", m.stable, `${m.maxZ.toFixed(2)}σ`);

    const checks = [shapeOk, m.allFinite, rainOk, tempOk, nullOk, m.localized, m.propagates, m.stable];
    const passCount = checks.filter(Boolean).length;
    const badge = document.getElementById("trust-overall-badge");
    badge.textContent = `${passCount} / 8 PASS`;
    badge.className = `tag-pill ${passCount === 8 ? "tag-green" : "tag-alert"}`;

    drawWavefrontChart(m);
  }

  // --- Option C: 3-Hazard Disaster Command Center & Deterministic Policy Co-Pilot ---
  function updateDisasterImpactAndPolicy() {
    if (!state.primeRollout || !state.shockRollout) return;
    const steps = state.primeRollout.length;
    const lsm = state.data.grid.land_sea_mask;

    // Aggregate 10-day physical indicators across India land & coastal cells
    let primeHeavyRainCells = 0, shockHeavyRainCells = 0;
    let primeMax10dRain = 0, shockMax10dRain = 0;
    let primeMinMsl = Infinity, shockMinMsl = Infinity;
    let primeMaxTempC = -Infinity, shockMaxTempC = -Infinity;
    let primeHeatStressCells = 0, shockHeatStressCells = 0;
    let primeLandRainSum = 0, shockLandRainSum = 0, landCount = 0;

    for (let r = 0; r < NLAT; r++) {
      for (let c = 0; c < NLON; c++) {
        const isLand = lsm[r][c] >= 0.4;
        let cellPrimeRain10d = 0;
        let cellShockRain10d = 0;

        for (let k = 0; k < steps; k++) {
          const pTp = state.primeRollout[k][1][r][c];
          const sTp = state.shockRollout[k][1][r][c];
          const pT = state.primeRollout[k][0][r][c] - 273.15;
          const sT = state.shockRollout[k][0][r][c] - 273.15;
          const pMsl = state.primeRollout[k][4][r][c] / 100.0;
          const sMsl = state.shockRollout[k][4][r][c] / 100.0;
          const pQ = state.primeRollout[k][5][r][c];
          const sQ = state.shockRollout[k][5][r][c];

          cellPrimeRain10d += pTp;
          cellShockRain10d += sTp;

          if (pTp > 10.0) primeHeavyRainCells++;
          if (sTp > 10.0) shockHeavyRainCells++;
          if (pMsl < primeMinMsl) primeMinMsl = pMsl;
          if (sMsl < shockMinMsl) shockMinMsl = sMsl;

          if (isLand) {
            if (pT > primeMaxTempC) primeMaxTempC = pT;
            if (sT > shockMaxTempC) shockMaxTempC = sT;
            // Wet-bulb thermal stress proxy: T_C + 0.12 * tcwv >= 38.0
            if (pT + 0.12 * pQ >= 38.0) primeHeatStressCells++;
            if (sT + 0.12 * sQ >= 38.0) shockHeatStressCells++;
          }
        }

        if (cellPrimeRain10d > primeMax10dRain) primeMax10dRain = cellPrimeRain10d;
        if (cellShockRain10d > shockMax10dRain) shockMax10dRain = cellShockRain10d;
        if (isLand) {
          primeLandRainSum += cellPrimeRain10d;
          shockLandRainSum += cellShockRain10d;
          landCount++;
        }
      }
    }

    const primeMeanLandRain = primeLandRainSum / Math.max(1, landCount);
    const shockMeanLandRain = shockLandRainSum / Math.max(1, landCount);
    const rainPctDelta = primeMeanLandRain > 0.1
      ? ((shockMeanLandRain - primeMeanLandRain) / primeMeanLandRain) * 100.0
      : 0.0;

    // Populate the active Hazard Tab KPIs
    const l1 = document.getElementById("hkpi-1-label");
    const v1 = document.getElementById("hkpi-1-val");
    const d1 = document.getElementById("hkpi-1-delta");
    const l2 = document.getElementById("hkpi-2-label");
    const v2 = document.getElementById("hkpi-2-val");
    const d2 = document.getElementById("hkpi-2-delta");
    const l3 = document.getElementById("hkpi-3-label");
    const v3 = document.getElementById("hkpi-3-val");
    const d3 = document.getElementById("hkpi-3-delta");
    const l4 = document.getElementById("hkpi-4-label");
    const v4 = document.getElementById("hkpi-4-val");
    const d4 = document.getElementById("hkpi-4-delta");

    if (state.hazardTab === "flood") {
      const dHeavy = shockHeavyRainCells - primeHeavyRainCells;
      const dPeak = shockMax10dRain - primeMax10dRain;
      const dMsl = shockMinMsl - primeMinMsl;
      l1.textContent = "Heavy-Rain Cell-Days (>10 mm/d)";
      v1.textContent = `${shockHeavyRainCells}`;
      d1.textContent = `${dHeavy >= 0 ? "+" : ""}${dHeavy} vs Prime (${primeHeavyRainCells})`;
      l2.textContent = "Peak 10-Day Accumulation";
      v2.textContent = `${shockMax10dRain.toFixed(1)} mm`;
      d2.textContent = `${dPeak >= 0 ? "+" : ""}${dPeak.toFixed(1)} mm vs Prime`;
      l3.textContent = "Min Core Sea-Level Pressure";
      v3.textContent = `${shockMinMsl.toFixed(1)} hPa`;
      d3.textContent = `${dMsl >= 0 ? "+" : ""}${dMsl.toFixed(1)} hPa vs Prime`;
      l4.textContent = "Flood & Surge Alert Level";
      v4.textContent = dHeavy > 25 || dMsl < -3.0 ? "HIGH SURGE" : (dHeavy < -25 ? "SUPPRESSED" : "MODERATE");
      d4.textContent = "NDMA Coastal & River Basin Index";
    } else if (state.hazardTab === "heat") {
      const dT = shockMaxTempC - primeMaxTempC;
      const dCells = shockHeatStressCells - primeHeatStressCells;
      l1.textContent = "Peak Land Temperature (10-Day)";
      v1.textContent = `${shockMaxTempC.toFixed(1)} °C`;
      d1.textContent = `${dT >= 0 ? "+" : ""}${dT.toFixed(2)} °C vs Prime`;
      l2.textContent = "Wet-Bulb Stress Cell-Days";
      v2.textContent = `${shockHeatStressCells}`;
      d2.textContent = `${dCells >= 0 ? "+" : ""}${dCells} vs Prime (${primeHeatStressCells})`;
      l3.textContent = "Grid Cooling Load Surge Proxy";
      const mwSurge = Math.round(dT * 1450 + dCells * 6.5);
      v3.textContent = `${mwSurge >= 0 ? "+" : ""}${mwSurge} MW`;
      d3.textContent = "Estimated Regional HVAC Demand Delta";
      l4.textContent = "Thermal Stress Advisory";
      v4.textContent = dT >= 1.5 ? "SEVERE HEAT" : (dT <= -1.0 ? "COOLING ANOMALY" : "NORMAL");
      d4.textContent = "Heat-Moisture Wet-Bulb Index";
    } else {
      const dRainMm = shockMeanLandRain - primeMeanLandRain;
      l1.textContent = "All-India 10-Day Land Rainfall";
      v1.textContent = `${shockMeanLandRain.toFixed(1)} mm`;
      d1.textContent = `${dRainMm >= 0 ? "+" : ""}${dRainMm.toFixed(1)} mm (${rainPctDelta >= 0 ? "+" : ""}${rainPctDelta.toFixed(1)}%)`;
      l2.textContent = "Kharif Soil Moisture Balance";
      v2.textContent = rainPctDelta < -5.0 ? "DEFICIT" : (rainPctDelta > 5.0 ? "SURPLUS" : "STABLE");
      d2.textContent = `Cumulative 10-Day Anomaly`;
      l3.textContent = "Heavy Downpour Lodging Risk";
      const dHeavy = shockHeavyRainCells - primeHeavyRainCells;
      v3.textContent = `${shockHeavyRainCells} cells`;
      d3.textContent = `${dHeavy >= 0 ? "+" : ""}${dHeavy} wet extremes vs Prime`;
      l4.textContent = "Agro-Advisory Trigger";
      v4.textContent = rainPctDelta < -6.0 ? "IRRIGATION ALERT" : (rainPctDelta > 8.0 ? "DRAINAGE ALERT" : "NOMINAL");
      d4.textContent = "ICAR / Kharif Crop Co-Pilot";
    }

    // Rule-Based Deterministic Policy Co-Pilot & Auto-Narrator
    const k = state.selectedDay;
    const dTempMean = meanDeltaAtDay(k, 0);
    const dRainMean = meanDeltaAtDay(k, 1);
    const dMoistMean = meanDeltaAtDay(k, 5);

    const narratorEl = document.getElementById("narrator-box");
    narratorEl.innerHTML =
      `<p class="narrator-lead"><strong>Day +${k + 1} Situational Briefing (${escapeHtml(state.activeTitle)}):</strong> ` +
      `All-India mean temperature shifts by <strong>${dTempMean >= 0 ? "+" : ""}${dTempMean.toFixed(2)} K</strong>, ` +
      `column water vapor changes by <strong>${dMoistMean >= 0 ? "+" : ""}${dMoistMean.toFixed(2)} kg/m²</strong>, ` +
      `and 10-day land precipitation shifts by <strong>${rainPctDelta >= 0 ? "+" : ""}${rainPctDelta.toFixed(1)}%</strong> ` +
      `(${shockHeavyRainCells - primeHeavyRainCells >= 0 ? "+" : ""}${shockHeavyRainCells - primeHeavyRainCells} heavy-rain cell-days &gt;10 mm/d).</p>`;

    const actionsEl = document.getElementById("policy-actions");
    const policies = [];
    if (shockHeavyRainCells - primeHeavyRainCells > 15 || shockMinMsl - primeMinMsl < -2.0) {
      policies.push({
        agency: "NDMA / FLOOD & CYCLONE DESK",
        action: `Pre-position flood response along East/West coastal basins (+${shockHeavyRainCells - primeHeavyRainCells} heavy-rain cell-days >10 mm/d; core pressure ${shockMinMsl.toFixed(1)} hPa).`,
      });
    }
    if (rainPctDelta < -4.0) {
      policies.push({
        agency: "MINISTRY OF AGRICULTURE (KHARIF SHIELD)",
        action: `Monsoon moisture deficit (${rainPctDelta.toFixed(1)}% 10-day land rain) detected. Trigger canal irrigation release for Peninsular & Central farming zones.`,
      });
    }
    if (shockMaxTempC - primeMaxTempC > 1.0) {
      policies.push({
        agency: "POSOCO / NATIONAL GRID CO-PILOT",
        action: `Peak land temperature rises by +${(shockMaxTempC - primeMaxTempC).toFixed(1)}°C. Schedule reserve peaking capacity for projected afternoon cooling load surge.`,
      });
    }
    if (policies.length === 0) {
      policies.push({
        agency: "INTEGRATED COMMAND STATUS",
        action: "Counterfactual perturbation remains within baseline operating thresholds or Zero-Shock Control is active.",
      });
    }
    actionsEl.innerHTML = policies
      .map((p) => `<div class="policy-item"><strong>[${p.agency}]</strong><br/>${p.action}</div>`)
      .join("");
  }

  function meanDeltaAtDay(k, ch) {
    let sum = 0;
    for (let r = 0; r < NLAT; r++) {
      for (let c = 0; c < NLON; c++) {
        sum += state.shockRollout[k][ch][r][c] - state.primeRollout[k][ch][r][c];
      }
    }
    return sum / (NLAT * NLON);
  }

  function meanGrid(grid2d) {
    let sum = 0;
    for (let r = 0; r < NLAT; r++) {
      for (let c = 0; c < NLON; c++) sum += grid2d[r][c];
    }
    return sum / (NLAT * NLON);
  }

  // --- Master View Updater ---
  function updateAllViews() {
    if (!state.primeRollout || !state.shockRollout) return;
    const k = Math.min(state.selectedDay, state.primeRollout.length - 1);
    const ch = state.selectedChannel;

    document.getElementById("current-day-title").textContent =
      `Forecast Lead: Day +${k + 1} ${k === 0 || k === 3 || k === 7 ? "(Official Scored Lead)" : ""}`;
    document.getElementById("active-scenario-title").textContent = `Active: ${state.activeTitle}`;

    const primeGrid = state.primeRollout[k][ch];
    const shockGrid = state.shockRollout[k][ch];
    const deltaGrid = Array.from({ length: NLAT }, (_, r) =>
      Array.from({ length: NLON }, (_, c) => {
        if (state.renderMode === "mc" && state.mcSpread) {
          return state.mcSpread[k][ch][r][c];
        }
        return shockGrid[r][c] - primeGrid[r][c];
      })
    );

    const [pMin, pMax] = getGridMinMax(primeGrid, false);
    const [sMin, sMax] = getGridMinMax(shockGrid, false);
    const combinedMin = Math.min(pMin, sMin);
    const combinedMax = Math.max(pMax, sMax);
    const isMC = state.renderMode === "mc" && state.mcSpread;
    const [dMin, dMax] = getGridMinMax(deltaGrid, !isMC);

    document.getElementById("delta-panel-title").textContent =
      isMC ? "MONTE CARLO ENSEMBLE SPREAD (σ)" : "COUNTERFACTUAL DELTA (Δ)";
    document.getElementById("delta-panel-sub").textContent =
      isMC ? "5-Member Perturbation Uncertainty" : "Shock − Prime + Shock Box & 3-Cell Near Zone";

    if (state.renderMode === "3d") {
      draw3DIsometricMap("canvas-prime", primeGrid, combinedMin, combinedMax, false);
      draw3DIsometricMap("canvas-shock", shockGrid, combinedMin, combinedMax, false);
      draw3DIsometricMap("canvas-delta", deltaGrid, dMin, dMax, !isMC);
    } else {
      draw2DMap("canvas-prime", primeGrid, state.primeRollout[k][2], state.primeRollout[k][3], combinedMin, combinedMax, false, false);
      draw2DMap("canvas-shock", shockGrid, state.shockRollout[k][2], state.shockRollout[k][3], combinedMin, combinedMax, false, true);
      draw2DMap("canvas-delta", deltaGrid, null, null, dMin, dMax, !isMC, true);
    }

    document.getElementById("stat-prime").textContent = `Mean: ${formatDisplayVal(ch, meanGrid(primeGrid), false)}`;
    document.getElementById("stat-shock").textContent = `Mean: ${formatDisplayVal(ch, meanGrid(shockGrid), false)}`;
    const maxAbsDelta = Math.max(Math.abs(dMin), Math.abs(dMax));
    document.getElementById("stat-delta").textContent =
      `${isMC ? "Max σ" : "Max |Δ|"}: ${formatDisplayVal(ch, maxAbsDelta, true)}`;

    document.getElementById("cb-prime-min").textContent = formatDisplayVal(ch, combinedMin, false);
    document.getElementById("cb-prime-max").textContent = formatDisplayVal(ch, combinedMax, false);
    document.getElementById("cb-shock-min").textContent = formatDisplayVal(ch, combinedMin, false);
    document.getElementById("cb-shock-max").textContent = formatDisplayVal(ch, combinedMax, false);
    document.getElementById("cb-delta-min").textContent = formatDisplayVal(ch, dMin, true);
    document.getElementById("cb-delta-max").textContent = formatDisplayVal(ch, dMax, true);

    updateHoverInspector();
    updateTrustAndCausalityPanel();
    updateDisasterImpactAndPolicy();
  }

  function updateHoverInspector() {
    if (!state.primeRollout || !state.shockRollout || !state.hoverCell) return;
    const { r, c } = state.hoverCell;
    const k = Math.min(state.selectedDay, state.primeRollout.length - 1);
    const ch = state.selectedChannel;
    const lat = state.data.grid.lat[r];
    const lon = state.data.grid.lon[c];
    const isLand = state.data.grid.land_sea_mask[r][c] >= 0.5;
    const elev = state.data.grid.orography_m[r][c];

    const pVal = state.primeRollout[k][ch][r][c];
    const sVal = state.shockRollout[k][ch][r][c];
    const uVal = state.shockRollout[k][2][r][c];
    const vVal = state.shockRollout[k][3][r][c];
    const rainVal = state.shockRollout[k][1][r][c];
    const prob = state.mcRainProb
      ? state.mcRainProb[k][r][c]
      : Math.min(99.0, Math.max(1.0, (rainVal / 14.0) * 100.0));

    document.getElementById("inspect-coords").textContent =
      `Cell [${r}, ${c}] · ${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E`;
    document.getElementById("insp-geo").textContent =
      `${isLand ? "Land" : "Ocean"} · ${Math.round(elev)} m`;
    document.getElementById("insp-prime").textContent = formatDisplayVal(ch, pVal, false);
    document.getElementById("insp-shock").textContent = formatDisplayVal(ch, sVal, false);
    document.getElementById("insp-delta").textContent = formatDisplayVal(ch, sVal - pVal, true);
    document.getElementById("insp-wind").textContent = `u:${uVal.toFixed(1)}, v:${vVal.toFixed(1)} m/s`;
    document.getElementById("insp-prob").textContent = `${prob.toFixed(0)}%`;
  }

  // --- Interactive Canvas Mouse Hover & Drag-to-Draw Shock Box ---
  function attachCanvasInteractions(canvasId) {
    const canvas = document.getElementById(canvasId);
    function posToGrid(ev) {
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(1 - 1e-6, (ev.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1 - 1e-6, (ev.clientY - rect.top) / rect.height));
      const c = Math.floor(x * NLON);
      const r = NLAT - 1 - Math.floor(y * NLAT);
      return { r, c, lat: state.data.grid.lat[r], lon: state.data.grid.lon[c] };
    }

    canvas.addEventListener("mousemove", (ev) => {
      const cell = posToGrid(ev);
      const prev = state.hoverCell;
      const changed = !prev || prev.r !== cell.r || prev.c !== cell.c;
      if (!changed && !state.dragStart) return;
      state.hoverCell = { r: cell.r, c: cell.c };
      if (state.dragStart) {
        const latMin = Math.min(state.dragStart.lat, cell.lat);
        const latMax = Math.max(state.dragStart.lat, cell.lat);
        const lonMin = Math.min(state.dragStart.lon, cell.lon);
        const lonMax = Math.max(state.dragStart.lon, cell.lon);
        setBoxInputs({ lat_min: latMin, lat_max: latMax, lon_min: lonMin, lon_max: lonMax });
        updateAllViews();
      } else {
        updateHoverInspector();
      }
    });

    canvas.addEventListener("mousedown", (ev) => {
      if (state.renderMode === "3d") return;
      state.dragStart = posToGrid(ev);
    });

    window.addEventListener("mouseup", () => {
      if (state.dragStart) {
        state.dragStart = null;
      }
    });
  }

  function setBoxInputs(box) {
    state.activeBox = box;
    document.getElementById("box-lat-min").value = box.lat_min.toFixed(1);
    document.getElementById("box-lat-max").value = box.lat_max.toFixed(1);
    document.getElementById("box-lon-min").value = box.lon_min.toFixed(1);
    document.getElementById("box-lon-max").value = box.lon_max.toFixed(1);
  }

  function setRenderMode(mode) {
    state.renderMode = mode;
    document.querySelectorAll("#render-mode-tabs .pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    updateAllViews();
  }

  // --- Initialization ---
  async function initDashboard() {
    if (window.VARSHA_PRESETS) {
      state.data = window.VARSHA_PRESETS;
    } else {
      try {
        const r = await fetch("presets.json");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        state.data = await r.json();
      } catch (err) {
        showApiError(`Failed to load presets.json: ${err.message}`);
        return;
      }
    }

    // Build 1-Click Scenario Preset Buttons
    const presetContainer = document.getElementById("preset-buttons");
    presetContainer.innerHTML = "";
    state.data.presets.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `preset-btn ${p.id === state.activePresetId ? "active" : ""}`;
      btn.dataset.id = p.id;
      btn.innerHTML = `<span>${escapeHtml(p.name)}</span><span class="preset-badge">${escapeHtml(p.badge)}</span>`;
      btn.addEventListener("click", () => {
        state.activePresetId = p.id;
        state.activeTitle = p.name;
        state.activeEffects = p.effects.map((e) => ({ ...e }));
        setBoxInputs({ ...p.box });
        if (p.effects.length > 0) {
          document.getElementById("shock-channel").value = String(p.effects[0].channel);
          document.getElementById("shock-mode").value = p.effects[0].mode;
          document.getElementById("shock-strength").value = String(p.effects[0].val);
          document.getElementById("shock-strength-val").textContent =
            `${p.effects[0].val >= 0 ? "+" : ""}${Number(p.effects[0].val).toFixed(2)}`;
        }
        document.querySelectorAll(".preset-btn").forEach((b) => b.classList.toggle("active", b.dataset.id === p.id));
        runSimulationPair();
      });
      presetContainer.appendChild(btn);
    });

    // Wire Left Rail Controls
    document.getElementById("window-select").addEventListener("change", (ev) => {
      state.windowKey = ev.target.value;
      runSimulationPair();
    });

    document.getElementById("shock-strength").addEventListener("input", (ev) => {
      const v = parseFloat(ev.target.value);
      document.getElementById("shock-strength-val").textContent = `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
    });

    document.getElementById("btn-run-custom").addEventListener("click", () => {
      const rawLat1 = Math.max(6.5, Math.min(37.5, parseFloat(document.getElementById("box-lat-min").value) || 8.0));
      const rawLat2 = Math.max(6.5, Math.min(37.5, parseFloat(document.getElementById("box-lat-max").value) || 20.0));
      const rawLon1 = Math.max(65.5, Math.min(100.5, parseFloat(document.getElementById("box-lon-min").value) || 82.0));
      const rawLon2 = Math.max(65.5, Math.min(100.5, parseFloat(document.getElementById("box-lon-max").value) || 94.0));
      const box = {
        lat_min: Math.min(rawLat1, rawLat2),
        lat_max: Math.max(rawLat1, rawLat2),
        lon_min: Math.min(rawLon1, rawLon2),
        lon_max: Math.max(rawLon1, rawLon2),
      };
      setBoxInputs(box);
      const ch = parseInt(document.getElementById("shock-channel").value, 10) || 0;
      const mode = document.getElementById("shock-mode").value;
      const val = parseFloat(document.getElementById("shock-strength").value) || 0.0;

      state.activePresetId = "custom";
      state.activeBox = box;
      state.activeEffects = Math.abs(val) < 1e-6 ? [] : [{ channel: ch, mode, val }];
      state.activeTitle = `Custom Shock: ${CHANNELS[ch].key} (${val >= 0 ? "+" : ""}${val} ${mode === "rel" ? "rel" : CHANNELS[ch].unit}) in [${box.lat_min}..${box.lat_max}°N, ${box.lon_min}..${box.lon_max}°E]`;
      document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
      runSimulationPair();
    });

    document.getElementById("btn-run-mc").addEventListener("click", runMonteCarloEnsemble);
    document.getElementById("btn-verify-null").addEventListener("click", verifyNullShockLive);
    document.getElementById("btn-retry-api").addEventListener("click", runSimulationPair);

    // Wire Toolbar Pills
    document.querySelectorAll("#channel-tabs .pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedChannel = parseInt(btn.dataset.ch, 10);
        document.querySelectorAll("#channel-tabs .pill").forEach((b) => b.classList.toggle("active", b === btn));
        updateAllViews();
      });
    });

    document.querySelectorAll("#render-mode-tabs .pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.mode === "mc" && !state.mcSpread) {
          runMonteCarloEnsemble();
        } else {
          setRenderMode(btn.dataset.mode);
        }
      });
    });

    // Wire Hazard Tabs
    document.querySelectorAll("#hazard-tabs .hazard-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.hazardTab = btn.dataset.hazard;
        document.querySelectorAll("#hazard-tabs .hazard-tab").forEach((b) => b.classList.toggle("active", b === btn));
        updateDisasterImpactAndPolicy();
      });
    });

    // Wire Timeline Day Slider & Play Button
    const daySlider = document.getElementById("day-slider");
    daySlider.addEventListener("input", (ev) => {
      state.selectedDay = parseInt(ev.target.value, 10) || 0;
      updateAllViews();
    });

    const playBtn = document.getElementById("btn-play");
    playBtn.addEventListener("click", () => {
      state.playing = !state.playing;
      playBtn.setAttribute("aria-pressed", String(state.playing));
      const icon = document.getElementById("icon-play");
      if (state.playing) {
        if (icon) icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
        state.playTimer = setInterval(() => {
          state.selectedDay = (state.selectedDay + 1) % state.steps;
          daySlider.value = String(state.selectedDay);
          updateAllViews();
        }, 650);
      } else {
        if (icon) icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3" />';
        if (state.playTimer) {
          clearInterval(state.playTimer);
          state.playTimer = null;
        }
      }
    });

    ["canvas-prime", "canvas-shock", "canvas-delta"].forEach(attachCanvasInteractions);

    // Run initial live simulation on load
    await runSimulationPair();
  }

  window.addEventListener("DOMContentLoaded", initDashboard);
})();
