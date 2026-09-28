from __future__ import annotations

import json
import os
import sqlite3
from datetime import date, datetime, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


DATABASE_FILE = Path(os.getenv("TODO_DATABASE_FILE", Path(__file__).with_name("data.db")))
LEGACY_DATA_FILE = Path(__file__).with_name("data.json")
database_lock = Lock()
data_lock = Lock()


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def open_database() -> sqlite3.Connection:
    with database_lock:
        database_existed = DATABASE_FILE.exists()
        try:
            DATABASE_FILE.parent.mkdir(parents=True, exist_ok=True)
            connection = sqlite3.connect(DATABASE_FILE, timeout=30)
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys = ON")
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS folders (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    color TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
                    due_date TEXT,
                    priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')),
                    completed INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL DEFAULT '',
                    content TEXT NOT NULL,
                    color TEXT NOT NULL,
                    reminder_date TEXT,
                    created_at TEXT NOT NULL
                );
                """
            )
            if not database_existed and LEGACY_DATA_FILE.exists():
                migrate_legacy_data(connection)
            connection.commit()
            return connection
        except (OSError, sqlite3.Error, json.JSONDecodeError) as error:
            if "connection" in locals():
                connection.close()
            raise HTTPException(
                status_code=500,
                detail="Could not open SQLite storage. Check that TODO_DATABASE_FILE is writable.",
            ) from error


def migrate_legacy_data(connection: sqlite3.Connection) -> None:
    payload = json.loads(LEGACY_DATA_FILE.read_text(encoding="utf-8"))
    for folder in payload.get("folders", []):
        connection.execute(
            "INSERT OR IGNORE INTO folders (id, name, color, created_at) VALUES (?, ?, ?, ?)",
            (folder["id"], folder["name"], folder.get("color", "#879c85"), folder.get("created_at", timestamp())),
        )
    for task in payload.get("tasks", []):
        connection.execute(
            """INSERT OR IGNORE INTO tasks
            (id, title, folder_id, due_date, priority, completed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                task["id"], task["title"], task.get("folder_id"), task.get("due_date"),
                task.get("priority", "medium"), int(task.get("completed", False)), task.get("created_at", timestamp()),
            ),
        )
    for note in payload.get("notes", []):
        connection.execute(
            """INSERT OR IGNORE INTO notes
            (id, title, content, color, reminder_date, created_at) VALUES (?, ?, ?, ?, ?, ?)""",
            (
                note["id"], note.get("title", ""), note["content"], note.get("color", "sunflower"),
                note.get("reminder_date"), note.get("created_at", timestamp()),
            ),
        )


def read_data() -> dict:
    with data_lock:
        connection = open_database()
        try:
            data = {
                table: [dict(row) for row in connection.execute(f"SELECT * FROM {table}").fetchall()]
                for table in ("tasks", "folders", "notes")
            }
            for task in data["tasks"]:
                task["completed"] = bool(task["completed"])
            return data
        except sqlite3.Error as error:
            raise HTTPException(status_code=500, detail="Could not read SQLite storage") from error
        finally:
            connection.close()


