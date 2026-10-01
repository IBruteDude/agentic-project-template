---
name: brief
description: Morning brief — what is up for work
disable-model-invocation: true
---

Assemble the canonical picture, then report it grouped by stream with one suggested first move. Run once per morning in the first session; sessions opened afterwards for individual streams resume from their STATUS section plus linked handoff/issue instead of re-running the full brief.

1. Fetch shared state: `git fetch`, then list assigned open issues (`gh issue list --assignee @me --state open`), open PRs by `@me` and review requests, and own recent branches (`git branch --sort=-committerdate`, top 5). Shared-state operations live in `docs/agents/issue-tracker.md`; branch lanes in `docs/agents/git-workflow.md`. Note the map frontier only when the human asks for team scope; the brief is personal first. Ordering hint: `needs-info` and `ready-for-human` may be surfaced first when present.
2. Read the personal log at `.scratch/personal/<user>/STATUS.md` (`<user>` is `git config user.name`; shape and surgical rule live in `docs/agents/personal-status.md`). When it is missing, emit `No personal STATUS.md at .scratch/personal/<user>/STATUS.md — continuing on shared state.` and continue on shared state alone; never invent streams.
3. Read linked handoffs: open only the markdown-linked handoff files `STATUS.md` points at for still-open streams (`.scratch/personal/<user>/handoffs/`), newest first, cap 3–5. Do not trawl the whole `handoffs/` directory.
4. Report grouped by stream (`building`, `learning`, `researching`, `prototyping`, `experimenting`, `fixing` — only streams with a trace), each as state plus next action, then one suggested first move for the day. Streams with no trace anywhere are omitted, not guessed at.

Brief completion: every reported stream carries a state and a next action grounded in something read this session (issue/PR URL, branch, or STATUS + handoff link).

## Reach, don't restate

Branching, identity, commit, and push rules live in `docs/agents/git-workflow.md`; issue operations in `docs/agents/issue-tracker.md`; handoff format in the `handoff` skill; `STATUS.md` shape and surgical update in `docs/agents/personal-status.md`. This skill adds only the assembly above.
