# Agent guide

## Project map

- `src/`: React and Vite user interface.
- `backend/main.py`: FastAPI routes, request validation, SQLite access, and one-time legacy JSON migration.
- `backend/data.db`: local runtime database, created automatically on the first request that reads or writes data.
- `backend/tests/test_api.py`: endpoint and persistence checks.
- `netlify/functions/api.mjs`: deployed same-origin API backed by Netlify Blobs.
- `netlify/functions/api.test.mjs`: Netlify function route and CRUD tests.

## Run and validate

1. Install backend dependencies with `python -m pip install -r requirements.txt`.
2. Run the local SQLite API suite from this directory with `python -m pytest backend/tests -q`.
3. Start the API using `uvicorn backend.main:app --reload`.
4. Check `GET /api/health` returns `200` and `{"status":"ok"}`; inspect `/docs` for the OpenAPI schema.
5. Install frontend dependencies with `npm install`, then start Vite with `npm run dev`.
6. Run `npm run build` to catch frontend compilation errors.
7. Run `npm run test:functions` to validate Netlify API routes with an in-memory Blob store.
8. Manually check the UI at desktop and mobile widths: navigation, search, filters, folder assignment, completion, due dates, priorities, reminders, and API error recovery.

For Netlify, use the provided `netlify.toml`; the Netlify Function handles `/api/*` and stores data in Netlify Blobs. Do not set `VITE_API_BASE_URL` to an old or missing external service.

The API tests use a temporary JSON data file. They cover health, folder/task/note CRUD, task filtering and completion, payload validation, missing records, duplicate folders, folder deletion unassigning tasks, and data persistence across requests.

## Good next improvements

- Add a frontend test runner for the task and note forms, keyboard navigation, and core list flows.
- Add keyboard shortcuts, task editing, and accessible focus handling for dialogs.
- Add account authentication and cross-device synchronization before supporting multiple users.
- Add authentication and per-user authorization before exposing the API beyond localhost.
- Add CI to run backend tests and `npm run build` on each change.
- Review and pin dependency versions deliberately before production deployment.
