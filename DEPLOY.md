# Production deployment

This project is split into two runtimes:

1. **Next.js (`frontend/`)** — static + server components, Clerk in the browser. A natural host is [Vercel](https://vercel.com/).
2. **FastAPI (`app/`)** — workflow API, MCP mount, webhooks, SQLite-backed checkpoints, timetable store, and a **minute scheduler** for notifications. Run this as a **long-lived container or VM**, not as a purely ephemeral serverless function.

SQLite file paths default to `/data/*.db` inside the provided `Dockerfile` so you can attach one persistent volume. Use **one replica** (or accept that multiple instances each need their own DB / external database — not covered here).

## 1. Deploy the API (Docker)

Build from the repository root:

```bash
docker build -t study-coach-api .
docker run --rm -p 8000:8000 \
  -v study_coach_data:/data \
  -e OPENAI_API_KEY=... \
  -e SESSION_SECRET=... \
  -e SESSION_COOKIE_SECURE=true \
  -e PUBLIC_BASE_URL=https://api.yourdomain.com \
  -e CORS_ORIGINS=https://app.yourdomain.com \
  -e STUDY_COACH_FRONTEND_URL=https://app.yourdomain.com \
  study-coach-api
```

Set secrets from `.env.example` as needed: Clerk (`CLERK_*`), SendGrid, `CLERK_WEBHOOK_SECRET`, optional `APP_ACCESS_CODE` / `API_KEYS`, etc.

**Behind a reverse proxy**, the image already runs Uvicorn with `--proxy-headers` and `--forwarded-allow-ips='*'` so `X-Forwarded-Proto` is honored for URL generation when your platform sets it.

### Example: Fly.io

1. `fly launch --dockerfile Dockerfile` (no Dockerfile CMD override).
2. Create a volume: `fly volumes create study_coach_data --region <region> --size 3`
3. In `fly.toml`, mount it at `/data` and set `min_machines_running = 1` if you rely on the timetable notification tick.
4. Set secrets: `fly secrets set SESSION_SECRET=... OPENAI_API_KEY=...` (and the rest).
5. Point DNS at the Fly app; set `PUBLIC_BASE_URL` and `CORS_ORIGINS`/`STUDY_COACH_FRONTEND_URL` to real HTTPS URLs.

Similar patterns work on **Railway**, **Render**, or a **VPS** with Docker and a volume.

## 2. Deploy the frontend (Vercel)

1. Import the Git repo in Vercel.
2. Set **Root Directory** to `frontend`.
3. **Environment variables** (Production):

   | Variable | Purpose |
   |----------|---------|
   | `NEXT_PUBLIC_API_URL` | HTTPS URL of the FastAPI app (no trailing slash). |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key. |
   | `CLERK_SECRET_KEY` | Clerk secret (server-side in Next if your setup needs it). |

4. Deploy. Optional: add a custom domain.

`frontend/vercel.json` sets baseline security headers. Tighten **Content-Security-Policy** later if you introduce third-party scripts.

`next.config.ts` adds `images.remotePatterns` from `NEXT_PUBLIC_API_URL` so optimized images can load from your API `/static/**` when needed.

## 3. Clerk

- **Authorized redirect / allowed origins**: production frontend URL(s).
- **JWT / sessions**: align `CLERK_JWT_ISSUER`, optional `CLERK_AUTHORIZED_PARTIES`, and `CLERK_JWT_AUDIENCE` with your Clerk app and FastAPI settings.
- **Webhooks**: endpoint `POST https://api.yourdomain.com/webhooks/clerk` with signing secret in `CLERK_WEBHOOK_SECRET`.

## 4. Checklist

- [ ] `SESSION_SECRET` strong and unique; `SESSION_COOKIE_SECURE=true` when serving only over HTTPS.
- [ ] `CORS_ORIGINS` lists the exact Vercel / custom domain (no trailing slashes).
- [ ] `PUBLIC_BASE_URL` is the public API URL.
- [ ] `STUDY_COACH_FRONTEND_URL` matches the live Next app (welcome email and redirects).
- [ ] Persistent `/data` (or equivalent) for SQLite if you care about retention across deploys.
- [ ] Single API instance **or** external DB if you scale horizontally.
- [ ] `GET /health` wired for your platform’s health checks.
