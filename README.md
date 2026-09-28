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

The Vite development server proxies `/api` to `http://127.0.0.1:8000`. For a separately hosted frontend, set `VITE_API_BASE_URL` at frontend build time to the full backend API base URL, including `/api` (for example, `https://your-api.example.com/api`). Set backend `TODO_CORS_ORIGINS` to the exact frontend origin (for example, `https://your-site.example`, with no trailing slash). The backend must be deployed and reachable; static hosting alone cannot run FastAPI. A same-origin reverse proxy can route `/api` to FastAPI and keep the default frontend setting.

SQLite uses Python's built-in `sqlite3` module; no database server or ORM is needed. The default database is `backend/data.db`. Set `TODO_DATABASE_FILE` to another writable path, preferably on a persistent disk when deployed. If `backend/data.json` exists on the first start, its tasks, folders, and notes are imported into SQLite automatically; the JSON file is left untouched.
