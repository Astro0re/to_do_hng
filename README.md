# Daymark To-Do

A calm, responsive task planner with React, Vite, and a FastAPI backend. Tasks, folders, and sticky reminders are stored in a local JSON file so they persist across restarts.

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

The Vite development server proxies `/api` to `http://127.0.0.1:8000`. For a separately hosted frontend, set `VITE_API_BASE_URL` to the backend API base URL, including `/api` (for example, `https://your-api.example.com/api`), and set the backend's `TODO_CORS_ORIGINS` to the frontend's origin. A production reverse proxy can also route `/api` to FastAPI and keep the default frontend setting.

Set `TODO_DATA_FILE` to choose a writable JSON data path. The default is `backend/data.json`; on hosts with ephemeral or read-only filesystems, configure a persistent writable disk and point `TODO_DATA_FILE` to it.
