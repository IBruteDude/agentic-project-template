# Engineering skills: when to reach for which flow

The skills live in `.agents/skills/`. `ask-matt` is the router — any situation you can't name, ask it. This file is the when-to-reach map for the flows this repo runs; it describes *when* to reach for each, never duplicates the `SKILL.md` files.

## The standing flows

| Situation | Reach for | Notes |
|---|---|---|
| Raw inbound issue or external PR | `triage` | Categorise → verify → agent-ready brief; output is ready to claim |
| Scoped idea worth building | `grill-with-docs` | Interview + writes ADRs/glossary as it goes |
| Where a session is going next, unclear | `ask-matt` | Canonical router over all skills |
| Plan the build | `to-spec` | No interview; synthesizes the agreed chat into a spec, publishes to tracker |
| Break a spec into work | `to-tickets` | Tracer-bullet tickets, blocking edges as native dependencies; output is agent-ready, never re-triage it |
| Build one ticket | `implement` | One ticket per session, `/clear` between; scoped branch `NN-<slug>`; drives `tdd` at the seams, buffs with `prototype`/`diagnosing-bugs`/`code-review`, Yes-gate commit |
| Build a whole spec | `implement-spec` | You'd rather orchestrate than drive: integration branch, parallel implementers on the ready frontier in own worktrees, draft PR after first merge, one final `code-review` |
| Foggy work spanning multiple sessions | `wayfinder` → `to-spec` | Charts a `wayfinder:map` of decision tickets, resolves the frontier, then hands to `to-spec` → `to-tickets`; never straight to build |
| End of a build session | `retro` | Same chat, before `/clear`: worst-first fixes to helper files only (pointers, checks, standards, steering cuts, tool economy); human picks what to keep; nothing auto-applies |
| Human-only step blocks the work | `wizard` | Interactive bash walk-through: bootstrap/adopt identity, `GH_TOKEN` + model key into `.sandcastle/.env`, CI secrets via `gh secret`. Filled runs stay local and get deleted after use; the stage-engine shape lives in the template |
| Writing a PR body | `pr` | `Summary` carries a visual (tree/diff-sketch/Mermaid), `Evidence` is Before/After (screenshot S-tier, test output A-tier), `Merge Danger` is one-way/two-way door + one-word blast radius, in `CONTEXT.md` domain language |
| Reviewing changes since a fixed point | `code-review` | Standards + spec in parallel sub-agents |

## Locked boundaries

- **`implement` vs `implement-spec`**: single ticket → `implement` on its own scoped branch; whole spec → `implement-spec` on one integration branch. Reach for `implement-spec` only when you'd rather orchestrate than drive.
- **`wayfinder` gate**: it hands off to `to-spec` → `to-tickets` → build; going map → build throws the detail away. Never for a well-scoped feature — that's `grill-with-docs`.
- **`retro`**: helper files only — the product code stays untouched; that's what `improve-codebase-architecture` is for.
- **`wizard`**: agent does anything it can itself; a wizard exists only for steps only the human can perform. Shape in template, filled runs local to the repo, deleted after use.
- **`to-tickets`**: tracer-bullet vertical slices with blocking edges; the frontier is unblocked + unassigned. No triage pass on its output.
- **No commit matrix**: a long-lived per-skill benefit matrix goes stale; gains live in `ask-matt` + the skills themselves. Docs here only ever say when to reach for which flow.

## Model-invoked vs you-typed

Of the 27 skills, 16 are you-typed only (`disable-model-invocation`). The agent fires the rest on their triggers: `grilling` (stress-test), `tdd` (test-first), `prototype` (design question), `code-review` (review-since), `diagnosing-bugs` (hard bug), `research` (unknown fact), `codebase-design`/`domain-modeling` (design vocabulary, fuzzy terms), `pr` (writing a PR), `wizard` (human-only step), `writing-for-agents` (agent-facing docs).
