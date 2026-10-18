---
name: publish-report
description: Publish or unpublish a static HTML report folder on GitHub Pages at a stable dated URL with an index entry. Fires when the human asks to publish or unpublish a report.
---

A report is a static folder whose entry is `index.html`. Publishing commits it to the orphan `gh-pages` branch under `reports/<date>-<slug>/` (`<slug>` below always means the full dated directory name); a stock Pages workflow deploys it. Unpublishing deletes the folder. Reads and paths below run from the project checkout; git remote auth is reused, no new secrets.

1. Confirm Pages serves this repo: resolve `owner/repo` via `gh repo view --json nameWithOwner`, then `gh api repos/<owner>/<repo>/pages`. Done when the API returns a site: continue. A 404 means Pages is off: stop and tell the human to enable it (Settings, Pages, source GitHub Actions), naming the exact repo.
2. Guard the payload: the folder exists, holds an `index.html` at its top, and totals at most 10MB (`du -sb`). Done when every guard passes. Anything failing a guard is rejected with the guard named; nothing is truncated or partially published.
3. Settle the slug: lowercase the proposed short slug (spaces and runs of separators collapse to one `-`), prefix today's UTC date as `YYYY-MM-DD` to form `<slug>`, and confirm `reports/<slug>/` is absent on `gh-pages` — via `git ls-remote origin gh-pages` when the branch has never been fetched here, via `git ls-tree HEAD reports/` inside an existing `gh-pages` checkout otherwise. Done when the slug is confirmed absent. On clash append `-2`, then `-3`, re-checking each.
4. Stage on `gh-pages`: create the orphan branch with `.nojekyll` when it does not exist yet; attach it with `git worktree add <dir> gh-pages`; copy the folder to `<dir>/reports/<slug>/`; regenerate the index with `npx tsx scripts/build-reports-index.mts <dir>` from the project checkout; commit; push; fire the deploy with `gh api --method POST repos/<owner>/<repo>/dispatches -f event_type=pages-reports`; remove the worktree. Done when the push and the dispatch both succeed and the worktree is gone. The dispatch is what triggers the deploy — a bare `gh-pages` push fires nothing, because the branch carries no workflow file.
5. Hand back `https://<owner>.github.io/<repo>/reports/<slug>/` in the reply and note the 1-2 minute deploy delay. Done when the reply holds the public URL. The in-thread preview, if one was open, is a bonus, never the deliverable.

Unpublish follows the same worktree path: delete `<dir>/reports/<slug>/` outright, regenerate the index with the same command, commit, push, fire the same deploy dispatch, remove the worktree. Done when the push and the dispatch both succeed and the slug is absent from the regenerated index.
