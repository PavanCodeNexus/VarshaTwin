/* VarshaTwin — Stitch Light-Theme Regional Insights + Live Multiverse Digital Twin
 * Plain HTML/CSS/JS · 100% Offline · Live POST /simulate · Georeferenced India & 3D Globe
 */
(function () {
  "use strict";

  const CHANNELS = [
    { idx: 0, key: "t2m", name: "Temperature", unit: "K", dispUnit: "°C" },
    { idx: 1, key: "tp", name: "Rainfall", unit: "mm/d", dispUnit: "mm/d" },
    { idx: 2, key: "u10", name: "East Wind", unit: "m/s", dispUnit: "m/s" },
    { idx: 3, key: "v10", name: "North Wind", unit: "m/s", dispUnit: "m/s" },
    { idx: 4, key: "msl", name: "Sea-Level Pressure", unit: "Pa", dispUnit: "hPa" },
    { idx: 5, key: "tcwv", name: "Column Moisture", unit: "kg/m²", dispUnit: "kg/m²" },
  ];

  const NLAT = 32;
  const NLON = 36;

  // Georeferenced Indian States mapped to India's 32x36 ERA5 Grid (6.5°N–37.5°N, 65.5°E–100.5°E)
  const INDIA_STATES = {
    "Karnataka": {
      lat_min: 12.0, lat_max: 17.5, lon_min: 74.0, lon_max: 78.0,
      centerLat: 14.8, centerLon: 76.2,
      basin: "Cauvery, Krishna & Tungabhadra",
      cropZone: "Interior rabi pulses, coffee & coastal paddy",
      terrainNote: "Western Ghats & Malnad slopes",
    },
    "Maharashtra": {
      lat_min: 16.5, lat_max: 21.5, lon_min: 72.8, lon_max: 80.5,
      centerLat: 19.2, centerLon: 75.8,
      basin: "Godavari, Krishna & Koyna",
      cropZone: "Konkan paddy, Marathwada cotton & soybean",
      terrainNote: "Konkan coast & Sahyadri ghats",
    },
    "Kerala": {
      lat_min: 8.5, lat_max: 12.5, lon_min: 75.0, lon_max: 77.5,
      centerLat: 10.5, centerLon: 76.3,
      basin: "Periyar, Bharathapuzha & Idukki",
      cropZone: "Spice plantations, rubber & wetland paddy",
      terrainNote: "Steep Western Ghats escarpment",
    },
    "Tamil Nadu": {
      lat_min: 8.5, lat_max: 13.5, lon_min: 77.0, lon_max: 80.5,
      centerLat: 11.1, centerLon: 78.7,
      basin: "Cauvery Delta, Vaigai & Mettur",
      cropZone: "Thanjavur delta paddy & irrigated millets",
      terrainNote: "Coromandel coast & Nilgiri hills",
    },
    "Andhra Pradesh": {
      lat_min: 13.5, lat_max: 18.5, lon_min: 78.0, lon_max: 84.5,
      centerLat: 16.2, centerLon: 80.6,
      basin: "Godavari & Krishna Delta",
      cropZone: "Coastal delta paddy, chillies & aquaculture",
      terrainNote: "Eastern Ghats & Bay coastal plains",
    },
    "Telangana": {
      lat_min: 16.0, lat_max: 19.5, lon_min: 77.5, lon_max: 81.0,
      centerLat: 17.9, centerLon: 79.2,
      basin: "Godavari & Nagarjuna Sagar",
      cropZone: "Deccan plateau cotton, maize & red gram",
      terrainNote: "Central Deccan plateau",
    },
    "Odisha": {
      lat_min: 18.0, lat_max: 22.5, lon_min: 81.5, lon_max: 87.5,
      centerLat: 20.3, centerLon: 85.2,
      basin: "Mahanadi, Brahmani & Baitarani",
      cropZone: "Coastal kharif/rabi paddy & delta pulses",
      terrainNote: "Puri–Ganjam Bay of Bengal littoral",
    },
    "West Bengal": {
      lat_min: 21.5, lat_max: 26.8, lon_min: 86.0, lon_max: 89.8,
      centerLat: 23.4, centerLon: 87.9,
      basin: "Hooghly, Damodar & Teesta",
      cropZone: "Gangetic plains paddy, jute & Sundarbans",
      terrainNote: "Sundarbans estuary & lower Gangetic plain",
    },
  };

  // True Georeferenced India Country Outline Polygon in [lon, lat] degrees (68.1°E–97.4°E, 8.1°N–37.1°N)
  const INDIA_BORDER_LONLAT = [
    [68.2, 23.7], [69.0, 22.3], [70.5, 20.9], [72.6, 21.7], [72.8, 19.0],
    [73.4, 16.0], [74.8, 12.8], [76.2, 9.9],  [77.5, 8.1],  [78.2, 8.8],
    [79.8, 10.3], [80.3, 13.1], [80.1, 15.8], [82.2, 16.8], [84.9, 19.2],
    [86.9, 21.5], [88.2, 21.6], [89.0, 22.2], [88.8, 24.4], [88.1, 26.6],
    [88.2, 27.9], [89.8, 26.8], [91.6, 26.8], [92.1, 27.7], [94.2, 28.4],
    [96.1, 29.4], [97.4, 28.2], [96.6, 27.1], [95.1, 26.6], [94.6, 25.4],
    [93.2, 23.1], [92.3, 24.2], [91.5, 23.0], [91.8, 25.1], [89.8, 25.8],
    [88.1, 26.5], [85.2, 26.8], [81.0, 28.4], [80.2, 29.8], [78.9, 31.4],
    [78.5, 32.8], [79.5, 34.4], [78.2, 35.8], [76.0, 36.9], [74.2, 36.8],
    [73.8, 35.2], [74.6, 33.4], [75.2, 32.1], [73.9, 30.2], [71.0, 27.8],
    [69.5, 26.8], [70.2, 25.4], [68.4, 24.4], [68.2, 23.7],
  ];

  // Key Internal State BoundaryPolylines in [lon, lat] degrees
  const INDIA_STATE_LINES_LONLAT = [
    [[72.8, 20.2], [76.2, 21.2], [80.3, 21.4], [83.8, 21.2], [86.9, 21.5]], // N Maharashtra / Chhattisgarh / Odisha
    [[73.4, 16.0], [77.4, 16.2], [80.1, 15.8]],                             // Karnataka / Maharashtra / Telangana / AP
    [[74.8, 12.8], [77.2, 12.6], [80.3, 13.1]],                             // Kerala / Karnataka / Tamil Nadu
    [[76.2, 9.9],  [77.4, 11.5], [77.2, 12.6]],                             // Kerala / Tamil Nadu Western Ghats
    [[77.4, 16.2], [78.0, 19.2], [80.3, 21.4]],                             // Telangana / Maharashtra
    [[78.0, 19.2], [81.2, 18.8], [84.9, 19.2]],                             // Telangana / Odisha / AP
    [[82.2, 16.8], [81.2, 18.8], [83.8, 21.2], [86.2, 22.6], [88.2, 21.6]], // AP / Odisha / West Bengal
    [[70.2, 25.4], [75.8, 25.2], [78.4, 26.5], [84.2, 25.6], [88.8, 24.4]], // Rajasthan / MP / UP / Bihar / Bengal
    [[72.6, 21.7], [74.5, 24.2], [75.8, 25.2], [76.2, 21.2]],               // Gujarat / Rajasthan / MP
  ];

  const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    data: null,
    windowKey: "monsoon_onset",
    steps: 10,
    activePresetId: "warm_ocean",
    activeBox: { lat_min: 8.0, lat_max: 20.0, lon_min: 82.0, lon_max: 94.0 },
    draftBox: null,
    activeEffects: [
      { channel: 0, mode: "add", val: 3.0 },
      { channel: 5, mode: "rel", val: 0.15 },
    ],
    activeTitle: "Warm Bay (+3K, +15% tcwv)",
    selectedChannel: 1,   // Default to Rainfall (matches Stitch Regional Insights default)
    selectedState: "Karnataka",
    compareMode: "split", // "split" | "swipe" | "delta"
    swipePct: 50,
    renderMode: "2d",     // "2d" | "3d" | "mc"
    smoothGrid: true,
    selectedDay: 0,
    playPos: 0.0,
    hazardTab: "flood",
    primeRollout: null,
    shockRollout: null,
    mcSpread: null,
    mcRainProb: null,
    nullDiffSigma: null,
    nullVerifiedKey: "",
    reqSeq: 0,
    refreshSwipeLayout: null,
    lastInferenceMs: 0.0,
    playing: false,
    playRafId: null,
    lastFrameTs: 0,
    dragStart: null,
    swiping: false,
    hoverCell: { r: 14, c: 16 },
    kpiPrevNums: {},
    kpiRafIds: {},
    wavefrontProgress: 1.0,
    wavefrontRafId: null,
    cachedCausality: null,
    presentationMode: false,
    darkTheme: false,
    globeRotLon: -78.9,
    globeRotLat: -20.5,
    globeZoom: 1.0,
    globeRafId: null,
    globeDragging: false,
    globeDragLast: null,
  };

  // --- Color Scales (Light & Dark Harmonized Perceptually Uniform Stops) ---
  const SEQ_STOPS = [
    [29, 78, 216],
    [6, 182, 212],
    [16, 185, 129],
    [245, 158, 11],
    [239, 68, 68],
  ];

  const DIV_STOPS = [
    [29, 78, 216],
    [96, 165, 250],
    [241, 245, 249],
    [245, 158, 11],
    [239, 68, 68],
  ];

  function sampleStops(stops, norm) {
    const t = Math.max(0, Math.min(1, norm));
    const scaled = t * (stops.length - 1);
    const idx = Math.min(stops.length - 2, Math.floor(scaled));
    const f = scaled - idx;
    const c1 = stops[idx];
    const c2 = stops[idx + 1];
    return [
      (c1[0] + (c2[0] - c1[0]) * f) | 0,
      (c1[1] + (c2[1] - c1[1]) * f) | 0,
      (c1[2] + (c2[2] - c1[2]) * f) | 0,
    ];
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateNumber(elId, targetNum, formatter, durationMs) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!Number.isFinite(targetNum) || prefersReducedMotion()) {
      state.kpiPrevNums[elId] = targetNum;
      el.textContent = formatter(targetNum);
      return;
    }
    const startNum = Number.isFinite(state.kpiPrevNums[elId]) ? state.kpiPrevNums[elId] : targetNum;
    state.kpiPrevNums[elId] = targetNum;
    if (Math.abs(targetNum - startNum) < 1e-6) {
      el.textContent = formatter(targetNum);
      return;
    }
    if (state.kpiRafIds[elId]) cancelAnimationFrame(state.kpiRafIds[elId]);
    const t0 = performance.now();
    const dur = durationMs || 320;

    function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      const val = startNum + (targetNum - startNum) * easeOutCubic(p);
      el.textContent = formatter(val);
      if (p < 1) {
        state.kpiRafIds[elId] = requestAnimationFrame(tick);
      } else {
        el.textContent = formatter(targetNum);
      }
    }
    state.kpiRafIds[elId] = requestAnimationFrame(tick);
  }

  function setLoadingState(loading) {
    const bar = document.getElementById("sim-progress-bar");
    const body = document.body;
    if (loading) {
      body.classList.add("is-loading");
      if (bar) {
        bar.classList.remove("done");
        bar.classList.add("active");
      }
    } else {
      body.classList.remove("is-loading");
      if (bar) {
        bar.classList.remove("active");
        bar.classList.add("done");
        setTimeout(() => bar.classList.remove("done"), 260);
      }
    }
  }

  function snapshotMapsForCrossFade() {
    if (prefersReducedMotion() || !state.primeRollout) return;
    const pairs = [
      ["canvas-prime", "fade-prime"],
      ["canvas-shock", "fade-shock"],
      ["canvas-delta", "fade-delta"],
    ];
    for (const [srcId, fadeId] of pairs) {
      const src = document.getElementById(srcId);
      const fade = document.getElementById(fadeId);
      if (!src || !fade) continue;
      const fctx = fade.getContext("2d");
      fctx.clearRect(0, 0, fade.width, fade.height);
      fctx.drawImage(src, 0, 0);
      if (srcId === "canvas-shock" && state.compareMode === "swipe") {
        const swipePrime = document.getElementById("canvas-swipe-prime");
        if (swipePrime) {
          const cutW = Math.round((state.swipePct / 100) * fade.width);
          if (cutW > 0) {
            fctx.drawImage(swipePrime, 0, 0, cutW, fade.height, 0, 0, cutW, fade.height);
          }
        }
      }
      fade.classList.add("fading-in");
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        for (const [, fadeId] of pairs) {
          const fade = document.getElementById(fadeId);
          if (fade) fade.classList.remove("fading-in");
        }
      });
    });
  }

  function showApiError(msg) {
    const banner = document.getElementById("api-error-banner");
    const msgEl = document.getElementById("api-error-msg");
    if (banner && msgEl) {
      banner.classList.remove("hidden");
      msgEl.textContent = msg;
    }
    if (!state.primeRollout) {
      const card = document.getElementById("stage-state-card");
      if (card) card.classList.remove("hidden");
    }
  }

  function hideStageOfflineCard() {
    const card = document.getElementById("stage-state-card");
    if (card) card.classList.add("hidden");
  }

  function renderOfflineTerrainPreview() {
    if (!state.data || state.primeRollout) return;
    const oro = state.data.grid.orography_m;
    const [oMin, oMax] = getGridMinMax(oro, false);
    draw2DMap("canvas-prime", oro, null, null, oMin, oMax, false, false);
    draw2DMap("canvas-shock", oro, null, null, oMin, oMax, false, true);
    draw2DMap("canvas-delta", oro, null, null, oMin, oMax, false, true);
    drawRegionalIndiaCanvas(oro, oMin, oMax);
  }

  function getApiUrl() {
    const el = document.getElementById("api-url-input");
    return (el ? el.value.trim() : "http://127.0.0.1:8000").replace(/\/+$/, "");
  }

  function formatCompactVal(ch, val, isDelta) {
    if (!Number.isFinite(val)) return "--";
    if (ch === 0) {
      return isDelta ? `${val >= 0 ? "+" : ""}${val.toFixed(2)} K` : `${(val - 273.15).toFixed(1)} °C`;
    }
    if (ch === 4) {
      return isDelta ? `${val >= 0 ? "+" : ""}${(val / 100).toFixed(1)} hPa` : `${(val / 100).toFixed(0)} hPa`;
    }
    const unit = CHANNELS[ch].unit;
    return `${isDelta && val >= 0 ? "+" : ""}${val.toFixed(1)} ${unit}`;
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
          pert[ch][r][c] += eff.mode === "rel" ? eff.val * lastDay[ch][r][c] : eff.val;
        }
      }
    }
    return pert;
  }

  // --- Live API Calls ---
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
        txt.textContent = "Live";
        banner.classList.add("hidden");
        modelEl.textContent = js.model_name || "VarshaTwin-L3";
        return true;
      }
      throw new Error("Server not ready");
    } catch (err) {
      pill.className = "status-pill status-down";
      txt.textContent = "Offline";
      showApiError(
        `Cannot reach server at ${getApiUrl()} (${err.message}). Start it with: python serve.py --port 8000`
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
      throw new Error(`POST /simulate HTTP ${res.status}`);
    }
    return await res.json();
  }

  function computeMaxSigmaDiff(rollA, rollB) {
    const std = state.data.grid.std;
    const steps = Math.min(rollA.length, rollB.length);
    let maxDiff = 0.0;
    for (let k = 0; k < steps; k++) {
      for (let ch = 0; ch < 6; ch++) {
        for (let r = 0; r < NLAT; r++) {
          for (let c = 0; c < NLON; c++) {
            const d = Math.abs(rollA[k][ch][r][c] - rollB[k][ch][r][c]) / std[ch];
            if (d > maxDiff) maxDiff = d;
          }
        }
      }
    }
    return maxDiff;
  }

  async function runSimulationPair() {
    const reqId = ++state.reqSeq;
    setLoadingState(true);
    const ok = await checkHealth();
    if (reqId !== state.reqSeq) return;
    if (!ok) {
      setLoadingState(false);
      return;
    }

    const winKey = state.windowKey;
    const win = state.data.windows[winKey];
    const steps = Math.max(4, Math.min(14, parseInt(document.getElementById("steps-input").value, 10) || 10));
    state.steps = steps;
    const slider = document.getElementById("day-slider");
    slider.max = String(steps - 1);
    if (state.selectedDay >= steps) {
      state.selectedDay = 0;
      state.playPos = 0.0;
      slider.value = "0";
    }

    const ticksEl = document.getElementById("day-ticks");
    if (ticksEl) {
      ticksEl.innerHTML = Array.from({ length: steps }, (_, i) => {
        const d = i + 1;
        const isScored = d === 1 || d === 4 || d === 8;
        return `<span class="${isScored ? "scored" : ""}">D+${d}</span>`;
      }).join("");
    }

    document.getElementById("doy-badge").textContent =
      `${win.doy_sincos[0].toFixed(2)}, ${win.doy_sincos[1].toFixed(2)}`;

    const pert = buildPerturbationFromState(win.init_states);
    const verifyKey = `${getApiUrl()}|${winKey}|${steps}`;
    const needNullVerify = state.nullVerifiedKey !== verifyKey || state.nullDiffSigma === null;
    const zeroPert = needNullVerify
      ? Array.from({ length: 6 }, () => Array.from({ length: NLAT }, () => new Array(NLON).fill(0.0)))
      : null;

    try {
      const t0 = performance.now();
      const [primeResp, shockResp, zeroResp] = await Promise.all([
        callSimulate(win.init_states, win.doy_sincos, steps, null),
        callSimulate(win.init_states, win.doy_sincos, steps, pert),
        zeroPert ? callSimulate(win.init_states, win.doy_sincos, steps, zeroPert) : Promise.resolve(null),
      ]);
      if (reqId !== state.reqSeq) return;
      const wallMs = performance.now() - t0;

      snapshotMapsForCrossFade();
      hideStageOfflineCard();
      state.primeRollout = primeResp.rollout;
      state.shockRollout = shockResp.rollout;
      state.mcSpread = null;
      state.mcRainProb = null;
      if (state.renderMode === "mc") {
        state.renderMode = "2d";
        document.querySelectorAll("#render-mode-tabs .seg-btn").forEach((btn) => {
          const active = btn.dataset.mode === "2d";
          btn.classList.toggle("active", active);
          btn.setAttribute("aria-pressed", String(active));
        });
      }
      if (zeroResp) {
        state.nullDiffSigma = computeMaxSigmaDiff(zeroResp.rollout, primeResp.rollout);
        state.nullVerifiedKey = verifyKey;
      }
      state.lastInferenceMs = shockResp.inference_ms || wallMs / (zeroResp ? 3 : 2);

      animateNumber("telemetry-ms", state.lastInferenceMs, (v) => `${v.toFixed(1)} ms`, 280);
      document.getElementById("mc-mean-sigma").textContent = "Not run";
      document.getElementById("mc-max-sigma").textContent = "--";
      document.getElementById("mc-wet-cells").textContent = "--";

      state.cachedCausality = computeCausalityAndWavefront();
      updateTrustAndCausalityPanel(true);
      updateAllViews();
    } catch (err) {
      if (reqId === state.reqSeq) {
        showApiError(`Simulation error: ${err.message}`);
      }
    } finally {
      if (reqId === state.reqSeq) {
        setLoadingState(false);
      }
    }
  }

  async function runMonteCarloEnsemble() {
    if (!state.primeRollout) return;
    const reqId = ++state.reqSeq;
    const steps = state.primeRollout.length;
    const winKey = state.windowKey;
    setLoadingState(true);
    const ok = await checkHealth();
    if (reqId !== state.reqSeq) return;
    if (!ok) {
      setLoadingState(false);
      return;
    }

    const win = state.data.windows[winKey];
    const basePert =
      buildPerturbationFromState(win.init_states) ||
      Array.from({ length: 6 }, () => Array.from({ length: NLAT }, () => new Array(NLON).fill(0.0)));
    const std = state.data.grid.std;

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
      return callSimulate(win.init_states, win.doy_sincos, steps, p);
    });

    const responses = await Promise.all(requests).catch((err) => {
      if (reqId === state.reqSeq) {
        showApiError(`Monte Carlo ensemble failed: ${err.message}`);
      }
      return null;
    });
    if (reqId !== state.reqSeq) return;
    setLoadingState(false);
    if (!responses) return;

    const members = responses.map((r) => r.rollout);
    const spread = Array.from({ length: steps }, () =>
      Array.from({ length: 6 }, () =>
        Array.from({ length: NLAT }, () => new Array(NLON).fill(0.0))
      )
    );
    const rainProb = Array.from({ length: steps }, () =>
      Array.from({ length: NLAT }, () => new Array(NLON).fill(0.0))
    );

    for (let k = 0; k < steps; k++) {
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

    snapshotMapsForCrossFade();
    state.mcSpread = spread;
    state.mcRainProb = rainProb;
    document.getElementById("mc-status-text").textContent =
      "5-member ensemble active. Viewing spatial standard deviation (σ) across perturbed trajectories.";

    updateUncertaintyKPIs();
    setRenderMode("mc");
    updateHoverInspector();
    switchBottomTab("uncertainty");
  }

  async function verifyNullShockLive() {
    if (!state.primeRollout) return;
    const reqId = ++state.reqSeq;
    const steps = state.primeRollout.length;
    const winKey = state.windowKey;
    setLoadingState(true);
    const ok = await checkHealth();
    if (reqId !== state.reqSeq) return;
    if (!ok) {
      setLoadingState(false);
      return;
    }
    const win = state.data.windows[winKey];
    const zeroPert = Array.from({ length: 6 }, () =>
      Array.from({ length: NLAT }, () => new Array(NLON).fill(0.0))
    );
    try {
      const zeroResp = await callSimulate(win.init_states, win.doy_sincos, steps, zeroPert);
      if (reqId !== state.reqSeq) return;
      state.nullDiffSigma = computeMaxSigmaDiff(zeroResp.rollout, state.primeRollout);
      state.nullVerifiedKey = `${getApiUrl()}|${winKey}|${steps}`;
      updateTrustAndCausalityPanel(false);
      switchRightTab("trust", true);
    } catch (err) {
      if (reqId === state.reqSeq) {
        showApiError(`Null shock verification failed: ${err.message}`);
      }
    } finally {
      if (reqId === state.reqSeq) {
        setLoadingState(false);
      }
    }
  }

  // --- Coordinate Projection & Georeferenced Official 37-State India GeoJSON Overlay ---
  function lonLatToCanvasXY(lon, lat, W, H) {
    const x = ((lon - 65.5) / 35.0) * W;
    const y = ((37.5 - lat) / 31.0) * H;
    return [x, y];
  }

  function traceRingOnCtx(ctx, ring, W, H) {
    if (!ring || !ring.length) return;
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = lonLatToCanvasXY(ring[i][0], ring[i][1], W, H);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function traceFeatureOnCtx(ctx, feat, W, H) {
    if (!feat || !feat.coordinates) return;
    if (feat.type === "Polygon") {
      for (const ring of feat.coordinates) {
        traceRingOnCtx(ctx, ring, W, H);
      }
    } else if (feat.type === "MultiPolygon") {
      for (const poly of feat.coordinates) {
        for (const ring of poly) {
          traceRingOnCtx(ctx, ring, W, H);
        }
      }
    }
  }

  function traceAllIndiaGeoOnCtx(ctx, W, H) {
    const geo = window.INDIA_STATES_GEO;
    if (geo && Array.isArray(geo.features) && geo.features.length) {
      for (const feat of geo.features) {
        traceFeatureOnCtx(ctx, feat, W, H);
      }
      return true;
    }
    // Fallback polygon if india_geo.js is absent
    traceRingOnCtx(ctx, INDIA_BORDER_LONLAT, W, H);
    return false;
  }

  function findGeoFeatureByName(stateName) {
    const geo = window.INDIA_STATES_GEO;
    if (!geo || !Array.isArray(geo.features)) return null;
    const norm = String(stateName || "").trim().toLowerCase();
    return (
      geo.features.find((f) => String(f.name || "").toLowerCase() === norm) ||
      geo.features.find((f) => String(f.name || "").toLowerCase().includes(norm)) ||
      null
    );
  }

  function pointInRingLonLat(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect =
        yi > lat !== yj > lat &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointInFeatureLonLat(lon, lat, feat) {
    if (!feat || !feat.bbox) return false;
    const [minLon, minLat, maxLon, maxLat] = feat.bbox;
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return false;
    if (feat.type === "Polygon") {
      return feat.coordinates.length > 0 && pointInRingLonLat(lon, lat, feat.coordinates[0]);
    }
    if (feat.type === "MultiPolygon") {
      for (const poly of feat.coordinates) {
        if (poly.length > 0 && pointInRingLonLat(lon, lat, poly[0])) return true;
      }
    }
    return false;
  }

  function drawIndiaVectorBoundaries(ctx, W, H, showStateAbbrev, highlightSelectedState) {
    ctx.save();
    const geo = window.INDIA_STATES_GEO;
    if (geo && Array.isArray(geo.features) && geo.features.length) {
      // 1. Crisp internal & coastal boundaries for all 37 States & UTs
      ctx.strokeStyle = state.darkTheme ? "rgba(241, 245, 249, 0.56)" : "rgba(15, 23, 42, 0.52)";
      ctx.lineWidth = showStateAbbrev ? 1.15 : 1.05;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (const feat of geo.features) {
        traceFeatureOnCtx(ctx, feat, W, H);
      }
      ctx.stroke();

      // 2. Highlight active selected state polygon
      if (highlightSelectedState && state.selectedState) {
        const selFeat = findGeoFeatureByName(state.selectedState);
        if (selFeat) {
          ctx.beginPath();
          traceFeatureOnCtx(ctx, selFeat, W, H);
          ctx.fillStyle = state.darkTheme
            ? "rgba(96, 165, 250, 0.16)"
            : "rgba(255, 255, 255, 0.24)";
          ctx.fill();
          ctx.strokeStyle = state.darkTheme ? "#60A5FA" : "#0058BF";
          ctx.lineWidth = 2.4;
          ctx.stroke();
        }
      }
    } else {
      // Fallback polylines
      ctx.strokeStyle = state.darkTheme ? "rgba(226, 232, 240, 0.35)" : "rgba(15, 23, 42, 0.28)";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      for (const poly of INDIA_STATE_LINES_LONLAT) {
        for (let i = 0; i < poly.length; i++) {
          const [x, y] = lonLatToCanvasXY(poly[i][0], poly[i][1], W, H);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      ctx.strokeStyle = state.darkTheme ? "rgba(241, 245, 249, 0.92)" : "rgba(16, 27, 56, 0.88)";
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      traceRingOnCtx(ctx, INDIA_BORDER_LONLAT, W, H);
      ctx.stroke();
    }

    // 3. Crisp Haloed State Labels
    if (showStateAbbrev) {
      ctx.font = "700 9.5px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const [sName, info] of Object.entries(INDIA_STATES)) {
        const [sx, sy] = lonLatToCanvasXY(info.centerLon, info.centerLat, W, H);
        const isSel = sName === state.selectedState;
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = state.darkTheme ? "rgba(6, 11, 20, 0.88)" : "rgba(255, 255, 255, 0.92)";
        ctx.strokeText(sName, sx, sy - 6);
        ctx.fillStyle = isSel
          ? (state.darkTheme ? "#60A5FA" : "#0058BF")
          : (state.darkTheme ? "#F8FAFC" : "#101B38");
        ctx.fillText(sName, sx, sy - 6);
      }
    }
    ctx.restore();
  }

  // --- Regional India Map Canvas (Stitch Col 2 Card — Exact 37-State GeoJSON Clipped Map) ---
  function drawRegionalIndiaCanvas(field2d, minVal, maxVal) {
    const canvas = document.getElementById("canvas-india-regional");
    if (!canvas || !field2d) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const invSpan = 1.0 / (maxVal - minVal || 1.0);

    // 1. Soft Ocean Gradient Background (Arabian Sea & Bay of Bengal)
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, H);
    if (state.darkTheme) {
      oceanGrad.addColorStop(0, "#071124");
      oceanGrad.addColorStop(1, "#0B1B36");
    } else {
      oceanGrad.addColorStop(0, "#EDF5FF");
      oceanGrad.addColorStop(1, "#DCEBFF");
    }
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Subtle Lat/Lon Graticule Lines + Degree Labels
    ctx.strokeStyle = state.darkTheme ? "rgba(96, 165, 250, 0.12)" : "rgba(0, 88, 191, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let lon = 70; lon <= 95; lon += 5) {
      const [x] = lonLatToCanvasXY(lon, 20, W, H);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let lat = 10; lat <= 35; lat += 5) {
      const [, y] = lonLatToCanvasXY(80, lat, W, H);
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();

    // Subtle Sea Labels
    ctx.save();
    ctx.font = "600 9px Inter, system-ui, sans-serif";
    ctx.fillStyle = state.darkTheme ? "rgba(148, 163, 184, 0.55)" : "rgba(37, 99, 235, 0.45)";
    ctx.textAlign = "center";
    const [asX, asY] = lonLatToCanvasXY(69.8, 15.0, W, H);
    ctx.fillText("ARABIAN", asX, asY);
    ctx.fillText("SEA", asX, asY + 11);
    const [bobX, bobY] = lonLatToCanvasXY(89.5, 15.0, W, H);
    ctx.fillText("BAY OF", bobX, bobY);
    ctx.fillText("BENGAL", bobX, bobY + 11);
    ctx.restore();

    // 3. Render Smooth Bilinear Climate Heatmap to Offscreen Canvas
    const offscreen = document.createElement("canvas");
    offscreen.width = W;
    offscreen.height = H;
    const octx = offscreen.getContext("2d");
    const img = octx.createImageData(W, H);
    const buf = img.data;
    const oro = state.data ? state.data.grid.orography_m : null;
    let p = 0;
    for (let py = 0; py < H; py++) {
      const rf = (1.0 - (py + 0.5) / H) * NLAT - 0.5;
      for (let px = 0; px < W; px++) {
        const cf = ((px + 0.5) / W) * NLON - 0.5;
        const val = bilerpGrid(field2d, rf, cf);
        const elev = oro ? bilerpGrid(oro, rf, cf) : 0;
        const norm = (val - minVal) * invSpan;
        const rgb = sampleStops(SEQ_STOPS, norm);
        const shade = 1.0 + Math.min(0.10, (elev / 4800.0) * 0.10);
        buf[p++] = Math.min(255, (rgb[0] * shade) | 0);
        buf[p++] = Math.min(255, (rgb[1] * shade) | 0);
        buf[p++] = Math.min(255, (rgb[2] * shade) | 0);
        buf[p++] = 238;
      }
    }
    octx.putImageData(img, 0, 0);

    // 4. Subtle Coastal Drop Shadow + Clip Heatmap Strictly Inside Official 37-State India GeoJSON Polygons
    ctx.save();
    ctx.beginPath();
    traceAllIndiaGeoOnCtx(ctx, W, H);
    ctx.shadowColor = state.darkTheme ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 88, 191, 0.22)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = state.darkTheme ? "#0F172A" : "#FFFFFF";
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    traceAllIndiaGeoOnCtx(ctx, W, H);
    ctx.clip();
    ctx.drawImage(offscreen, 0, 0);
    ctx.restore();

    // 5. Draw All 37 State Polygon Borders, Highlight Active State & Render Haloed Labels
    drawIndiaVectorBoundaries(ctx, W, H, true, true);

    // 6. Move #map-pin to Selected State Centroid
    const stInfo = INDIA_STATES[state.selectedState] || INDIA_STATES["Karnataka"];
    const [pinX, pinY] = lonLatToCanvasXY(stInfo.centerLon, stInfo.centerLat, W, H);
    const pinEl = document.getElementById("map-pin");
    if (pinEl) {
      pinEl.style.left = `${((pinX / W) * 100).toFixed(1)}%`;
      pinEl.style.top = `${((pinY / H) * 100).toFixed(1)}%`;
    }
  }

  // --- Live State-Level Regional Insights Engine (Coupled to POST /simulate) ---
  function computeStateMetrics(stateName) {
    const info = INDIA_STATES[stateName];
    if (!info || !state.primeRollout || !state.shockRollout) return null;
    const lat = state.data.grid.lat;
    const lon = state.data.grid.lon;
    const steps = state.primeRollout.length;

    const cells = [];
    for (let r = 0; r < NLAT; r++) {
      for (let c = 0; c < NLON; c++) {
        if (lat[r] >= info.lat_min && lat[r] <= info.lat_max && lon[c] >= info.lon_min && lon[c] <= info.lon_max) {
          cells.push([r, c]);
        }
      }
    }
    if (!cells.length) return null;

    const dailyRainShock = new Array(steps).fill(0);
    const dailyRainPrime = new Array(steps).fill(0);
    const dailyTempShockC = new Array(steps).fill(0);
    const dailyTempPrimeC = new Array(steps).fill(0);
    let sumWindShockKmh = 0, sumWindPrimeKmh = 0;
    let sumMoistShock = 0, sumMoistPrime = 0;
    let peakRainDayIdx = 0;

    for (let k = 0; k < steps; k++) {
      let rS = 0, rP = 0, tS = 0, tP = 0, wS = 0, wP = 0, mS = 0, mP = 0;
      for (const [r, c] of cells) {
        rS += state.shockRollout[k][1][r][c];
        rP += state.primeRollout[k][1][r][c];
        tS += state.shockRollout[k][0][r][c] - 273.15;
        tP += state.primeRollout[k][0][r][c] - 273.15;
        wS += Math.hypot(state.shockRollout[k][2][r][c], state.shockRollout[k][3][r][c]) * 3.6;
        wP += Math.hypot(state.primeRollout[k][2][r][c], state.primeRollout[k][3][r][c]) * 3.6;
        mS += state.shockRollout[k][5][r][c];
        mP += state.primeRollout[k][5][r][c];
      }
      const n = cells.length;
      dailyRainShock[k] = rS / n;
      dailyRainPrime[k] = rP / n;
      dailyTempShockC[k] = tS / n;
      dailyTempPrimeC[k] = tP / n;
      if (dailyRainShock[k] > dailyRainShock[peakRainDayIdx]) peakRainDayIdx = k;
      sumWindShockKmh += wS / n;
      sumWindPrimeKmh += wP / n;
      sumMoistShock += mS / n;
      sumMoistPrime += mP / n;
    }

    const totalRainShock = dailyRainShock.reduce((a, b) => a + b, 0);
    const totalRainPrime = dailyRainPrime.reduce((a, b) => a + b, 0);
    const rainDeltaMm = totalRainShock - totalRainPrime;
    const rainPctDelta = totalRainPrime > 0.5
      ? ((totalRainShock - totalRainPrime) / totalRainPrime) * 100.0
      : rainDeltaMm * 10.0;

    const avgTempShock = dailyTempShockC.reduce((a, b) => a + b, 0) / steps;
    const avgTempPrime = dailyTempPrimeC.reduce((a, b) => a + b, 0) / steps;
    const tempDeltaC = avgTempShock - avgTempPrime;

    const avgWindShock = sumWindShockKmh / steps;
    const avgWindPrime = sumWindPrimeKmh / steps;
    const windPctDelta = avgWindPrime > 0.2
      ? ((avgWindShock - avgWindPrime) / avgWindPrime) * 100.0
      : 0.0;

    const avgMoistShock = sumMoistShock / steps;
    const avgMoistPrime = sumMoistPrime / steps;
    const moistPctDelta = avgMoistPrime > 0.2
      ? ((avgMoistShock - avgMoistPrime) / avgMoistPrime) * 100.0
      : 0.0;

    const maxDailyRain = Math.max(...dailyRainShock);
    const riskLevel =
      maxDailyRain >= 12.0 || Math.abs(rainPctDelta) >= 15.0 || avgTempShock >= 36.5
        ? "High"
        : (maxDailyRain >= 5.0 || Math.abs(rainPctDelta) >= 5.0 ? "Moderate" : "Low");

    return {
      stateName,
      info,
      steps,
      dailyRainShock,
      dailyTempShockC,
      totalRainShock,
      rainDeltaMm,
      rainPctDelta,
      avgTempShock,
      tempDeltaC,
      avgWindShock,
      windPctDelta,
      avgMoistShock,
      moistPctDelta,
      peakRainDayIdx,
      maxDailyRain,
      riskLevel,
    };
  }

  function updateRegionalInsightsLive() {
    if (!state.primeRollout || !state.shockRollout) return;

    const allStateMetrics = Object.keys(INDIA_STATES)
      .map(computeStateMetrics)
      .filter(Boolean);
    const cur = computeStateMetrics(state.selectedState) || allStateMetrics[0];
    if (!cur) return;

    const winLabel =
      state.windowKey === "cyclone_oct" ? "Bay Cyclone Surge (Mid-Oct)" :
      state.windowKey === "heatwave_may" ? "Pre-Monsoon Heatwave (Mid-May)" :
      "Monsoon Onset (Mid-June)";

    // 1. Update Callout & Forecast Header
    document.getElementById("callout-state").textContent = cur.stateName;
    document.getElementById("callout-rain").textContent = `${cur.totalRainShock.toFixed(1)} mm (${cur.steps}d)`;
    document.getElementById("callout-sub").textContent =
      `${cur.rainPctDelta >= 0 ? "+" : ""}${cur.rainPctDelta.toFixed(1)}% vs Baseline`;
    document.getElementById("state-forecast-title").textContent =
      `${cur.stateName} – ${cur.steps}-Day Forecast`;
    document.getElementById("state-window-badge").textContent =
      `${winLabel} · D+1 to D+${cur.steps}`;
    document.getElementById("insights-title").textContent =
      `Key Insights – ${cur.stateName}`;

    // 2. Update 4 State KPI Tiles
    document.getElementById("kpi-rain").textContent = `${cur.totalRainShock.toFixed(1)} mm`;
    document.getElementById("kpi-rain-delta").textContent =
      `${cur.rainPctDelta >= 0 ? "+" : ""}${cur.rainPctDelta.toFixed(1)}% vs Prime`;
    document.getElementById("kpi-temp").textContent = `${cur.avgTempShock.toFixed(1)} °C`;
    document.getElementById("kpi-temp-delta").textContent =
      `${cur.tempDeltaC >= 0 ? "+" : ""}${cur.tempDeltaC.toFixed(2)} °C`;
    document.getElementById("kpi-wind").textContent = `${cur.avgWindShock.toFixed(1)} km/h`;
    document.getElementById("kpi-wind-delta").textContent =
      `${cur.windPctDelta >= 0 ? "+" : ""}${cur.windPctDelta.toFixed(1)}%`;
    document.getElementById("kpi-moist").textContent = `${cur.avgMoistShock.toFixed(1)} kg/m²`;
    document.getElementById("kpi-moist-delta").textContent =
      `${cur.moistPctDelta >= 0 ? "+" : ""}${cur.moistPctDelta.toFixed(1)}%`;

    // 3. Render 10-Day Rainfall (Bars) & Temperature (Line) Trend SVG Chart
    const barsGroup = document.getElementById("trend-bars-group");
    const tempLine = document.getElementById("trend-temp-line");
    const dotsGroup = document.getElementById("trend-dots-group");
    const xLabelsGroup = document.getElementById("trend-xlabels-group");
    if (barsGroup && tempLine && dotsGroup && xLabelsGroup) {
      const n = cur.steps;
      const maxR = Math.max(10.0, ...cur.dailyRainShock);
      const minT = Math.min(...cur.dailyTempShockC) - 1.0;
      const maxT = Math.max(minT + 2.0, ...cur.dailyTempShockC) + 1.0;
      const plotL = 36, plotR = 334, baseY = 114, maxBarH = 64;
      const stepW = (plotR - plotL) / Math.max(1, n - 1);

      let barsHtml = "";
      let dotsHtml = "";
      let lblsHtml = "";
      const pts = [];

      for (let k = 0; k < n; k++) {
        const cx = plotL + k * stepW;
        const barH = Math.max(4, Math.min(maxBarH, (cur.dailyRainShock[k] / maxR) * maxBarH));
        const barY = baseY - barH;
        const isActiveDay = k === state.selectedDay;
        const barFill = isActiveDay ? "#0058BF" : "#60A5FA";
        barsHtml += `<rect x="${(cx - 7).toFixed(1)}" y="${barY.toFixed(1)}" width="14" height="${barH.toFixed(1)}" rx="2.5" fill="${barFill}"><title>Day +${k + 1}: ${cur.dailyRainShock[k].toFixed(1)} mm/d, ${cur.dailyTempShockC[k].toFixed(1)} °C</title></rect>`;

        const tNorm = (cur.dailyTempShockC[k] - minT) / (maxT - minT || 1);
        const ty = 46 - tNorm * 26;
        pts.push(`${cx.toFixed(1)},${ty.toFixed(1)}`);
        dotsHtml += `<circle cx="${cx.toFixed(1)}" cy="${ty.toFixed(1)}" r="${isActiveDay ? 3.5 : 2.2}"></circle>`;
        lblsHtml += `<text x="${cx.toFixed(1)}" y="130" font-weight="${isActiveDay ? "700" : "500"}">D${k + 1}</text>`;
      }
      barsGroup.innerHTML = barsHtml;
      tempLine.setAttribute("points", pts.join(" "));
      dotsGroup.innerHTML = dotsHtml;
      xLabelsGroup.innerHTML = lblsHtml;
    }

    // 4. Populate State-wise Impact Summary Table (All 8 States Live)
    const tbody = document.getElementById("state-summary-tbody");
    if (tbody) {
      tbody.innerHTML = allStateMetrics
        .map((m) => {
          const pillCls =
            m.riskLevel === "High" ? "risk-high" :
            m.riskLevel === "Moderate" ? "risk-mod" : "risk-low";
          const isSel = m.stateName === cur.stateName;
          return (
            `<tr data-state="${escapeHtml(m.stateName)}" style="${isSel ? "background-color: var(--primary-container);" : ""}">` +
            `<td class="font-semibold">${escapeHtml(m.stateName)}</td>` +
            `<td class="tabular">${m.totalRainShock.toFixed(1)} mm</td>` +
            `<td class="tabular text-success">${m.rainPctDelta >= 0 ? "+" : ""}${m.rainPctDelta.toFixed(1)}%</td>` +
            `<td><span class="risk-pill ${pillCls}">${m.riskLevel}</span></td>` +
            `</tr>`
          );
        })
        .join("");

      tbody.querySelectorAll("tr[data-state]").forEach((row) => {
        row.addEventListener("click", () => selectIndianState(row.dataset.state));
      });
    }

    // 5. Populate Key Insights & Sector Impacts
    const peakD = cur.peakRainDayIdx + 1;
    document.getElementById("insight-1").textContent =
      `Cumulative ${cur.steps}-day rainfall is projected at ${cur.totalRainShock.toFixed(1)} mm (${cur.rainPctDelta >= 0 ? "+" : ""}${cur.rainPctDelta.toFixed(1)}% vs unperturbed baseline).`;
    document.getElementById("insight-2").textContent =
      `Average 2m temperature sits at ${cur.avgTempShock.toFixed(1)} °C (${cur.tempDeltaC >= 0 ? "+" : ""}${cur.tempDeltaC.toFixed(2)} °C counterfactual shift across ${cur.stateName}).`;
    document.getElementById("insight-3").textContent =
      `10m wind averages ${cur.avgWindShock.toFixed(1)} km/h with column water vapour at ${cur.avgMoistShock.toFixed(1)} kg/m² (${cur.moistPctDelta >= 0 ? "+" : ""}${cur.moistPctDelta.toFixed(1)}%).`;
    document.getElementById("insight-4").textContent =
      `Peak precipitation occurs around Day +${peakD} (${cur.maxDailyRain.toFixed(1)} mm/day) across ${cur.info.terrainNote}.`;

    document.getElementById("sector-agri").textContent =
      cur.rainPctDelta > 8.0
        ? `Ensure field drainage for ${cur.info.cropZone}; +${cur.rainPctDelta.toFixed(1)}% moisture surge.`
        : cur.rainPctDelta < -5.0
        ? `Schedule supplemental irrigation for ${cur.info.cropZone} (${cur.rainPctDelta.toFixed(1)}% deficit).`
        : `Favourable moisture balance for ${cur.info.cropZone}.`;

    document.getElementById("sector-water").textContent =
      `${cur.info.basin} basin inflow projected at ${cur.rainPctDelta >= 0 ? "+" : ""}${cur.rainPctDelta.toFixed(1)}% vs baseline.`;

    document.getElementById("sector-risk").textContent =
      `${cur.riskLevel} monsoon watch near Day +${peakD} (${cur.maxDailyRain.toFixed(1)} mm/d peak) over ${cur.info.terrainNote}.`;
  }

  function selectIndianState(stateName) {
    if (!INDIA_STATES[stateName]) return;
    state.selectedState = stateName;
    document.querySelectorAll(".state-btn").forEach((b) => {
      const act = b.dataset.state === stateName;
      b.classList.toggle("active", act);
      b.setAttribute("aria-selected", String(act));
    });
    updateRegionalInsightsLive();
    renderMapsOnly();
  }

  // --- Smooth Bilinear & Raw Grid Map Rendering ---
  function bilerpGrid(grid2d, rf, cf) {
    const r0 = Math.max(0, Math.min(NLAT - 1, Math.floor(rf)));
    const r1 = Math.min(NLAT - 1, r0 + 1);
    const c0 = Math.max(0, Math.min(NLON - 1, Math.floor(cf)));
    const c1 = Math.min(NLON - 1, c0 + 1);
    const dr = rf - r0;
    const dc = cf - c0;
    const v00 = grid2d[r0][c0];
    const v01 = grid2d[r0][c1];
    const v10 = grid2d[r1][c0];
    const v11 = grid2d[r1][c1];
    return (v00 * (1 - dc) + v01 * dc) * (1 - dr) + (v10 * (1 - dc) + v11 * dc) * dr;
  }

  function lerp2D(gA, gB, t) {
    if (t <= 0.001 || !gB) return gA;
    if (t >= 0.999) return gB;
    const out = new Array(NLAT);
    for (let r = 0; r < NLAT; r++) {
      const row = new Float32Array(NLON);
      for (let c = 0; c < NLON; c++) {
        row[c] = gA[r][c] + (gB[r][c] - gA[r][c]) * t;
      }
      out[r] = row;
    }
    return out;
  }

  function getInterpolatedSlice(rollout, posFloat, ch) {
    const maxIdx = rollout.length - 1;
    const k0 = Math.max(0, Math.min(maxIdx, Math.floor(posFloat)));
    const k1 = Math.min(maxIdx, k0 + 1);
    const frac = posFloat - k0;
    return lerp2D(rollout[k0][ch], rollout[k1][ch], frac);
  }

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
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const cellW = W / NLON;
    const cellH = H / NLAT;
    const oro = state.data.grid.orography_m;
    const stops = isDiverging ? DIV_STOPS : SEQ_STOPS;
    const invSpan = 1.0 / (maxVal - minVal || 1.0);

    if (state.smoothGrid) {
      const img = ctx.createImageData(W, H);
      const buf = img.data;
      let p = 0;
      for (let py = 0; py < H; py++) {
        const rf = (1.0 - (py + 0.5) / H) * NLAT - 0.5;
        for (let px = 0; px < W; px++) {
          const cf = ((px + 0.5) / W) * NLON - 0.5;
          const val = bilerpGrid(field2d, rf, cf);
          const elev = bilerpGrid(oro, rf, cf);
          const norm = (val - minVal) * invSpan;
          const rgb = sampleStops(stops, norm);
          const shade = 1.0 + Math.min(0.12, (elev / 4800.0) * 0.12);
          buf[p++] = Math.min(255, (rgb[0] * shade) | 0);
          buf[p++] = Math.min(255, (rgb[1] * shade) | 0);
          buf[p++] = Math.min(255, (rgb[2] * shade) | 0);
          buf[p++] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    } else {
      ctx.clearRect(0, 0, W, H);
      for (let r = 0; r < NLAT; r++) {
        const y = (NLAT - 1 - r) * cellH;
        for (let c = 0; c < NLON; c++) {
          const x = c * cellW;
          const norm = (field2d[r][c] - minVal) * invSpan;
          const rgb = sampleStops(stops, norm);
          ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
          ctx.fillRect(x, y, Math.ceil(cellW), Math.ceil(cellH));
        }
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let r = 1; r < NLAT; r++) {
        ctx.moveTo(0, r * cellH);
        ctx.lineTo(W, r * cellH);
      }
      for (let c = 1; c < NLON; c++) {
        ctx.moveTo(c * cellW, 0);
        ctx.lineTo(c * cellW, H);
      }
      ctx.stroke();
    }

    // Accurate Georeferenced India Country & State Boundaries Overlay
    drawIndiaVectorBoundaries(ctx, W, H, false, true);

    // Wind Vectors
    if (uWind2d && vWind2d) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      for (let r = 1; r < NLAT; r += 2) {
        const cy = (NLAT - 1 - r + 0.5) * cellH;
        for (let c = 1; c < NLON; c += 2) {
          const cx = (c + 0.5) * cellW;
          const u = uWind2d[r][c];
          const v = vWind2d[r][c];
          const mag = Math.hypot(u, v);
          if (mag < 0.35) continue;
          const len = Math.min(13, 3.0 + mag * 1.25);
          const ux = u / mag;
          const uy = -v / mag;
          const x1 = cx - ux * len * 0.45;
          const y1 = cy - uy * len * 0.45;
          const x2 = cx + ux * len * 0.55;
          const y2 = cy + uy * len * 0.55;
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - ux * 3.2 - uy * 2.0, y2 - uy * 3.2 + ux * 2.0);
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - ux * 3.2 + uy * 2.0, y2 - uy * 3.2 - ux * 2.0);
        }
      }
      ctx.stroke();
    }

    // Shock Box & 3-Cell Locality Zone Overlay
    const displayBox = state.draftBox || state.activeBox;
    if (drawBoxOverlay && displayBox) {
      const lat = state.data.grid.lat;
      const lon = state.data.grid.lon;
      let rMin = lat.findIndex((v) => v >= displayBox.lat_min);
      if (rMin < 0) rMin = 0;
      let rMax = NLAT - 1;
      for (let r = NLAT - 1; r >= 0; r--) {
        if (lat[r] <= displayBox.lat_max) { rMax = r; break; }
      }
      let cMin = lon.findIndex((v) => v >= displayBox.lon_min);
      if (cMin < 0) cMin = 0;
      let cMax = NLON - 1;
      for (let c = NLON - 1; c >= 0; c--) {
        if (lon[c] <= displayBox.lon_max) { cMax = c; break; }
      }

      const nrMin = Math.max(0, rMin - 3);
      const nrMax = Math.min(NLAT - 1, rMax + 3);
      const ncMin = Math.max(0, cMin - 3);
      const ncMax = Math.min(NLON - 1, cMax + 3);

      ctx.save();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        ncMin * cellW,
        (NLAT - 1 - nrMax) * cellH,
        (ncMax - ncMin + 1) * cellW,
        (nrMax - nrMin + 1) * cellH
      );

      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 2.2;
      ctx.setLineDash([]);
      ctx.strokeRect(
        cMin * cellW,
        (NLAT - 1 - rMax) * cellH,
        (cMax - cMin + 1) * cellW,
        (rMax - rMin + 1) * cellH
      );
      ctx.restore();
    }

    if (state.hoverCell) {
      const { r, c } = state.hoverCell;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.6;
      ctx.strokeRect(c * cellW, (NLAT - 1 - r) * cellH, cellW, cellH);
    }
  }

  function draw3DIsometricMap(canvasId, field2d, minVal, maxVal, isDiverging) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const lsm = state.data.grid.land_sea_mask;
    const oro = state.data.grid.orography_m;
    const stops = isDiverging ? DIV_STOPS : SEQ_STOPS;

    ctx.clearRect(0, 0, W, H);
    const tileW = 12.6;
    const tileH = 6.3;
    const originX = W * 0.47;
    const originY = 64;

    for (let r = NLAT - 1; r >= 0; r--) {
      const northIdx = NLAT - 1 - r;
      for (let c = 0; c < NLON; c++) {
        const val = field2d[r][c];
        const norm = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal || 1)));
        const rgb = sampleStops(stops, norm);

        const isoX = originX + (c - northIdx) * (tileW * 0.5);
        const isoY = originY + (c + northIdx) * (tileH * 0.5);
        const terrainZ = (oro[r][c] / 5000.0) * 42.0;
        const plumeZ = isDiverging ? Math.abs(norm - 0.5) * 34.0 : norm * 22.0;
        const totalZ = terrainZ + plumeZ;

        ctx.fillStyle = `rgba(${(rgb[0] * 0.68) | 0}, ${(rgb[1] * 0.68) | 0}, ${(rgb[2] * 0.68) | 0}, 0.94)`;
        ctx.fillRect(isoX - tileW * 0.46, isoY - totalZ, tileW * 0.92, totalZ + 2);

        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        ctx.beginPath();
        ctx.moveTo(isoX, isoY - totalZ - tileH * 0.5);
        ctx.lineTo(isoX + tileW * 0.5, isoY - totalZ);
        ctx.lineTo(isoX, isoY - totalZ + tileH * 0.5);
        ctx.lineTo(isoX - tileW * 0.5, isoY - totalZ);
        ctx.closePath();
        ctx.fill();

        if (lsm[r][c] >= 0.5) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  // --- Interactive 3D Rotating Earth-to-India Globe ---
  function renderEarthGlobe() {
    const canvas = document.getElementById("canvas-earth-globe");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const cx = W * 0.5;
    const cy = H * 0.5;
    const R = Math.min(W, H) * 0.38 * state.globeZoom;
    const deg2rad = Math.PI / 180;
    const lon0 = -state.globeRotLon * deg2rad;
    const lat0 = -state.globeRotLat * deg2rad;

    function project3D(lonDeg, latDeg) {
      const lam = lonDeg * deg2rad;
      const phi = latDeg * deg2rad;
      const dLam = lam - lon0;
      const cosC = Math.sin(lat0) * Math.sin(phi) + Math.cos(lat0) * Math.cos(phi) * Math.cos(dLam);
      if (cosC < 0) return null; // Back of globe
      const x = cx + R * Math.cos(phi) * Math.sin(dLam);
      const y = cy - R * (Math.cos(lat0) * Math.sin(phi) - Math.sin(lat0) * Math.cos(phi) * Math.cos(dLam));
      return [x, y];
    }

    // Atmospheric Outer Halo
    const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.24);
    halo.addColorStop(0, "rgba(22, 119, 249, 0.26)");
    halo.addColorStop(1, "rgba(22, 119, 249, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.24, 0, Math.PI * 2);
    ctx.fill();

    // 3D Ocean Sphere
    const oceanGrad = ctx.createRadialGradient(cx - R * 0.28, cy - R * 0.28, R * 0.1, cx, cy, R);
    oceanGrad.addColorStop(0, state.darkTheme ? "#1E4E8C" : "#3B82F6");
    oceanGrad.addColorStop(0.65, state.darkTheme ? "#0F2952" : "#1D4ED8");
    oceanGrad.addColorStop(1, state.darkTheme ? "#061126" : "#1E3A8A");
    ctx.fillStyle = oceanGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();

    // Graticule Latitude / Longitude Lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 1;
    for (let lon = -180; lon < 180; lon += 20) {
      ctx.beginPath();
      let started = false;
      for (let lat = -80; lat <= 80; lat += 5) {
        const pt = project3D(lon, lat);
        if (!pt) { started = false; continue; }
        if (!started) { ctx.moveTo(pt[0], pt[1]); started = true; }
        else ctx.lineTo(pt[0], pt[1]);
      }
      ctx.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 20) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 5) {
        const pt = project3D(lon, lat);
        if (!pt) { started = false; continue; }
        if (!started) { ctx.moveTo(pt[0], pt[1]); started = true; }
        else ctx.lineTo(pt[0], pt[1]);
      }
      ctx.stroke();
    }

    // Highlighted Georeferenced 37-State India Polygons on the 3D Globe
    ctx.fillStyle = "rgba(16, 185, 129, 0.72)";
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.4;
    const geo = window.INDIA_STATES_GEO;
    if (geo && Array.isArray(geo.features) && geo.features.length) {
      ctx.beginPath();
      const traceRing3D = (ring) => {
        let s = false;
        for (const [lon, lat] of ring) {
          const pt = project3D(lon, lat);
          if (!pt) continue;
          if (!s) { ctx.moveTo(pt[0], pt[1]); s = true; }
          else ctx.lineTo(pt[0], pt[1]);
        }
        if (s) ctx.closePath();
      };
      for (const feat of geo.features) {
        if (feat.type === "Polygon") {
          for (const ring of feat.coordinates) traceRing3D(ring);
        } else if (feat.type === "MultiPolygon") {
          for (const poly of feat.coordinates) {
            for (const ring of poly) traceRing3D(ring);
          }
        }
      }
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      let started = false;
      for (const [lon, lat] of INDIA_BORDER_LONLAT) {
        const pt = project3D(lon, lat);
        if (!pt) continue;
        if (!started) { ctx.moveTo(pt[0], pt[1]); started = true; }
        else ctx.lineTo(pt[0], pt[1]);
      }
      if (started) {
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Target Reticle on India (20.5°N, 78.9°E)
    const indCenter = project3D(78.9, 20.5);
    if (indCenter) {
      ctx.strokeStyle = "#FEF08A";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(indCenter[0], indCenter[1], 32 * Math.sqrt(state.globeZoom), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function openGlobeOverlay() {
    const overlay = document.getElementById("globe-intro-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    state.globeZoom = 1.0;
    if (state.globeRafId) cancelAnimationFrame(state.globeRafId);

    function spinTick() {
      if (overlay.classList.contains("hidden")) return;
      if (!state.globeDragging) {
        state.globeRotLon -= 0.12;
      }
      renderEarthGlobe();
      state.globeRafId = requestAnimationFrame(spinTick);
    }
    state.globeRafId = requestAnimationFrame(spinTick);
  }

  function restoreRegionalNavActive() {
    document.querySelectorAll("#primary-nav-tabs .nav-pill").forEach((p) =>
      p.classList.toggle("active", p.dataset.nav === "regional")
    );
  }

  function animateZoomIntoIndiaAndClose() {
    const overlay = document.getElementById("globe-intro-overlay");
    const statusEl = document.getElementById("globe-zoom-status");
    if (!overlay) return;
    if (prefersReducedMotion()) {
      overlay.classList.add("hidden");
      restoreRegionalNavActive();
      return;
    }
    if (state.globeRafId) cancelAnimationFrame(state.globeRafId);
    const startLon = state.globeRotLon;
    const startLat = state.globeRotLat;
    const targetLon = -78.9;
    const targetLat = -20.5;
    const t0 = performance.now();
    const dur = 950;

    function zoomStep(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = easeOutCubic(p);
      state.globeRotLon = startLon + (targetLon - startLon) * e;
      state.globeRotLat = startLat + (targetLat - startLat) * e;
      state.globeZoom = 1.0 + 1.35 * e;
      if (statusEl) {
        statusEl.textContent = `Zooming into Indian Subcontinent (20.5°N, 78.9°E) · Locking 32×36 ERA5 Grid (${Math.round(p * 100)}%)`;
      }
      renderEarthGlobe();
      if (p < 1) {
        state.globeRafId = requestAnimationFrame(zoomStep);
      } else {
        overlay.classList.add("hidden");
        state.globeZoom = 1.0;
        restoreRegionalNavActive();
      }
    }
    state.globeRafId = requestAnimationFrame(zoomStep);
  }

  // --- Wavefront Chart & Causality Engine ---
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

    const boxCells = [];
    for (let r = 0; r < NLAT; r++) {
      for (let c = 0; c < NLON; c++) {
        if (bMask[r][c]) boxCells.push([r, c]);
      }
    }
    const distGrid = Array.from({ length: NLAT }, (_, r) =>
      Array.from({ length: NLON }, (_, c) => {
        if (!boxCells.length) return 0;
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
            if (ch === 1) {
              if (sv < minRain) minRain = sv;
              if (pv < minRain) minRain = pv;
            }
            if (ch === 0) {
              if (sv < minTemp) minTemp = sv;
              if (pv < minTemp) minTemp = pv;
              if (sv > maxTemp) maxTemp = sv;
              if (pv > maxTemp) maxTemp = pv;
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
      localized,
      propagates,
      stable,
      nearEnergyByDay,
      outEnergyByDay,
      totalEnergyByDay,
    };
  }

  function animateWavefrontDraw() {
    if (prefersReducedMotion()) {
      state.wavefrontProgress = 1.0;
      drawWavefrontChart(state.cachedCausality, 1.0);
      return;
    }
    if (state.wavefrontRafId) cancelAnimationFrame(state.wavefrontRafId);
    const t0 = performance.now();
    const dur = 420;
    function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      state.wavefrontProgress = easeOutCubic(p);
      drawWavefrontChart(state.cachedCausality, state.wavefrontProgress);
      if (p < 1) {
        state.wavefrontRafId = requestAnimationFrame(step);
      }
    }
    state.wavefrontRafId = requestAnimationFrame(step);
  }

  function drawWavefrontChart(metrics, progress) {
    const canvas = document.getElementById("canvas-wavefront");
    if (!canvas || !metrics) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = Math.max(360, Math.round(canvas.clientWidth || 760));
    const cssH = Math.max(84, Math.round(canvas.clientHeight || 112));
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = cssW;
    const H = cssH;
    ctx.clearRect(0, 0, W, H);

    const prog = progress === undefined ? 1.0 : progress;
    const steps = metrics.totalEnergyByDay.length;
    const padL = 46, padR = 20, padT = 22, padB = 22;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    ctx.strokeStyle = state.darkTheme ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)";
    ctx.lineWidth = 1;
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.fillStyle = state.darkTheme ? "#94A3B8" : "#64748B";
    for (let g = 0; g <= 2; g++) {
      const y = padT + (plotH * g) / 2;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillText(`${100 - g * 50}%`, 8, y + 4);
    }

    const nearShare = metrics.totalEnergyByDay.map((tot, k) =>
      tot > 1e-12 ? metrics.nearEnergyByDay[k] / tot : 1.0
    );
    const outShare = metrics.totalEnergyByDay.map((tot, k) =>
      tot > 1e-12 ? metrics.outEnergyByDay[k] / tot : 0.0
    );

    ctx.save();
    ctx.beginPath();
    ctx.rect(padL, 0, plotW * prog + 2, H);
    ctx.clip();

    function plotCurve(arr, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let k = 0; k < steps; k++) {
        const x = padL + (plotW * k) / Math.max(1, steps - 1);
        const y = padT + plotH * (1.0 - arr[k]);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    plotCurve(nearShare, "#F59E0B");
    plotCurve(outShare, "#0058BF");
    ctx.restore();

    const dayPos = state.playing ? state.playPos : state.selectedDay;
    const curX = padL + (plotW * dayPos) / Math.max(1, steps - 1);
    ctx.strokeStyle = "#16A34A";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(curX, padT);
    ctx.lineTo(curX, padT + plotH);
    ctx.stroke();

    ctx.fillStyle = state.darkTheme ? "#94A3B8" : "#64748B";
    for (let k = 0; k < steps; k++) {
      const x = padL + (plotW * k) / Math.max(1, steps - 1);
      ctx.fillText(`D+${k + 1}`, x - 11, H - 5);
    }

    ctx.fillStyle = "#D97706";
    ctx.fillText("● Near Shock (≤3 cells)", padL + 6, 14);
    ctx.fillStyle = "#0058BF";
    ctx.fillText("● Outward Ripple (>3 cells)", padL + 175, 14);

    document.getElementById("wavefront-summary").textContent =
      `Day-1 Locality: ${(metrics.nearFracDay1 * 100).toFixed(1)}% · Outward Spread: ${metrics.propagates ? "Pass" : "Low"}`;
  }

  function setTrustBadge(id, pass, valText) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `trust-row ${pass ? "pass" : "fail"}`;
    const checkEl = el.querySelector(".trust-check");
    if (checkEl) checkEl.textContent = pass ? "✓" : "✕";
    const valEl = el.querySelector(".trust-val");
    if (valEl) valEl.textContent = valText;
  }

  function hasValidRolloutShape(roll, expectedSteps) {
    return (
      Array.isArray(roll) &&
      roll.length === expectedSteps &&
      Array.isArray(roll[0]) &&
      roll[0].length === 6 &&
      Array.isArray(roll[0][0]) &&
      roll[0][0].length === NLAT &&
      Array.isArray(roll[0][0][0]) &&
      roll[0][0][0].length === NLON
    );
  }

  function updateTrustAndCausalityPanel(animateChart) {
    const m = state.cachedCausality || computeCausalityAndWavefront();
    if (!m) return;
    state.cachedCausality = m;

    const steps = state.primeRollout.length;
    const shapeOk = hasValidRolloutShape(state.primeRollout, steps) && hasValidRolloutShape(state.shockRollout, steps);
    const rainOk = m.minRain >= -1e-6;
    const tempOk = m.minTemp >= 233.15 && m.maxTemp <= 333.15;
    const nullOk = state.nullDiffSigma !== null && state.nullDiffSigma <= 1e-3;

    setTrustBadge("trust-schema", shapeOk, shapeOk ? `[${steps},6,32,36]` : "Fail");
    setTrustBadge("trust-finite", m.allFinite, m.allFinite ? "0 NaN/Inf" : "Fail");
    setTrustBadge("trust-rain", rainOk, `${Math.max(0, m.minRain).toFixed(1)} mm`);
    setTrustBadge("trust-temp", tempOk, `${(m.minTemp - 273.15).toFixed(0)}..${(m.maxTemp - 273.15).toFixed(0)}°C`);
    setTrustBadge("trust-null", nullOk, state.nullDiffSigma !== null ? `${state.nullDiffSigma.toFixed(2)}σ` : "Unverified");
    setTrustBadge("trust-local", m.localized, `${(m.nearFracDay1 * 100).toFixed(1)}%`);
    setTrustBadge("trust-prop", m.propagates, m.propagates ? "Passed" : "Low");
    setTrustBadge("trust-stable", m.stable, `${m.maxZ.toFixed(2)}σ`);

    const checks = [shapeOk, m.allFinite, rainOk, tempOk, nullOk, m.localized, m.propagates, m.stable];
    const passCount = checks.filter(Boolean).length;

    const badge = document.getElementById("trust-overall-badge");
    if (badge) {
      badge.classList.remove("pending");
      badge.textContent = `${passCount}/8 passed`;
    }

    const topTrustBtn = document.getElementById("btn-trust-topbar");
    const topTrustTxt = document.getElementById("trust-topbar-text");
    if (topTrustTxt) topTrustTxt.textContent = `${passCount}/8 ✓`;
    if (topTrustBtn) {
      topTrustBtn.classList.remove("pending");
      topTrustBtn.classList.toggle("warn", passCount < 8);
    }

    if (animateChart) animateWavefrontDraw();
    else drawWavefrontChart(m, 1.0);
  }

  // --- Impact KPIs & Co-pilot ---
  function updateDisasterImpactAndPolicy() {
    if (!state.primeRollout || !state.shockRollout) return;
    const steps = state.primeRollout.length;
    const lsm = state.data.grid.land_sea_mask;

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

    const l1 = document.getElementById("hkpi-1-label");
    const d1 = document.getElementById("hkpi-1-delta");
    const l2 = document.getElementById("hkpi-2-label");
    const d2 = document.getElementById("hkpi-2-delta");
    const l3 = document.getElementById("hkpi-3-label");
    const d3 = document.getElementById("hkpi-3-delta");
    const l4 = document.getElementById("hkpi-4-label");
    const v4 = document.getElementById("hkpi-4-val");
    const d4 = document.getElementById("hkpi-4-delta");

    if (state.hazardTab === "flood") {
      const dHeavy = shockHeavyRainCells - primeHeavyRainCells;
      const dPeak = shockMax10dRain - primeMax10dRain;
      const dMsl = shockMinMsl - primeMinMsl;
      l1.textContent = "Heavy-Rain Footprint (>10 mm/d)";
      animateNumber("hkpi-1-val", shockHeavyRainCells, (v) => `${Math.round(v)} cell-days`, 320);
      d1.textContent = `${dHeavy >= 0 ? "+" : ""}${dHeavy} vs Prime (${primeHeavyRainCells})`;

      l2.textContent = `Peak ${steps}-Day Accumulation`;
      animateNumber("hkpi-2-val", shockMax10dRain, (v) => `${v.toFixed(1)} mm`, 320);
      d2.textContent = `${dPeak >= 0 ? "+" : ""}${dPeak.toFixed(1)} mm vs Prime`;

      l3.textContent = "Core Sea-Level Pressure";
      animateNumber("hkpi-3-val", shockMinMsl, (v) => `${v.toFixed(1)} hPa`, 320);
      d3.textContent = `${dMsl >= 0 ? "+" : ""}${dMsl.toFixed(1)} hPa vs Prime`;

      l4.textContent = "Flood & Surge Risk";
      v4.textContent = dHeavy > 25 || dMsl < -3.0 ? "High Surge" : (dHeavy < -25 ? "Suppressed" : "Moderate");
      d4.textContent = "Coastal & river basin index";
    } else if (state.hazardTab === "heat") {
      const dT = shockMaxTempC - primeMaxTempC;
      const dCells = shockHeatStressCells - primeHeatStressCells;
      const mwSurge = Math.round(dT * 1450 + dCells * 6.5);
      l1.textContent = "Peak Land Temperature";
      animateNumber("hkpi-1-val", shockMaxTempC, (v) => `${v.toFixed(1)} °C`, 320);
      d1.textContent = `${dT >= 0 ? "+" : ""}${dT.toFixed(2)} °C vs Prime`;

      l2.textContent = "Humid Heat-Stress Footprint";
      animateNumber("hkpi-2-val", shockHeatStressCells, (v) => `${Math.round(v)} cell-days`, 320);
      d2.textContent = `${dCells >= 0 ? "+" : ""}${dCells} vs Prime (${primeHeatStressCells})`;

      l3.textContent = "Cooling Load Surge";
      animateNumber("hkpi-3-val", mwSurge, (v) => `${v >= 0 ? "+" : ""}${Math.round(v)} MW`, 320);
      d3.textContent = "Projected regional grid demand";

      l4.textContent = "Thermal Stress Level";
      v4.textContent = dT >= 1.5 ? "Severe Heat" : (dT <= -1.0 ? "Cool Anomaly" : "Normal");
      d4.textContent = "Combined temperature & humidity";
    } else {
      const dRainMm = shockMeanLandRain - primeMeanLandRain;
      const dHeavy = shockHeavyRainCells - primeHeavyRainCells;
      l1.textContent = `${steps}-Day Mean Land Rainfall`;
      animateNumber("hkpi-1-val", shockMeanLandRain, (v) => `${v.toFixed(1)} mm`, 320);
      d1.textContent = `${dRainMm >= 0 ? "+" : ""}${dRainMm.toFixed(1)} mm (${rainPctDelta >= 0 ? "+" : ""}${rainPctDelta.toFixed(1)}%)`;

      l2.textContent = "Downpour Lodging Exposure";
      animateNumber("hkpi-2-val", shockHeavyRainCells, (v) => `${Math.round(v)} cell-days`, 320);
      d2.textContent = `${dHeavy >= 0 ? "+" : ""}${dHeavy} extreme wet cells`;

      l3.textContent = "Rainfall Shift Ratio";
      animateNumber("hkpi-3-val", rainPctDelta, (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`, 320);
      d3.textContent = "All-India agricultural land mean";

      l4.textContent = "Crop Moisture Status";
      v4.textContent = rainPctDelta < -5.0 ? "Irrigation Needed" : (rainPctDelta > 7.0 ? "Drainage Alert" : "Balanced");
      d4.textContent = "Kharif soil water balance";
    }

    const k = Math.max(0, Math.min(state.selectedDay, steps - 1));
    const dTempMean = meanDeltaAtDay(k, 0);
    const dMoistMean = meanDeltaAtDay(k, 5);
    const dHeavy = shockHeavyRainCells - primeHeavyRainCells;

    let headline = "Baseline conditions steady";
    if (dHeavy > 20 || shockMinMsl - primeMinMsl < -2.5) {
      headline = `Heavy rain expands by +${dHeavy} cells; coastal surge watch`;
    } else if (rainPctDelta < -4.0) {
      headline = `Monsoon land rain drops ${rainPctDelta.toFixed(1)}%; moisture deficit`;
    } else if (shockMaxTempC - primeMaxTempC > 1.2) {
      headline = `Land heat rises +${(shockMaxTempC - primeMaxTempC).toFixed(1)} °C; grid demand alert`;
    } else if (Math.abs(dTempMean) > 0.05 || Math.abs(rainPctDelta) > 0.5) {
      headline = `Moderate regional ripple (${rainPctDelta >= 0 ? "+" : ""}${rainPctDelta.toFixed(1)}% land rain)`;
    }

    document.getElementById("copilot-headline").textContent = headline;
    document.getElementById("narrator-box").innerHTML =
      `<p>Under <strong>${escapeHtml(state.activeTitle)}</strong>, Day +${k + 1} mean temperature shifts by ` +
      `<strong>${dTempMean >= 0 ? "+" : ""}${dTempMean.toFixed(2)} K</strong>, atmospheric moisture shifts by ` +
      `<strong>${dMoistMean >= 0 ? "+" : ""}${dMoistMean.toFixed(2)} kg/m²</strong>, and ${steps}-day land rainfall changes by ` +
      `<strong>${rainPctDelta >= 0 ? "+" : ""}${rainPctDelta.toFixed(1)}%</strong>.</p>`;

    const policies = [];
    if (dHeavy > 15 || shockMinMsl - primeMinMsl < -2.0) {
      policies.push({
        agency: "NDMA · Flood & Cyclone Desk",
        action: `Pre-position flood response teams across coastal basins (+${dHeavy} heavy-rain cell-days >10 mm/d; minimum pressure ${shockMinMsl.toFixed(1)} hPa).`,
      });
    }
    if (rainPctDelta < -4.0) {
      policies.push({
        agency: "Ministry of Agriculture · Crop Advisory",
        action: `${steps}-day land rainfall drops ${rainPctDelta.toFixed(1)}%. Release reservoir irrigation schedules for Peninsular and Central farming belts.`,
      });
    }
    if (shockMaxTempC - primeMaxTempC > 1.0) {
      policies.push({
        agency: "Grid Controller · Peak Load Desk",
        action: `Peak temperature rises +${(shockMaxTempC - primeMaxTempC).toFixed(1)} °C. Schedule peaking reserve capacity for afternoon cooling surge.`,
      });
    }
    if (!policies.length) {
      policies.push({
        agency: "Integrated Operations Desk",
        action: "Perturbation remains within normal seasonal operating bounds; maintain standard monitoring.",
      });
    }
    document.getElementById("policy-actions").innerHTML = policies
      .map((p) => `<div class="policy-item"><strong>${escapeHtml(p.agency)}</strong>${escapeHtml(p.action)}</div>`)
      .join("");
  }

  function meanDeltaAtDay(k, ch) {
    const kSafe = Math.max(0, Math.min(k, state.primeRollout.length - 1));
    let sum = 0;
    for (let r = 0; r < NLAT; r++) {
      for (let c = 0; c < NLON; c++) {
        sum += state.shockRollout[kSafe][ch][r][c] - state.primeRollout[kSafe][ch][r][c];
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

  function updateUncertaintyKPIs() {
    if (!state.mcSpread || !state.mcRainProb) return;
    const ch = state.selectedChannel;
    const k = Math.max(0, Math.min(state.selectedDay, state.mcSpread.length - 1));
    const gridSig = state.mcSpread[k][ch];
    const meanSig = meanGrid(gridSig);
    const [, maxSig] = getGridMinMax(gridSig, false);
    let wetCells50 = 0;
    for (let r = 0; r < NLAT; r++) {
      for (let c = 0; c < NLON; c++) {
        if (state.mcRainProb[k][r][c] >= 50.0) wetCells50++;
      }
    }
    document.getElementById("mc-mean-sigma").textContent = formatCompactVal(ch, meanSig, true);
    document.getElementById("mc-max-sigma").textContent = formatCompactVal(ch, maxSig, true);
    document.getElementById("mc-wet-cells").textContent = `${wetCells50} cells`;
  }

  // --- Fast Map Frame Renderer ---
  function renderMapsOnly() {
    if (!state.primeRollout || !state.shockRollout) return;
    const pos = state.playing ? state.playPos : state.selectedDay;
    const kNearest = Math.max(0, Math.min(Math.round(pos), state.primeRollout.length - 1));
    const ch = state.selectedChannel;

    const isScored = kNearest === 0 || kNearest === 3 || kNearest === 7;
    document.getElementById("current-day-title").textContent =
      `Day +${kNearest + 1}${isScored ? " · Scored Lead" : ""}`;

    const primeGrid = getInterpolatedSlice(state.primeRollout, pos, ch);
    const shockGrid = getInterpolatedSlice(state.shockRollout, pos, ch);
    const uPrime = getInterpolatedSlice(state.primeRollout, pos, 2);
    const vPrime = getInterpolatedSlice(state.primeRollout, pos, 3);
    const uShock = getInterpolatedSlice(state.shockRollout, pos, 2);
    const vShock = getInterpolatedSlice(state.shockRollout, pos, 3);

    const isMC = state.renderMode === "mc" && Boolean(state.mcSpread);
    const mcGrid = isMC
      ? getInterpolatedSlice(state.mcSpread, Math.min(pos, state.mcSpread.length - 1), ch)
      : null;

    const deltaGrid = Array.from({ length: NLAT }, (_, r) =>
      Array.from({ length: NLON }, (_, c) =>
        isMC ? mcGrid[r][c] : shockGrid[r][c] - primeGrid[r][c]
      )
    );

    const [pMin, pMax] = getGridMinMax(primeGrid, false);
    const [sMin, sMax] = getGridMinMax(shockGrid, false);
    const cMin = Math.min(pMin, sMin);
    const cMax = Math.max(pMax, sMax);
    const cMid = 0.5 * (cMin + cMax);
    const [dMin, dMax] = getGridMinMax(deltaGrid, !isMC);

    const rightMapGrid = isMC ? mcGrid : shockGrid;
    const rightMin = isMC ? dMin : cMin;
    const rightMax = isMC ? dMax : cMax;
    const rightMid = 0.5 * (rightMin + rightMax);

    // Update Stitch Regional India Map Canvas & Vertical Legend
    drawRegionalIndiaCanvas(rightMapGrid, rightMin, rightMax);
    const legNames = ["Temp", "Rain", "E-Wind", "N-Wind", "Press", "Moist"];
    const regLegTitle = document.getElementById("regional-legend-label");
    if (regLegTitle) regLegTitle.textContent = legNames[ch] || "Rain";
    document.getElementById("reg-leg-max").textContent = formatCompactVal(ch, rightMax, isMC).replace(/\s+.*$/, "");
    document.getElementById("reg-leg-mid").textContent = formatCompactVal(ch, rightMid, isMC).replace(/\s+.*$/, "");
    document.getElementById("reg-leg-min").textContent = formatCompactVal(ch, rightMin, isMC).replace(/\s+.*$/, "");

    document.getElementById("shock-panel-title").textContent =
      state.compareMode === "swipe"
        ? (isMC ? "Swipe Compare (Prime ↔ Spread σ)" : "Swipe Compare (Prime ↔ Branched)")
        : (isMC ? "Monte Carlo Spread (σ)" : "Branched Multiverse");
    document.getElementById("active-scenario-title").textContent =
      isMC ? `5-member ensemble spread · ${state.activeTitle}` : state.activeTitle;

    document.getElementById("delta-panel-title").textContent =
      isMC ? "Monte Carlo Spread (σ)" : "Counterfactual Delta (Δ)";
    document.getElementById("delta-panel-sub").textContent =
      isMC ? "5-member ensemble standard deviation" : "Branched minus Prime · Amber = shock · Dashed = 3-cell zone";

    if (state.renderMode === "3d") {
      draw3DIsometricMap("canvas-prime", primeGrid, cMin, cMax, false);
      draw3DIsometricMap("canvas-shock", rightMapGrid, rightMin, rightMax, false);
      draw3DIsometricMap("canvas-delta", deltaGrid, dMin, dMax, !isMC);
      if (state.compareMode === "swipe") {
        draw3DIsometricMap("canvas-swipe-prime", primeGrid, cMin, cMax, false);
      }
    } else {
      draw2DMap("canvas-prime", primeGrid, uPrime, vPrime, cMin, cMax, false, false);
      draw2DMap("canvas-shock", rightMapGrid, isMC ? null : uShock, isMC ? null : vShock, rightMin, rightMax, false, true);
      draw2DMap("canvas-delta", deltaGrid, null, null, dMin, dMax, !isMC, true);
      if (state.compareMode === "swipe") {
        draw2DMap("canvas-swipe-prime", primeGrid, uPrime, vPrime, cMin, cMax, false, false);
      }
    }

    document.getElementById("stat-prime").textContent = `Mean: ${formatCompactVal(ch, meanGrid(primeGrid), false)}`;
    document.getElementById("stat-shock").textContent = isMC
      ? `Mean σ: ${formatCompactVal(ch, meanGrid(mcGrid), true)}`
      : `Mean: ${formatCompactVal(ch, meanGrid(shockGrid), false)}`;
    const maxAbsDelta = Math.max(Math.abs(dMin), Math.abs(dMax));
    document.getElementById("stat-delta").textContent =
      `${isMC ? "Peak σ" : "Peak |Δ|"}: ${formatCompactVal(ch, maxAbsDelta, true)}`;

    document.getElementById("cb-prime-min").textContent = formatCompactVal(ch, cMin, false);
    document.getElementById("cb-prime-mid").textContent = formatCompactVal(ch, cMid, false);
    document.getElementById("cb-prime-max").textContent = formatCompactVal(ch, cMax, false);
    document.getElementById("cb-shock-min").textContent = formatCompactVal(ch, rightMin, isMC);
    document.getElementById("cb-shock-mid").textContent = formatCompactVal(ch, rightMid, isMC);
    document.getElementById("cb-shock-max").textContent = formatCompactVal(ch, rightMax, isMC);
    document.getElementById("cb-delta-min").textContent = formatCompactVal(ch, dMin, true);
    document.getElementById("cb-delta-mid").textContent = isMC ? formatCompactVal(ch, 0.5 * (dMin + dMax), true) : "0";
    document.getElementById("cb-delta-max").textContent = formatCompactVal(ch, dMax, true);

    if (state.compareMode === "swipe" && state.refreshSwipeLayout) {
      state.refreshSwipeLayout();
    }

    if (state.cachedCausality) {
      drawWavefrontChart(state.cachedCausality, state.wavefrontProgress);
    }
  }

  function updateAllViews() {
    renderMapsOnly();
    updateHoverInspector();
    updateDisasterImpactAndPolicy();
    updateUncertaintyKPIs();
    updateRegionalInsightsLive();
  }

  function updateHoverInspector(clientX, clientY) {
    if (!state.primeRollout || !state.shockRollout || !state.hoverCell) return;
    const { r, c } = state.hoverCell;
    const k = Math.max(0, Math.min(state.selectedDay, state.primeRollout.length - 1));
    const ch = state.selectedChannel;
    const lat = state.data.grid.lat[r];
    const lon = state.data.grid.lon[c];
    const isLand = state.data.grid.land_sea_mask[r][c] >= 0.5;
    const elev = state.data.grid.orography_m[r][c];

    const pVal = state.primeRollout[k][ch][r][c];
    const sVal = state.shockRollout[k][ch][r][c];
    const uVal = state.shockRollout[k][2][r][c];
    const vVal = state.shockRollout[k][3][r][c];
    const hasMcProb = Boolean(state.mcRainProb && state.mcRainProb[k]);

    document.getElementById("inspect-coords").textContent =
      `${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E · [${r}, ${c}]`;
    document.getElementById("insp-geo").textContent =
      `${isLand ? "Land" : "Ocean"} · ${Math.round(elev)} m`;
    document.getElementById("insp-prime").textContent = formatCompactVal(ch, pVal, false);
    document.getElementById("insp-shock").textContent = formatCompactVal(ch, sVal, false);
    document.getElementById("insp-delta").textContent = formatCompactVal(ch, sVal - pVal, true);
    document.getElementById("insp-wind").textContent = `${uVal.toFixed(1)}, ${vVal.toFixed(1)} m/s`;
    document.getElementById("insp-prob").textContent = hasMcProb
      ? `${state.mcRainProb[k][r][c].toFixed(0)}%`
      : "Run MC";

    const tt = document.getElementById("map-tooltip");
    if (tt && clientX !== undefined && clientY !== undefined) {
      tt.innerHTML =
        `<div class="tt-coord">${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E</div>` +
        `<div>${escapeHtml(CHANNELS[ch].name)}: <strong>${formatCompactVal(ch, sVal, false)}</strong> ` +
        `(${formatCompactVal(ch, sVal - pVal, true)})</div>`;
      const maxX = window.innerWidth - 210;
      const maxY = window.innerHeight - 75;
      tt.style.left = `${Math.min(maxX, clientX + 14)}px`;
      tt.style.top = `${Math.min(maxY, clientY + 14)}px`;
      tt.classList.remove("hidden");
    }
  }

  // --- Map Pointer Interactions & Swipe Slider ---
  function attachCanvasInteractions(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    function posToGrid(ev) {
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(1 - 1e-6, (ev.clientX - rect.left) / Math.max(1, rect.width)));
      const y = Math.max(0, Math.min(1 - 1e-6, (ev.clientY - rect.top) / Math.max(1, rect.height)));
      const c = Math.floor(x * NLON);
      const r = NLAT - 1 - Math.floor(y * NLAT);
      return { r, c, lat: state.data.grid.lat[r], lon: state.data.grid.lon[c], px: ev.clientX, py: ev.clientY };
    }

    canvas.addEventListener("pointermove", (ev) => {
      if (state.swiping) return;
      if (state.renderMode === "3d") {
        const tt = document.getElementById("map-tooltip");
        if (tt) tt.classList.add("hidden");
        return;
      }
      const cell = posToGrid(ev);
      const changed = !state.hoverCell || state.hoverCell.r !== cell.r || state.hoverCell.c !== cell.c;
      state.hoverCell = { r: cell.r, c: cell.c };
      if (state.dragStart) {
        const distPx = Math.hypot(ev.clientX - state.dragStart.px, ev.clientY - state.dragStart.py);
        if (distPx >= 4) {
          const box = {
            lat_min: Math.min(state.dragStart.lat, cell.lat),
            lat_max: Math.max(state.dragStart.lat, cell.lat),
            lon_min: Math.min(state.dragStart.lon, cell.lon),
            lon_max: Math.max(state.dragStart.lon, cell.lon),
          };
          state.draftBox = box;
          setBoxInputFieldsOnly(box);
          renderMapsOnly();
        }
      } else if (changed) {
        renderMapsOnly();
      }
      updateHoverInspector(ev.clientX, ev.clientY);
    });

    canvas.addEventListener("pointerleave", () => {
      const tt = document.getElementById("map-tooltip");
      if (tt) tt.classList.add("hidden");
    });

    canvas.addEventListener("pointerdown", (ev) => {
      if (state.renderMode === "3d" || state.swiping || ev.button !== 0) return;
      ev.preventDefault();
      canvas.focus({ preventScroll: true });
      state.dragStart = posToGrid(ev);
    });

    canvas.addEventListener("keydown", (ev) => {
      if (!state.hoverCell) return;
      let { r, c } = state.hoverCell;
      if (ev.key === "ArrowUp") r = Math.min(NLAT - 1, r + 1);
      else if (ev.key === "ArrowDown") r = Math.max(0, r - 1);
      else if (ev.key === "ArrowLeft") c = Math.max(0, c - 1);
      else if (ev.key === "ArrowRight") c = Math.min(NLON - 1, c + 1);
      else return;
      ev.preventDefault();
      state.hoverCell = { r, c };
      renderMapsOnly();
      updateHoverInspector();
    });
  }

  function initRegionalMapClick() {
    const regCanvas = document.getElementById("canvas-india-regional");
    if (!regCanvas) return;
    regCanvas.addEventListener("click", (ev) => {
      const rect = regCanvas.getBoundingClientRect();
      const xFrac = (ev.clientX - rect.left) / Math.max(1, rect.width);
      const yFrac = (ev.clientY - rect.top) / Math.max(1, rect.height);
      const clickLon = 65.5 + xFrac * 35.0;
      const clickLat = 37.5 - yFrac * 31.0;

      // First test exact GeoJSON polygon hit across our 8 featured states
      for (const sName of Object.keys(INDIA_STATES)) {
        const feat = findGeoFeatureByName(sName);
        if (feat && pointInFeatureLonLat(clickLon, clickLat, feat)) {
          selectIndianState(sName);
          return;
        }
      }

      // Fallback to nearest centroid if clicked near a featured state
      let bestState = null;
      let bestDist = Infinity;
      for (const [sName, info] of Object.entries(INDIA_STATES)) {
        const d = Math.hypot(clickLon - info.centerLon, clickLat - info.centerLat);
        if (d < bestDist) {
          bestDist = d;
          bestState = sName;
        }
      }
      if (bestState && bestDist <= 8.5) {
        selectIndianState(bestState);
      }
    });
  }

  function initSwipeSlider() {
    const handle = document.getElementById("swipe-handle");
    const wrap = document.getElementById("swipe-wrap");
    const baseCanvas = document.getElementById("canvas-shock");
    if (!handle || !wrap || !baseCanvas) return;

    function applySwipePosition() {
      const clamped = Math.max(2, Math.min(98, state.swipePct));
      state.swipePct = clamped;
      handle.setAttribute("aria-valuenow", String(Math.round(clamped)));
      const overlay = document.getElementById("canvas-swipe-prime");
      if (overlay) {
        overlay.style.clipPath = `inset(0 ${(100 - clamped).toFixed(2)}% 0 0)`;
      }
      const wrapRect = wrap.getBoundingClientRect();
      const canvasRect = baseCanvas.getBoundingClientRect();
      if (wrapRect.width > 0 && canvasRect.width > 0) {
        const offsetLeft = canvasRect.left - wrapRect.left;
        handle.style.left = `${offsetLeft + (clamped / 100) * canvasRect.width}px`;
      } else {
        handle.style.left = `${clamped}%`;
      }
    }

    function setSwipe(pct) {
      state.swipePct = Math.max(2, Math.min(98, pct));
      applySwipePosition();
    }

    state.refreshSwipeLayout = applySwipePosition;

    handle.addEventListener("pointerdown", (ev) => {
      ev.stopPropagation();
      state.swiping = true;
      if (handle.setPointerCapture) handle.setPointerCapture(ev.pointerId);
    });

    window.addEventListener("pointermove", (ev) => {
      if (!state.swiping) return;
      const canvasRect = baseCanvas.getBoundingClientRect();
      const pct = ((ev.clientX - canvasRect.left) / Math.max(1, canvasRect.width)) * 100;
      setSwipe(pct);
    });

    const clearPointers = () => {
      state.swiping = false;
      state.dragStart = null;
      state.globeDragging = false;
    };
    window.addEventListener("pointerup", clearPointers);
    window.addEventListener("pointercancel", clearPointers);
    window.addEventListener("blur", clearPointers);

    handle.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowLeft") { ev.preventDefault(); setSwipe(state.swipePct - 4); }
      if (ev.key === "ArrowRight") { ev.preventDefault(); setSwipe(state.swipePct + 4); }
    });

    setSwipe(50);
  }

  function setBoxInputFieldsOnly(box) {
    document.getElementById("box-lat-min").value = box.lat_min.toFixed(1);
    document.getElementById("box-lat-max").value = box.lat_max.toFixed(1);
    document.getElementById("box-lon-min").value = box.lon_min.toFixed(1);
    document.getElementById("box-lon-max").value = box.lon_max.toFixed(1);
  }

  function setBoxInputs(box) {
    state.activeBox = box;
    state.draftBox = null;
    setBoxInputFieldsOnly(box);
  }

  function syncShockSliderBounds(ch, mode, targetVal) {
    const slider = document.getElementById("shock-strength");
    const readout = document.getElementById("shock-strength-val");
    if (!slider || !readout) return;

    let min = -8.0, max = 8.0, step = 0.1;
    if (mode === "rel") {
      min = -0.80; max = 0.80; step = 0.01;
    } else if (ch === 4) {
      min = -1500; max = 1500; step = 25;
    } else if (ch === 1 || ch === 5) {
      min = -25.0; max = 25.0; step = 0.5;
    }
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);

    const raw = targetVal !== undefined ? Number(targetVal) : parseFloat(slider.value);
    const clamped = Math.max(min, Math.min(max, Number.isFinite(raw) ? raw : 0.0));
    slider.value = String(clamped);
    const decimals = step >= 1 ? 0 : 2;
    readout.textContent = `${clamped >= 0 ? "+" : ""}${clamped.toFixed(decimals)}`;
  }

  function setRenderMode(mode) {
    state.renderMode = mode;
    document.querySelectorAll("#render-mode-tabs .seg-btn").forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    snapshotMapsForCrossFade();
    renderMapsOnly();
  }

  function syncLeftRailAria() {
    const shell = document.getElementById("workspace-shell");
    const btnCollapseLeft = document.getElementById("btn-collapse-left");
    const leftRail = document.getElementById("left-rail");
    const isHidden = Boolean(
      state.presentationMode || (shell && shell.classList.contains("left-collapsed"))
    );
    if (btnCollapseLeft) btnCollapseLeft.setAttribute("aria-expanded", String(!isHidden));
    if (leftRail && "inert" in leftRail) leftRail.inert = isHidden;
  }

  function setPresentationMode(active) {
    state.presentationMode = Boolean(active);
    const shell = document.getElementById("workspace-shell");
    const btn = document.getElementById("btn-present");
    const label = document.getElementById("present-label");
    document.body.classList.toggle("presentation-active", state.presentationMode);
    if (shell) shell.classList.toggle("presentation-mode", state.presentationMode);
    if (btn) btn.setAttribute("aria-pressed", String(state.presentationMode));
    if (label) label.textContent = state.presentationMode ? "Exit (Esc)" : "Present";
    syncLeftRailAria();
    setTimeout(() => {
      if (state.refreshSwipeLayout) state.refreshSwipeLayout();
      if (state.cachedCausality) drawWavefrontChart(state.cachedCausality, 1.0);
    }, 40);
  }

  function attachArrowKeyNav(containerId, selector) {
    const list = document.getElementById(containerId);
    if (!list) return;
    list.addEventListener("keydown", (ev) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(ev.key)) return;
      const items = Array.from(list.querySelectorAll(selector));
      if (!items.length) return;
      const idx = items.indexOf(document.activeElement);
      if (idx < 0) return;
      ev.preventDefault();
      let nextIdx = idx;
      if (ev.key === "ArrowRight") nextIdx = (idx + 1) % items.length;
      else if (ev.key === "ArrowLeft") nextIdx = (idx - 1 + items.length) % items.length;
      else if (ev.key === "Home") nextIdx = 0;
      else if (ev.key === "End") nextIdx = items.length - 1;
      items[nextIdx].focus();
      items[nextIdx].click();
    });
  }

  function switchRightTab(tabName, openDrawerIfCompact) {
    document.querySelectorAll("#right-tabs .tab-btn").forEach((b) => {
      const active = b.dataset.rtab === tabName;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
      b.setAttribute("tabindex", active ? "0" : "-1");
    });
    document.querySelectorAll(".right-pane").forEach((p) => {
      p.classList.toggle("active", p.id === `rtab-${tabName}`);
    });
    if (openDrawerIfCompact && window.innerWidth >= 1024 && window.innerWidth < 1280) {
      const rightRail = document.getElementById("right-rail");
      rightRail.classList.add("drawer-open");
      if ("inert" in rightRail) rightRail.inert = false;
      document.getElementById("drawer-backdrop").classList.remove("hidden");
      document.getElementById("btn-toggle-insights").setAttribute("aria-expanded", "true");
    }
  }

  function switchBottomTab(tabName) {
    document.querySelectorAll("#bottom-tabs .tab-btn").forEach((b) => {
      const active = b.dataset.btab === tabName;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
      b.setAttribute("tabindex", active ? "0" : "-1");
    });
    document.querySelectorAll(".dock-pane").forEach((p) => {
      p.classList.toggle("active", p.id === `btab-${tabName}`);
    });
    if (tabName === "wavefront") animateWavefrontDraw();
  }

  // --- Smooth 60fps Timeline Playback ---
  function togglePlayback() {
    if (!state.primeRollout) return;
    const playBtn = document.getElementById("btn-play");
    const icon = document.getElementById("icon-play");
    const daySlider = document.getElementById("day-slider");
    const maxIdx = Math.max(0, state.primeRollout.length - 1);
    state.playing = !state.playing;
    playBtn.setAttribute("aria-pressed", String(state.playing));

    if (!state.playing) {
      if (icon) icon.innerHTML = '<polygon points="6 4 20 12 6 20 6 4" />';
      if (state.playRafId) cancelAnimationFrame(state.playRafId);
      state.playRafId = null;
      state.selectedDay = Math.min(maxIdx, Math.max(0, Math.round(state.playPos)));
      state.playPos = state.selectedDay;
      daySlider.value = String(state.selectedDay);
      updateAllViews();
      return;
    }

    if (icon) icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    state.lastFrameTs = performance.now();

    function playbackTick(now) {
      if (!state.playing || !state.primeRollout) return;
      const curMaxIdx = Math.max(0, state.primeRollout.length - 1);
      const dtSec = Math.min(0.1, (now - state.lastFrameTs) / 1000.0);
      state.lastFrameTs = now;

      if (prefersReducedMotion()) {
        state.playPos += dtSec * 1.6;
        if (state.playPos >= curMaxIdx + 1) state.playPos = 0;
        const nextInt = Math.min(curMaxIdx, Math.floor(state.playPos));
        if (nextInt !== state.selectedDay) {
          state.selectedDay = nextInt;
          daySlider.value = String(state.selectedDay);
          updateAllViews();
        }
      } else {
        state.playPos += dtSec * 1.65;
        if (state.playPos >= curMaxIdx) {
          state.playPos = 0.0;
        }
        const nearestDay = Math.min(curMaxIdx, Math.max(0, Math.round(state.playPos)));
        if (nearestDay !== state.selectedDay) {
          state.selectedDay = nearestDay;
          daySlider.value = String(nearestDay);
          updateDisasterImpactAndPolicy();
          updateHoverInspector();
          updateUncertaintyKPIs();
          updateRegionalInsightsLive();
        }
        renderMapsOnly();
      }
      state.playRafId = requestAnimationFrame(playbackTick);
    }
    state.playRafId = requestAnimationFrame(playbackTick);
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

    // Build Grouped Preset Chips
    const presetContainer = document.getElementById("preset-buttons");
    presetContainer.innerHTML = "";
    const groups = [
      { label: "Grader & Control", match: (b) => b === "GRADER" || b === "CONTROL" },
      { label: "What-if Scenarios", match: (b) => b === "WHAT-IF" },
      { label: "Hazard Stress Tests", match: (b) => b === "HAZARD" },
    ];
    groups.forEach((grp) => {
      const items = state.data.presets.filter((p) => grp.match(p.badge));
      if (!items.length) return;
      const block = document.createElement("div");
      const title = document.createElement("div");
      title.className = "preset-group-label";
      title.textContent = grp.label;
      const wrap = document.createElement("div");
      wrap.className = "preset-chip-wrap";

      items.forEach((p) => {
        const isActive = p.id === state.activePresetId;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `preset-btn ${isActive ? "active" : ""}`;
        btn.setAttribute("aria-pressed", String(isActive));
        btn.dataset.id = p.id;
        btn.title = p.name;
        const shortLabel = p.name
          .replace(/^(Grader Shock \d+:\s*|What-If:\s*)/i, "")
          .replace(/\s*\([^)]*\)/, "");
        const dotClass =
          p.badge === "CONTROL" ? "dot-control" :
          p.badge === "WHAT-IF" ? "dot-whatif" :
          p.badge === "HAZARD" ? "dot-hazard" : "dot-grader";
        btn.innerHTML = `<span class="preset-dot ${dotClass}" aria-hidden="true"></span><span>${escapeHtml(shortLabel)}</span>`;
        btn.addEventListener("click", () => {
          state.activePresetId = p.id;
          state.activeTitle = p.name.replace(/^(Grader Shock \d+:\s*|What-If:\s*)/i, "");
          state.activeEffects = p.effects.map((e) => ({ ...e }));
          setBoxInputs({ ...p.box });
          if (p.effects.length > 0) {
            const e0 = p.effects[0];
            document.getElementById("shock-channel").value = String(e0.channel);
            document.getElementById("shock-mode").value = e0.mode;
            syncShockSliderBounds(e0.channel, e0.mode, e0.val);
          } else {
            const curCh = parseInt(document.getElementById("shock-channel").value, 10) || 0;
            const curMode = document.getElementById("shock-mode").value;
            syncShockSliderBounds(curCh, curMode, 0.0);
          }
          document.querySelectorAll(".preset-btn").forEach((b) => {
            const act = b.dataset.id === p.id;
            b.classList.toggle("active", act);
            b.setAttribute("aria-pressed", String(act));
          });
          runSimulationPair();
        });
        wrap.appendChild(btn);
      });

      block.appendChild(title);
      block.appendChild(wrap);
      presetContainer.appendChild(block);
    });

    // Stitch State Selector & Search Input
    const stateButtons = document.querySelectorAll(".state-btn");
    const searchInput = document.getElementById("state-search");
    stateButtons.forEach((btn) => {
      btn.addEventListener("click", () => selectIndianState(btn.dataset.state));
    });
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim().toLowerCase();
        stateButtons.forEach((btn) => {
          const match = btn.dataset.state.toLowerCase().includes(q);
          btn.style.display = match ? "flex" : "none";
        });
      });
    }
    initRegionalMapClick();

    // Primary Stitch Top Navigation Pills + 3D Globe Modal
    document.querySelectorAll("#primary-nav-tabs .nav-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const target = pill.dataset.nav;
        document.querySelectorAll("#primary-nav-tabs .nav-pill").forEach((p) =>
          p.classList.toggle("active", p === pill)
        );
        if (target === "globe") {
          openGlobeOverlay();
        } else if (target === "regional") {
          document.getElementById("sec-regional-insights").scrollIntoView({ behavior: "smooth" });
        } else if (target === "simulate") {
          document.getElementById("workspace-shell").scrollIntoView({ behavior: "smooth" });
        } else if (target === "multiverse") {
          document.getElementById("sec-multiverse-stage").scrollIntoView({ behavior: "smooth" });
        } else if (target === "analytics") {
          document.getElementById("sec-analytics-dock").scrollIntoView({ behavior: "smooth" });
        }
      });
    });

    document.getElementById("btn-country-pill").addEventListener("click", openGlobeOverlay);
    document.getElementById("btn-explore-india").addEventListener("click", animateZoomIntoIndiaAndClose);
    document.getElementById("btn-skip-globe").addEventListener("click", () => {
      document.getElementById("globe-intro-overlay").classList.add("hidden");
      restoreRegionalNavActive();
    });

    const globeCanvas = document.getElementById("canvas-earth-globe");
    if (globeCanvas) {
      globeCanvas.addEventListener("pointerdown", (ev) => {
        state.globeDragging = true;
        state.globeDragLast = { x: ev.clientX, y: ev.clientY };
      });
      window.addEventListener("pointermove", (ev) => {
        if (!state.globeDragging || !state.globeDragLast) return;
        const dx = ev.clientX - state.globeDragLast.x;
        const dy = ev.clientY - state.globeDragLast.y;
        state.globeDragLast = { x: ev.clientX, y: ev.clientY };
        state.globeRotLon += dx * 0.35;
        state.globeRotLat = Math.max(-70, Math.min(70, state.globeRotLat - dy * 0.35));
      });
    }

    // Light / Dark Theme Toggle
    document.getElementById("btn-theme-toggle").addEventListener("click", () => {
      state.darkTheme = !state.darkTheme;
      document.body.classList.toggle("dark-theme", state.darkTheme);
      renderMapsOnly();
    });

    // Left Rail Controls
    document.getElementById("window-select").addEventListener("change", (ev) => {
      state.windowKey = ev.target.value;
      runSimulationPair();
    });

    document.getElementById("steps-input").addEventListener("change", () => runSimulationPair());

    const syncSliderFromSelects = () => {
      const ch = parseInt(document.getElementById("shock-channel").value, 10) || 0;
      const mode = document.getElementById("shock-mode").value;
      syncShockSliderBounds(ch, mode);
    };
    document.getElementById("shock-channel").addEventListener("change", syncSliderFromSelects);
    document.getElementById("shock-mode").addEventListener("change", syncSliderFromSelects);

    document.getElementById("shock-strength").addEventListener("input", (ev) => {
      const v = parseFloat(ev.target.value);
      const step = parseFloat(ev.target.step) || 0.1;
      const decimals = step >= 1 ? 0 : 2;
      document.getElementById("shock-strength-val").textContent = `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}`;
    });

    function parseCoord(id, minBound, maxBound, fallback) {
      const parsed = parseFloat(document.getElementById(id).value);
      const val = Number.isFinite(parsed) ? parsed : fallback;
      return Math.max(minBound, Math.min(maxBound, val));
    }

    document.getElementById("btn-run-custom").addEventListener("click", () => {
      const rawLat1 = parseCoord("box-lat-min", 6.5, 37.5, 8.0);
      const rawLat2 = parseCoord("box-lat-max", 6.5, 37.5, 20.0);
      const rawLon1 = parseCoord("box-lon-min", 65.5, 100.5, 82.0);
      const rawLon2 = parseCoord("box-lon-max", 65.5, 100.5, 94.0);
      const box = {
        lat_min: Math.min(rawLat1, rawLat2),
        lat_max: Math.max(rawLat1, rawLat2),
        lon_min: Math.min(rawLon1, rawLon2),
        lon_max: Math.max(rawLon1, rawLon2),
      };
      setBoxInputs(box);
      const ch = parseInt(document.getElementById("shock-channel").value, 10) || 0;
      const mode = document.getElementById("shock-mode").value;
      const parsedStrength = parseFloat(document.getElementById("shock-strength").value);
      const val = Number.isFinite(parsedStrength) ? parsedStrength : 0.0;

      state.activePresetId = "custom";
      state.activeBox = box;
      state.activeEffects = Math.abs(val) < 1e-6 ? [] : [{ channel: ch, mode, val }];
      state.activeTitle = `Custom ${CHANNELS[ch].name} (${val >= 0 ? "+" : ""}${val} ${mode === "rel" ? "×" : CHANNELS[ch].unit})`;
      document.querySelectorAll(".preset-btn").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      runSimulationPair();
    });

    document.getElementById("btn-run-mc").addEventListener("click", runMonteCarloEnsemble);
    document.getElementById("btn-dock-mc").addEventListener("click", runMonteCarloEnsemble);
    document.getElementById("btn-verify-null").addEventListener("click", verifyNullShockLive);
    document.getElementById("btn-retry-api").addEventListener("click", runSimulationPair);
    document.getElementById("btn-stage-retry").addEventListener("click", runSimulationPair);
    document.getElementById("api-url-input").addEventListener("change", runSimulationPair);

    // Sidebar Collapse, Presentation Mode, Tabs, Drawer & Co-pilot Expand
    const shell = document.getElementById("workspace-shell");
    const btnCollapseLeft = document.getElementById("btn-collapse-left");
    btnCollapseLeft.addEventListener("click", () => {
      if (state.presentationMode) {
        setPresentationMode(false);
        return;
      }
      shell.classList.toggle("left-collapsed");
      syncLeftRailAria();
      setTimeout(() => {
        if (state.refreshSwipeLayout) state.refreshSwipeLayout();
        if (state.cachedCausality) drawWavefrontChart(state.cachedCausality, 1.0);
      }, 40);
    });

    document.getElementById("btn-present").addEventListener("click", () => {
      setPresentationMode(!state.presentationMode);
    });

    const rightRail = document.getElementById("right-rail");
    const backdrop = document.getElementById("drawer-backdrop");
    const btnToggleInsights = document.getElementById("btn-toggle-insights");
    const syncRightDrawerInert = () => {
      const isCompact = window.innerWidth >= 1024 && window.innerWidth < 1280;
      const isOpen = rightRail.classList.contains("drawer-open");
      if (!isCompact && isOpen) {
        rightRail.classList.remove("drawer-open");
        backdrop.classList.add("hidden");
        btnToggleInsights.setAttribute("aria-expanded", "false");
      }
      if ("inert" in rightRail) {
        rightRail.inert = isCompact && !rightRail.classList.contains("drawer-open");
      }
    };

    window.addEventListener("resize", () => {
      syncRightDrawerInert();
      if (state.refreshSwipeLayout) state.refreshSwipeLayout();
      if (state.cachedCausality) drawWavefrontChart(state.cachedCausality, 1.0);
    });

    document.querySelectorAll("#bottom-tabs .tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchBottomTab(btn.dataset.btab));
    });

    document.querySelectorAll("#right-tabs .tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchRightTab(btn.dataset.rtab, false));
    });

    document.getElementById("btn-trust-topbar").addEventListener("click", () => switchRightTab("trust", true));

    btnToggleInsights.addEventListener("click", () => {
      rightRail.classList.add("drawer-open");
      backdrop.classList.remove("hidden");
      btnToggleInsights.setAttribute("aria-expanded", "true");
      syncRightDrawerInert();
    });
    const closeDrawer = () => {
      rightRail.classList.remove("drawer-open");
      backdrop.classList.add("hidden");
      btnToggleInsights.setAttribute("aria-expanded", "false");
      syncRightDrawerInert();
    };
    document.getElementById("btn-close-drawer").addEventListener("click", closeDrawer);
    backdrop.addEventListener("click", closeDrawer);
    syncRightDrawerInert();

    const btnCopilotDetails = document.getElementById("btn-copilot-details");
    const policyDrawer = document.getElementById("policy-actions");
    btnCopilotDetails.addEventListener("click", () => {
      const hidden = policyDrawer.classList.toggle("hidden");
      btnCopilotDetails.setAttribute("aria-expanded", String(!hidden));
      btnCopilotDetails.textContent = hidden ? "Show details" : "Hide details";
    });

    // Stage Toolbar Segmented Controls
    document.querySelectorAll("#channel-tabs .seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        snapshotMapsForCrossFade();
        state.selectedChannel = parseInt(btn.dataset.ch, 10);
        document.querySelectorAll("#channel-tabs .seg-btn").forEach((b) => {
          const active = b === btn;
          b.classList.toggle("active", active);
          b.setAttribute("aria-pressed", String(active));
        });
        updateAllViews();
      });
    });

    document.querySelectorAll("#render-mode-tabs .seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.mode === "mc" && !state.mcSpread) {
          runMonteCarloEnsemble();
        } else {
          setRenderMode(btn.dataset.mode);
        }
      });
    });

    document.querySelectorAll("#compare-mode-tabs .seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.compare;
        state.compareMode = mode;
        document.querySelectorAll("#compare-mode-tabs .seg-btn").forEach((b) => {
          const active = b === btn;
          b.classList.toggle("active", active);
          b.setAttribute("aria-pressed", String(active));
        });
        const stage = document.getElementById("maps-stage");
        stage.className = `maps-stage mode-${mode}`;
        document.getElementById("card-prime").classList.toggle("hidden", mode !== "split");
        document.getElementById("card-shock").classList.toggle("hidden", mode === "delta");
        document.getElementById("card-delta").classList.toggle("hidden", mode !== "delta");
        document.getElementById("canvas-swipe-prime").classList.toggle("hidden", mode !== "swipe");
        document.getElementById("swipe-handle").classList.toggle("hidden", mode !== "swipe");
        document.getElementById("swipe-badge-left").classList.toggle("hidden", mode !== "swipe");
        document.getElementById("swipe-badge-right").classList.toggle("hidden", mode !== "swipe");
        renderMapsOnly();
      });
    });

    const smoothBtn = document.getElementById("btn-grid-smooth");
    smoothBtn.addEventListener("click", () => {
      state.smoothGrid = !state.smoothGrid;
      smoothBtn.setAttribute("aria-pressed", String(state.smoothGrid));
      smoothBtn.textContent = state.smoothGrid ? "Smooth" : "Raw grid";
      snapshotMapsForCrossFade();
      renderMapsOnly();
    });

    document.querySelectorAll("#hazard-tabs .seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.hazardTab = btn.dataset.hazard;
        document.querySelectorAll("#hazard-tabs .seg-btn").forEach((b) => {
          const active = b === btn;
          b.classList.toggle("active", active);
          b.setAttribute("aria-pressed", String(active));
        });
        updateDisasterImpactAndPolicy();
      });
    });

    ["bottom-tabs", "right-tabs"].forEach((id) => attachArrowKeyNav(id, '[role="tab"]'));
    ["channel-tabs", "compare-mode-tabs", "render-mode-tabs", "hazard-tabs"].forEach((id) =>
      attachArrowKeyNav(id, ".seg-btn")
    );

    // Timeline Scrubber & Smooth Playback
    const daySlider = document.getElementById("day-slider");
    daySlider.addEventListener("input", (ev) => {
      state.selectedDay = parseInt(ev.target.value, 10) || 0;
      state.playPos = state.selectedDay;
      updateAllViews();
    });

    document.getElementById("btn-play").addEventListener("click", togglePlayback);

    // Global Keyboard Shortcuts: P = Presentation Mode, Esc = Exit/Close, Space = Play/Pause
    window.addEventListener("keydown", (ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const activeEl = document.activeElement;
      const tag = activeEl ? activeEl.tagName : "";
      const isFormInput =
        tag === "INPUT" ||
        tag === "SELECT" ||
        tag === "TEXTAREA" ||
        Boolean(activeEl && activeEl.isContentEditable);

      if (ev.key === "Escape") {
        const globeOverlay = document.getElementById("globe-intro-overlay");
        if (globeOverlay && !globeOverlay.classList.contains("hidden")) {
          ev.preventDefault();
          globeOverlay.classList.add("hidden");
          return;
        }
        if (state.presentationMode) {
          ev.preventDefault();
          setPresentationMode(false);
        }
        closeDrawer();
        return;
      }

      if (isFormInput) return;

      if (ev.key === "p" || ev.key === "P") {
        ev.preventDefault();
        setPresentationMode(!state.presentationMode);
        return;
      }

      if (ev.code === "Space" || ev.key === " ") {
        const isInteractiveTrigger =
          tag === "BUTTON" ||
          tag === "SUMMARY" ||
          (activeEl && activeEl.getAttribute("role") === "slider");
        if (!isInteractiveTrigger && state.primeRollout) {
          ev.preventDefault();
          togglePlayback();
        }
      }
    });

    ["canvas-prime", "canvas-shock", "canvas-delta"].forEach(attachCanvasInteractions);
    syncShockSliderBounds(0, "add", 3.0);
    initSwipeSlider();
    renderOfflineTerrainPreview();

    await runSimulationPair();
  }

  window.addEventListener("DOMContentLoaded", initDashboard);
})();
