# Template changelog

Every template release carries a human-readable entry so a downstream team can judge whether an update matters before pulling with `sync-template`. Newest first.

## 0.2.0 — 2026-09-20 — Model auth provider-neutral + fixture bootstrap proof (Part of wellfin#21)

- Wizard + skeleton publish: `bootstrap.mts` renders `docs/template/*.tmpl` + `scripts/template/*` from fixture inputs, writes `PERSONALIZATION.log.md`, runs token + residue + wording audits, then self-deletes plus template sources. Reruns unsupported.
- Model: default `opencode/muse-spark-1.3-contributor-free`. `main.mts` template keeps that default but reads `OPENCODE_MODEL` from env — switching models never needs a code edit.
- `.env.example` template is provider-neutral: `GH_TOKEN` (required, gh inside sandbox) + `OPENCODE_MODEL` (required) + `{{CREDENTIAL_VAR}}` slot for whatever credential the chosen model needs. Claude OAuth (`CLAUDE_CODE_OAUTH_TOKEN`) and Anthropic key (`ANTHROPIC_API_KEY`) remain only as documented commented examples. Contributing setup template reworded to match: fill `GH_TOKEN` and the credential for your `OPENCODE_MODEL`.
- Wizard captures model id + credential-var name as free-text inputs (same free-text + VERIFY-TODO treatment as stack). Known-good default model is Muse Spark 1.3 Contributor Free.
- Credential-var answer (best-effort, recorded here): outside this harness, Muse Spark via opencode uses OpenCode Zen auth — run `opencode providers login` (stores in `~/.local/share/opencode/auth.json`, type `api`), or set `OPENCODE_API_KEY` in the environment for headless/CI. No separate `ANTHROPIC_*`/`CLAUDE_*` key is required for `opencode/muse-spark-*`. The wizard therefore defaults `CREDENTIAL_VAR` to `OPENCODE_API_KEY` with a VERIFY-TODO to confirm `opencode providers login` on the host, and keeps Claude vars only as commented examples. If your site uses a different Zen key name, set `{{CREDENTIAL_VAR}}` at bootstrap; no code change needed.
- Tokens: `{{PROJECT_NAME}}` `{{PROJECT_SLUG}}` `{{GITHUB_ORG}}` `{{MEMBER_LIST}}` `{{MEMBER_PIPE}}` `{{DOMAIN_ONELINER}}` `{{DOMAIN_SEED_TERMS}}` `{{STACK_DESC}}` `{{MODEL_ID}}` `{{CREDENTIAL_VAR}}` `{{LEARNING_DEPTH}}` `{{V1_SCOPE}}`. Team size goes to the log only.
- Hard-excludes respected: `.env`, `.scratch/` content, `node_modules/`, `.sandcastle/logs|worktrees/`, secrets, product code never ship; only `.env.example` + `.gitignore` seeds.
- Arabic exception intact in Contributing template: human-facing guide/reference HTML under `docs/knowledge/` may carry Arabic; everything else English.
- Fixture proof (scratch clone, `scripts/template/fixtures/sample-inputs.json`): rendered sample passes token audit (0 `{{...}}`), residue audit (0 wellfin/fintech/EGP/Egypt/member/model-old strings), wording audit clean outside vendored skills. `PERSONALIZATION.log.md` present, `bootstrap.mts` + `docs/template/` + `scripts/template/` sources removed.

## 0.1.0 — 2026-09-20 — Skeleton with tokens, hard-excludes, ownership manifest

- Public template repo born neutral (rename-first-then-extract: knowledge/guide/note vocabulary already landed upstream).
- `docs/template/` (prose) + `scripts/template/` (runnables) hold tokenized full-clone scaffolding; root stays clean.
- `TEMPLATE-OWNERSHIP.md` declares template-owned vs project-owned; project edits always win, updater Yes-gates per file.
