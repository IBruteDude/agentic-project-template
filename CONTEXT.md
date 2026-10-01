# Agentic Project Template (repo glossary)

The dogfooded project that builds and ships the template. Single-context: this file is the glossary, `docs/adr/` holds hard-to-reverse decisions.

## Language

**template**:
The quarantined payload under `template/` — blueprints, wizard, adopter, updater, and its own changelog — that renders a downstream project.
_Avoid_: repo, project, rails, template repo

**repo**:
This git repo itself as a dogfooded project, with its own `CONTEXT.md`, `docs/adr/`, issues, and labels.
_Avoid_: template, project, downstream

**project**:
A rendered downstream project produced by bootstrap or adopt from the template. Each one owns its own glossary.
_Avoid_: template, repo, downstream repo

**rails**:
The conventions the template installs: lanes, Yes-gate commits, brief/wrap driver, knowledge intake with promotion, skills wiring, sandboxed runner, closed triage labels.
_Avoid_: template, tooling, workflow
