# Daymark To-Do

A calm, responsive task planner with React, Vite, and a FastAPI backend. Tasks, folders, and sticky reminders are stored in a local JSON file so they persist across restarts.

## Run locally

In one terminal:

```bash
cd To_Do_Proj
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

In another terminal:

```bash
cd To_Do_Proj
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). The API docs are at `http://127.0.0.1:8000/docs` and its health check is `http://127.0.0.1:8000/api/health`.

Set `TODO_DATA_FILE` to choose another JSON data path, or `TODO_CORS_ORIGINS` to configure comma-separated frontend origins.
