FROM node:22-alpine AS web
WORKDIR /build/web
COPY web/package*.json ./
RUN npm ci --ignore-scripts
COPY web/ ./
RUN npm run test && npm run build

FROM python:3.12-slim AS data
WORKDIR /build
COPY db/ ./db/
RUN python db/build_seed_db.py --output /build/eisa_demo.db

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home appuser
COPY backend/ ./
COPY --from=data --chown=10001:10001 /build/eisa_demo.db /app/data/eisa_demo.db
COPY --from=web /build/web/dist /app/web
USER 10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import os,urllib.request,urllib.parse; r=urllib.request.Request('http://127.0.0.1:8000/healthz',headers={'Host':urllib.parse.urlsplit(os.environ['PUBLIC_ORIGIN']).netloc}); urllib.request.urlopen(r,timeout=3)" || exit 1
CMD ["uvicorn", "main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
