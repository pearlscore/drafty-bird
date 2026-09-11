# AGENTS.md — Pearl SRE Sample App: “Drafty Bird”
You are an autonomous engineering team. Build a small, amusing, *stable* sample app that SRE candidates can deploy and operate.
The candidate should demonstrate IaC/ops chops; they should NOT have to debug flaky app code.

## Prime Directive
1) Plan before code. Write a concise plan in `docs/PLAN.md` and link it from the README.
2) Ship a working app with strong defaults, tests, and reproducible builds.
3) Provide clean operational interfaces: container image, health endpoints, metrics, logs, OpenTelemetry tracing, and optional chaos.
4) Keep scope small. If something is unclear, ask AC early.

## Hard Constraints (from AC)
- **Deploy-neutral**: Do NOT include Terraform/Kubernetes/Helm/etc.
- Deliver **Docker container(s)** and a simple local run path.
- **MIT license**.
- Use mainstream tooling; keep it simple.

## Project Concept
Pearl home-performance theme. A flappy-bird-like game:
- You are a tiny **Draft Detector** flying through a house.
- Obstacles are **leaky ducts / drafty gaps**.
- Score = “comfort points”.

## UX / Gameplay Requirements
- Single-page browser game.
- Controls: Spacebar / click to “flap”.
- Obstacles: scrolling gaps; collision ends run.
- Scoring: increments when passing an obstacle.
- Humor: short Pearl-ish status text every N points.
- Restart button.

## Architecture (keep it simple and robust)
Preferred: **single Node.js TypeScript service** that serves:
- static frontend (React+TS+Vite build output)
- minimal API endpoints

This avoids coordinating multiple services and makes candidate deployment easier.

### Frontend
- React + TypeScript + Vite
- Canvas-based rendering preferred
- Deterministic game loop; testable pure functions for collision/scoring

### Backend/API (in same server)
Must expose:
- `GET /healthz` (liveness)
- `GET /readyz` (readiness)
- `GET /metrics` (Prometheus text format)
- `POST /score` (optional, store run score)
- `GET /leaderboard` (optional)

### Storage
- Optional SQLite for leaderboard persistence.
- Must gracefully fall back to in-memory if SQLite is unavailable.
- If SQLite is implemented, store DB at a configurable path (default inside container, e.g. `/data/db.sqlite`) and document volume mount.

## Observability Requirements
### Logging
- Structured JSON logs to stdout
- Include `request_id` correlation
- Avoid noisy steady-state logs

### Prometheus Metrics
Expose `/metrics` with at least:
- `http_requests_total{route,method,status}`
- `http_request_duration_seconds_bucket`
- `drafty_bird_games_started_total`
- `drafty_bird_games_completed_total`
- `drafty_bird_high_score` (gauge)
- `drafty_bird_chaos_injections_total{type}`

### OpenTelemetry Tracing (REQUIRED)
Instrument the backend with OpenTelemetry:
- HTTP server spans
- custom spans around:
  - score submission
  - leaderboard query
  - chaos injection (if enabled)
