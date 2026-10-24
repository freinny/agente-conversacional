from typing import Protocol

from openai import OpenAI, OpenAIError
from pydantic import ValidationError

from app.config import Settings
from app.models.contracts import ModelQuery


class ModelUnavailable(RuntimeError):
    pass


class ModelResponseError(ValueError):
    pass


class NL2SQLClient(Protocol):
    def generate(self, question: str, system_prompt: str) -> ModelQuery: ...


class FoundryNL2SQLClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = None
        if settings.model_configured():
            if settings.foundry_auth_mode == "key":
                credential = settings.foundry_api_key.get_secret_value()
            else:
                from azure.identity import DefaultAzureCredential, get_bearer_token_provider

                credential = get_bearer_token_provider(
                    DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
                )
            self.client = OpenAI(
                base_url=settings.foundry_openai_base_url,
                api_key=credential,
                timeout=15.0,
                max_retries=1,
            )

    def generate(self, question: str, system_prompt: str) -> ModelQuery:
        if self.client is None:
            raise ModelUnavailable("Foundry aún no está configurado")
        try:
            kwargs = (
                {"response_format": {"type": "json_object"}}
                if self.settings.foundry_json_mode
                else {}
            )
            completion = self.client.chat.completions.create(
                model=self.settings.foundry_model_deployment,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": question},
                ],
                **kwargs,
            )
            if not completion.choices or completion.choices[0].finish_reason != "stop":
                raise ModelResponseError(
                    "El modelo no completó una consulta; reformula la pregunta"
                )
            message = completion.choices[0].message
            if message.refusal or not message.content:
                raise ModelResponseError("El modelo solicitó aclarar la pregunta")
            return ModelQuery.model_validate_json(message.content)
        except ValidationError as error:
            raise ModelResponseError(
                "El modelo devolvió un formato inválido; reformula la pregunta"
            ) from error
        except OpenAIError as error:
            # Never expose provider messages, request headers or keys.
            raise ModelUnavailable(
                "No se pudo consultar Microsoft Foundry; inténtalo más tarde"
            ) from error
