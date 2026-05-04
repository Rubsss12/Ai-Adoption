// Global AI Adoption — interactive 3D globe
// Renders country polygons colored by AI adoption metrics on a globe.gl globe.

const GEOJSON_URL =
  "https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson";

const METRIC_LABELS = {
  score: "Composite AI Adoption Index",
  enterprise: "Enterprise AI adoption",
  consumer: "Consumer GenAI usage",
  government: "Government AI readiness",
  talent: "Talent & skills",
  investment: "Investment & infrastructure",
};

// ISO_A3 fallback for countries Natural Earth marks as "-99" or with mismatched names.
const NAME_TO_ISO3 = {
  "France": "FRA",
  "Norway": "NOR",
  "Kosovo": "XKX",
  "Somaliland": "SOM",
  "N. Cyprus": "CYP",
  "Northern Cyprus": "CYP",
  "Republic of Serbia": "SRB",
  "United States of America": "USA",
  "Republic of Korea": "KOR",
  "Democratic People's Republic of Korea": "PRK",
  "Korea, South": "KOR",
  "Korea, North": "PRK",
  "South Korea": "KOR",
  "North Korea": "PRK",
  "Russian Federation": "RUS",
  "Russia": "RUS",
  "Czech Republic": "CZE",
  "Czechia": "CZE",
  "Iran (Islamic Republic of)": "IRN",
  "Vietnam": "VNM",
  "Viet Nam": "VNM",
  "Tanzania": "TZA",
  "United Republic of Tanzania": "TZA",
  "Bolivia": "BOL",
  "Venezuela": "VEN",
  "Syria": "SYR",
  "Laos": "LAO",
  "Brunei": "BRN",
  "Moldova": "MDA",
  "Macedonia": "MKD",
  "North Macedonia": "MKD",
  "Republic of the Congo": "COG",
  "Democratic Republic of the Congo": "COD",
  "Ivory Coast": "CIV",
  "Cote d'Ivoire": "CIV",
  "Côte d'Ivoire": "CIV",
  "Taiwan": "TWN",
  "Turkey": "TUR",
  "Türkiye": "TUR",
  "United Kingdom": "GBR",
  "Eswatini": "SWZ",
  "Swaziland": "SWZ",
};

// 6-stop sequential palette (dark blue → magenta) — anchors match CSS legend.
const PALETTE = [
  [0,   [11, 29, 77]],
  [20,  [29, 58, 138]],
  [40,  [59, 106, 209]],
  [60,  [106, 163, 255]],
  [80,  [179, 136, 255]],
  [100, [255, 95, 180]],
];
const NO_DATA_COLOR = "rgba(95, 110, 150, 0.45)";
const BORDER_COLOR = "rgba(255, 255, 255, 0.55)";
const SELECTED_BORDER = "#ffffff";
const HOVER_BORDER = "#ffd166";
const SIDE_COLOR = "rgba(70, 95, 180, 0.55)";

