---
name: wrap
description: Continue broken-off streams at session pause — record stopping point, write handoff, surgically update STATUS.md. Fires after intent-to-change (edits on scoped/personal branch, issue/PR writes, or stated work on #NN); no-op on inspect-only sessions.
---

Lite close for broken-off streams. Fires when the conversation showed **intent-to-change** — an edit on a scoped (`NN-<slug>`) or personal (`personal/<user>/<topic>`) branch, a create/advance of an issue or PR, or a stated "work on #NN" even if no edit yet. Inspect-only sessions (read issues/branches/code with no edit and no ticket write) are a no-op: report `No broken-off stream to record.` and write nothing.

1. Name each open stream and its stopping point: what is done, what is next, what is blocked and on what. Scope is the streams named at this session's start (open with "continuing <stream>" where possible); when none was named, infer from the conversation and name them in the report so the next brief can see the scope.
2. Write one handoff per broken-off stream following `.agents/skills/handoff/SKILL.md` by reference, pinned to `.scratch/personal/<user>/handoffs/` (stable and linkable; overrides the temp-dir default). Reference shared artifacts by path or URL; never paste what issues, PRs, or commits already hold.
3. Update `.scratch/personal/<user>/STATUS.md` surgically per `docs/agents/personal-status.md`: re-read it fresh first (never from an earlier read in this session), then rewrite only the sections for streams touched here — state, next action, markdown handoff links, plus an `Updated: <YYYY-MM-DD HH:MM>` stamp each. Leave every other section byte-identical so parallel sessions never clobber each other; retire sections for streams that closed. English, no secrets, no tokens. Report what was recorded and where; name any stream left intentionally unrecorded.

Wrap completion: if intent-to-change, `STATUS.md` rewritten and every broken-off stream has a linked handoff; nothing recorded outside `personal/`. If no intent, no file written and one-line no-op reported.
