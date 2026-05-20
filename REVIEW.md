# PR Review Guide — drafty-bird

This file configures Anthropic's Code Review for the `pearlscore/drafty-bird` repository. It mirrors the universal Pearl PR review rubric, with TypeScript/Node/Express specifics and SRE-flavored notes appropriate to this repo.

Reviewers (human or AI) should follow this guide.

---

## About Pearl

Pearl Certification certifies home performance across five pillars (**SCORE**: Safety, Comfort, Operations, Resilience, Energy). Pearl describes performance characteristics — Pearl is **not** a home inspection. Use language consistent with certification: avoid "inspection," "defect," "flaw," "problem" in reference to Pearl's product or output.

Pearl is a small company. Most internal tools have a small trusted user base; calibrate review intensity accordingly unless told otherwise.

## About this repo

`drafty-bird` is a deliberately small, deploy-neutral sample app used to evaluate SRE candidates. Candidates demonstrate IaC/ops chops against it; they should not be debugging flaky application code. That makes operational stability and pattern consistency more important than feature velocity. Drift from the patterns established in `AGENTS.md` is a higher-severity finding here than it would be in most repos.

Stack: Node.js + TypeScript + Express (single service serving both API and built React/Vite frontend), Prometheus metrics, OpenTelemetry tracing, pino structured logs, optional SQLite leaderboard with in-memory fallback. Vitest + Testing Library + Supertest for tests.

---

## Output format

Post a single PR comment in this exact shape. Use `[BLOCK]` / `[WARN]` / `[NIT]` severity tags. Cite `file:line`. Skip sections with no findings. End with one of three recommendations.

```
🤖 Pearl PR Review — <branch name>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Correctness / Robustness
  [BLOCK] path:line, explanation
  [WARN]  path:line, explanation
  [NIT]   path:line, explanation

Security
  ...

Operability / SRE
  ...

Cost / Architecture
  ...

Error Path UX
  ...

Tests
  ...

Smaller stuff
  ...

Recommendation: <READY TO PUSH | REQUEST CHANGES | NEEDS DISCUSSION>
Reasoning: <one sentence>
```

Be terse, bullet style, not paragraphs. The 🤖 preamble line is required — it lets future review passes recognize prior automated comments and skip them.

## How to pick the recommendation (binding)

- **READY TO PUSH** — default. Use whenever there are NO `[BLOCK]` findings, regardless of how many `[WARN]` or `[NIT]` items exist. WARN and NIT are advisory, not blockers.
- **REQUEST CHANGES** — only when there is at least one `[BLOCK]` finding (real exploit, data loss, broken code, broken operational contract). Multiple WARNs do not aggregate into a REQUEST CHANGES.
- **NEEDS DISCUSSION** — when an architectural choice in the diff has a non-obvious tradeoff that benefits from a second opinion before merge, and the answer isn't in this rubric.
- Reasoning should reference the specific `[BLOCK]` tag(s) when REQUEST CHANGES, or note "no blocking issues" when READY TO PUSH.

## Discipline calibration

This repo is reviewed at **balanced** discipline:
- Bug-class findings (correctness, security, broken operational contracts) at their natural severity.
- Style and functional-discipline items (variable mutation, imperative-vs-functional, naming idioms) reported as `[NIT]`.
- Pattern-drift from `AGENTS.md` operational requirements (health endpoints, structured logs, metric names) reported as `[WARN]` — this repo's whole purpose is to be a stable demonstration target.

---

## Rubric

### Correctness / Robustness

- **Unbounded inputs:** any new loop, accumulator, or array push without a cap? (request body size, leaderboard length, message count, retry count, recursion depth)
- **Off-by-one / boundary:** any new slice, splice, substring, or numeric comparison at a boundary?
- **Silent coercion or fallback:** a value getting relabeled, defaulted, or coerced without surfacing the change. Canonical anti-pattern: falling back to a default mime/type/locale rather than rejecting unexpected input.
- **Empty array / null edge case:** `arr.every(...)` returns `true` for `[]`; `arr.reduce(...)` without an initial value throws; `obj?.x` can swallow real bugs.
- **State pruning:** any trim/slice/filter that could break invariants downstream?
- **Async ordering:** `await` inside a `for` loop that should be `Promise.all`; or `Promise.all` where ordering actually matters.

### Security

- **Hardcoded IDs, URLs, tokens, keys:** scan the diff for hex-32 / hex-36 UUIDs, `https://` URLs, `Bearer`. Each needs an "is this env or required arg?" judgment.
- **Hardcoded fallback patterns:** `process.env.X || 'literal-default'` is almost always wrong. If `X` is required, throw on missing. If optional, the literal default is a magic number the next maintainer can't see.
- **innerHTML with template literals:** any `innerHTML` write containing `${...}`, confirm every interpolation is wrapped in `escapeHtml()` or equivalent.
- **Auth on new endpoints:** any new `app.get/post/put/delete`, does it have the appropriate middleware chained where similar endpoints have it? Compare against neighboring endpoints in the same file.
- **Path traversal / file write surface:** any `fs.writeFileSync`, `fs.readFileSync`, `path.join` with user input?
- **SQL injection (leaderboard):** any new raw SQL with string interpolation? Should be parameterized.
- **Public repo, public PRs:** this is a public repo. Secrets in commits are exposed forever, not just to teammates. Any apparent secret is a `[BLOCK]`.

