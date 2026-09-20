# Template ownership manifest

Single visible manifest: what the template owns (safe to update) vs what the project owns (never overwritten by `sync-template`). On conflict, project edits always win and the updater waits for an explicit Yes per file.

## Template-owned (updater may propose changes, Yes-gated per file)

- `AGENTS.md`
- `CONTRIBUTING.md` (structure; domain examples render from tokens at bootstrap)
- `docs/agents/` (`domain.md`, `git-workflow.md`, `issue-tracker.md`, `personal-status.md`, `triage-labels.md`)
- `.sandcastle/` runner (`Dockerfile`, `main.mts`, `plan-prompt.md`, `implement-prompt.md`, `review-prompt.md`, `.env.example`, `.gitignore`)
- `package.json` (runner deps; stack declaration renders from STACK_DESC token with VERIFY-TODOs where unknown)
- `skills-lock.json` + `.agents/skills/` wiring (vendored upstream skills; excluded from wording audit)
- `docs/knowledge/inbox/INDEX.md` (structure; notes themselves are project-owned)
- `docs/adr/README.md` + `docs/adr/0000-template.md` (seed + blank; numbered decisions are project-owned)
- `scripts/token-audit.mts` (audit tool)
- `sync-template.mts` (updater itself)
- `.gitignore` (root; keeps `.scratch/` local-only)

## Project-owned (updater never overwrites; conflicts surface for explicit Yes, skip by default)

- `CONTEXT.md` terms (glossary entries graduated via domain modeling)
- `docs/adr/NNNN-*.md` numbered decisions (except seed/README above)
- `docs/knowledge/**` (guides, notes, inbox notes — including any Arabic HTML under the single exception)
- `PERSONALIZATION.log.md` (bootstrap record; append-only by humans)
- Product code (`src/`, `services/`, `apps/`, etc.)
- `.env`, `.sandcastle/.env`, `.scratch/` (local-only, never shipped, never updated)
- Any file the team created outside the template-owned list

## Rules

1. `sync-template` classifies every incoming file by this manifest before touching the tree.
2. Template-owned + clean (unmodified since bootstrap or last sync): update automatically after Yes.
3. Template-owned + locally modified: show diff, wait for explicit per-file Yes (update / skip / keep-both).
4. Project-owned: never write, even with Yes, unless the human explicitly reclassifies in this manifest first.
5. `PERSONALIZATION.log.md` is append-only; the updater may append a sync entry, never rewrite history.
