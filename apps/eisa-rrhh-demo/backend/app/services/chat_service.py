import json
import logging
import re
import time
import unicodedata
from uuid import uuid4

from app.models.contracts import ChatResponse
from app.services.foundry_client import ModelResponseError, NL2SQLClient
from app.services.markdown_formatter import MarkdownFormatter
from app.services.schema_registry import SchemaRegistry
from app.services.sql_guardrails import SQLGuardrails
from app.services.sqlite_executor import SQLiteExecutor

QUESTIONS = (
    "¿Cuántos colaboradores tenemos en septiembre de 2026?",
    "¿Cuál es la dotación por proyecto en septiembre de 2026?",
    "¿Cuál fue el costo laboral por proyecto en septiembre de 2026?",
    "¿Cómo se distribuye la dotación por área en septiembre de 2026?",
    "¿Cómo evolucionaron la dotación y el costo laboral entre agosto y octubre de 2026?",
    "¿Cuál fue el costo laboral total en septiembre de 2026?",
    "¿Qué duración planificada tienen los proyectos?",
)


class QuestionContext:
    months = {
        m: i
        for i, m in enumerate(
            (
                "enero",
                "febrero",
                "marzo",
                "abril",
                "mayo",
                "junio",
                "julio",
                "agosto",
                "septiembre",
                "octubre",
                "noviembre",
                "diciembre",
            ),
            1,
        )
    }

    def __init__(self, message: str, latest: str):
        plain = "".join(
            c for c in unicodedata.normalize("NFD", message.lower()) if not unicodedata.combining(c)
        )
        if re.search(
            r"\b(nombres?|rut|sueldos? individuales|salarios? individuales|empleados? individuales|emp-\d+|credenciales|contrasenas?|api.?key)\b",
            plain,
        ):
            raise ModelResponseError(
                "Solo puedo consultar indicadores agregados; no datos personales ni credenciales"
            )
        # The model remains responsible for domain recognition; this is a local
        # privacy filter and temporal normalization, never a question→SQL router.
        explicit = bool(
            re.search(
                r"\b20\d{2}\b|\bmes(?:es)?\b|evoluci|compar|anterior|histor|trimestre|semestre|anual",
                plain,
            )
            or any(m in plain for m in self.months)
        )
        duration = bool(re.search(r"duracion|plazo|fecha.*(?:fin|inicio)", plain))
        self.required_period = None
        self.note = ""
        if not explicit and not duration:
            self.required_period = latest
            self.note = f"Periodo utilizado: **{latest}**, último disponible."
        else:
            iso = re.findall(r"\b20\d{2}-(?:0[1-9]|1[0-2])\b", plain)
            named = [i for m, i in self.months.items() if m in plain]
            years = re.findall(r"\b20\d{2}\b", plain)
            if len(iso) == 1:
                self.required_period = iso[0]
            elif len(named) == 1 and len(years) == 1:
                self.required_period = f"{years[0]}-{named[0]:02}"


class ChatService:
    def __init__(self, model: NL2SQLClient, executor: SQLiteExecutor):
        self.model, self.executor = model, executor
        self.schema = SchemaRegistry()
        self.guardrails = SQLGuardrails()
        self.formatter = MarkdownFormatter()

    def answer(self, message: str) -> ChatResponse:
        started = time.monotonic()
        trace_id = str(uuid4())
        latest = self.executor.latest_period()
        context = QuestionContext(message, latest)
        normalized = message
        if context.required_period:
            normalized += f"\nPeriodo obligatorio: {context.required_period}."
        generated = self.model.generate(normalized, self.schema.prompt(latest))
        if generated.sql is None:
            # Do not echo untrusted model prose or injected instructions.
            raise ModelResponseError(
                "Reformula tu pregunta sobre dotación, FTE, costos agregados, áreas o duración planificada de proyectos"
            )
        query = self.guardrails.validate(generated.sql, required_period=context.required_period)
        result = self.executor.execute(query)
        elapsed = int((time.monotonic() - started) * 1000)
        logging.getLogger("eisa.query").info(
            json.dumps(
                {
                    "trace_id": trace_id,
                    "sql": query.sql,
                    "views": query.views,
                    "elapsed_ms": elapsed,
                    "row_count": len(result.rows),
                },
                ensure_ascii=False,
            )
        )
        return ChatResponse(
            answer_markdown=self.formatter.format(result, context.note),
            generated_sql=query.sql,
            columns=list(result.columns),
            rows=[list(r) for r in result.rows],
            row_count=len(result.rows),
            elapsed_ms=elapsed,
            trace_id=trace_id,
        )
