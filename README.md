# Daymark To-Do

A simple task planner with a React/Vite frontend and FastAPI backend. Tasks, folders, and sticky reminders are stored in a local SQLite database.

## Run locally

In one terminal:

```bash
cd to_do_hng
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

In another terminal:

```bash
cd to_do_hng
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). The API docs are at `http://127.0.0.1:8000/docs` and its health check is `http://127.0.0.1:8000/api/health`.

The Vite development server proxies `/api` to the local FastAPI backend. Netlify builds use `netlify.toml` to publish the React app and deploy a Netlify Function at `/api/*`, so the deployed app does not need a separate FastAPI URL or CORS setup. Remove any stale `VITE_API_BASE_URL` value from Netlify so requests use the same-origin function.

Local FastAPI development stores data in SQLite using Python's built-in `sqlite3` module. The default database is `backend/data.db`; set `TODO_DATABASE_FILE` to change its path. Existing `backend/data.json` data is imported on first local database creation, and the JSON file is left untouched.

Netlify Functions run in ephemeral environments, so their local filesystem is not used for durable data. The deployed API stores each browser's tasks, folders, and reminders in Netlify Database. The browser keeps a random client ID in local storage; data is scoped to that browser and is not synced across devices. Database migrations are applied automatically during deploys. See [Netlify Functions](https://docs.netlify.com/build/functions/overview/) and [Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/).
