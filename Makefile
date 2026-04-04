.PHONY: install install-web dev-api dev-web dev check

# Python deps (editable install)
install:
	pip install -e .

install-web:
	cd frontend && npm install

# API: http://127.0.0.1:8000
dev-api:
	.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Next.js: http://127.0.0.1:3000 — set frontend/.env.local first
dev-web:
	cd frontend && npm run dev

# Smoke checks (no servers)
check:
	.venv/bin/python -c "from app.main import app; print('ok', app.title)"
	cd frontend && npm run lint && npm run build
