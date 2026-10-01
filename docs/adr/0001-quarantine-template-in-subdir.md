# Quarantine the template in `template/` and dogfood the rails at root

The repo was the template: `docs/` held only downstream blueprints, skills were installed but untracked, and tracking used default GitHub labels. We quarantine the whole template under `template/` and run this repo as a dogfooded project at root (own `CONTEXT.md`, `docs/adr/`, `docs/agents/`, committed skills, closed label set).

## Considered Options

- **Split repos** (template-source vs template-dev): two remotes/trackers, double maintenance. Rejected: one backlog proves the workflow.
- **Shim paths for one release** (old `scripts/` + `docs/template/` forwarding to `template/`): less breakage but two truths and double audit surface. Rejected: big-bang 0.8.0 with fixture proof instead.
- **Scattered seam** (root + `docs/template/` + `scripts/template/` with a manifest drawing the line): keeps paths stable but preserves the friction — no independent self-docs, skills and tracking stay ambiguous. Rejected: the complaint that started this.

## Consequences

Updater pulls become `--template <checkout>/template`; documented `npx tsx scripts/*` prompts become `npx tsx template/*`; existing downstream checkouts (e.g. wellfin) migrate on their next pull with a one-line command change. Root self-files (`AGENTS.md`, `CONTEXT.md`, `docs/agents/`, `docs/adr/`) are never synced downstream; the two `skills-lock.json` files evolve independently.
