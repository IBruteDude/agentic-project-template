# Publish agent HTML reports via GitHub Pages

Agent session artifacts (static `index.html` folders) publish to a public GitHub Pages site from an orphan `gh-pages` branch (`reports/<yyyy-mm-dd>-<slug>/`), deployed by stock `deploy-pages` Actions, with an explicit `publish`/`unpublish` step. Chosen because it is zero-cost, zero-new-accounts, and ships as template rails so every downstream project inherits it.

## Considered Options

- **Ephemeral artifact upload, no git commit** (`upload-pages-artifact` + deploy): rejected — no revertible history, custom index/unpublish logic, fiddlier agent→Actions handoff.
- **Pages deploy-from-branch, no Actions**: rejected — no build step to regenerate the index, Jekyll interference, least control.
- **External host (Cloudflare/Netlify/R2 direct upload)**: rejected for v1 — instant and private-capable, but needs a new account + token secret per project, violating the zero-new-accounts constraint. Revisit if reports ever need privacy or >10MB payloads.

## Consequences

- Reports are public-safe only; the index at `reports/` enumerates all slugs (accepted per Q9).
- Payload is a static folder with `index.html` entry, ≤10MB, no server code; agent rejects oversize instead of truncating.
- URLs are permanent (`/<date>-<slug>/`, collision-suffixed, no `latest` alias); unpublish deletes the folder and regenerates the index, no tombstones.
- Cost is 1–2 min Pages deploy delay and `gh-pages` branch growth; mechanism lives in `template/` (skill + workflow + index generator) so the repo dogfoods what downstream projects get. `CONTEXT.md` unchanged — downstream projects define what their own "report" means.
