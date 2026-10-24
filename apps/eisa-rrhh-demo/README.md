# EISA · Data Assistant

Prototipo académico de la tesis de Freinny Moreno. FastAPI, Python OOP, OpenAI SDK
con Microsoft Foundry, SQLite3 y JavaScript Vanilla. Una sola imagen sirve API y UI.
Datos completamente sintéticos; no contiene información real de Echeverría Izquierdo.
SQLite representa exclusivamente el contrato de lectura de la capa Gold; no hay
conexión productiva a Fabric. La cabecera incluye el workspace solicitado como
referencia de arquitectura y el icono oficial de Fabric.

La app está aislada en este directorio y no cambia Amalia/Cinépolis ni los workspaces
npm de la raíz. La UI tiene una sola pregunta sugerida; cualquier otra pregunta
se escribe libremente. El SQL validado de cada respuesta aparece en un panel dedicado.
No existe un router de preguntas a respuestas prefabricadas ni un fallback offline.

## Configuración

Copiar los nombres de `.env.example` a un archivo privado fuera del repositorio.
Proveer `PUBLIC_ORIGIN` HTTPS sin barra final, `DEMO_USERNAME`, `DEMO_PASSWORD_HASH`
(bcrypt), `SESSION_SECRET` (mínimo 32 caracteres), `FOUNDRY_OPENAI_BASE_URL` terminado
en `/openai/v1/` y el nombre **real** de `FOUNDRY_MODEL_DEPLOYMENT`.
`FOUNDRY_AUTH_MODE=entra` usa `DefaultAzureCredential` con RBAC previamente autorizado.
`FOUNDRY_AUTH_MODE=key` requiere `FOUNDRY_API_KEY`, solo backend/Container App Secret.
`FOUNDRY_JSON_MODE=false` permite deployments sin JSON mode; el parseo JSON estricto
y los guardrails se mantienen. No se configura ningún modelo o endpoint por defecto.

Generar un hash sin dejar la contraseña en el historial:

```bash
python -c 'import bcrypt,getpass; print(bcrypt.hashpw(getpass.getpass().encode(),bcrypt.gensalt()).decode())'
```

No guardar contraseñas, hashes de la cuenta de demo, cookies ni claves en Git.
La cuenta pública se aprovisiona mediante secretos, no se incluye en el seed SQL.

## Desarrollo y pruebas

Requiere Python 3.12 y Node 22.22 o superior.

```bash
cd apps/eisa-rrhh-demo
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements-dev.lock
pytest -q
ruff check backend db tests scripts
(cd web && npm ci && npm test && npm run build)
python db/build_seed_db.py --output /tmp/eisa-local.db
```

El constructor rechaza sobrescribir un archivo existente. Las dos fuentes del
handoff se copiaron literalmente: `db/seed_eisa.sql` y
`tests/fixtures/expected_results.json`. Los tests con `FakeNL2SQLClient` son
exclusivamente de prueba y no se importan en runtime. Las dependencias Python,
incluidas sus transitivas, están fijadas a versiones instaladas y probadas.

## Docker

```bash
docker build -t eisa-rrhh-demo:local apps/eisa-rrhh-demo
docker run --rm --env-file /ruta/privada/eisa.env -p 8000:8000 eisa-rrhh-demo:local
```

Para login local debe existir un proxy HTTPS hacia el puerto 8000 que conserve
el Host configurado en `PUBLIC_ORIGIN`; las cookies siempre son Secure. La imagen
genera `/app/data/eisa_demo.db` durante el build, lo marca de solo lectura y corre
como UID 10001. No se persisten conversaciones ni contraseñas en SQLite.

## Controles y límites

- Sesión opaca firmada, cookie `__Host-`, HttpOnly, Secure, SameSite Strict, hasta
  8 horas, registro activo en memoria y revocación real en logout.
- Cinco intentos de login cada cinco minutos por IP; 20 chats/minuto por sesión.
- Verificación exacta de Origin para POST, Host permitido, sin CORS abierto, CSP
  sin scripts externos, máximo 500 caracteres y 8 KiB de cuerpo.
