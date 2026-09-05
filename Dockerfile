# Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Runtime
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ARG VERSION=dev
ENV FORGE_DATA_DIR=/data \
    FORGE_VERSION=$VERSION

RUN useradd -m -u 1000 forge \
    && mkdir -p /data \
    && chown forge:forge /data
USER forge

VOLUME ["/data"]
EXPOSE 8081

# Same endpoint the deploy polls, but asked continuously rather than once, so
# `docker ps` reports healthy/unhealthy instead of just "Up". python:slim ships
# neither curl nor wget, and installing one for this would be silly — urllib is
# already in the interpreter running the app. urlopen raises on a connection
# failure and on any non-2xx, so a bare call is the whole check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8081/api/health', timeout=4)"]

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8081", "--proxy-headers", "--forwarded-allow-ips", "*"]
