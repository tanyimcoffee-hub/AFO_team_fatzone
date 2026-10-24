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

## Web page

`index.html`, `styles.css` and `app.js` at the repo root:

- Chat planner first: trip form, AI replies as chat bubbles, and a reply box to answer the AI's follow-up questions.
- Route map (Leaflet + OpenStreetMap tiles) with the plan's stops in order. The dashed line joins stops in plan order; it is not a road route. If Leaflet cannot load, an illustrative SVG diagram is shown instead.
- Ready-made trip templates, a region picker for all 77 provinces, and a per-province place explorer (restaurants, cafes, hotels, fuel stations, attractions, rest stops).

## API (`services/api`)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Status check |
| POST | `/api/plan` | Body: `origin`, `destination` (required), `days`, `budgetTHB`, `interests[]`, `tripType` (`one_way`/`round_trip`), `travelers` (1–50), `message` (follow-up text, ≤1000 chars), `history` (≤20 × `{role: user\|assistant, content}`). Returns `data` = AI response (`reply`, `status`, `trip`, `itinerary`; stops get `lat`/`lon` when known) and `meta` (places sent, provinces, approximate origin/destination points, attribution). |
| GET | `/api/places` | Query: `province` (Thai or English name), `type`, `q`, `limit` (1–200, default 50), `offset`. |
| GET | `/api/places/provinces` | All 77 provinces with counts per type. |

Errors are `{ success: false, error }` with 400 (bad input), 404 (unknown province), 502/503 (AI quota or bad AI output) or 500.

Tests: `npm test` in `services/api` (store) and in `ai-engine` (validators).

## Place data

See [`data/places/README.md`](data/places/README.md). Starter data comes from OpenStreetMap (© OpenStreetMap contributors, ODbL) and is marked unverified. Travel Data team files in `data/places/team/` (and the original `places_bkk_cnx.json`) override OSM rows.