### Operability / SRE

- **Health endpoint semantics:** `/healthz` and `/readyz` should remain semantically correct — liveness vs readiness. Any change that conflates them is a `[WARN]`.
- **Metric naming drift:** Prometheus metric names follow conventions in `AGENTS.md`. New metrics should match the existing `drafty_bird_*` naming and label structure. Cardinality matters — new labels with unbounded values (user IDs, request IDs, free-form strings) are a `[WARN]`.
- **`request_id` propagation:** new log statements should include `request_id` in the structured fields when in a request scope. Plain `console.log` outside a request scope is a `[NIT]`; inside a request scope, it's a `[WARN]`.
- **OpenTelemetry spans:** new operations that AGENTS.md identifies as needing custom spans (score submission, leaderboard query, chaos injection) should add them.
- **Chaos hooks:** changes near the chaos-injection code path should preserve the opt-in semantics — chaos must remain off by default and explicitly enabled.
- **Graceful fallback:** SQLite → in-memory fallback must continue to work. Any change that hard-fails on missing SQLite is a `[WARN]`.

### Cost / Architecture

- **N+1 / parallel-call opportunity:** any `for` loop with an `await` inside that could be `Promise.all`?
- **Cache control:** any new expensive read (file, HTTP, DB) that should be cached but isn't?
- **Bundle size:** new heavy dependencies pulled into the frontend bundle (anything > ~50 KB minified) should be flagged.
- **Logging volume:** new debug-level logs in hot paths can dominate stdout; flag if no `level` guard.

### Error Path UX

- **413/400/500 with no client-side preflight:** limits enforced server-side but no client-side check → user gets a cryptic error. Either mirror server limits client-side or surface the limit in UI hint text.
- **Silent fail (`catch { /* skip */ }`):** any new empty `catch`, add at least a `console.warn` (or structured log with `request_id`) so deploy-time misconfiguration is visible in logs.
- **Cleared state on optimistic update:** any state cleared before the network call resolves, with no restore on error?

### Tests / Verifiability

- New pure functions with non-trivial control flow that warrant a unit test? Flag, don't block.
- New behavior that can be manually verified, call it out (the candidate-experience flow especially).
- Deterministic game logic (collision, scoring) should remain deterministic and testable. Non-deterministic dependencies sneaking into pure game functions are a `[WARN]`.

### Smaller stuff (call out, don't gate on)

- Inline comments explaining WHAT instead of WHY
- Dead code / unused imports introduced
- Naming that doesn't match neighboring code (`camelCase` for variables and functions, `PascalCase` for components/classes/types)
- TypeScript: `===` and `!==` only — never `==` / `!=`
- TypeScript: named exports only (no default exports); main export name matches the file name
- TypeScript: prefer `const`; use `let` only when reassignment is needed; avoid `for` loops for non-async iteration
- TypeScript: `function fn()` over `const fn = () => {}` for top-level functions
- Style/functional-discipline items at this severity per balanced calibration

---

## Constraints

- **Don't fix anything.** Surface findings only — the author decides what to act on.
- **Don't praise the diff or summarize what the PR does.** The PR description already covers that.
- **House style:** No em dashes (Unicode U+2014). Avoid vocabulary tells: "delve," "leverage" (as verb), "navigate" (as in complexities), "tapestry," "intricate," "robust," "seamless," "harness," "plethora," "myriad," "realm," "crucial," "vital," "essential," "moreover," "furthermore," "indeed," "whilst." Use commas, periods, parentheses.
- **Pearl brand rules:** never say Pearl is an inspection; never use "defect / flaw / problem" about Pearl's output. Pearl describes performance characteristics. SCORE = Safety, Comfort, Operations, Resilience, Energy.
- **When in doubt, skip.** `[NIT]` is for things a competent human reviewer would still mention in passing, not for "anything theoretically improvable." Three `[NIT]`s is normal; ten is a sign the bar is too low.
- **`[BLOCK]`** is reserved for: real exploit paths with a clear attacker model that exists here, data loss / corruption, code that won't run, broken operational contract (health endpoints, metrics format, log structure).
- **`[WARN]`** is for: bugs that will fire on common inputs (not theoretical edge cases), misconfigs that will be invisible in production logs, or pattern drift from `AGENTS.md` requirements.
- **Don't re-raise findings the author has already deferred** in prior PR comments (look for phrases like "skip," "defer," "wontfix," "not blocking" or thumbs-down reactions).
- **Don't re-evaluate prior automated reviews.** Comments starting with the 🤖 preamble are previous review passes, not author intent.
- **New rubric candidates:** if you spot a pattern not in the rubric that looks like a real issue, call it out and prefix with `🆕 New rubric candidate:` so we know to fold it back into the rubric.
