import sqlglot
from sqlglot import exp
from sqlglot.errors import SqlglotError

from app.models.contracts import ValidatedQuery
from app.services.schema_registry import SchemaRegistry


class SQLRejected(ValueError):
    pass


class SQLGuardrails:
    # Deliberately small grammar. New capabilities require an explicit review.
    allowed_nodes = frozenset(
        {
            "Select",
            "From",
            "Table",
            "Identifier",
            "Column",
            "Literal",
            "Where",
            "EQ",
            "NEQ",
            "GT",
            "GTE",
            "LT",
            "LTE",
            "And",
            "Or",
            "Not",
            "Between",
            "In",
            "Ordered",
            "Order",
            "Group",
            "Having",
            "Limit",
            "Alias",
            "TableAlias",
            "Add",
            "Sub",
            "Mul",
            "Div",
            "Paren",
            "Neg",
            "Sum",
            "Avg",
            "Min",
            "Max",
            "Count",
            "Round",
            "Coalesce",
            "Null",
            "Is",
            "Star",
            "Distinct",
        }
    )

    @staticmethod
    def fixed_period(tree: exp.Select) -> str | None:
        where = tree.args.get("where")
        if not where:
            return None

        def guaranteed(node):
            if isinstance(node, exp.Paren):
                return guaranteed(node.this)
            if isinstance(node, exp.And):
                return guaranteed(node.left) or guaranteed(node.right)
            if isinstance(node, exp.EQ):
                for col, literal in [(node.left, node.right), (node.right, node.left)]:
                    if (
                        isinstance(col, exp.Column)
                        and col.name.lower() == "periodo"
                        and isinstance(literal, exp.Literal)
                        and literal.is_string
                    ):
                        return literal.this
            return None

        return guaranteed(where.this)

    def validate(self, sql: str, required_period: str | None = None) -> ValidatedQuery:
        if not sql or len(sql) > 6000:
            raise SQLRejected("Consulta vacía o demasiado extensa")
        try:
            statements = sqlglot.parse(sql, read="sqlite")
        except SqlglotError as error:
            raise SQLRejected("No se pudo interpretar SQL SQLite") from error
        if len(statements) != 1 or not isinstance(statements[0], exp.Select):
            raise SQLRejected("Solo se permite una consulta SELECT")
        tree = statements[0]
        for node in tree.walk():
            if type(node).__name__ not in self.allowed_nodes:
                raise SQLRejected("La consulta contiene una operación no autorizada")
            if node.comments:
                raise SQLRejected("No se permiten comentarios en SQL generado")
        tables = list(tree.find_all(exp.Table))
        if len(tables) != 1 or len(list(tree.find_all(exp.Select))) != 1:
            raise SQLRejected("Consulta una sola vista Gold, sin subconsultas ni joins")
        table = tables[0]
        name = table.name.lower()
        if name not in SchemaRegistry.views or table.db or table.catalog:
            raise SQLRejected("Vista fuera del catálogo Gold permitido")
        columns = SchemaRegistry.views[name]
        qualifiers = {name, table.alias_or_name.lower()}
        aliases = {a.alias.lower() for a in tree.expressions if isinstance(a, exp.Alias)}
        if any(not a.isidentifier() or len(a) > 64 for a in aliases):
            raise SQLRejected("Alias no permitido")
        for column in tree.find_all(exp.Column):
            if (
                column.catalog
                or column.db
                or (column.table and column.table.lower() not in qualifiers)
            ):
                raise SQLRejected("Calificador de columna no autorizado")
            if column.name.lower() not in columns:
                # Aliases may appear only as a simple ORDER BY expression.
                if not (column.name.lower() in aliases and isinstance(column.parent, exp.Ordered)):
                    raise SQLRejected("Columna fuera del catálogo permitido")
        for projection in tree.expressions:
            if not (
                isinstance(projection, exp.Star)
                or projection.find(exp.Column)
                or projection.find(exp.Count)
            ):
                raise SQLRejected("El resultado debe proceder de columnas Gold")
        fixed = self.fixed_period(tree)
        if required_period and "periodo" in columns and fixed != required_period:
            raise SQLRejected("La consulta debe filtrar el periodo solicitado")
        if "periodo" in columns:
            groups = tree.args.get("group")
            grouped_period = bool(
                groups
                and any(
                    isinstance(c, exp.Column) and c.name.lower() == "periodo"
                    for c in groups.expressions
                )
            )
            aggregates = list(tree.find_all(exp.AggFunc))
            if aggregates and not fixed and not grouped_period:
                raise SQLRejected("No se permite agregar indicadores entre meses")
            if not fixed and not any(
                c.name.lower() == "periodo"
                for p in tree.expressions
                for c in p.find_all(exp.Column)
            ):
                if not any(isinstance(p, exp.Star) for p in tree.expressions):
                    raise SQLRejected("Incluye el periodo al consultar múltiples meses")
        if tree.args.get("offset"):
            raise SQLRejected("No se permite OFFSET")
        limit = tree.args.get("limit")
        row_limit = 50
        if limit:
            literal = limit.expression
            if (
                not isinstance(literal, exp.Literal)
                or not literal.is_int
                or not 1 <= int(literal.this)
            ):
                raise SQLRejected("LIMIT debe ser un entero positivo")
            row_limit = min(50, int(literal.this))
        tree = tree.limit(row_limit)
        return ValidatedQuery(tree.sql(dialect="sqlite"), (name,))
