import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "database" in data
    assert "model" in data
    assert "vector_index" in data


def test_index_status_endpoint():
    response = client.get("/api/index/status")
    assert response.status_code == 200
    data = response.json()
    assert "total_files" in data
    assert "indexed_files" in data
    assert "vector_count" in data


def test_folders_list_endpoint():
    response = client.get("/api/index/folders")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_search_history_endpoint():
    response = client.get("/api/history")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


def test_search_endpoint():
    response = client.post("/api/search", json={"query": "test query", "top_k": 5})
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "test query"
    assert "results" in data
    assert "took_ms" in data


def test_settings_endpoint():
    response = client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert "settings" in data
