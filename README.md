# Agentic Project Template (repo)

A reusable, parameterized full-clone starter for agent-assisted teams: lanes, Yes-gate commits, brief/wrap daily driver, knowledge intake with promotion rules, skills wiring, and a sandboxed runner.

Four words, used verbatim (see `CONTEXT.md`):

- **template** — the quarantined payload under `template/` (blueprints + wizard + updater). Start there to adopt or bootstrap: `template/README.md`.
- **repo** — this git repo itself, a dogfooded project with its own glossary (`CONTEXT.md`), decisions (`docs/adr/`), and agent workflows (`docs/agents/`, `AGENTS.md`).
- **project** — a rendered downstream project (bootstrap/adopt output). Each one owns its own glossary.
- **rails** — the conventions the template installs (lanes, Yes-gate, brief/wrap, triage labels, sandboxed runner).

Humans start at `AGENTS.md` (agent entrypoint) and `docs/agents/git-workflow.md` (lanes + commit gates). The template changelog lives at `template/TEMPLATE-CHANGELOG.md` — judge before pulling with `--template <checkout>/template`.