Exporters:
- Default: OTLP over HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT` if set
- Otherwise: console exporter in dev
Document env vars in README.

## Chaos Engineering Hooks (REQUIRED, SAFE DEFAULTS)
Chaos must be **OFF by default**.
Enable via env vars; implement deterministically and document clearly.

Implement:
- `CHAOS_ENABLED=true|false` (default false)
- `CHAOS_LATENCY_MS_P50` and `CHAOS_LATENCY_MS_P99` (optional)
- `CHAOS_ERROR_RATE` (0.0–1.0)
- `CHAOS_ROUTES` (comma-separated, default applies only to `/score` and `/leaderboard`)
Behavior:
- When enabled, inject:
  - probabilistic latency
  - probabilistic 5xx errors
Always:
- emit metrics for injections
- log an event when chaos triggers
- add span attributes like `chaos.injected=true`, `chaos.type=latency|error`

## Deliverables
Commit:
1) `LICENSE` (MIT)
2) `README.md` with:
   - what it is + screenshot
   - local dev instructions
   - docker build/run
   - endpoints
   - metrics + OTel instructions
   - chaos controls
   - acceptance checklist
3) `docs/PLAN.md` and `docs/DECISIONS.md`
4) Source:
   - `apps/web` (frontend)
   - `apps/server` (Node TS server serving web + API)
5) `docker/`:
   - Dockerfile
   - compose file for local run (allowed; still deploy-neutral)
6) CI workflow:
   - lint + test + build docker image

## Repo Structure (suggested)
- apps/
  - web/
  - server/
- docker/
- docs/
- .github/workflows/

## Candidate Experience (what we optimize for)
Candidate should be able to:
- take a published container image (or build it)
- deploy to any platform
- add ingress/TLS/DNS, rollout/rollback, autoscaling
- wire metrics/logs/traces to their chosen stack
- define SLOs + alerts + runbooks
without touching app code.

Therefore: do not include IaC. Provide *interfaces* and *docs* only.

## Implementation Standards (senior engineer bar)
- TypeScript, strict mode
- ESLint + Prettier
- Tests:
  - web: unit tests for collision/scoring + smoke test for mounting
  - server: endpoint tests (health/ready/metrics) + chaos behavior tests
- Deterministic builds; lockfiles committed
- Keep dependencies minimal and reputable
- Bun (document exact version in `.bun-version`)

## Step-by-Step Plan (must follow)
### Phase 0 — Plan
- Create `docs/PLAN.md`:
  - architecture diagram (ASCII ok)
  - endpoints
  - data model (leaderboard)
  - metrics list
  - tracing setup
  - chaos design
- Create `docs/DECISIONS.md` (brief ADR bullets)

### Phase 1 — Build App
- Implement game in `apps/web`
- Implement server in `apps/server`:
  - static hosting of web build
  - required endpoints
  - metrics + tracing + chaos
- Web must function even if API is disabled/unreachable

### Phase 2 — Containerize
- Dockerfile builds and runs server, serving web assets
- Provide `docker-compose.yml` for local:
  - app service
  - optional: otel-collector + jaeger (or similar) for tracing demo (keep optional)

### Phase 3 — CI
- GitHub Actions:
  - lint
  - tests
  - docker build

### Phase 4 — Acceptance Checklist
Create `docs/ACCEPTANCE.md` and ensure:
- `bun ci` works cleanly
- `bun run test` passes
- `docker build .` succeeds
- `docker run -p 8080:8080 ...` serves game
- `curl /healthz` ok
- `curl /readyz` ok
- `curl /metrics` includes required metrics
- traces export when `OTEL_EXPORTER_OTLP_ENDPOINT` is set
- chaos does nothing by default; injects when enabled

## Confirmed Defaults (do not ask AC unless deviating)
- Deployment model: **single container**
- Leaderboard: **Top 10 all-time**
- Chaos: **off by default**, enabled via env vars only
- Persistence: optional SQLite with in-memory fallback
- License: MIT

## Branding & Visual Identity (REQUIRED)
The app should loosely reflect Pearl branding. This is *not* a marketing site; keep it tasteful and minimal.

### Colors
Use these as the primary palette. Do not introduce additional colors unless necessary for contrast.

Primary:
- #1C4C75 (deep blue)
- #04B290 (teal/green)

Secondary:
- #FCAF1F (gold)
- #2597EC (light blue)

Tertiary / Neutrals:
- #000000
- #FFFFFF
- #F0F7F9 (very light background)

Suggested usage:
- Backgrounds: #F0F7F9 or #FFFFFF
- Primary UI elements: #1C4C75
- Accents / score / success: #04B290
- Highlights / callouts: #FCAF1F
- Links / motion accents: #2597EC

### Typography
Preferred fonts (in order):
1) **Lato**
2) Brandon Grotesque
3) Trend Sans

Implementation guidance:
- Use **Lato** via Google Fonts (safe, free, easy).
- If Brandon Grotesque or Trend Sans are unavailable/licensed, DO NOT embed them.
- Fall back cleanly: `font-family: Lato, system-ui, -apple-system, sans-serif;`

Typography should be clean, readable, and understated.

### Visual Tone
- Friendly, calm, slightly playful
- Avoid neon, heavy gradients, or gimmicky animations
- Motion should feel “smooth airflow,” not “arcade chaos”

## UI Constraints
- Must be usable on laptop screens without resizing
- No mobile optimization required (optional bonus)
- No audio by default (optional toggle if implemented)

## Accessibility (lightweight)
- Reasonable color contrast
- Keyboard playable (spacebar)
- No flashing or strobing effects
