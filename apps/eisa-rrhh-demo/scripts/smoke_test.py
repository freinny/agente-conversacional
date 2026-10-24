"""HTTPS acceptance test; validates actual returned rows, never supplies SQL."""

import argparse
import json
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.services.chat_service import QUESTIONS  # noqa: E402

KEYS = [
    "dotacion_total_septiembre",
    "dotacion_por_proyecto_septiembre",
    "costo_por_proyecto_septiembre",
    "dotacion_por_area_septiembre",
    "evolucion_dotacion",
    "costo_total_septiembre",
    "plazos_proyectos",
]


def verify_rows(actual, expected):
    # Model projection/order may differ; every expected field and value must be present.
    import sqlite3

    with sqlite3.connect(":memory:") as connection:
        connection.executescript((ROOT / "db/seed_eisa.sql").read_text())
        names = [d[0] for d in connection.execute(expected["sql"]).description]
    indices = [actual["columns"].index(n) for n in names]
    rows = [[r[i] for i in indices] for r in actual["rows"]]
    assert sorted(rows, key=repr) == sorted(expected["rows"], key=repr), (rows, expected["rows"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--credentials-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    assert args.url.startswith("https://") and args.url.rstrip("/") == args.url
    credentials = json.loads(args.credentials_file.read_text())
    fixtures = json.loads((ROOT / "tests/fixtures/expected_results.json").read_text())
    evidence = {
        "url": args.url,
        "provider": "Microsoft Foundry (real HTTP inference)",
        "questions": [],
    }
    with httpx.Client(base_url=args.url, headers={"Origin": args.url}, timeout=60) as client:
        assert client.get("/healthz").status_code == 200
        assert client.get("/readyz").status_code == 200
        assert client.post("/api/chat", json={"message": QUESTIONS[0]}).status_code == 401
        login = client.post("/api/auth/login", json=credentials)
        assert login.status_code == 200, login.text
        assert "httponly" in login.headers["set-cookie"].lower()
        assert client.get("/api/auth/me").json()["username"] == credentials["username"]
        for question, key in zip(QUESTIONS, KEYS):
            response = client.post("/api/chat", json={"message": question})
            assert response.status_code == 200, (question, response.text)
            actual = response.json()
            assert actual["validated"] is True and actual["row_count"] == len(actual["rows"])
            verify_rows(actual, fixtures[key])
            evidence["questions"].append(
                {"question": question, "fixture": key, "matched": True, **actual}
            )
            print(f"PASS: {key} · trace {actual['trace_id']} · {actual['row_count']} rows")
        cookie = client.cookies.get("__Host-eisa_session")
        assert client.post("/api/auth/logout", json={}).status_code == 200
        client.cookies.set("__Host-eisa_session", cookie)
        assert client.get("/api/auth/me").status_code == 401
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
