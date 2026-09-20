# ISSUES

<issues-json>

!`gh issue list --state open --label ready-for-agent --limit 100 --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`

</issues-json>

# TASK

Build a dependency graph for open `ready-for-agent` issues. An issue B is **blocked by** A if: B needs code/infra from A; B and A touch overlapping files (merge-conflict risk); or B depends on a decision/API shape from A.

Also respect native GitHub dependencies: if `issue_dependencies_summary.blocked_by > 0` (or body has `Blocked by: #N` with open blocker), that edge exists — mirror `docs/agents/issue-tracker.md:42`.

An issue is **unblocked** if it has zero open blocking dependencies and no assignee.

For each unblocked issue, assign a branch name using the exact format `NN-<kebab-slug>` (e.g. `12-add-daily-skill`), where `NN` is the issue number. Use the issue title to derive the slug (lowercase, hyphen-separated). This must be deterministic.

If the issue is a map/PRD that has implementation children, do not plan it directly.

# OUTPUT

Output your plan as JSON wrapped in `<plan>` tags:

<plan>
{"issues": [{"number": 42, "title": "Fix auth bug", "branch": "42-fix-auth-bug"}]}
</plan>

Include only unblocked issues. If every issue is blocked, include the single highest-priority candidate (fewest/weakest dependencies).
