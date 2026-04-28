# Global AI Adoption — 3D Interactive Globe

An interactive 3D globe visualizing country-level AI adoption as of **28 April 2026**.
Inspired by the [crypticsy AI adoption dashboard](https://crypticsy.github.io/ai-adoption-dashboard/),
rebuilt as a real WebGL globe with a richer breakdown and more current estimates.

## Features

- **3D globe** with country polygons extruded by adoption (powered by [globe.gl](https://globe.gl) / Three.js)
- **6 metrics** to color the world by:
  - Composite AI Adoption Index (default)
  - Enterprise adoption
  - Consumer GenAI usage
  - Government readiness
  - Talent & skills
  - Investment & infrastructure
- **Hover tooltips**, **click-to-focus**, search box, country leaderboard
- **Auto-rotate** toggle, smooth camera fly-to on selection
- **Sources & methodology** panel — every claim is traceable
- Pure static site — no build step, deploys anywhere

## Run locally

The page fetches `data/ai-adoption.json` and a remote GeoJSON, so it must be
served over HTTP (not opened as `file://`).

```bash
# any one of these works
python3 -m http.server 8000
# or
npx --yes serve .
```

Then open <http://localhost:8000>.

## Project layout

```
.
├── index.html            # markup, panels, CDN script tags
├── styles.css            # dark dashboard theme
├── app.js                # globe.gl wiring, interactions
├── data/
│   └── ai-adoption.json  # country dataset + sources + methodology
└── README.md
```

## Data & methodology

The composite **AI Adoption Index** is a 0–100 score blending five sub-indices:

| Sub-index             | Weight | Drawn from |
|-----------------------|-------:|------------|
| Enterprise adoption   | 30%    | McKinsey *State of AI 2024*, IBM *Global AI Adoption Index 2024* |
| Consumer GenAI usage  | 20%    | Stanford / Ipsos *Global GenAI Usage Survey 2024–2025* |
| Government readiness  | 20%    | Oxford Insights *Government AI Readiness Index 2024*, IMF *AIPI* |
| Talent & skills       | 15%    | Tortoise *Global AI Index 2024*, OECD.AI |
| Investment & infra    | 15%    | Stanford HAI *AI Index 2025*, OECD.AI |

Sub-scores are normalised 0–100 from the latest published values and linearly
extrapolated through Q1 2026 using the 2023 → 2024 deltas reported in each
source. **Treat the numbers as directional.** They are not a primary survey.

To swap in your own data, edit [`data/ai-adoption.json`](./data/ai-adoption.json)
— the schema is:

```jsonc
{
  "meta": { "title": "...", "as_of": "YYYY-MM-DD", "sources": [...], "methodology": "..." },
  "countries": [
    {
      "iso_a3": "USA",
      "name": "United States",
      "score": 88,        // composite 0-100
      "enterprise": 82,
      "consumer": 71,
      "government": 85,
      "talent": 96,
      "investment": 99,
      "rank": 1,
      "yoy": 6,           // index points change YoY
      "note": "Optional human-readable note"
    }
  ]
}
```

## Tech

- [globe.gl 2.x](https://github.com/vasturiano/globe.gl) on top of Three.js (UMD via jsDelivr)
- Natural Earth 110m country boundaries (GeoJSON)
- No framework, no bundler — just three static files.

## Caveats

- "AI adoption" is not a single, agreed-upon metric. Different studies
  measure different things (any-AI use, GenAI use, deployed in production,
  organisations vs individuals). The composite here is one reasonable blend,
  not the truth.
- Country boundaries follow Natural Earth definitions; this carries no
  political endorsement.
- Real-time data sources for AI adoption do not exist yet. As of April 2026
  the freshest broad surveys are from late 2025; this index extrapolates
  forward and should be refreshed when newer surveys land.
