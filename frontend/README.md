# ReconFlow Dashboard

React + TypeScript + Vite + Tailwind CSS v4 frontend for the ReconFlow FastAPI backend.

## Run

```bash
npm install
cp .env.example .env     # optional: set VITE_API_URL
npm run dev              # http://localhost:5173
```

Start the API separately: `uvicorn main:app --reload --port 8000`.
If the API is unreachable on load, the app switches to Demo mode automatically.

## Backend routes used (src/api/live.ts)

| Action | Route |
|---|---|
| Health | `GET /` |
| Save iCal | `POST /api/calendar/config/` |
| Audit invoice | `POST /audit-invoice/` |
| List folders | `GET /api/folders/` |
| Report detail | `GET /api/reports/{stem}_report.json` |

## Production build

`npm run build` outputs `dist/`. To serve it from FastAPI:
`app.mount("/app", StaticFiles(directory="dist", html=True), name="app")` (set `base: '/app/'` in vite.config.ts).
