# Product Requirements Document: Study Coach

| Field | Value |
|--------|--------|
| **Product** | Study Coach |
| **Repository** | fastapi-langgraph-mcp-agent |
| **Version** | 0.1.0 (API as shipped) |
| **Last updated** | 2026-04-04 |

## 1. Vision

Study Coach is a vertical AI platform for **African education**: personalized tutoring aligned with local programmes (initially **Ghana**: GES, JHS/SHS, **WASSCE**, tertiary), **document intelligence** on learner materials, and an architecture aimed at **offline-capable** operation where connectivity is thin. The product positions expert-level academic support as **available 24/7** at lower cost than traditional tutoring, **without replacing teachers**—schools, syllabi, and official bodies remain the source of truth for examinable content and policy.

## 2. Problem statement

- **Access:** Many learners lack affordable, timely one-on-one help outside class hours.
- **Context:** Generic global tutors miss **local curriculum, language, and pathway** nuance (e.g. BECE, WASSCE, TVET, GTEC-linked tertiary choices).
- **Trust & safety:** Learners need guidance that **defers to official sources** and builds **digital literacy** (scams, hoaxes, MoMo safety).
- **Continuity:** Sessions should **resume** across visits (thread memory) with optional **session binding** for shared-device or privacy scenarios.

## 3. Goals and success metrics (suggested)

| Goal | Indicator |
|------|-----------|
| Relevance | Learner satisfaction with “understands my level and programme” (survey / qualitative). |
| Utility | Repeat sessions per learner; threads with multiple turns. |
| Trust | Low rate of escalations over factual/policy claims; explicit citations to verify with school/WAEC/GES where applicable. |
| Reliability | API health (`/health`, `/health/deps`); workflow latency and error budgets under limits. |
| Reach | Uptime and cost per conversation within targets for pilot scale. |

## 4. Users and personas

| Persona | Needs |
|---------|--------|
| **JHS / basic learner** | BECE-oriented study habits, foundational subjects, Ghanaian school context. |
| **SHS learner** | Track-aware help (e.g. science/arts), WASSCE-oriented revision, stress on verifying aggregates/placements yearly. |
| **Tertiary learner** | Programme- and institution-aware support; admissions and GTEC-oriented context without pretending cut-offs are fixed. |
| **Educator / parent** | Classroom-adjacent support, child-safety framing, deferral to school policy. |
| **Integrator / developer** | Stable HTTP API, streaming, document upload, auth hooks (Clerk, access gate). |

## 5. Product scope

### 5.1 In scope (current)

- **Web experience (Next.js 15):** Landing, multi-step **assessment**, **studio** dashboard, **chat** workspace, optional **Clerk** protection when configured.
- **Coach API (FastAPI):** Synchronous and **SSE streaming** workflow, **history** reload, **multipart document upload** with server-side text extraction.
- **Agent stack:** **LangGraph** ReAct loop with **MCP**-sourced tools and **MCP-defined system prompts** (per education **lane**).
- **Lanes:** `general`, `jhs`, `shs`, `tertiary`, `educator`; request may send `agent_lane: auto` to infer from `learner_profile.education_level`.
- **Personalization:** `learner_profile` on first turn of a new thread (education level, SHS track, tertiary institution/programme from assessment, subject, region, goals).
- **Coaching modes:** `full` (default) vs `hints` (shorter, Socratic-style nudges).
- **Memory:** Checkpointed conversations (`thread_id`), SQLite checkpointer by default; **thread registry** optional when `BIND_THREADS_TO_SESSION=true`.
- **Access control:** Optional **gate** (`APP_ACCESS_CODE`, session cookie or `X-App-Access-Code`); **CORS** and rate limits on workflow routes.
- **MCP tools (examples):** Wikipedia summaries, REST Countries, Ghana education/edigital literacy reference material exposed as tools (see server implementation).
- **Truthfulness guardrails:** System-prompt **anti-hallucination addendum** (`trust_safety.py`), optional **verification footer** on each `/workflow` and stream reply, and optional heuristic **risk logging** (`TRUST_SAFETY_LOG_RISK_SIGNALS`)—not a substitute for external fact-checking.
- **Studio coaching UX:** Assessment informs **`learner_profile`**, dashboard starters, and prompt library; structured path/analytics/remediation copy is delivered through **Coach** and prompts rather than a separate insights page.

### 5.2 Out of scope (explicit non-goals for this repo)

- Replacing **WAEC**, **GES**, or any **official syllabus** as authoritative.
- Guaranteed **offline** inference on device (architecture is *aimed* at offline-capable deployments; full offline UX is not specified here).
- Accredited certification or formal proctoring.
- **Guaranteed predictive grades** or **machine-learned exam outcome prediction**—insights are heuristic and disclosure-first.

## 6. Functional requirements

### 6.1 Assessment and onboarding

- **FR-1:** The product SHALL collect learner context (education band, subject focus, region, goals, and where applicable SHS track or tertiary institution/programme) and pass it to the coach on the **first** message of a new `thread_id` as `learner_profile`.
- **FR-2:** The product SHALL support routing to a specialist coach lane from profile or explicit `agent_lane`.

