# Skills map: when to reach for which skill

Two pinned upstream sets live in `.agents/skills/`, restored from `skills-lock.json`: `mattpocock/skills` (the flows this project runs end to end) and `backnotprop/pstack` (the 13-skill pack below). Alongside them sit the team skills (`brief`, `wrap`, `publish-report`) — template-owned, not from either vendor. This file is the when-to-reach map; it says when to reach for each, never duplicates the `SKILL.md` files.

## The router and its boundary

`ask-matt` is the router: any situation you can't name, ask it. It routes the matt vendor only — it is pinned upstream and never forked to route the second one. For the pstack pack it does not know, this map is the bridge: find the situation in the table below and reach for that skill directly.

## The pstack pack: when to reach

| Situation | Reach for | Notes |
|---|---|---|
| Docs, readmes, or PR prose that reads machine-written | `unslop` | Cuts the AI tells from any writing before it ships |
| Writing or reviewing docs, RFCs, readmes, commit messages | `technical-writing` | Layered standard: Diátaxis structure, plain sentences, instruction rules. Sets the prose; `pr` sets the PR body's structure (see boundaries) |
| No scripted way to prove UI/CLI/service behavior | `create-verification-skill` | Generates a project-local verification skill that drives the app the way a user does |
| The verification skill drifting from the app it proves | `maintain-verification-skill` | Periodic pass: parallel source readers per feature, one live session driving every feature, at most one PR of proven corrections |
| "What could this change break?" | `blast-radius` | Finds breakage beyond the diff and proves the one fact it's safe because of by running real code — or names the unproven state when it can't |
| "How does X work?" / "where should this live?" | `how` | Code walkthroughs before changing something; placement, ownership, and layering questions — the companion to `blast-radius` |
| About to report a measured speedup or regression | `benchmark-checklist` | Vets the measurement (limiter, repeatability, relevance, whether the work happened) before you report or act on it |
| The same mistake keeps coming back | `correct` | Finds what agents keep repeating here and makes each one impossible — architecture first, then types, then a lint, then a test, docs last |
| Two or more fixes sharing one premise have failed | `principle-attack-the-premise` | Write the premise down and test it directly before writing another fix that assumes it |
| Wiring validation, error handling, or framework adapters | `principle-boundary-discipline` | Concentrate guards at system boundaries; trust internal types, keep business logic in pure functions |
| Commands or loops that meet crashes, restarts, retries | `principle-make-operations-idempotent` | Converge to the same end state regardless of partial prior runs |
| About to trust, report, or act on a number you measured | `principle-explain-the-number` | Find what limits it, and rule out that it measured something other than the work you think |
| Non-trivial work about to be done by hand | `principle-build-the-lever` | Build the tool that does it or proves it — codemod, script, generator, or a check; the tool is the artifact a reviewer can rerun |

## Locked boundaries

- **`pr` vs `technical-writing`**: `pr` sets the PR body's structure; `technical-writing` sets the prose inside it. A PR body carries the `pr` shape written to the `technical-writing` standard — neither replaces the other.
- **`ask-matt` routes the matt vendor only.** It is never forked or edited to route the pstack pack; the table above is the pack's router.
- **Incumbents win on collision.** Where the two vendors overlap, the matt skill stays and the pstack one is never installed — matt's `tdd` and `teach` are the standing examples; pstack's same-name skills stay out of the lock.
- **Subsumed principles are absorbed as wording, not installed.** Where a pstack principle's ground is already covered by a skill or rail here, its delta lives in this map's wording; the five `principle-*` skills above are the clean remainder, invoked explicitly when judgment is needed.

## You-typed, not model-invoked

The entire pstack pack is you-typed: all 13 skills disable model invocation, so none of them fires on its own triggers. When a situation in the table appears, type the skill (`/unslop`, `/blast-radius`, `/correct`, …) or name it in the prompt. The matt vendor splits: the agent fires the skills whose triggers are situations itself (`tdd`, `pr`, `code-review`, `diagnosing-bugs`, `prototype`, `research`, `grilling`, `wizard`), and the rest are you-typed. `ask-matt` decides which matt skill applies; the table decides for the pack.
