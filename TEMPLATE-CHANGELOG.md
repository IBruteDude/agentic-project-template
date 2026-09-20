# Template changelog

Every template release carries a human-readable entry so a downstream team can judge whether an update matters before pulling with `scripts/sync-template.mts`. Newest first.

## 0.6.0 — 2026-09-20 — Skills provenance: brief/wrap rails + upstream install story

- `brief` + `wrap` are real template-owned rails now: byte-identical copies live at `scripts/template/skills/brief|wrap/`, render verbatim to downstream `.agents/skills/brief|wrap` via bootstrap/adopt, and sync like any template-owned file. The daily driver `CONTRIBUTING.md` promises finally exists in every fresh project.
- Upstream skills need no hand-rolled installer: setup runs `npx skills@latest experimental_install` (restores `.agents/skills/` from the pinned `skills-lock.json`), later bumps via `npx skills update`. Documented in the README agent flow with a manual fallback in `CONTRIBUTING.md` first-day setup.
- Installed skills are committed, not ignored — a fresh clone has working `$brief` on arrival; updates flow through the Yes-gated updater.
- Existing projects (wellfin included — treated as any other downstream) get the installer docs plus brief/wrap records via adopt/sync; already-present identical skill files skip.
- Fixture proof (scratch, 2026-09-20): fixture bootstrap renders 27 files (23 + 4 skill files), token-audit PASS (0 tokens, wording clean), wizard + template sources self-deleted, `.template-sync.json` present.

## 0.5.0 — 2026-09-20 — Clean-room setup: purge, scripts layout, agent-driven bootstrap

- History restarted here: earlier entries referenced the template's source project and are gone. New projects seeded from this version carry no source-project history.
- No source-project blocklists anywhere: the old residue lists (project name, collaborator handles, domain words, old model id) are deleted from `scripts/bootstrap.mts`, `scripts/adopt.mts`, and the rendered `scripts/token-audit.mts`. Audits check unrendered `{{TOKENS}}` + wording only.
- Layout: `bootstrap.mts`, `adopt.mts`, `sync-template.mts` moved from the repo root to `scripts/` (assumed to have always lived there; no shims). All docs, `package.json` scripts, audit skip-lists, and the updater's META sync follow the new paths. Downstream keeps the updater at `scripts/sync-template.mts`.
- Agent-driven bootstrap: the README's canonical path is a paste-to-agent prompt. Identity inputs (name, slug, org, members, domain) have no placeholder defaults — interactive runs re-prompt, non-interactive runs fail loudly instead of rendering placeholders. Only team size (derived), learning depth, stack, model, and credential var keep defaults.
- Default model is now `opencode/big-pickle` (wizard default, fixture, `.env.example` comment). Credential default stays `OPENCODE_API_KEY`.
- Machine sync record for every project: `scripts/bootstrap.mts` now writes `.template-sync.json` (`{template, version, inputs}`), same shape as adopt. Both writers read the version from the top `## X.Y.Z` line of this changelog, so they can never disagree; `sync-template` reads the record when `--input` is omitted.
- Env setup is copy-only: every doc and log says `cp .sandcastle/.env.example .sandcastle/.env` (never move), and the rendered root `.gitignore` now ignores `.env` plus `.sandcastle/.env`.
- Clean tree: after bootstrap the README instructs `rm -rf .git && git init` plus a fresh initial commit, so the new project starts with no template history. Later releases pull via an explicit `--template <checkout>` path.
- Fixture proof (scratch, 2026-09-20): fixture bootstrap renders 23 files, token-audit PASS (0 tokens, wording clean), wizard + template sources self-deleted, `.template-sync.json` present. Updater no-op round-trip: identical files skip, protected untouched.
