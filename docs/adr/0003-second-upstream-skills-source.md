# Add `backnotprop/pstack` as a second pinned skills source

Accepted 2026-10-20 — spec issue #2, build ticket #7. The engineering-skills rails pin a single upstream vendor (`mattpocock/skills`, routed through `ask-matt`). A full audit of a second vendor found disciplines the matt roster genuinely lacks, so the payload lock gains a second pinned source for a cherry-picked adoption pack alongside matt — not a vendor switch. Project-owned numbered ADR, so this changes only this repo.

## Motivation

The matt roster has no answer for five disciplines: anti-slop docs prose, a verification-skill create/maintain pair, proving a change's blast radius by running code, validating measured numbers before they are reported, and a correction loop that transfers to the highest enforcement level. The pstack collection (54 skills) was read in full — every `SKILL.md` audited — and 13 of its skills filled exactly those gaps plus a set of clean, transferable judgment principles; the full audit was the gate, and the verdict map travels preserved with the spec so the selection's reasons stay reviewable. No pilots or benches: the handwaved map is the record. The verdicts ground in this environment's facts: one built-in provider, no model-role config, free tier, and a skills CLI (1.7.2) that supports per-skill adds (`owner/repo -s name`) — which is what makes cherry-picking possible at all.

## Decision

- Second pinned source `backnotprop/pstack`, 13 entries entering the payload lock, pinned at the mirror tip current at implementation time (the `0.15.28` sync, recorded in the changelog): `unslop`, `how`, `blast-radius`, `technical-writing`, `create-verification-skill`, `maintain-verification-skill`, `benchmark-checklist`, `correct`, `principle-attack-the-premise`, `principle-boundary-discipline`, `principle-make-operations-idempotent`, `principle-explain-the-number`, `principle-build-the-lever`. Lock entries mirror the skills CLI lock format (source, sourceType, skillPath, computedHash); hashes are CLI-produced at implementation, never hand-computed.
- Incumbent wins on name collision: matt's `tdd` and `teach` stay; pstack's same-name skills are never installed (the adopt's verdict, Q15).
- Colliding or subsumed principles are absorbed as wording in the rendered when-to-reach map, not installed as skills.
- Embedded policies, both load-bearing for the future:
  - **`ask-matt` is never forked or edited.** The hash-pinned upstream router stays matt-only; routing a second vendor through it would mean forking it and repinning every future matt update. The map is the bridge instead: `ask-matt` routes the matt vendor, the rendered map surfaces second-vendor skills it does not know.
  - **No multi-model panel skills.** The environment is single-provider — one built-in provider, no model-role config, free tier — so skills preconditioned on model diversity or high throughput (`arena`, `swarm`, `interrogate`, `show-me-your-work`) do not fit (Q17/Q20 verdicts).

## Rejected with reasons

The spec's Out-of-Scope list is the canonical rejected roster, quoted verbatim:

> Everything the verdict map rejected: the pstack framework (poteto-mode, poteto-help, setup-pstack, automate-me, recall, figure-it-out), the multi-model panels (arena, swarm, interrogate), pstack's tdd/teach (name collisions), why, ketchup/bro/in-your-own-words, sharpen, typescript-best-practices, no-comments, show-me-your-work, make-bot-ui, the benny pack, and the remaining principles (covered by rails, stubs, or TS-bound).

Grouped reasons behind it:

- **Framework/router skills** (`poteto-mode`, `poteto-help`, `setup-pstack`, `automate-me`, `recall`, `figure-it-out`): unroutable without forking `ask-matt`, some depend on external non-shipped deps, and their autonomy conflicts with the Yes-gate commit flow.
- **Model-diversity panels** (`arena`, `swarm`, `interrogate`): preconditioned on frontier-model diversity this environment does not run (Q17).
- **High-throughput-preconditioned** (`show-me-your-work`): assumes throughput capacity beyond the free tier (Q20).
- **Destructive or infra-risky** (`no-comments`, `make-bot-ui`, the benny pack): agent-initiated edits or infrastructure changes that bypass the human-in-the-loop rails.
- **Covered by existing rails** (pstack's `tdd`/`teach` by name collision, plus `why`, `ketchup`/`bro`/`in-your-own-words`, `sharpen`, `typescript-best-practices`): the incumbent skill or an existing rail already carries the discipline.
- **Remaining principles**: colliding deltas are absorbed into the map's wording; stub principles are skipped as not invokable; TS-bound ones do not travel.

## Consequences

- Two vendors ride the same Yes-gated update flow — refresh all retained hashes, re-audit changed bodies — with no extra maintenance channel for the second source (Q10).
- The repo's own root mirror dogfoods the pack: root lock and root skills gain the same 13 entries after the payload release lands, so what this repo uses matches what it ships (Q21); the roots are repo-self and never synced downstream.
- Downstream projects get the rendered when-to-reach map plus the `AGENTS.md` seed pointer, so second-vendor skills `ask-matt` does not know are discoverable on a first session; the collision policy lives in the map's wording as well.
- A future re-audit re-reads the verdict map with the spec; this ADR is the permanent record of why the vendors are two.
