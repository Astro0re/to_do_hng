import pytest
from fastapi.testclient import TestClient

from backend import main


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATABASE_FILE", tmp_path / "data.db")
    monkeypatch.setattr(main, "LEGACY_DATA_FILE", tmp_path / "legacy.json")
    with TestClient(main.app) as test_client:
        yield test_client


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_deployed_frontend_origin_is_allowed(client):
    response = client.options(
        "/api/tasks",
        headers={
            "Origin": "https://todoapphng.netlify.app",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://todoapphng.netlify.app"


def test_folder_crud_and_duplicate_validation(client):
    created = client.post("/api/folders", json={"name": "Work", "color": "#879c85"})
    assert created.status_code == 201
    folder_id = created.json()["id"]
    assert client.get("/api/folders").json()[0]["name"] == "Work"
    assert client.post("/api/folders", json={"name": "work"}).status_code == 409
    renamed = client.patch(f"/api/folders/{folder_id}", json={"name": "Projects", "color": "#8d9ebc"})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Projects"
    assert client.delete(f"/api/folders/{folder_id}").status_code == 204
    assert client.get("/api/folders").json() == []


def test_task_crud_filter_and_folder_cleanup(client):
    folder = client.post("/api/folders", json={"name": "Work"}).json()
    task = client.post("/api/tasks", json={
        "title": "Send update", "folder_id": folder["id"], "due_date": "2026-09-28", "priority": "high"
    })
    assert task.status_code == 201
    task_id = task.json()["id"]
    assert client.get(f"/api/tasks?folder_id={folder['id']}").json()[0]["title"] == "Send update"
    assert client.patch(f"/api/tasks/{task_id}", json={"completed": True}).json()["completed"] is True
    assert client.patch(f"/api/tasks/{task_id}", json={"folder_id": "missing"}).status_code == 404
    assert client.delete(f"/api/folders/{folder['id']}").status_code == 204
    assert client.get("/api/tasks").json()[0]["folder_id"] is None
    assert client.delete(f"/api/tasks/{task_id}").status_code == 204
    assert client.get("/api/tasks").json() == []


def test_task_validation_and_missing_ids(client):
    assert client.post("/api/tasks", json={"title": " "}).status_code == 422
    assert client.post("/api/tasks", json={"title": "Task", "priority": "urgent"}).status_code == 422
    assert client.patch("/api/tasks/missing", json={"completed": True}).status_code == 404
    assert client.delete("/api/tasks/missing").status_code == 404


def test_note_crud_and_data_persistence(client):
    note = client.post("/api/notes", json={
        "title": "Remember", "content": "Water the plants", "color": "sage", "reminder_date": "2026-09-29"
    })
    assert note.status_code == 201
    note_id = note.json()["id"]
    assert client.get("/api/notes").json()[0]["content"] == "Water the plants"
    updated = client.patch(f"/api/notes/{note_id}", json={"content": "Water all the plants"})
    assert updated.json()["content"] == "Water all the plants"
    assert client.get("/api/notes").json()[0]["content"] == "Water all the plants"
    assert client.delete(f"/api/notes/{note_id}").status_code == 204
    assert client.get("/api/notes").json() == []
    assert client.patch(f"/api/notes/{note_id}", json={"content": "Missing"}).status_code == 404


def test_note_and_folder_payload_validation(client):
    assert client.post("/api/notes", json={"content": "Note", "color": "purple"}).status_code == 422
    assert client.post("/api/notes", json={"content": ""}).status_code == 422
    assert client.post("/api/folders", json={"name": "Bad color", "color": "red"}).status_code == 422


def test_migrates_existing_json_data(client, tmp_path, monkeypatch):
    monkeypatch.setattr(main, "LEGACY_DATA_FILE", tmp_path / "legacy.json")
    main.LEGACY_DATA_FILE.write_text(
        '{"folders": [], "tasks": [{"id": "old-task", "title": "Imported task"}], "notes": []}',
        encoding="utf-8",
    )

    response = client.get("/api/tasks")

    assert response.status_code == 200
    assert response.json()[0]["id"] == "old-task"
    assert response.json()[0]["title"] == "Imported task"
