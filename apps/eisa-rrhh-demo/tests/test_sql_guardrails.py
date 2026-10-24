import pytest

from app.services.sql_guardrails import SQLGuardrails, SQLRejected


@pytest.mark.parametrize(
    "sql",
    [
        "DROP TABLE employees",
        "UPDATE employees SET role=1",
        "PRAGMA database_list",
        "ATTACH DATABASE '/tmp/x' AS x",
        "SELECT * FROM employees",
        "SELECT * FROM sqlite_master",
        "SELECT * FROM v_gold_proyectos; DROP TABLE projects",
        "SELECT * FROM v_gold_proyectos; SELECT * FROM v_gold_proyectos",
        "SELECT * FROM main.v_gold_proyectos",
        "SELECT * FROM v_gold_proyectos UNION SELECT * FROM employees",
        "WITH x AS (SELECT * FROM employees) SELECT * FROM x",
        "SELECT (SELECT employee_id FROM employees) FROM v_gold_proyectos",
        "SELECT * FROM v_gold_proyectos p JOIN v_gold_proyectos q ON 1=1",
        "SELECT load_extension('/tmp/x') FROM v_gold_proyectos",
        "SELECT randomblob(100000000) FROM v_gold_proyectos",
        "SELECT secret FROM v_gold_proyectos",
        "SELECT dotacion FROM v_gold_dotacion_area_mensual LIMIT -1",
        "SELECT * FROM v_gold_proyectos LIMIT 10 OFFSET 2",
        "SELECT SUM(dotacion_total) FROM v_gold_resumen_rrhh_mensual",
        "SELECT dotacion_total FROM v_gold_resumen_rrhh_mensual",
        "SELECT 999999 AS dotacion_total FROM v_gold_proyectos",
        "SELECT proyecto_nombre FROM v_gold_proyectos -- bypass",
    ],
)
def test_rejections(sql):
    with pytest.raises(SQLRejected):
        SQLGuardrails().validate(sql)


@pytest.mark.parametrize("limit,expected", [("", 50), (" LIMIT 999", 50), (" LIMIT 3", 3)])
def test_limits(limit, expected):
    assert (
        SQLGuardrails()
        .validate("SELECT * FROM v_gold_proyectos" + limit)
        .sql.endswith("LIMIT " + str(expected))
    )


def test_period_bypass():
    for where in ["periodo='2026-08'", "periodo='2026-09' OR 1=1", "NOT periodo='2026-09'"]:
        with pytest.raises(SQLRejected):
            SQLGuardrails().validate(
                "SELECT dotacion_total FROM v_gold_resumen_rrhh_mensual WHERE " + where, "2026-09"
            )
    SQLGuardrails().validate(
        "SELECT dotacion_total FROM v_gold_resumen_rrhh_mensual WHERE periodo='2026-09' AND dotacion_total>0",
        "2026-09",
    )
