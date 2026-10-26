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

Skills live in `.agents/skills/`; the when-to-reach map is `docs/agents/skills.md`, and `ask-matt` routes any unclear situation — the matt vendor only; `docs/agents/skills-map.md` (the rendered two-vendor map) is the bridge for the pstack pack it does not know. Standing flows: scoped idea → `grill-with-docs` → `to-spec` → `to-tickets` → `implement` (one ticket per session, `/clear` between) or `implement-spec` (whole spec at once, integration branch + parallel implementers); foggy multi-session work → `wayfinder` → `to-spec`, never straight to build; raw inbound → `triage`; end of a build session → `retro` (helper-file fixes only, human picks what to keep). PR bodies follow the `pr` skill's shape; `technical-writing` sets their prose.

### Git workflow

Work in one lane: primary (`main`), scoped (`NN-<slug>` per issue), or personal (`personal/<user>/<topic>`, local-only). Make changes reviewable, show the proposed message, and wait for Yes before each commit. Commit approval on a pre-authorized scoped branch carries push approval; `personal/*` is never pushed. See `docs/agents/git-workflow.md`.

### Separate-session handoffs

Suggest a separate session when a work unit can progress independently or the current context is getting crowded. Use context size as one signal, with no fixed token cutoff. Leave starting the session to the human. Use subagents for bounded work the current agent can complete itself.

When suggesting a session, choose the format that best helps the next agent complete the intended outcome. Keep it concise while preserving the goal and key details. Carry forward only relevant context and pointers to useful artifacts. Invoke relevant skills when they help. Use existing handoff or grounding files when useful, and create them only when they add context the prompt cannot carry concisely. Check available context before making assumptions. State what remains uncertain. Ask the human only when uncertainty materially changes the goal or blocks progress.

### Review before approval

Present work for approval through the human's existing review workflow. Keep a concise overview of what changed and what approval covers in the request itself, visible when the human decides. Show small diffs inline. For larger changes, guide the human through the available diff viewer. When no viewer is available, choose a presentation suited to the changes and the human's tools. Give the human a chance to request edits, then update the review before asking again.

### Contributing

No repo `CONTRIBUTING.md` yet — gap to close, rendered from `template/docs/CONTRIBUTING.md.tmpl`. Until it exists, humans start at `docs/agents/git-workflow.md` (lanes + commit gates). Point newcomers there before anything else.

### Reports

Agent-published HTML reports live on GitHub Pages (`reports/<date>-<slug>/` plus an index). To publish or unpublish one, use the `publish-report` skill.
