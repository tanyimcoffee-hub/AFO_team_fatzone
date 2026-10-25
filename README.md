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

When the page is opened from `localhost`, `127.0.0.1` or a file, it calls the API at `http://localhost:3000`. On any other host (for example a Vercel URL) it calls `/api` on the same domain.

Groq's free tier allows about 8,000 tokens per minute, which is roughly one plan per minute. When the quota is full the API answers 503 and the page asks the user to wait.

## Deploy to Vercel

The repo deploys as one Vercel project: the root HTML/CSS/JS are served as static files, and every `/api/*` request goes to one serverless function (`api/index.js`) that runs the same Express app as `services/api` (`services/api/app.js`).

Files involved:

- `package.json` (repo root): dependencies the function needs (`express`, `cors`, `dotenv`, `groq-sdk`).
- `api/index.js`: exports the Express app as the function.
- `vercel.json`: sends `/api/*` to the function, bundles `data/places/**`, `places_bkk_cnx.json` and `ai-engine/system-prompt.md` with it, and allows up to 60 s per request.

Steps:

1. Push the branch you want to deploy to GitHub.
2. In Vercel, choose **Add New → Project** and import `tanyimcoffee-hub/AFO_team_fatzone`.
3. Keep **Framework Preset: Other** and the **Root Directory** as the repo root. Leave the build command and output directory empty.
4. Under **Environment Variables**, add `GROQ_API_KEY` with your Groq key. Optional: `OSRM_URL` to use your own routing server.
5. Click **Deploy**. To deploy a branch other than `main`, either set it as the Production Branch in **Settings → Git**, or open the branch's Preview deployment.
6. Check `https://<your-project>.vercel.app/api/health`, then open the site and create a plan.

Notes:

- Never put `GROQ_API_KEY` in the code. If it is missing, `/api/plan` answers 503 with a clear message.
- Each new function instance loads about 11.5 MB of place data first, so the first request after a quiet period is slower.
- Vercel's Hobby plan caps a function at 60 seconds. AI or routing calls that take longer fail and the page shows a retry button.
- The public OSRM demo server is free but best effort. For heavy use, run your own OSRM server and set `OSRM_URL`.

To test the same setup locally, install the Vercel CLI and run `vercel dev` from the repo root (it needs `GROQ_API_KEY` in a root `.env`, which is git-ignored).

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
