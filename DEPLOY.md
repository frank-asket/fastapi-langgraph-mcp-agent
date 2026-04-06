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

### Fly.io — full walkthrough

Prerequisites: [install `flyctl`](https://fly.io/docs/hands-on/install-flyctl/), `fly auth signup` or `fly auth login`, and this repo cloned locally. Deploy from the **repository root** (where `Dockerfile` and `fly.toml` live). The frontend stays on **Vercel**; Fly runs **only the FastAPI API**.

**1. Name and register the app**

- Pick a globally unique app name (e.g. `yourname-study-coach-api`).
- Either:
  - **A)** Edit `fly.toml` and set `app = "yourname-study-coach-api"`, then run `fly apps create yourname-study-coach-api --org personal`, **or**
  - **B)** Run `fly launch` interactively once; if it generates a new `fly.toml`, merge the important bits (port `8000`, mounts, checks) with the repo’s `fly.toml` or replace `app` / `primary_region` to match.

Keep **`primary_region`** (e.g. `lhr`, `fra`, `iad`) where you want the machine to run; the volume **must** use the **same** region (next step).

**2. Persistent disk for SQLite**

The image expects databases under **`/data`**. Create a volume **before** the first deploy that uses `[[mounts]]`:

```bash
fly volumes create study_coach_data --region lhr --size 3
```

Use the same `--region` as `primary_region` in `fly.toml`. Name `study_coach_data` must match `[[mounts]]` → `source` in `fly.toml`. For this app, use **one machine** (`min_machines_running = 1` in `fly.toml`) so one SQLite volume is enough.

**3. Secrets (environment)**

Set production config as Fly secrets (not committed to git). Example — adjust to your real URLs:

```bash
fly secrets set \
  OPENAI_API_KEY="sk-..." \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  SESSION_COOKIE_SECURE=true \
  PUBLIC_BASE_URL="https://yourname-study-coach-api.fly.dev" \
  CORS_ORIGINS="https://your-app.vercel.app" \
  STUDY_COACH_FRONTEND_URL="https://your-app.vercel.app"
```

Add more from `.env.example` as needed, for example:

- Clerk: `CLERK_JWT_ISSUER`, `CLERK_WEBHOOK_SECRET`, `CLERK_AUTHORIZED_PARTIES`, `CLERK_SEND_WELCOME_EMAIL`, etc.
- SendGrid: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
- Optional: `APP_ACCESS_CODE`, `API_KEYS`, `CLERK_ONLY_AUTH`, `MCP_HTTP_URL` (only if you override defaults)

**4. Deploy**

```bash
fly deploy
```

**5. DNS and URLs**

- Default host: `https://<app-name>.fly.dev`. Put that (no trailing slash) in `PUBLIC_BASE_URL`, and in the Vercel app as **`NEXT_PUBLIC_API_URL`**.
- Custom domain (optional): `fly certs add api.yourdomain.com` and add the CNAME/A records Fly shows; then set `PUBLIC_BASE_URL` / Clerk webhookURL to `https://api.yourdomain.com`.

**6. Smoke checks**

- `curl -sS https://<app-name>.fly.dev/health` → `{"status":"ok"}`
- `curl -sS https://<app-name>.fly.dev/service` → JSON service map
- In Clerk, webhook endpoint: `POST https://<your-api-host>/webhooks/clerk` with `CLERK_WEBHOOK_SECRET` set on Fly.

**7. Logs and ops**

- `fly logs`
- `fly ssh console` (debug; data lives under `/data` on the volume)
- Scale / more regions: for SQLite + in-process timetable scheduler, **stay at one machine** unless you move to a shared database and a separate worker.

Repo **`fly.toml`** sets `internal_port = 8000`, **`/health`** checks, **HTTPS** to the app, **`/data` mount**, and **`auto_stop_machines = "off"`** so background work (timetable tick) is not paused unexpectedly. Change `app` and `primary_region` to yours before the first deploy.

### Railway (API)

1. In [Railway](https://railway.app/), create a project → **New** → **GitHub Repo** (this repo) or **Empty** → **Dockerfile** deploy from the **repository root** (same `Dockerfile` as Fly).
2. **Variables** (mirror root `.env`): at minimum `OPENAI_API_KEY`, `SESSION_SECRET`, `SESSION_COOKIE_SECURE=true`, `PUBLIC_BASE_URL` (your **canonical** API URL, e.g. `https://coach.klingbo.com` with custom domain, not only the default `*.up.railway.app` name—so redirects and MCP URLs stay consistent), `STUDY_COACH_FRONTEND_URL` (e.g. `https://study.klingbo.com`), and either `CORS_ORIGINS` listing **every** frontend origin the browser uses (Vercel preview URL, custom domain, etc.) **or** `CORS_ORIGIN_REGEX` to match several subdomains (see `.env.example`). When `CORS_ORIGINS` is non-empty, the API **also merges** `STUDY_COACH_FRONTEND_URL` into the allowlist. If `CORS_ORIGINS` is empty/whitespace but `STUDY_COACH_FRONTEND_URL` is set, the API allows that origin only. Clerk/SendGrid keys as needed. The Docker image defaults SQLite paths under **`/data`** — add a **Volume** in Railway mounted at **`/data`** so data survives redeploys.
3. **Networking**: generate a public domain; set **`PORT`** handling: this image listens on **8000** (`EXPOSE 8000`). In Railway, set the service **port** to **8000** if the UI asks for an internal port.
4. Point **Vercel** `NEXT_PUBLIC_API_URL` at the same URL as `PUBLIC_BASE_URL`. Clerk webhook: `POST https://<railway-host>/webhooks/clerk`.

Similar patterns work on **Render** or a **VPS** with Docker and a volume.

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

### Next.js security patches / `@next/swc-*` versions

Stay on the **latest `next` in your minor line** (for 15.3.x, use the newest patch e.g. **15.3.8**). [CVE-2025-66478](https://nextjs.org/blog/CVE-2025-66478) names **15.3.6** as the *first* fixed 15.3.x release; **15.3.7+** still contains that fix and adds patches for later RSC issues ([Dec 2025 advisory](https://nextjs.org/blog/security-update-2025-12-11))—**do not pin only 15.3.6** unless you have a specific reason.

In `package-lock.json`, **`next@15.3.x`** may list optional **`@next/swc-*`** at **15.3.5**. That is what the published `next` package declares on npm (there are no `15.3.6+` releases of those `@next/swc-*` packages for that line). It is intentional, not a lockfile mistake.

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