def write_data(data: dict) -> None:
    with data_lock:
        connection = open_database()
        try:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("DELETE FROM tasks")
            connection.execute("DELETE FROM notes")
            connection.execute("DELETE FROM folders")
            connection.executemany(
                "INSERT INTO folders (id, name, color, created_at) VALUES (?, ?, ?, ?)",
                [(item["id"], item["name"], item["color"], item["created_at"]) for item in data["folders"]],
            )
            connection.executemany(
                """INSERT INTO tasks
                (id, title, folder_id, due_date, priority, completed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                [
                    (item["id"], item["title"], item["folder_id"], item["due_date"], item["priority"],
                     int(item["completed"]), item["created_at"])
                    for item in data["tasks"]
                ],
            )
            connection.executemany(
                """INSERT INTO notes
                (id, title, content, color, reminder_date, created_at) VALUES (?, ?, ?, ?, ?, ?)""",
                [
                    (item["id"], item["title"], item["content"], item["color"], item["reminder_date"], item["created_at"])
                    for item in data["notes"]
                ],
            )
            connection.commit()
        except (OSError, sqlite3.Error) as error:
            connection.rollback()
            raise HTTPException(
                status_code=500,
                detail="Could not save task data to SQLite. Check that TODO_DATABASE_FILE is writable.",
            ) from error
        finally:
            connection.close()


class InputModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class FolderCreate(InputModel):
    name: str = Field(min_length=1, max_length=40)
    color: str = Field(default="#879c85", pattern=r"^#[0-9a-fA-F]{6}$")


class TaskCreate(InputModel):
    title: str = Field(min_length=1, max_length=160)
    folder_id: str | None = None
    due_date: date | None = None
    priority: str = Field(default="medium", pattern="^(low|medium|high)$")


class TaskUpdate(InputModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    folder_id: str | None = None
    due_date: date | None = None
    priority: str | None = Field(default=None, pattern="^(low|medium|high)$")
    completed: bool | None = None


class NoteCreate(InputModel):
    title: str = Field(default="", max_length=80)
    content: str = Field(min_length=1, max_length=1000)
    color: str = Field(default="sunflower", pattern="^(sunflower|sky|rose|sage)$")
    reminder_date: date | None = None


class NoteUpdate(InputModel):
    title: str | None = Field(default=None, max_length=80)
    content: str | None = Field(default=None, min_length=1, max_length=1000)
    color: str | None = Field(default=None, pattern="^(sunflower|sky|rose|sage)$")
    reminder_date: date | None = None


app = FastAPI(title="Daymark To-Do API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip().rstrip("/")
        for origin in os.getenv(
            "TODO_CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,https://todoapphng.netlify.app",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-User-ID"],
)


def ensure_folder(data: dict, folder_id: str | None) -> None:
    if folder_id and not any(folder["id"] == folder_id for folder in data["folders"]):
        raise HTTPException(status_code=404, detail="Folder not found")


def find_record(records: list[dict], record_id: str, label: str) -> dict:
    record = next((item for item in records if item["id"] == record_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return record


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/folders")
def list_folders() -> list[dict]:
    return read_data()["folders"]


@app.post("/api/folders", status_code=201)
def create_folder(payload: FolderCreate) -> dict:
    data = read_data()
    if any(folder["name"].casefold() == payload.name.casefold() for folder in data["folders"]):
        raise HTTPException(status_code=409, detail="A folder with this name already exists")
    folder = {"id": str(uuid4()), **payload.model_dump(), "created_at": timestamp()}
    data["folders"].append(folder)
    write_data(data)
    return folder


@app.patch("/api/folders/{folder_id}")
def rename_folder(folder_id: str, payload: FolderCreate) -> dict:
    data = read_data()
    folder = find_record(data["folders"], folder_id, "Folder")
    if any(item["id"] != folder_id and item["name"].casefold() == payload.name.casefold() for item in data["folders"]):
        raise HTTPException(status_code=409, detail="A folder with this name already exists")
    folder.update(payload.model_dump())
    write_data(data)
    return folder


@app.delete("/api/folders/{folder_id}", status_code=204)
def delete_folder(folder_id: str) -> Response:
    data = read_data()
    find_record(data["folders"], folder_id, "Folder")
    data["folders"] = [folder for folder in data["folders"] if folder["id"] != folder_id]
    for task in data["tasks"]:
        if task["folder_id"] == folder_id:
            task["folder_id"] = None
    write_data(data)
    return Response(status_code=204)


@app.get("/api/tasks")
def list_tasks(folder_id: str | None = Query(default=None)) -> list[dict]:
    tasks = read_data()["tasks"]
    return tasks if folder_id is None else [task for task in tasks if task["folder_id"] == folder_id]


@app.post("/api/tasks", status_code=201)
def create_task(payload: TaskCreate) -> dict:
    data = read_data()
    ensure_folder(data, payload.folder_id)
    task = {"id": str(uuid4()), **payload.model_dump(mode="json"), "completed": False, "created_at": timestamp()}
    data["tasks"].append(task)
    write_data(data)
    return task


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: str, payload: TaskUpdate) -> dict:
    data = read_data()
    task = find_record(data["tasks"], task_id, "Task")
    changes = payload.model_dump(exclude_unset=True, mode="json")
    if "folder_id" in changes:
        ensure_folder(data, changes["folder_id"])
    task.update(changes)
    write_data(data)
    return task


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: str) -> Response:
    data = read_data()
    find_record(data["tasks"], task_id, "Task")
    data["tasks"] = [task for task in data["tasks"] if task["id"] != task_id]
    write_data(data)
    return Response(status_code=204)


@app.get("/api/notes")
def list_notes() -> list[dict]:
    return read_data()["notes"]


@app.post("/api/notes", status_code=201)
def create_note(payload: NoteCreate) -> dict:
    data = read_data()
    note = {"id": str(uuid4()), **payload.model_dump(mode="json"), "created_at": timestamp()}
    data["notes"].insert(0, note)
    write_data(data)
    return note


@app.patch("/api/notes/{note_id}")
def update_note(note_id: str, payload: NoteUpdate) -> dict:
    data = read_data()
    note = find_record(data["notes"], note_id, "Note")
    note.update(payload.model_dump(exclude_unset=True, mode="json"))
    write_data(data)
    return note


@app.delete("/api/notes/{note_id}", status_code=204)
def delete_note(note_id: str) -> Response:
    data = read_data()
    find_record(data["notes"], note_id, "Note")
    data["notes"] = [note for note in data["notes"] if note["id"] != note_id]
    write_data(data)
    return Response(status_code=204)
