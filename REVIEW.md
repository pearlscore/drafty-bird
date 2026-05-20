# PR Review Guide — drafty-bird

Configures Anthropic's Code Review for this repo. Pearl's universal engineering rules live in [`pearlscore/coding-agent-skills/rules/`](https://github.com/pearlscore/coding-agent-skills/tree/main/rules); the contents below extend them.

## About this repo

`drafty-bird` is a deliberately small, deploy-neutral sample app used to evaluate SRE candidates. Stability of operational patterns matters more than feature velocity; drift from the patterns in `AGENTS.md` (health endpoints, structured logs, OTel spans, metric naming) is a higher-severity finding here than in most repos.

Stack: Node.js + TypeScript + Express, Prometheus metrics, OpenTelemetry, pino structured logs, optional SQLite leaderboard with in-memory fallback. Vitest + Testing Library + Supertest.

Public repo: apparent secrets in a commit are `[BLOCK]` (exposed forever).

## Rules to apply

Pearl's universal engineering rules apply first:

- [`global-rules.md`](https://github.com/pearlscore/coding-agent-skills/blob/main/rules/global-rules.md) for language conventions and naming.
- [`pearl-domain.md`](https://github.com/pearlscore/coding-agent-skills/blob/main/rules/pearl-domain.md) for Pearl data conventions (`lat`/`lon`, ZIPs, money, timestamps, IDs).

Repo-specific rules below extend these.

## Discipline calibration

**Balanced.** Bug-class findings (correctness, security, broken operational contracts) at natural severity. Style and functional-discipline items as `[NIT]`. Pattern drift from `AGENTS.md` operational requirements as `[WARN]`.

## Repo-specific rubric

### Operability / SRE

- **Health endpoint semantics:** `/healthz` and `/readyz` should stay semantically correct (liveness vs readiness). Conflation is `[WARN]`.
- **Metric naming and cardinality:** new Prometheus metrics match the existing `drafty_bird_*` naming. Labels with unbounded values (user IDs, request IDs, free-form strings) are `[WARN]`.
- **`request_id` propagation:** new log statements in request scope include `request_id`. Plain `console.log` in request scope is `[WARN]`; outside, `[NIT]`.
- **OpenTelemetry spans:** new operations identified in `AGENTS.md` as needing custom spans (score submission, leaderboard query, chaos injection) should add them.
- **Chaos opt-in:** changes near chaos-injection preserve the off-by-default contract.
- **SQLite fallback:** in-memory fallback must continue to work. Hard-fail on missing SQLite is `[WARN]`.

## Output format

Post a single PR comment. Use `[BLOCK]` / `[WARN]` / `[NIT]` tags. Cite `file:line`. End with one of:

- **READY TO PUSH** (default; only `[BLOCK]` blocks merge).
- **REQUEST CHANGES** (at least one `[BLOCK]`).
- **NEEDS DISCUSSION** (architectural tradeoff worth a second opinion).

Prefix the comment with `🤖 Pearl PR Review` so future passes recognize prior automated reviews.

## Constraints

- Don't fix. Surface findings; the author decides.
- Don't praise the diff or summarize what it does.
- House style: no em dashes; no AI vocab tells (delve, leverage, navigate, robust, seamless, harness, myriad, crucial, moreover, whilst, etc.).
- Pearl brand: never call Pearl an inspection; never use "defect" / "flaw" / "problem" about Pearl's output. SCORE = Safety, Comfort, Operations, Resilience, Energy.
- When in doubt, skip. Three `[NIT]`s is normal; ten means the bar is too low.
- Don't re-raise findings the author already deferred (skip/defer/wontfix/thumbs-down in prior comments).
- Don't re-evaluate prior automated reviews (recognizable by the `🤖 Pearl PR Review` prefix).
- Surface patterns not covered here or in `coding-agent-skills/rules/` with `🆕 New rubric candidate:`.
