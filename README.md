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

## Web preview

The root `index.html` and `app.js` provide a small Thai-language planning form. Serve the project root with a local static HTTP server (for example, VS Code Live Server) and run the API separately:

```bash
cd services/api
npm start
```

The browser UI sends requests to `http://localhost:3000/api/plan`. Override this address by setting `window.TRAVEL_API_BASE_URL` before `app.js` loads.

The current `/api/plan` endpoint returns mock data; the web page labels it as a sample and does not claim it is AI-generated or verified. `places_bkk_cnx.json` uses the current place-validator shape (`id`, `name`, `province`, `type`) and starts empty until sourced place records are available.