### 6.2 Chat and workflow

- **FR-3:** Clients SHALL send `POST /workflow` with `message`, optional `thread_id`, optional `learner_profile`, `coaching_mode`, and `agent_lane`.
- **FR-4:** Responses SHALL return assistant `reply`, stable `thread_id`, and resolved `agent_lane`.
- **FR-5:** Clients MAY use `POST /workflow/stream` for **SSE** token streaming with terminal `done` (payload includes `thread_id`, `agent_lane`, and full `reply` including verification footer) / `error` events.
- **FR-6:** Clients MAY call `GET /workflow/history?thread_id=…` to restore prior turns for UI rehydration.

### 6.3 Documents

- **FR-7:** Clients SHALL upload documents via `POST /workflow/upload` (multipart: file + optional message, thread, coaching mode, lane, optional `learner_profile_json`). Supported types include common text, office, PDF, HTML, CSV, markdown (see route description).

### 6.4 Security and abuse prevention

- **FR-8:** When `APP_ACCESS_CODE` is set, workflow and related routes SHALL require a valid session from `/gate` or the `X-App-Access-Code` header.
- **FR-9:** Workflow endpoints SHALL be rate-limited per configuration (`WORKFLOW_REQUESTS_PER_MINUTE` pattern).
- **FR-10:** Optional **Clerk**-only API mode SHALL integrate with backend verification as implemented (`CLERK_ONLY_AUTH` and related settings).

### 6.5 Observability and operations

- **FR-11:** The API SHALL expose `GET /health` and `GET /health/deps` for liveness and dependency checks (OpenAI, checkpointer, MCP HTTP).
- **FR-12:** A machine-readable **service map** SHALL be available at `GET /service`.

### 6.6 Learning intelligence (UI)

- **FR-13:** The web app SHALL personalise studio UX using stored **`learner_profile`** (e.g. dashboard starters, prompt library); it NEED NOT provide a dedicated aggregated insights route.
- **FR-14:** Any **analytics-style** or snapshot copy shown in the UI SHALL be **coach-guided** (profile/thread context) and SHALL disclose that it is **not** a statistical prediction of grades or rankings.
- **FR-15:** **Remediation**-style guidance SHOULD be actionable in Coach (e.g. `/studio/chat?prompt=…`); automated scoring remains out of scope.

## 7. Non-functional requirements

| ID | Requirement |
|----|-------------|
| **NFR-1 Performance** | Workflow completes within acceptable latency for interactive chat; streaming improves perceived latency. |
| **NFR-2 Reliability** | Checkpointer durability: conversations survive API restarts when SQLite/Postgres checkpointer is used. |
| **NFR-3 Maintainability** | Prompts live in MCP where possible so product can iterate prompts without always changing graph code. |
| **NFR-4 Security** | Secrets only via environment; session signing key required when gate is enabled. |
| **NFR-5 Scalability** | MCP optional Redis event store for stream limits and persistence at scale. |

## 8. System architecture (summary)

```text
Client (Next.js or API client)
  → FastAPI (/workflow, /workflow/stream, /workflow/upload, /workflow/history)
  → LangGraph ReAct agent (checkpointer + session config)
  → MultiServerMCPClient (HTTP) → FastMCP (/agent) tools + prompts
  → LLM (e.g. OpenAI Chat Completions)
```

- **MCP** centralizes discoverable tools and prompts.
- **LangGraph** orchestrates tool loops and state; `thread_id` scopes memory.

## 9. Key configuration (product-facing)

| Variable | Purpose |
|----------|---------|
| `STUDY_COACH_FRONTEND_URL` | Redirects from legacy API routes to Next.js. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_BASE_URL` | LLM provider configuration. |
| `CHECKPOINT_SQLITE_PATH` | Default checkpoint database path. |
| `APP_ACCESS_CODE` / `SESSION_SECRET` | Access gate. |
| `BIND_THREADS_TO_SESSION` / `THREAD_REGISTRY_DB_PATH` | Thread ownership per session. |
| `CORS_ORIGINS` | Allowed browser origins. |
| Clerk-related | Optional end-user auth for API and frontend. |

## 10. Risks and assumptions

- **Assumption:** Learners and guardians understand the coach is **assistive**; exam and admissions facts MUST be verified with official channels (reflected in MCP context).
- **Risk:** LLM hallucination on grades, dates, and policies → mitigated by prompt design, tools, and UX copy emphasizing verification.
- **Risk:** Cost and quota at scale → needs monitoring, caching, and model-tier strategy outside this document.

## 11. Future considerations (backlog hints)

- Deeper **curriculum-tied** content packs per subject and year.
- Stronger **offline-first** client bundles and sync.
- **Analytics** dashboard for institutions (privacy-preserving).
- Expanded **MCP tool** catalog (e.g. licensed textbooks APIs where available).

---

*This PRD describes the product as implemented in this repository. Update it when ship scope or external compliance requirements change.*
