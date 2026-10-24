import html

from app.models.contracts import QueryResult


class MarkdownFormatter:
    @staticmethod
    def cell(value, column="") -> str:
        if value is None:
            return "—"
        if isinstance(value, (int, float)) and "clp" in column.lower():
            return "CLP " + f"{value:,.0f}".replace(",", ".")
        return html.escape(str(value)).replace("|", "&#124;").replace("\n", " ").replace("\r", " ")

    def format(self, result: QueryResult, period_note: str = "") -> str:
        intro = "**Resultado sobre datos sintéticos.**"
        if period_note:
            intro += " " + period_note
        if not result.rows:
            return intro + "\n\nNo hay registros para los filtros solicitados."
        header = "| " + " | ".join(self.cell(c.replace("_", " ")) for c in result.columns) + " |"
        separator = "| " + " | ".join("---" for _ in result.columns) + " |"
        rows = [
            "| " + " | ".join(self.cell(v, c) for c, v in zip(result.columns, row)) + " |"
            for row in result.rows
        ]
        return intro + "\n\n" + "\n".join([header, separator, *rows])
