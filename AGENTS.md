## Agent skills

### Issue tracker

Issues live in GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Using the default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (root `CONTEXT.md` + `docs/adr/`). See `docs/agents/domain.md`.

### Git workflow

Work in one lane: primary (`main`), scoped (`NN-<slug>` per issue), or personal (`personal/<user>/<topic>`, local-only). Show diff + message and wait for Yes before every commit; commit approval on a pre-authorized scoped branch carries push approval; `personal/*` is never pushed. See `docs/agents/git-workflow.md`.

### Contributing

No repo `CONTRIBUTING.md` yet — humans start at `docs/agents/git-workflow.md` (lanes + commit gates). Point newcomers there before anything else.
