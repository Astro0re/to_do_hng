# Daymark To-Do — Project Guide

## Purpose

Daymark is a learning-focused task planner built as part of an AI engineering internship/bootcamp. It helps a user organize unfinished tasks, classify them into folders, track due dates and priorities, mark work complete, and write sticky-note reminders. Keep the interface simple and focused on these core workflows.

## Product specifications

- The main task view is **To do** and shows all unfinished tasks, whether or not they have a due date.
- **Completed** shows finished tasks. Do not add separate **Today** or **Upcoming** views unless the user requests them.
- Users can create and delete tasks, set an optional due date and low/medium/high priority, and mark tasks complete or incomplete.
- Users can create folders, assign tasks to folders, filter the task list by folder, and delete folders. Deleting a folder must leave its tasks in place and unassigned.
- Users can create dated or undated sticky-note reminders and delete them.
- Show useful loading, empty, success, and error states. Keep the UI responsive on mobile and desktop and use accessible labels for controls.

## Current architecture

- `src/`: React frontend built and served with Vite.
- `backend/main.py`: local FastAPI API with request validation and SQLite persistence. SQLite uses Python's built-in `sqlite3`; the default database is `backend/data.db`.
- `backend/tests/`: local API and SQLite persistence tests.
- `netlify/functions/api.mjs`: production same-origin API function for `/api/*`; deployed data is stored in Netlify Blobs.
- `tests/api.test.mjs`: tests for the Netlify function; keep test files outside `netlify/functions` so Netlify does not treat them as deployable endpoints.
- The frontend sends a browser-generated `X-User-ID`; production data is scoped to that browser. This is not account authentication or cross-device sync.
- `netlify.toml`: Netlify build and function configuration. Do not configure `VITE_API_BASE_URL` to a nonexistent or stale API host.

Keep this description synchronized with the implementation when the architecture changes. Do not describe a proposed framework or database as implemented until the code and deployment configuration have actually been changed and tested.

## Cost and resource constraints

- Prefer the existing React/Vite, FastAPI, SQLite, Netlify Functions, and Netlify Blobs stack unless a change has a clear benefit and the user approves it.
- Optimize for a working, low-maintenance project with no unnecessary recurring costs. Prefer static hosting, local development tools, and services already configured for the project.
- Do not add paid APIs, subscriptions, hosted databases, always-on servers, or usage-billed services without explaining the likely cost and getting the user's approval first. Check current provider pricing and quotas before recommending a deployment change that could incur charges.
- Avoid introducing extra dependencies, infrastructure, background jobs, polling, or compute-heavy processing when a simpler implementation meets the need. Prefer existing dependencies and standard-library features where practical.
- Keep local SQLite as the zero-hosting-cost development store. Do not assume a serverless function's local filesystem is durable; use the configured persistent store for production.
- Never commit secrets, credentials, private database URLs, or personal task data. Keep configuration in environment variables and document required variables without including their values.
- Before suggesting scale-related services or cross-device accounts, explain the trade-offs and wait for approval if they add cost, operational work, or user-data risk.

## Working and teaching approach

- Treat this as both a software project and a learning project. Make focused changes, explain the major checkpoints in beginner-friendly language, and define unfamiliar terms briefly.
- When useful, offer the user a small, optional contribution task with clear steps and explain what they will learn. Do not make their participation a blocker.
- Recommend a different technology only when it solves a concrete problem. Explain why it fits, what it replaces, and the cost, complexity, and learning trade-offs before making a major stack change.
- Preserve existing behavior unless the request calls for a change. Avoid unrelated refactors and do not push or commit unless asked.
- Validate changes with the narrowest relevant tests first, then run the frontend build when appropriate. Report what passed and any checks that could not be run.

## Run and validate

1. Install local API dependencies: `python -m pip install -r requirements.txt`.
2. Run SQLite API tests: `python -m pytest backend/tests -q`.
3. Start the local API: `uvicorn backend.main:app --reload`.
4. Confirm `GET /api/health` returns `200` and `{"status":"ok"}`; local API docs are available at `/docs`.
5. Install frontend dependencies: `npm install`; start the UI with `npm run dev`.
6. Run the frontend production build: `npm run build`.
7. Run Netlify API tests: `npm run test:functions`.
8. Check task/folder/reminder flows, API errors, and responsive layouts when the change affects the UI.

Vite proxies local `/api` requests to FastAPI. On Netlify, the same-origin function handles `/api/*` and uses Netlify Blobs for persistence. Netlify must redeploy after changes are pushed; a successful local test alone does not verify production deployment.

## Improvement ideas

- Add frontend tests for task, folder, and reminder flows and basic keyboard accessibility.
- Add task editing and accessible focus management for dialogs.
- Add authentication and cross-device synchronization only when needed, with a clear privacy and cost plan.
- Add CI to run backend tests, function tests, and the frontend build.
- Pin dependency versions deliberately and review updates before production releases.