const lerp = (a, b, t) => a + (b - a) * t;
function colorForScore(score) {
  if (score == null || isNaN(score)) return NO_DATA_COLOR;
  const s = Math.max(0, Math.min(100, score));
  for (let i = 0; i < PALETTE.length - 1; i++) {
    const [s0, c0] = PALETTE[i];
    const [s1, c1] = PALETTE[i + 1];
    if (s <= s1) {
      const t = (s - s0) / (s1 - s0);
      const r = Math.round(lerp(c0[0], c1[0], t));
      const g = Math.round(lerp(c0[1], c1[1], t));
      const b = Math.round(lerp(c0[2], c1[2], t));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return `rgb(${PALETTE.at(-1)[1].join(",")})`;
}

function getFeatureIso3(feature) {
  const p = feature.properties || {};
  const candidates = [p.ISO_A3, p.ISO_A3_EH, p.ADM0_A3, p.SOV_A3, p.iso_a3];
  for (const c of candidates) {
    if (c && c !== "-99") return c;
  }
  const name = p.ADMIN || p.NAME || p.name;
  return NAME_TO_ISO3[name] || null;
}

function getFeatureName(feature) {
  const p = feature.properties || {};
  return p.ADMIN || p.NAME_LONG || p.NAME || p.name || "Unknown";
}

// ------- State -------
const state = {
  metric: "score",
  data: null,            // raw dataset (meta + countries[])
  byIso: new Map(),      // iso3 -> country record
  features: [],          // GeoJSON features
  selectedIso: null,
  hoveredIso: null,
  spin: true,
  globe: null,
};

// ------- Boot -------
init().catch((err) => {
  console.error(err);
  document.getElementById("hint").textContent =
    "Failed to load globe — see browser console.";
});

async function init() {
  const [dataset, geo] = await Promise.all([
    fetch("./data/ai-adoption.json").then((r) => r.json()),
    fetch(GEOJSON_URL).then((r) => r.json()),
  ]);

  state.data = dataset;
  state.features = (geo.features || []).filter(
    (f) => getFeatureName(f) !== "Antarctica"
  );
  for (const c of dataset.countries) state.byIso.set(c.iso_a3, c);

  // Header / sources
  document.getElementById("asOf").textContent = "as of " + dataset.meta.as_of;
  document.getElementById("methodology").textContent = dataset.meta.methodology;
  const sourceList = document.getElementById("sourceList");
  for (const s of dataset.meta.sources) {
    const li = document.createElement("li");
    if (s.url) {
      const a = document.createElement("a");
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = s.name;
      li.appendChild(a);
    } else {
      li.textContent = s.name;
    }
    sourceList.appendChild(li);
  }

  buildGlobe();
  bindUi();
  renderLeaderboard();
  renderTopMovers();
  renderSummaryStats();
  refreshGlobeColors();
}

// ------- Number formatting -------
function fmtNum(n) {
  if (n == null) return "—";
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return Math.round(n).toString();
}
function fmtMoney(bn) {
  if (bn == null) return "—";
  if (bn >= 1000) return "$" + (bn / 1000).toFixed(1) + "T";
  return "$" + Math.round(bn) + "B";
}
function fmtPop(m) {
  if (m == null) return "—";
  if (m >= 1000) return (m / 1000).toFixed(2) + "B";
  if (m < 10) return m.toFixed(1) + "M";
  return Math.round(m) + "M";
}

// ------- Globe -------
function buildGlobe() {
  const el = document.getElementById("globe");
  const tooltip = document.getElementById("tooltip");

  const globe = Globe()(el)
    .backgroundColor("rgba(0,0,0,0)")
    .globeImageUrl("//unpkg.com/three-globe/example/img/earth-dark.jpg")
    .showAtmosphere(true)
    .atmosphereColor("#7aa2ff")
    .atmosphereAltitude(0.18)
    .polygonsData(state.features)
    .polygonAltitude((d) => polygonAltitudeFor(d))
    .polygonCapColor((d) => fillFor(d))
    .polygonSideColor(() => SIDE_COLOR)
    .polygonStrokeColor((d) => strokeFor(d))
    .polygonsTransitionDuration(300)
    .polygonLabel(() => "")
    .onPolygonHover((hover) => {
      el.style.cursor = hover ? "pointer" : "grab";
      const newIso = hover ? getFeatureIso3(hover) : null;
      if (newIso !== state.hoveredIso) {
        state.hoveredIso = newIso;
        refreshGlobeColors();
      }
      if (!hover) {
        tooltip.hidden = true;
        return;
      }
      const name = getFeatureName(hover);
      const c = newIso ? state.byIso.get(newIso) : null;
      const v = c ? c[state.metric] : null;
      tooltip.innerHTML = c
        ? `<strong>${name}</strong><span class="tval">${v}</span>`
        : `<strong>${name}</strong><span class="tval" style="color:#8a93c8">no data</span>`;
      tooltip.hidden = false;
    })
    .onPolygonClick((feat) => {
      const iso = getFeatureIso3(feat);
      if (iso) selectCountry(iso, { fly: true, openModal: true });
    });

  // Sizing + responsive
  const resize = () => {
    globe.width(el.clientWidth);
    globe.height(el.clientHeight);
  };
  resize();
  window.addEventListener("resize", resize);

  // Auto-rotate
  const controls = globe.controls();
  controls.autoRotate = state.spin;
  controls.autoRotateSpeed = 0.45;
  controls.enableDamping = true;

  // Tooltip follow
  el.addEventListener("mousemove", (e) => {
    const rect = el.getBoundingClientRect();
    tooltip.style.left = e.clientX - rect.left + "px";
    tooltip.style.top = e.clientY - rect.top + "px";
  });

  // Initial camera
  globe.pointOfView({ lat: 25, lng: 10, altitude: 2.4 }, 0);

  state.globe = globe;
}

function getMetric(feature) {
  const iso = getFeatureIso3(feature);
  if (!iso) return null;
  const c = state.byIso.get(iso);
  return c ? c[state.metric] : null;
}

function polygonAltitudeFor(feature) {
  const iso = getFeatureIso3(feature);
  const m = getMetric(feature);
  let alt = 0.02 + (m ?? 0) / 100 * 0.18;
  if (state.hoveredIso === iso) alt += 0.04;
  if (state.selectedIso === iso) alt += 0.06;
  return alt;
}

function fillFor(feature) {
  const iso = getFeatureIso3(feature);
  const c = iso ? state.byIso.get(iso) : null;
  if (!c) return NO_DATA_COLOR;
  return colorForScore(c[state.metric]);
}

function strokeFor(feature) {
  const iso = getFeatureIso3(feature);
  if (state.selectedIso && state.selectedIso === iso) return SELECTED_BORDER;
  if (state.hoveredIso && state.hoveredIso === iso) return HOVER_BORDER;
  return BORDER_COLOR;
}

function refreshGlobeColors() {
  if (!state.globe) return;
  state.globe
    .polygonCapColor((d) => fillFor(d))
    .polygonAltitude((d) => polygonAltitudeFor(d))
    .polygonStrokeColor((d) => strokeFor(d));
}

// ------- UI bindings -------
function bindUi() {
  // Metric tabs
  document.getElementById("metricTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-metric]");
    if (!btn) return;
    setMetric(btn.dataset.metric);
  });

  // Search
  const search = document.getElementById("search");
  search.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const q = search.value.trim().toLowerCase();
    if (!q) return;
    const c = state.data.countries.find(
      (x) =>
        x.name.toLowerCase() === q ||
        x.name.toLowerCase().startsWith(q) ||
        x.iso_a3.toLowerCase() === q
    );
    if (c) selectCountry(c.iso_a3, { fly: true, openModal: true });
  });

  // Spin toggle
  const spin = document.getElementById("spinToggle");
  spin.addEventListener("click", () => {
    state.spin = !state.spin;
    state.globe.controls().autoRotate = state.spin;
    spin.classList.toggle("active", state.spin);
    spin.textContent = state.spin ? "⟳ Spin" : "■ Stopped";
  });
  spin.classList.add("active");

  // Modal close handlers
  const modal = document.getElementById("countryModal");
  const closeModal = () => {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    state.selectedIso = null;
    refreshGlobeColors();
    document.querySelectorAll("#leaderboard li").forEach((li) =>
      li.classList.remove("selected")
    );
  };
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    // Esc: close modal
    if (e.key === "Escape" && !modal.hidden) {
      closeModal();
      return;
    }
    // Ignore shortcuts while typing in search
    const tag = (e.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    // 1-6: switch metric tabs
    const tabKeys = { 1: "score", 2: "enterprise", 3: "consumer", 4: "government", 5: "talent", 6: "investment" };
    if (tabKeys[e.key]) {
      setMetric(tabKeys[e.key]);
      return;
    }
    // /: focus search
    if (e.key === "/") {
      e.preventDefault();
      document.getElementById("search").focus();
      return;
    }
    // s: toggle spin
    if (e.key === "s" || e.key === "S") {
      document.getElementById("spinToggle").click();
    }
  });

  // "Fly to" inside modal — re-fly to currently selected country
  document.getElementById("modalFly").addEventListener("click", () => {
    if (!state.selectedIso) return;
    const feat = state.features.find((f) => getFeatureIso3(f) === state.selectedIso);
    if (!feat) return;
    const [lng, lat] = featureCentroid(feat);
    state.globe.pointOfView({ lat, lng, altitude: 1.5 }, 1000);
  });
}

