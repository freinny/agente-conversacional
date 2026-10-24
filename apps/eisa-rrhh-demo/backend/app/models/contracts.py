from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=72)

    @field_validator("password")
    @classmethod
    def bcrypt_length(cls, value):
        if len(value.encode()) > 72:
            raise ValueError("Password exceeds 72 bytes")
        return value


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1, max_length=500)

    @field_validator("message")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("La pregunta no puede estar vacía")
        return value.strip()


class ModelQuery(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    sql: str | None = Field(max_length=6000)
    description: str = Field(min_length=1, max_length=500)


@dataclass(frozen=True)
class ValidatedQuery:
    sql: str
    views: tuple[str, ...]


@dataclass(frozen=True)
class QueryResult:
    columns: tuple[str, ...]
    rows: tuple[tuple[Any, ...], ...]


class ChatResponse(BaseModel):
    answer_markdown: str
    generated_sql: str
    validated: bool = True
    source: str = "SQLite3 · vista Gold sintética"
    columns: list[str]
    rows: list[list[Any]]
    row_count: int
    elapsed_ms: int
    trace_id: str
