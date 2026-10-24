import pytest
from conftest import FakeNL2SQLClient
from fastapi.testclient import TestClient
from main import create_app

from app.models.contracts import ModelQuery, QueryResult
from app.services.chat_service import QUESTIONS, ChatService
from app.services.foundry_client import ModelResponseError, ModelUnavailable
from app.services.markdown_formatter import MarkdownFormatter
from app.services.sqlite_executor import SQLiteExecutor

KEYS = [
    "dotacion_total_septiembre",
    "dotacion_por_proyecto_septiembre",
    "costo_por_proyecto_septiembre",
    "dotacion_por_area_septiembre",
    "evolucion_dotacion",
    "costo_total_septiembre",
    "plazos_proyectos",
]


@pytest.mark.parametrize("index", range(7))
def test_seven_questions_http(settings, credentials, fixtures, index):
    fixture = fixtures[KEYS[index]]
    model = FakeNL2SQLClient(fixture["sql"])
    with TestClient(
        create_app(settings, model),
        base_url="https://testserver",
        headers={"origin": "https://testserver"},
    ) as client:
        assert (
            client.post(
                "/api/auth/login", json={"username": "thesis-test", "password": credentials[0]}
            ).status_code
            == 200
        )
        response = client.post("/api/chat", json={"message": QUESTIONS[index]})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["rows"] == fixture["rows"] and data["row_count"] == len(fixture["rows"])
    assert data["validated"] is True and data["generated_sql"].endswith("LIMIT 50")
    assert len(data["trace_id"]) == 36 and "EMP-001" not in model.calls[0][1]


def test_default_period_privacy(database):
    model = FakeNL2SQLClient(
        "SELECT dotacion_total FROM v_gold_resumen_rrhh_mensual WHERE periodo='2026-10'"
    )
    service = ChatService(model, SQLiteExecutor(database))
    response = service.answer("¿Cuántos colaboradores tenemos?")
    assert response.rows == [[24]] and "2026-10" in response.answer_markdown
    with pytest.raises(ModelResponseError):
        service.answer("Dame los nombres y RUT de los empleados")
    assert len(model.calls) == 1


def test_rejected_model_sql_and_outage(signed_in):
    service = signed_in.app.state.chat
    service.model = FakeNL2SQLClient("SELECT * FROM employees")
    response = signed_in.post("/api/chat", json={"message": QUESTIONS[0]})
    assert response.status_code == 422 and "generated_sql" not in response.json()
    service.model = FakeNL2SQLClient(None)
    assert signed_in.post("/api/chat", json={"message": "¿Qué clima hay hoy?"}).status_code == 422

    class Unavailable:
        def generate(self, *args):
            raise ModelUnavailable("Proveedor no disponible")

    service.model = Unavailable()
    assert signed_in.post("/api/chat", json={"message": QUESTIONS[0]}).status_code == 503


def test_input(signed_in):
    for payload in [
        {"message": ""},
        {"message": " " * 5},
        {"message": "x" * 501},
        {"message": QUESTIONS[0], "sql": "DROP TABLE employees"},
    ]:
        assert signed_in.post("/api/chat", json=payload).status_code == 422


def test_formatter():
    formatter = MarkdownFormatter()
    assert "CLP 34.100.000" in formatter.format(
        QueryResult(("costo_laboral_total_clp",), ((34100000,),))
    )
    assert "No hay registros" in formatter.format(QueryResult(("periodo",), ()))
    text = formatter.format(QueryResult(("area",), (("<script>x</script>|\n",),)))
    assert "<script>" not in text and "&#124;" in text


def test_strict_model_json():
    from pydantic import ValidationError

    for value in [
        "not JSON",
        '{"sql":"SELECT 1"}',
        '{"sql":1,"description":"a"}',
        '{"sql":null,"description":"a","secret":"b"}',
    ]:
        with pytest.raises(ValidationError):
            ModelQuery.model_validate_json(value)
