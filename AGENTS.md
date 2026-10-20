## Agent skills

### Issue tracker

Issues live in GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Using the default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (root `CONTEXT.md` + `docs/adr/`). See `docs/agents/domain.md`.

### Vision grounding

Before planning or reconciling a feature request — in a planning skill (`to-spec`, `to-tickets`, `wayfinder`, `brief`, any grilling skill) or ad-hoc ("should we build X?") — read `docs/VISION.md` first; if the file doesn't exist, skip this rule silently. When it does exist, cite in the reply the sections the feature serves (e.g. `Serves §4 Core loop → Monitoring`) and confirm it is not excluded by `§8 Non-goals and exclusions` or `§10 Egypt-first edge`. If no section fits, write `OUT OF VISION` and ask before continuing. Fires when planning actually starts, not on routine claims of already-planned tickets.

### Engineering skills

Skills live in `.agents/skills/`; the when-to-reach map is `docs/agents/skills.md`, and `ask-matt` routes any unclear situation. Standing flows: scoped idea → `grill-with-docs` → `to-spec` → `to-tickets` → `implement` (one ticket per session, `/clear` between) or `implement-spec` (whole spec at once, integration branch + parallel implementers); foggy multi-session work → `wayfinder` → `to-spec`, never straight to build; raw inbound → `triage`; end of a build session → `retro` (helper-file fixes only, human picks what to keep). PR bodies follow the `pr` skill's shape.

### Git workflow

Work in one lane: primary (`main`), scoped (`NN-<slug>` per issue), or personal (`personal/<user>/<topic>`, local-only). Show diff + message and wait for Yes before every commit; commit approval on a pre-authorized scoped branch carries push approval; `personal/*` is never pushed. See `docs/agents/git-workflow.md`.

### Example prompts for next steps

Hand a next step back to the human as a pasteable block **only when it needs them in the loop**: a decision, an interview, or shaping a separate sub-issue across several turns. If an agent can execute it autonomously — implement a ticket, review a diff, gather research — do not hand it back: do it in this session, or delegate it to a subagent (background where the work allows). When you do emit a block, it must stand alone: the instruction, the read-first list (`AGENTS.md`, `docs/VISION.md` when the step is planning and the repo has one, plus issue number and target branch when they exist), and what done looks like. A sequence of steps goes in one block; independent steps get one block each. Drop the read-first list only when it would be noise. Exempt: work you are about to do yourself in this same session, and handoff documents (written for an agent, not pasted by a human).

### Contributing

No repo `CONTRIBUTING.md` yet — gap to close, rendered from `template/docs/CONTRIBUTING.md.tmpl`. Until it exists, humans start at `docs/agents/git-workflow.md` (lanes + commit gates). Point newcomers there before anything else.

### Reports

Agent-published HTML reports live on GitHub Pages (`reports/<date>-<slug>/` plus an index). To publish or unpublish one, use the `publish-report` skill.