function setMetric(m) {
  if (!METRIC_LABELS[m]) return;
  state.metric = m;
  document
    .querySelectorAll("#metricTabs button")
    .forEach((b) => b.classList.toggle("active", b.dataset.metric === m));
  document.getElementById("legendTitle").textContent = METRIC_LABELS[m];
  document.getElementById("leaderMetric").textContent = METRIC_LABELS[m];
  refreshGlobeColors();
  renderLeaderboard();
  if (state.selectedIso) {
    const modal = document.getElementById("countryModal");
    if (!modal.hidden) renderModalBars(state.byIso.get(state.selectedIso));
  }
}

// ------- Selection + modal -------
function selectCountry(iso, { fly = false, openModal = false } = {}) {
  const c = state.byIso.get(iso);
  if (!c) return;
  state.selectedIso = iso;
  refreshGlobeColors();
  highlightLeaderboard(iso);

  if (fly) {
    const feat = state.features.find((f) => getFeatureIso3(f) === iso);
    if (feat) {
      const [lng, lat] = featureCentroid(feat);
      state.globe.pointOfView({ lat, lng, altitude: 1.6 }, 900);
    }
  }
  if (openModal) showCountryModal(c);
}

function showCountryModal(c) {
  const modal = document.getElementById("countryModal");
  document.getElementById("modalName").textContent = c.name;
  document.getElementById("modalIso").textContent = c.iso_a3;
  document.getElementById("modalRank").textContent = `Rank #${c.rank}`;

  const yoyEl = document.getElementById("modalYoy");
  const sign = c.yoy > 0 ? "+" : "";
  yoyEl.textContent = `${sign}${c.yoy} pts YoY`;
  yoyEl.classList.toggle("down", (c.yoy ?? 0) < 0);

  document.getElementById("modalScore").textContent = c.score;
  document.getElementById("scoreDial").style.setProperty("--pct", c.score);

  document.getElementById("modalNote").textContent =
    c.note || `${c.name} scores ${c.score}/100 on the composite AI Adoption Index.`;

  document.getElementById("modalMethod").textContent = state.data.meta.methodology;

  renderStatTiles(c);
  renderSparkline(c);
  renderModalBars(c);
  renderSectors(c);
  renderInitiatives(c);
  renderOrgs(c);
  document.getElementById("modalRegulation").textContent = c.regulation || "—";

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  // Animate score number
  animateNumber(document.getElementById("modalScore"), 0, c.score, 700);
}

