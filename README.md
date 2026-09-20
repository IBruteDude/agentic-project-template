# Agentic Project Template

A reusable, parameterized full-clone starter for agent-assisted teams: lanes, Yes-gate commits, brief/wrap daily driver, knowledge intake with promotion rules, skills wiring, and a sandboxed runner — rendered for your project by a fire-once wizard, kept fresh by a pull-style updater.

This repo is the template source. It is not a project itself. To start a project: clone, run the wizard once, get a clean project root with no template machinery left except the updater.

## Start a new project

```sh
git clone https://github.com/IBruteDude/agentic-project-template.git my-project
cd my-project
npx tsx bootstrap.mts
# answer: project name/slug, org, members, domain one-liner + seed terms,
# team size, learning depth (guided | intake-only), stack (free text),
# model id (default opencode/muse-spark-1.3-contributor-free), credential var
```

The wizard renders every `docs/template/*.tmpl` and `scripts/template/*` token, writes `PERSONALIZATION.log.md`, runs the token + residue + wording audits, then deletes itself plus `docs/template/` and `scripts/template/` sources. What stays is a clean project plus `sync-template.mts` (the updater, added in #22) and `scripts/token-audit.mts`.

## Layout (root stays clean)

- Prose templates: `docs/template/` — `AGENTS`, `CONTRIBUTING`, `CONTEXT`, `docs/agents/*`, knowledge inbox `INDEX`, `docs/adr/` seed.
- Runnable templates: `scripts/template/` — `package.json`, `.sandcastle/*`, `.gitignore`, skills lock, fixtures, audit.
- `bootstrap.mts` — fire-once wizard (self-deletes). Reruns are not supported; hand-tune after.
- `sync-template.mts` — pull-style updater (per-file Yes-gate; project-owned never overwritten). Added in #22.
- `TEMPLATE-OWNERSHIP.md` — single visible manifest: template-owned vs project-owned.
- `TEMPLATE-CHANGELOG.md` — every release with a human-readable entry; judge before pulling.

## Tokens

`{{PROJECT_NAME}}` `{{PROJECT_SLUG}}` `{{GITHUB_ORG}}` `{{MEMBER_LIST}}` `{{MEMBER_PIPE}}` `{{DOMAIN_ONELINER}}` `{{DOMAIN_SEED_TERMS}}` `{{STACK_DESC}}` `{{MODEL_ID}}` `{{CREDENTIAL_VAR}}` `{{LEARNING_DEPTH}}` `{{V1_SCOPE}}`

Team size goes to the personalization log only. Stack and model credential are free-text with explicit `VERIFY-TODO` markers where unknown — non-Node teams are guided, not blocked.

## Hard-excludes (never ship)

`.env`, `.scratch/` content, `node_modules/`, `.sandcastle/logs/`, `.sandcastle/worktrees/`, secrets/tokens, product code (`src/`, `services/`, `apps/`). Only `.env.example`, `.gitignore` entries, and empty-zone seeds ship.

## Language rule (Arabic exception intact)

Everything recorded stays English. Sole exception: human-facing guide/reference HTML under `docs/knowledge/` may carry Arabic. This survives rendering unchanged.

## Tracker

GitHub Issues with the closed label set (`wayfinder:map`, `wayfinder:research|prototype|grilling|task`, `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). No new labels without approval.

## Verification

- Rendered-project audit from fixture inputs in a scratch clone (seam 1): zero `{{TOKENS}}`, zero residue, wording clean outside vendored skills.
- Updater round-trip from a fixture bump into a diverged sample (seam 2, #22).
- Wording audit by search (seam 3): no academy/school/mission/lesson outside vendored skills and changelog history.
