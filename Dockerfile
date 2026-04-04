# API only — deploy the Next.js app separately (e.g. Vercel). See DEPLOY.md.
FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY app ./app
COPY frontend/public/images/landing/kifinal.png /app/assets/kifinal.png
COPY frontend/public/images/timetable-calendar-template.png /app/assets/timetable-calendar-template.png

RUN mkdir -p /data /app/assets \
    && pip install --no-cache-dir --upgrade pip setuptools \
    && pip install --no-cache-dir .

ENV PYTHONUNBUFFERED=1
# Mount a persistent volume at /data for SQLite (see DEPLOY.md).
ENV CHECKPOINT_SQLITE_PATH=/data/langgraph_checkpoints.db
ENV THREAD_REGISTRY_DB_PATH=/data/thread_registry.db
ENV TIMETABLE_DB_PATH=/data/timetable.db
ENV CLERK_ENTITLEMENTS_DB_PATH=/data/clerk_entitlements.db
ENV TIMETABLE_BRAND_LOGO_PATH=/app/assets/kifinal.png
ENV TIMETABLE_REFERENCE_LAYOUT_PATH=/app/assets/timetable-calendar-template.png

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
