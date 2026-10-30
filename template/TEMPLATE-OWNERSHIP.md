# Template ownership manifest

Single visible manifest: what the template owns (safe to update) vs what the project owns (never overwritten by `sync-template`). On conflict, project edits always win and the updater waits for an explicit Yes per file.

Template sources live under `template/` in this checkout (`template/docs/`, `template/scripts/`, the `bootstrap`/`adopt`/`sync-template` runners, this manifest, the changelog). Pull updates with `--template <checkout>/template`. Root self-files of this repo (`AGENTS.md`, `CONTEXT.md`, `docs/agents/`, `docs/adr/`, root `skills-lock.json` + `.agents/skills/`) are never synced downstream.

## Template-owned (updater may propose changes, Yes-gated per file)

- `CONTRIBUTING.md` (structure; domain examples render from tokens at bootstrap)
- `docs/agents/` (`domain.md`, `git-workflow.md`, `issue-tracker.md`, `personal-status.md`, `skills-map.md`, `triage-labels.md`)
- `.sandcastle/` runner (`Dockerfile`, `main.mts`, `plan-prompt.md`, `implement-prompt.md`, `review-prompt.md`, `.env.example`, `.gitignore`)
- `package.json` (runner deps; stack declaration renders from STACK_DESC token with VERIFY-TODOs where unknown)
- `skills-lock.json` (pinned upstream-skill manifest; restored via `npx skills@latest experimental_install`, bumps via `npx skills update`) + `.agents/skills/` (upstream set, committed; plus template-owned `brief` + `wrap` + `publish-report` team skills; excluded from wording audit)
- `scripts/build-reports-index.mts` (report index generator for the Pages site)
- `.github/workflows/pages-reports.yml` (stock Pages deploy for the `gh-pages` branch)
- `tsconfig.json` (strict TS config for the rendered `.mts` rails; the template repo dogfoodes a byte-identical copy)
- `docs/knowledge/inbox/INDEX.md` (structure; notes themselves are project-owned)
- `docs/adr/README.md` + `docs/adr/0000-template.md` (seed + blank; numbered decisions are project-owned)
- `scripts/token-audit.mts` (audit tool: unrendered tokens + wording)
- `scripts/lock-preflight.mts` (lock preflight: every `skills-lock.json` pin resolves live upstream, fails loud on dead pins)
- `scripts/sync-template.mts` (updater itself)
- `.gitignore` (root; keeps `.scratch/` local-only)

## Project-owned (updater never overwrites; conflicts surface for explicit Yes, skip by default)

- `AGENTS.md` (project-owned entrypoint; seed-only + notify: seeded once by bootstrap/adopt from `template/docs/AGENTS.md.tmpl` when absent, then released — sync never overwrites, only recreates-if-missing plus a loud NOTICE + diff when the seed changes)
- `CONTEXT.md` terms (glossary entries graduated via domain modeling; adopt creates from the template only when absent, otherwise always protected with no prompt)
- `README.md` (project description; adopt creates from the template only when absent, otherwise always protected with no prompt — adopt docs live in the template-repo README only)
- `docs/adr/NNNN-*.md` numbered decisions (except seed/README above)
- `docs/knowledge/**` (guides, notes, inbox notes — including any Arabic HTML under the single exception)
- `PERSONALIZATION.log.md` (bootstrap/adopt record; append-only — humans and the updater/adopt may append entries, never rewrite history)
- `.template-sync.json` (machine sync record written by bootstrap or adopt: template source, version, inputs; the updater reads it when `--input` is omitted and never overwrites it)
- `.template-receipt.json` (machine sync provenance receipt written by bootstrap, adopt, or sync-template: template version, source commit, sync timestamp, and baseline SHA-256 hashes per template-owned file. Project-owned, updater-maintained — sync-template updates file baselines as they are applied, preserving prior baselines on partial sync)
- Product code (`src/`, `services/`, `apps/`, etc. — adopt and updater never write outside the template-owned list)
- `.env`, `.sandcastle/.env`, `.scratch/` (local-only, never shipped, never updated)
- Any file the team created outside the template-owned list

## Rules

1. The downstream `scripts/sync-template.mts` (synced from `template/sync-template.mts`) classifies every incoming file by this manifest before touching the tree.
2. Clean convergence: destination file matches incoming rendered template — baseline hash advances cleanly.
3. Clean auto-update: destination file matches the recorded receipt baseline hash — updates automatically under `--yes`.
4. Conflict protection: destination file differs from the recorded receipt baseline hash (local customization or diverged unbaselined). Under non-interactive execution (`--yes --non-interactive` or `--non-interactive`), `sync-template` refuses to overwrite diverged files, logs conflict details to stderr, and exits with code 1. In interactive mode, it displays a unified diff and prompts for explicit per-file resolution (`[u]pdate` / `[s]kip` / `[k]eep-both`). No manual `LOCAL-EDIT` comment markers are required — divergence from baseline is detected cryptographically via SHA-256 hashes.
5. Project-owned: never write, even with Yes, unless the human explicitly reclassifies in this manifest first. Exception: `AGENTS.md` seed-only + notify may be created when absent (adopt, plus sync recreate unless `CLAUDE.md` exists) and may print a NOTICE + diff — it is never overwritten when present.
6. `PERSONALIZATION.log.md` is append-only; the updater may append a sync entry, never rewrite history.
7. Legacy baseline adoption: for projects initialized before `.template-receipt.json`, running `sync-template --record-baseline` inspects the project tree without modifying any source or config files. Clean files are baselined with their verified template hash, while customized or unverifiable files are recorded as `diverged-unbaselined`, guaranteeing they remain protected conflicts on subsequent updates.
8. `template/adopt.mts` (template payload only, never copied downstream) installs the same template-owned set additively: missing files are created, differing files are left as conflicts for an interactive per-file Yes, `README.md` + `CONTEXT.md` are always protected, `AGENTS.md` is seed-only + notify (created when absent, NOTICE + diff when the seed differs, never overwritten), `package.json` is the sole structural merge (missing scripts/deps added, existing kept, semver-higher-wins with a report line), reruns skip identical files and re-report conflicts.
