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
const NO_DATA_COLOR = "rgba(120, 130, 170, 0.10)";
const NO_DATA_STROKE = "rgba(140, 170, 255, 0.18)";

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
  refreshGlobeColors();
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
    .polygonAltitude((d) => 0.012 + (getMetric(d) ?? 0) / 100 * 0.16)
    .polygonCapColor((d) => fillFor(d))
    .polygonSideColor(() => "rgba(40, 60, 140, 0.35)")
    .polygonStrokeColor(() => NO_DATA_STROKE)
    .polygonLabel(() => "")
    .onPolygonHover((hover) => {
      el.style.cursor = hover ? "pointer" : "grab";
      if (!hover) {
        tooltip.hidden = true;
        return;
      }
      const name = getFeatureName(hover);
      const iso = getFeatureIso3(hover);
      const c = iso ? state.byIso.get(iso) : null;
      const v = c ? c[state.metric] : null;
      tooltip.innerHTML = c
        ? `<strong>${name}</strong><span class="tval">${v}</span>`
        : `<strong>${name}</strong><span class="tval" style="color:#8a93c8">no data</span>`;
      tooltip.hidden = false;
    })
    .onPolygonClick((feat) => {
      const iso = getFeatureIso3(feat);
      if (iso) selectCountry(iso, { fly: true });
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

function fillFor(feature) {
  const iso = getFeatureIso3(feature);
  const c = iso ? state.byIso.get(iso) : null;
  if (!c) return NO_DATA_COLOR;
  const base = colorForScore(c[state.metric]);
  if (state.selectedIso && state.selectedIso === iso) {
    return base;
  }
  return base;
}

function refreshGlobeColors() {
  if (!state.globe) return;
  state.globe
    .polygonCapColor((d) => fillFor(d))
    .polygonAltitude((d) => 0.012 + (getMetric(d) ?? 0) / 100 * 0.16)
    .polygonStrokeColor((d) => {
      const iso = getFeatureIso3(d);
      if (state.selectedIso && state.selectedIso === iso) return "#ffffff";
      return NO_DATA_STROKE;
    });
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
    if (c) selectCountry(c.iso_a3, { fly: true });
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
  if (state.selectedIso) renderDetail(state.byIso.get(state.selectedIso));
}

// ------- Detail panel -------
function selectCountry(iso, { fly = false } = {}) {
  const c = state.byIso.get(iso);
  if (!c) return;
  state.selectedIso = iso;
  refreshGlobeColors();
  renderDetail(c);
  highlightLeaderboard(iso);

  if (fly) {
    const feat = state.features.find((f) => getFeatureIso3(f) === iso);
    if (feat) {
      const [lng, lat] = featureCentroid(feat);
      state.globe.pointOfView({ lat, lng, altitude: 1.6 }, 900);
    }
  }
}

function renderDetail(c) {
  const card = document.getElementById("detailCard");
  document.getElementById("detailName").textContent = c.name;
  document.getElementById("detailRank").textContent = `#${c.rank} · ${c.iso_a3}`;
  const noteEl = document.getElementById("detailNote");
  noteEl.textContent = c.note || "Composite AI adoption snapshot.";

  const stats = document.getElementById("detailStats");
  stats.hidden = false;
  document.getElementById("sComposite").textContent = c.score;
  const yoyEl = document.getElementById("sYoy");
  const sign = c.yoy > 0 ? "+" : "";
  yoyEl.textContent = `${sign}${c.yoy} pts YoY`;
  yoyEl.style.color = c.yoy >= 0 ? "var(--good)" : "var(--bad)";
  document.getElementById("sEnt").textContent = c.enterprise;
  document.getElementById("sCons").textContent = c.consumer;
  document.getElementById("sGov").textContent = c.government;
  document.getElementById("sTal").textContent = c.talent;
  document.getElementById("sInv").textContent = c.investment;

  // Bars (sub-metric breakdown)
  const bars = document.getElementById("detailBars");
  bars.hidden = false;
  bars.innerHTML = "";
  const subs = [
    ["Enterprise", c.enterprise],
    ["Consumer GenAI", c.consumer],
    ["Government", c.government],
    ["Talent", c.talent],
    ["Investment", c.investment],
  ];
  for (const [label, val] of subs) {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span>${label}</span>
      <span class="bar-track"><span class="bar-fill" style="right:${100 - val}%"></span></span>
      <span class="val">${val}</span>
    `;
    bars.appendChild(row);
  }
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    li.addEventListener("click", () => selectCountry(c.iso_a3, { fly: true }));
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
