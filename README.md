# Thai Travel AI

AI Travel Planner สำหรับวางแผนท่องเที่ยวในประเทศไทย โดยเน้น Road Trip

## Project Goal

สร้าง AI ที่เข้าใจภาษาไทย ช่วยวางแผนการเดินทาง และทำงานร่วมกับข้อมูลสถานที่จริงได้

## Team Responsibilities

- Person 1: AI Engineer
- Person 2: Travel Data & Tools Engineer
- Person 3: Backend & Integration Engineer

## AI Engineer Responsibilities

- Design the system prompt
- Connect an AI model through an API
- Design the travel-planning conversation
- Return structured travel-plan data
- Test Thai responses and reduce hallucinations

## Initial Milestone

The AI can accept a travel request in Thai and return a structured sample itinerary.

## Run locally

1. Put `GROQ_API_KEY=...` in `ai-engine/.env` (never commit it), then install both packages:

```bash
cd ai-engine && npm install
cd ../services/api && npm install
```

2. Start the API (port 3000):

```bash
cd services/api
npm start
```

3. Serve the repo root with any static server, then open http://localhost:8080:

```bash
python -m http.server 8080
```

The page calls `http://localhost:3000`. Override it with `window.TRAVEL_API_BASE_URL` before `app.js` loads, or add `?api=http://host:port` to the page URL.

Groq's free tier allows about 8,000 tokens per minute, which is roughly one plan per minute. When the quota is full the API answers 503 and the page asks the user to wait.

## Web pages

Repo root, sharing `styles.css` and `app.js`:

- `index.html` (landing): quick-start box (origin, destination, days) that opens the chat page, ready-made trip templates, auto-scrolling feature cards, a region picker for all 77 provinces and a per-province place explorer.
- `plan.html` (chat page): a large chat window (trip form, AI replies, reply box for follow-up questions) next to a large map. Links can prefill it, e.g. `plan.html?origin=กรุงเทพมหานคร&destination=จันทบุรี&days=2&go=1` (`go=1` sends to the AI right away; other params: `budget`, `travelers`, `tripType`, `interest`).
- The map (Leaflet + OpenStreetMap tiles) draws the plan's stops and the driving route along real roads from `/api/route`, with total distance and driving time. If routing fails, it falls back to a dashed straight line and says so. If Leaflet cannot load, an illustrative SVG diagram is shown instead.

## API (`services/api`)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Status check |
| POST | `/api/plan` | Body: `origin`, `destination` (required), `days`, `budgetTHB`, `interests[]`, `tripType` (`one_way`/`round_trip`), `travelers` (1–50), `message` (follow-up text, ≤1000 chars), `history` (≤20 × `{role: user\|assistant, content}`). Returns `data` = AI response (`reply`, `status`, `trip`, `itinerary`; stops get `lat`/`lon` when known) and `meta` (places sent, provinces, approximate origin/destination points, attribution). |
| GET | `/api/places` | Query: `province` (Thai or English name), `type`, `q`, `limit` (1–200, default 50), `offset`. |
| GET | `/api/places/provinces` | All 77 provinces with counts per type. |
| POST | `/api/route` | Body: `points` (2–25 × `{lat, lon}` in driving order). Returns `distanceKm`, `durationMin`, `legs`, `geometry` (`[lat, lon]` list) and attribution. Uses the public OSRM demo server by default (free, no key, best effort); set `OSRM_URL` to use another OSRM server. 400 bad input, 422 no road route, 502 routing service unavailable. |

Errors are `{ success: false, error }` with 400 (bad input), 404 (unknown province), 502/503 (AI quota or bad AI output) or 500.

Tests: `npm test` in `services/api` (store) and in `ai-engine` (validators).

## Place data

See [`data/places/README.md`](data/places/README.md). Starter data comes from OpenStreetMap (© OpenStreetMap contributors, ODbL) and is marked unverified. Travel Data team files in `data/places/team/` (and the original `places_bkk_cnx.json`) override OSM rows.
