import json
import secrets
from pathlib import Path

import bcrypt
import pytest
from fastapi.testclient import TestClient
from main import create_app

from app.config import Settings
from app.models.contracts import ModelQuery
from db.build_seed_db import build_database

ROOT = Path(__file__).resolve().parents[1]


class FakeNL2SQLClient:
    """Test-only stub, never imported by runtime."""

    def __init__(self, sql):
        self.sql, self.calls = sql, []

    def generate(self, question, system_prompt):
        self.calls.append((question, system_prompt))
        return ModelQuery(sql=self.sql, description="Prueba sin inferencia real")


@pytest.fixture(scope="session")
def fixtures():
    return json.loads((ROOT / "tests/fixtures/expected_results.json").read_text())


@pytest.fixture(scope="session")
def database(tmp_path_factory):
    path = tmp_path_factory.mktemp("db") / "eisa.db"
    build_database(path)
    return path


@pytest.fixture(scope="session")
def credentials():
    password = secrets.token_urlsafe(24)
    return password, bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=4)).decode()


@pytest.fixture
def settings(database, credentials):
    return Settings(
        database_path=database,
        static_path=ROOT / "web/dist",
        public_origin="https://testserver",
        demo_username="thesis-test",
        demo_password_hash=credentials[1],
        session_secret=secrets.token_urlsafe(48),
    )


@pytest.fixture
def client(settings):
    model = FakeNL2SQLClient(
        "SELECT dotacion_total FROM v_gold_resumen_rrhh_mensual WHERE periodo='2026-09'"
    )
    with TestClient(
        create_app(settings, model),
        base_url="https://testserver",
        headers={"Origin": "https://testserver"},
    ) as c:
        yield c


@pytest.fixture
def signed_in(client, credentials):
    assert (
        client.post(
            "/api/auth/login", json={"username": "thesis-test", "password": credentials[0]}
        ).status_code
        == 200
    )
    return client
