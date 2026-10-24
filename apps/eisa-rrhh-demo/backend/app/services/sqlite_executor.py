import sqlite3
import time
from contextlib import closing
from pathlib import Path

from app.models.contracts import QueryResult, ValidatedQuery
from app.services.schema_registry import SchemaRegistry


class QueryExecutionError(RuntimeError):
    pass


class SQLiteExecutor:
    def __init__(self, path: Path, timeout_seconds: float = 2.0, max_operations: int = 200000):
        self.path = path
        self.timeout_seconds = timeout_seconds
        self.max_operations = max_operations

    @staticmethod
    def authorize(action, arg1, arg2, database, source):
        if action == sqlite3.SQLITE_SELECT:
            return sqlite3.SQLITE_OK
        if action == sqlite3.SQLITE_READ:
            # SQLite expands a trusted view into reads of its base tables. Only
            # reads originating INSIDE one of these views are allowed there.
            if database == "main" and (
                source in SchemaRegistry.views or arg1 in SchemaRegistry.views
            ):
                return sqlite3.SQLITE_OK
        if action == sqlite3.SQLITE_FUNCTION and arg2.lower() in {
            "count",
            "sum",
            "round",
            "coalesce",
            "julianday",
            "min",
            "max",
            "avg",
        }:
            return sqlite3.SQLITE_OK
        return sqlite3.SQLITE_DENY

    def execute(self, query: ValidatedQuery) -> QueryResult:
        deadline = time.monotonic() + self.timeout_seconds
        operations = 0

        def progress():
            nonlocal operations
            operations += 100
            return int(operations > self.max_operations or time.monotonic() > deadline)

        try:
            with closing(
                sqlite3.connect(self.path.resolve().as_uri() + "?mode=ro", uri=True, timeout=2)
            ) as connection:
                connection.execute("PRAGMA query_only=ON")
                connection.enable_load_extension(False)
                connection.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, 100000)
                connection.setlimit(sqlite3.SQLITE_LIMIT_SQL_LENGTH, 6000)
                connection.set_authorizer(self.authorize)
                connection.set_progress_handler(progress, 100)
                cursor = connection.execute(query.sql)
                rows = cursor.fetchmany(51)
                if len(rows) > 50 or time.monotonic() > deadline:
                    raise QueryExecutionError("La consulta excedió el presupuesto permitido")
                return QueryResult(
                    tuple(d[0] for d in cursor.description), tuple(tuple(row) for row in rows)
                )
        except sqlite3.Error as error:
            raise QueryExecutionError(
                "No se pudo ejecutar la consulta Gold de forma segura"
            ) from error

    def latest_period(self) -> str:
        result = self.execute(
            ValidatedQuery(
                "SELECT MAX(periodo) FROM v_gold_resumen_rrhh_mensual LIMIT 1",
                ("v_gold_resumen_rrhh_mensual",),
            )
        )
        return result.rows[0][0]