function animateNumber(el, from, to, ms) {
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function renderStatTiles(c) {
  const startupsPer = c.ai_startups && c.population_m
    ? (c.ai_startups / c.population_m).toFixed(1)
    : null;
  const tiles = [
    { lab: "Population",   num: fmtPop(c.population_m) },
    { lab: "GDP (nominal)", num: fmtMoney(c.gdp_bn) },
    { lab: "AI companies",  num: fmtNum(c.ai_startups), suf: c.ai_startups ? "est." : "" },
    { lab: "AI cos / 1M people", num: startupsPer ?? "—" },
  ];
  const root = document.getElementById("statTiles");
  root.innerHTML = "";
  for (const t of tiles) {
    const div = document.createElement("div");
    div.className = "stat-tile";
    div.innerHTML = `<div class="tile-num">${t.num}${t.suf ? `<i>${t.suf}</i>` : ""}</div><div class="tile-lab">${t.lab}</div>`;
    root.appendChild(div);
  }
}

function renderSparkline(c) {
  const svg = document.getElementById("sparkline");
  const W = 600, H = 120, pad = { l: 28, r: 36, t: 14, b: 18 };
  const trend = c.trend || [];
  const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const vmin = 0, vmax = 100;
  const x = (i) => pad.l + (i / (trend.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - vmin) / (vmax - vmin)) * (H - pad.t - pad.b);

  const pts = trend.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const linePath = "M" + pts.join(" L ");
  const areaPath = `M ${x(0)},${y(0)} L ` + pts.join(" L ") + ` L ${x(trend.length-1)},${y(0)} Z`;

  const gridLines = [25, 50, 75]
    .map((g) => `<line class="grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${y(g).toFixed(1)}" y2="${y(g).toFixed(1)}"/>`)
    .join("");

  const dots = trend.map((v, i) => {
    const cls = i === 0 ? "dot first" : (i === trend.length - 1 ? "dot" : "dot mid");
    const r = i === 0 || i === trend.length - 1 ? 4.5 : 2.8;
    return `<circle class="${cls}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${r}"/>`;
  }).join("");

  const startLabel = `<text class="label muted" x="${(x(0) - 6).toFixed(1)}" y="${(y(trend[0]) + 4).toFixed(1)}" text-anchor="end">${trend[0]}</text>`;
  const endLabel = `<text class="label" x="${(x(trend.length-1) + 8).toFixed(1)}" y="${(y(trend.at(-1)) + 4).toFixed(1)}">${trend.at(-1)}</text>`;

  svg.innerHTML = `
    <defs>
      <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#c084fc" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#c084fc" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <path class="area" d="${areaPath}"/>
    <path class="line" d="${linePath}"/>
    ${dots}
    ${startLabel}${endLabel}
  `;

  const axis = document.getElementById("sparkAxis");
  axis.innerHTML = years.map((y) => `<span>${y}</span>`).join("");
}

function renderSectors(c) {
  const root = document.getElementById("modalSectors");
  root.innerHTML = "";
  for (const s of c.top_sectors || []) {
    const span = document.createElement("span");
    span.className = "pill";
    span.textContent = s;
    root.appendChild(span);
  }
}

function renderInitiatives(c) {
  const root = document.getElementById("modalInitiatives");
  root.innerHTML = "";
  for (const t of c.flagship_initiatives || []) {
    const li = document.createElement("li");
    li.textContent = t;
    root.appendChild(li);
  }
}

function renderOrgs(c) {
  const root = document.getElementById("modalOrgs");
  root.innerHTML = "";
  for (const o of c.notable_orgs || []) {
    const span = document.createElement("span");
    span.className = "pill org";
    span.textContent = o;
    root.appendChild(span);
  }
}

function renderTopMovers() {
  const root = document.getElementById("topMovers");
  if (!root) return;
  root.innerHTML = "";
  const top = [...state.data.countries]
    .sort((a, b) => (b.yoy ?? 0) - (a.yoy ?? 0))
    .slice(0, 6);
  for (const c of top) {
    const li = document.createElement("li");
    li.dataset.iso = c.iso_a3;
    const cls = (c.yoy ?? 0) >= 0 ? "" : "down";
    const sign = c.yoy > 0 ? "+" : "";
    li.innerHTML = `
      <span class="mv-name">${c.name}</span>
      <span class="mv-rank">#${c.rank}</span>
      <span class="mv-yoy ${cls}">${sign}${c.yoy} pts</span>
    `;
    li.addEventListener("click", () => selectCountry(c.iso_a3, { fly: true, openModal: true }));
    root.appendChild(li);
  }
}

function renderSummaryStats() {
  const cs = state.data.countries;
  const avg = cs.reduce((s, c) => s + c.score, 0) / cs.length;
  const avgYoy = cs.reduce((s, c) => s + (c.yoy ?? 0), 0) / cs.length;
  const top = cs.reduce((a, b) => (a.score > b.score ? a : b));
  const set = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };
  set("globalAvg", avg.toFixed(1));
  set("globalCountries", cs.length);
  set("globalTop", top.iso_a3);
  set("globalYoy", "+" + avgYoy.toFixed(1));
}

