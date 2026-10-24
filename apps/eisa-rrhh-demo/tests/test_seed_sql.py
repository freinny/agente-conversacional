import sqlite3

import pytest

from app.models.contracts import ValidatedQuery
from app.services.sql_guardrails import SQLGuardrails
from app.services.sqlite_executor import QueryExecutionError, SQLiteExecutor
from db.build_seed_db import build_database


def test_handoff_results(database, fixtures):
    executor = SQLiteExecutor(database)
    for fixture in fixtures.values():
        result = executor.execute(SQLGuardrails().validate(fixture["sql"]))
        assert [list(r) for r in result.rows] == fixture["rows"]
    assert executor.latest_period() == "2026-10"


def test_exclusive_build(database):
    with pytest.raises(FileExistsError):
        build_database(database)


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM employees",
        "PRAGMA database_list",
        "DELETE FROM employees",
        "SELECT load_extension('x')",
        "SELECT * FROM sqlite_master",
    ],
)
def test_executor_defense(database, sql):
    with pytest.raises(QueryExecutionError):
        SQLiteExecutor(database).execute(ValidatedQuery(sql, ()))


def test_readonly_mode(database):
    connection = sqlite3.connect(database.as_uri() + "?mode=ro", uri=True)
    try:
        with pytest.raises(sqlite3.OperationalError):
            connection.execute("DROP TABLE employees")
    finally:
        connection.close()


def test_query_budget(database):
    query = SQLGuardrails().validate("SELECT * FROM v_gold_dotacion_area_mensual")
    with pytest.raises(QueryExecutionError):
        SQLiteExecutor(database, max_operations=0).execute(query)
    with pytest.raises(QueryExecutionError):
        SQLiteExecutor(database, timeout_seconds=0).execute(query)
