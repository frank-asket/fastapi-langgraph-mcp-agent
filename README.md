# FastAPI + LangGraph + MCP Agent

Product-grade pattern: **FastAPI** exposes a stable HTTP API, **FastMCP** serves tools and system prompts over the [Model Context Protocol](https://modelcontextprotocol.io/), and **LangGraph** runs the agent loop (reason → tool → observe → repeat) with optional checkpointed memory.

## Architecture

```text
Client
  |
  | POST /workflow
  v
FastAPI
  |
  | MCP Client (HTTP)
  v
FastMCP Server
  |        |
Tools   Prompts
  |
LangGraph Agent
```

- **MCP** = tool and prompt server (discoverable, centralized).
- **LangGraph** = orchestration and state (including `thread_id` for memory).
- **FastAPI** = public gateway (optional gate + rate limits; **`POST /workflow/stream`** for SSE token streaming).

```mermaid
flowchart LR
  C[Client] --> F[FastAPI]
  F --> M[MCP HTTP]
  M --> T[Tools]
  M --> P[Prompts]
  F --> G[LangGraph]
  G --> M
  G --> LLM[LLM]
```

## Features

- **Landing** at **`/`** (marketing page) and **`/assessment`** (short questionnaire → personalised **`/chat`**).
- **Web UI** at **`/chat`**: calls `POST /workflow` with optional **`learner_profile`** on the **first** turn of a new thread (assessment results), plus **`thread_id`** for memory. **`coaching_mode`**: `full` (default) or `hints` (shorter nudges).
- **Gate** at **`/gate`**: HTML form sets a session when **`APP_ACCESS_CODE`** is set; API clients can send **`X-App-Access-Code`** instead. The chat UI uses `credentials: "include"` so cookies work.
- **Service map** (JSON) at **`/service`** (formerly the root JSON).
- **Learning progress**: `thread_id` is stored in **localStorage** (survives tab close) and chat state in **SQLite** (`CHECKPOINT_SQLITE_PATH`, default `data/langgraph_checkpoints.db`) so students can continue after the API restarts. **`GET /workflow/history`** reloads past turns. Treat `thread_id` like a private link. With **`BIND_THREADS_TO_SESSION=true`**, the first session that uses a `thread_id` owns it (cross-device resume with the same learning ID still works if **`false`**).
- HTTP agent API with a workflow endpoint.
- MCP-defined tools (e.g. Wikipedia summaries, REST Countries).
- MCP-defined system prompts (no hardcoded prompts inside the graph).
- LangGraph conditional routing: chat node ↔ tool node until done.
- Optional **Redis**-backed MCP event store for persistence and stream limits.

## Prerequisites

- Python 3.11+ (recommended).
- [Redis](https://redis.io/) if you enable the MCP `EventStore` with `RedisStore`.
- An LLM API key (e.g. OpenAI or provider supported by your LangChain stack).

## Suggested layout

```text
fastapi-langgraph-mcp-agent/
├── README.md
├── pyproject.toml          # or requirements.txt
├── .env.example
├── app/
│   ├── main.py             # FastAPI app, lifespan, routes, /chat UI
│   ├── static/
│   │   └── chat.html       # Browser chat front-end
│   ├── mcp_server/
│   │   └── server.py       # FastMCP: tools, prompts, http_app
│   └── workflows/
│       └── graph.py        # LangGraph: state, nodes, compile + checkpointer
```

## Configuration

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | LLM calls (example provider). |
| `REDIS_URL` | e.g. `redis://localhost:6379` for MCP event store. |
| `SESSION_SECRET` | Signs session cookies (use a long random value when using `/gate`). |
| `APP_ACCESS_CODE` | If non-empty, enables gate + requires session or `X-App-Access-Code`. |
| `BIND_THREADS_TO_SESSION` | If `true`, locks each `thread_id` to the first browser session (see `.env.example`). |
| `THREAD_REGISTRY_DB_PATH` | SQLite file for thread ownership when bind is on. |
| `WORKFLOW_REQUESTS_PER_MINUTE` | Rate limit for `/workflow`, `/workflow/history`, `/workflow/stream`. |
| Host / port | Default development: `http://localhost:8000`. |

Copy `.env.example` to `.env` and fill values. Never commit secrets.

**Health**: **`GET /health`** liveness; **`GET /health/deps`** checks OpenAI config, checkpointer, and MCP HTTP reachability.

## Install

```bash
cd fastapi-langgraph-mcp-agent
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -U pip
# pip install -e .   # if using pyproject.toml
# or: pip install -r requirements.txt
```

Dependencies (conceptual — pin versions in your lockfile):

- `fastapi`, `uvicorn[standard]`
- `langgraph`, `langchain-core`, `langchain-openai` (or your LLM package)
- `langchain-mcp-adapters` (`MultiServerMCPClient`, session helpers)
- `fastmcp`, `httpx`
- `wikipedia` (or replace with HTTP/API tools)
- Redis client / `key-value` store package as used by your FastMCP event store setup

## Run locally

1. Start Redis (if using event store):

   ```bash
   redis-server
   ```

2. Start the API (example):

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. MCP is typically mounted under the same app (e.g. `/agent`); the MCP HTTP URL must match what `MultiServerMCPClient` uses (e.g. `http://localhost:8000/agent/mcp`).

4. Open the app: **landing** [http://localhost:8000/](http://localhost:8000/), **gate** [http://localhost:8000/gate](http://localhost:8000/gate) (when access code is set), **assessment** [http://localhost:8000/assessment](http://localhost:8000/assessment), **chat** [http://localhost:8000/chat](http://localhost:8000/chat) — Swagger at `/docs`, JSON routes at `/service`.

## API usage

Example workflow invocation:

When **`APP_ACCESS_CODE`** is set, add `-H "X-App-Access-Code: …"` to the request.

```bash
curl -s -X POST "http://localhost:8000/workflow" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the capital of Ghana?"}'
```

Optional: **`learner_profile`** (first turn of a new `thread_id` only) personalises the coach — same shape as the browser assessment stores. Omit `thread_id` to start a fresh learning thread. Add **`"coaching_mode": "hints"`** for shorter hints.

```bash
curl -s -X POST "http://localhost:8000/workflow" \
  -H "Content-Type: application/json" \
  -d '{"message": "I need a two-week revision plan.", "learner_profile": {"education_level": "shs", "shs_track": "science", "subject_focus": "Mathematics", "region": "Greater Accra", "goals": "WASSCE Core Math"}}'
```

**Streaming** (`text/event-stream`): same JSON body as `POST /workflow` on **`POST /workflow/stream`**. Events: `token` (partial assistant text), `done` (full reply + `thread_id`), `error`.

## MCP tools (examples)

| Tool | Role |
|------|------|
| `global_news` | Wikipedia summary for a query. |
| `get_countries_details` | REST Countries by name. |
| `get_currency` | REST Countries by currency code. |

Extend by registering new `@mcp.tool` functions; LangGraph picks them up via MCP for the session.

## MCP prompts

Define prompts with `@mcp.prompt` (e.g. `common_prompt`) and load them in the graph builder with `load_mcp_prompt` so product teams can iterate prompts without redeploying graph code (depending on your deployment model).

## LangGraph behavior

1. **chat node** — LLM with bound tools decides the next step.
2. **tool node** — `ToolNode` executes MCP-backed tools.
3. **Conditional edge** — if tools are needed, run tools and return to chat; else **END**.

Compile with a checkpointer (e.g. `MemorySaver()` for development; Postgres/SQLite checkpointers for production) and pass `configurable.thread_id` for conversation-scoped memory.

## Production considerations

- This template adds optional **gate** + **`X-App-Access-Code`** and **slowapi** limits on workflow routes; tighten further (API keys, JWT, mTLS) as needed.
- **Payload size limits** on FastAPI beyond the default.
- **Secrets** via env or a secret manager; never in MCP prompts committed to git.
- **Observability**: structured logs, tracing around MCP and LangGraph steps.
- **Redis** sizing and TTL (`ttl`, `max_events_per_stream`) for MCP event store.
- **LLM timeouts/retries** and cost controls.

## References

- [FastAPI](https://fastapi.tiangolo.com/)
- [LangGraph](https://langchain-ai.github.io/langgraph/)
- [LangChain MCP adapters](https://github.com/langchain-ai/langchain-mcp-adapters)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## License

Specify your license here (e.g. MIT, Apache-2.0, or proprietary).