function renderModalBars(c) {
  const bars = document.getElementById("modalBars");
  bars.innerHTML = "";
  const subs = [
    ["enterprise", "Enterprise adoption", c.enterprise],
    ["consumer",   "Consumer GenAI use",  c.consumer],
    ["government", "Government readiness", c.government],
    ["talent",     "Talent & skills",     c.talent],
    ["investment", "Investment & infra",  c.investment],
  ];
  for (const [key, label, val] of subs) {
    const row = document.createElement("div");
    row.className = "bar-row" + (state.metric === key ? " active" : "");
    row.innerHTML = `
      <span>${label}</span>
      <span class="bar-track"><span class="bar-fill" style="right:${100 - val}%"></span></span>
      <span class="val">${val}</span>
    `;
    bars.appendChild(row);
  }
}

// ------- Leaderboard -------
function renderLeaderboard() {
  const list = document.getElementById("leaderboard");
  list.innerHTML = "";
  const ranked = [...state.data.countries].sort(
    (a, b) => (b[state.metric] ?? -1) - (a[state.metric] ?? -1)
  );
  ranked.forEach((c, i) => {
    const li = document.createElement("li");
    li.dataset.iso = c.iso_a3;
    if (state.selectedIso === c.iso_a3) li.classList.add("selected");
    const yoyClass = (c.yoy ?? 0) >= 0 ? "" : "down";
    const yoyTxt = c.yoy != null ? `${c.yoy > 0 ? "+" : ""}${c.yoy}` : "";
    li.innerHTML = `
      <span class="pos">${i + 1}</span>
      <span><span class="swatch" style="background:${colorForScore(c[state.metric])}"></span>${c.name}</span>
      <span class="val">${c[state.metric]}</span>
      <span class="yoy ${yoyClass}">${yoyTxt}</span>
    `;
    li.addEventListener("click", () => selectCountry(c.iso_a3, { fly: true, openModal: true }));
    list.appendChild(li);
  });
}

function highlightLeaderboard(iso) {
  document
    .querySelectorAll("#leaderboard li")
    .forEach((li) => li.classList.toggle("selected", li.dataset.iso === iso));
  const sel = document.querySelector(`#leaderboard li[data-iso="${iso}"]`);
  if (sel) sel.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// ------- Geo helpers -------
// Rough centroid of a (Multi)Polygon feature: average of outer-ring vertices.
function featureCentroid(feature) {
  const g = feature.geometry;
  if (!g) return [0, 0];
  let polys;
  if (g.type === "Polygon") polys = [g.coordinates];
  else if (g.type === "MultiPolygon") polys = g.coordinates;
  else return [0, 0];

  let sx = 0, sy = 0, n = 0;
  for (const poly of polys) {
    const ring = poly[0];
    for (const [x, y] of ring) {
      sx += x;
      sy += y;
      n++;
    }
  }
  return n ? [sx / n, sy / n] : [0, 0];
}