- SQLGlot AST: una SELECT sobre una sola de cuatro vistas autorizadas; columnas
  y funciones permitidas; sin tablas base, CTE, joins, UNION, subconsultas,
  comentarios, DDL/DML, PRAGMA, ATTACH ni funciones opacas.
- Máximo 50 filas, sin OFFSET. Protección contra agregación de indicadores entre
  meses y filtro verificable para periodos explícitos o último periodo disponible.
- SQLite `mode=ro`, `query_only`, authorizer que bloquea accesos directos a tablas,
  extensiones desactivadas, presupuesto de operaciones y 2 segundos de ejecución.
- Formatter determinístico a partir de filas reales. El texto del modelo no se
  presenta como respuesta. Markdown procesado con marked y DOMPurify; SQL mediante
  `textContent`. Logs con traza, SQL validado, vistas, latencia y conteo, sin pregunta
  textual ni credenciales.

Ejecutar **un worker y una réplica**: las sesiones y limitadores viven en memoria.
Una nueva revisión o reinicio cierra sesiones. Para escalar se requiere un almacén
de sesiones/limitadores y revisar la arquitectura. Los guardrails acotan un
subconjunto SQL intencionalmente; solicitudes más complejas requieren aclaración.

## Azure

El blueprint pide por defecto `AP Global Sandbox`. En esta sesión el usuario cambió
expresamente el destino a `Azure CL - Credit Card - Presales (Franky Rojas)`,
`6c51ac27-9d90-4bde-94e5-511ca2fa75d2`, y autorizó reutilizar el mismo deployment
`gpt-4o` que Amalia. Esta excepción no cambia el destino seguro por defecto del script.
Los nombres/ID se verifican por igualdad antes de cualquier mutación.

El script realiza preflight por defecto; `--apply` prueba primero el modelo real,
pytest, sanitización y build. Solo crea un grupo nuevo `rg-eisa-rrhh-*`. Para
recuperar una ejecución parcial, `--resume-owned` exige que el grupo y **todos**
sus recursos tengan las cuatro etiquetas exactas de EISA. No borra recursos,
no modifica recursos de Amalia y no concede permisos en recursos compartidos.

```bash
PYTHON=.venv/bin/python scripts/deploy_azure.sh \
  --subscription-name '<nombre autorizado exacto>' --subscription-id '<ID verificado>' \
  --resource-group '<nuevo rg-eisa-rrhh-*>' --location '<región verificada>' \
  --registry '<nombre nuevo disponible>' --foundry-group '<grupo autorizado>' \
  --foundry-account '<cuenta real>' --foundry-deployment '<deployment real>' \
  --settings-file /ruta/privada/auth.json --output evidence/deployment.json
# Revisar el preflight y agregar --apply para ejecutar.
```

El JSON privado contiene únicamente `DEMO_USERNAME`, `DEMO_PASSWORD_HASH` y
`SESSION_SECRET`. El deployment lee la clave Foundry autorizada en memoria y la
transporta por HTTPS directamente a un secreto de la nueva Container App; no la
escribe en un archivo ni en argumentos CLI. Contributor no permite asignar AcrPull:
el registro exclusivo usa credencial administrativa guardada como secreto de la
Container App. Cambiarla por identidad administrada requiere autorización RBAC.
La imagen se construye remotamente en ACR y se despliega por digest. CPU 0.5,
memoria 1 GiB, mínimo=máximo=1. HTTPS externo y probes explícitos.

El entorno dedicado usa `logs-destination=none`: se pueden inspeccionar logs de
consola en vivo, pero no se aprovisiona Log Analytics ni se promete retención de
logs. Las evidencias de aceptación se exportan a JSON. Para retención duradera,
habilitar un destino de logs aprobado.

```bash
PYTHON=.venv/bin/python scripts/smoke_test.sh --url 'https://<FQDN real>' \
  --credentials-file /ruta/privada/login.json --output evidence/acceptance.json
```

El archivo privado de login contiene `username` y `password`. El smoke hace siete
preguntas por `/api/chat`, comprueba filas contra el fixture sin depender de prosa,
verifica login/logout y replay, y guarda SQL/trazas sin cookies ni secretos.
Ver [evidencia técnica](../../docs/eisa_prototype_technical_evidence.md) para URL,
recursos, resultados y estado verificados.
