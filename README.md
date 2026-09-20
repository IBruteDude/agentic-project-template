# Agentic Project Template

A reusable, parameterized full-clone starter for agent-assisted teams: lanes, Yes-gate commits, brief/wrap daily driver, knowledge intake with promotion rules, skills wiring, and a sandboxed runner — rendered for your project by a fire-once wizard, kept fresh by a pull-style updater.

This repo is the template source. It is not a project itself.

## Start a new project (agent-driven)

Setup is a conversation with an agent, not a bare script run. The wizard collects your project's identity and offers no placeholder defaults for it — running `scripts/bootstrap.mts` alone will interrogate you field by field, and skipping answers is not an option. Paste this to your agent:

> Set up a new project from the agentic-project-template. Clone `https://github.com/IBruteDude/agentic-project-template.git`, collect my project name/slug, org, members, and domain one-liner + seed terms (plus team size, learning depth, stack, model id, credential var as needed), run the wizard, restore upstream skills, then walk me through the VERIFY-TODOs and first-issue setup. Before we start, confirm I have `GH_TOKEN` and my model credential ready for `.sandcastle/.env`.

What the agent does with you:

1. Clones the template and collects identity: project name/slug, org, members, domain one-liner + seed terms. All required — interactive runs re-prompt, `--non-interactive` fails loudly on anything missing. Only team size (derived), learning depth, stack, model id (default `opencode/big-pickle`), and credential var (default `OPENCODE_API_KEY`) have defaults.
2. Runs `npx tsx scripts/bootstrap.mts` (or `--input <json>` with the full identity shape). The wizard renders every `docs/template/*.tmpl` and `scripts/template/*` token, copies the `brief`/`wrap` team skills to `.agents/skills/`, writes `PERSONALIZATION.log.md` (human record) plus `.template-sync.json` (machine inputs so later updates never re-ask), runs the token + wording audits, then deletes itself plus `docs/template/` and `scripts/template/` sources.
3. Restores upstream skills: `npx skills@latest experimental_install` from the project root fetches the pinned `.agents/skills/` set from `skills-lock.json` (later bumps via `npx skills update`). Installed skills are committed, not ignored — a fresh clone has working `$brief` on arrival.
4. Copies (never moves) the env template: `cp .sandcastle/.env.example .sandcastle/.env`, then fills `GH_TOKEN` + the model credential. `.env` files are gitignored and never committed — moving would delete the template other teammates need.
5. Gives the new project a clean tree: `rm -rf .git && git init && git add -A && git commit -m "chore: seed from agentic-project-template"`, then creates the real repo/origin. What stays is a clean project plus `scripts/sync-template.mts` (the updater), `scripts/token-audit.mts`, `TEMPLATE-OWNERSHIP.md`, `TEMPLATE-CHANGELOG.md`, and both records — with zero template git history.

## Layout (root stays clean)

- Prose templates: `docs/template/` — `AGENTS`, `CONTRIBUTING`, `CONTEXT`, `docs/agents/*`, knowledge inbox `INDEX`, `docs/adr/` seed.
- Runnable templates: `scripts/template/` — `package.json`, `.sandcastle/*`, `.gitignore`, skills lock, fixtures, audit.
- `scripts/bootstrap.mts` — fire-once wizard (self-deletes). Reruns are not supported; hand-tune after.
- `scripts/sync-template.mts` — pull-style updater (per-file Yes-gate; project-owned never overwritten).
- `scripts/adopt.mts` — one-time adopter for existing projects (additive; per-file Yes on conflicts; glossary + README always protected; manifest-only merge). Stays in this checkout; downstream keeps the updater plus a machine sync record.
- `TEMPLATE-OWNERSHIP.md` — single visible manifest: template-owned vs project-owned.
- `TEMPLATE-CHANGELOG.md` — every release with a human-readable entry; judge before pulling.

## Adopt an existing project

Install the full rails into a lived-in repo in place — no clone-transplant dance. Run from a template checkout against the old repo path (same shape as the updater):

```sh
git clone https://github.com/IBruteDude/agentic-project-template.git /tmp/template
npx tsx /tmp/template/scripts/adopt.mts --downstream ~/projects/old-project
# infer-then-confirm: slug + org from the downstream git remote, name from its
# package manifest (directory-name fallback), members + domain + stack + model
# prompted with fixture defaults; every inferred value shown for confirmation.
# Non-interactive fixture shape:
npx tsx /tmp/template/scripts/adopt.mts --template /tmp/template --downstream /tmp/old-proj \
  --input /tmp/template/scripts/template/fixtures/sample-inputs.json --yes --non-interactive
```

Collision policy (additive by default; full rails only, no subset picker):

- Missing template-owned files are created.
- Existing template-owned files that differ are left as-is and reported as `conflict` for an interactive per-file Yes (`overwrite` or `skip`). `--yes` never overwrites them; it only applies the additive writes (creates + manifest merge + sync record).
- `README.md` and `CONTEXT.md` (glossary) are always protected: created from the template only when absent, otherwise reported untouched with no prompt and kept byte-identical.
- `package.json` is the sole structural merge: missing scripts and dependencies are added, existing entries are kept, dependency version conflicts resolve semver-higher-wins with a report line.
- Anything outside the template-owned list (product code, team-created files, local-only paths) is never written.

Records: human `PERSONALIZATION.log.md` (inputs plus created vs conflicted vs merged vs protected, consistent with bootstrap; created when absent, appended when present) plus machine `.template-sync.json` (template source, version, inputs). Both bootstrap and adopt write it; the updater reads it when `--input` is omitted, so projects pull later releases without re-asking.

Idempotency: reruns are a safe no-op — identical files skip, conflicts re-report, protected stay untouched, the merged manifest skips once applied. Nothing overwrites without an interactive per-file Yes.

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

- Rendered-project audit from fixture inputs in a scratch clone (seam 1): zero `{{TOKENS}}`, wording clean outside vendored skills.
- Updater round-trip from a fixture bump into a diverged sample (seam 2).
- Wording audit by search (seam 3): no academy/school/mission/lesson outside vendored skills and changelog history.
