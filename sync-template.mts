#!/usr/bin/env tsx
/**
 * sync-template.mts — pull-style template updater with per-file Yes-gate.
 *
 * Pulls a template release into an already-bootstrapped downstream project
 * file-by-file behind an explicit Yes. Project-owned specialization is never
 * overwritten; conflicts surface for explicit Yes instead.
 *
 * Usage (run from template checkout or downstream; paths explicit):
 *   npx tsx sync-template.mts --template <template-repo> --downstream <project> --input <inputs.json> [--yes] [--non-interactive]
 *
 * Inputs JSON is the same shape as bootstrap fixture (members[], domainOneliner, ...).
 * When --input is omitted, the updater prefers the downstream machine record
 * `.template-sync.json` written by adopt (its embedded inputs), falling back to
 * the template fixture. Adopted projects therefore pull without re-asking.
 * Template-owned files render from docs/template/*.tmpl + scripts/template/* with those
 * inputs, then compare to downstream. Root meta (TEMPLATE-OWNERSHIP, TEMPLATE-CHANGELOG,
 * sync-template.mts itself) sync by direct copy. README.md and CONTEXT.md are
 * project-owned after bootstrap (not in template-owned list) and are never touched.
 * PERSONALIZATION.log.md is append-only (sync appends an entry, never rewrites).
 *
 * Outcomes per file: update (Yes, overwritten), skip (identical), conflict (differs
 * but needs explicit Yes — includes LOCAL-EDIT marker files even with --yes),
 * protected (project-owned, never touched).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { createInterface } from "node:readline";

type Inputs = {
  projectName: string; projectSlug: string; githubOrg: string; members: string[];
  domainOneliner: string; domainSeedTerms: string; teamSize: string;
  learningDepth: string; stackDesc: string; modelId: string; credentialVar: string;
};

// Template-owned destinations (relative). Canonical list in TEMPLATE-OWNERSHIP.md.
// README.md + CONTEXT.md deliberately excluded: project-owned after bootstrap.
const TMPL_MAP: Record<string, string> = {
  "docs/template/AGENTS.md.tmpl": "AGENTS.md",
  "docs/template/CONTRIBUTING.md.tmpl": "CONTRIBUTING.md",
  "docs/template/domain.md.tmpl": "docs/agents/domain.md",
  "docs/template/git-workflow.md.tmpl": "docs/agents/git-workflow.md",
  "docs/template/issue-tracker.md.tmpl": "docs/agents/issue-tracker.md",
  "docs/template/personal-status.md.tmpl": "docs/agents/personal-status.md",
  "docs/template/triage-labels.md.tmpl": "docs/agents/triage-labels.md",
  "docs/template/knowledge-index.md.tmpl": "docs/knowledge/inbox/INDEX.md",
  "docs/template/adr-readme.md.tmpl": "docs/adr/README.md",
  "docs/template/adr-0000-template.md.tmpl": "docs/adr/0000-template.md",
  "scripts/template/package.json.tmpl": "package.json",
  "scripts/template/root-gitignore.tmpl": ".gitignore",
  "scripts/template/skills-lock.json.tmpl": "skills-lock.json",
  "scripts/template/sandcastle-main.mts.tmpl": ".sandcastle/main.mts",
  "scripts/template/sandcastle-env-example.tmpl": ".sandcastle/.env.example",
  "scripts/template/sandcastle-dockerfile.tmpl": ".sandcastle/Dockerfile",
  "scripts/template/sandcastle-gitignore.tmpl": ".sandcastle/.gitignore",
  "scripts/template/sandcastle-plan-prompt.md.tmpl": ".sandcastle/plan-prompt.md",
  "scripts/template/sandcastle-implement-prompt.md.tmpl": ".sandcastle/implement-prompt.md",
  "scripts/template/sandcastle-review-prompt.md.tmpl": ".sandcastle/review-prompt.md",
  "scripts/template/token-audit.mts.tmpl": "scripts/token-audit.mts",
};

// Root meta synced by direct copy (no tokens).
const META = ["TEMPLATE-OWNERSHIP.md", "TEMPLATE-CHANGELOG.md", "sync-template.mts"];

function parseArgs(): Record<string, string | boolean> {
  const a = process.argv.slice(2);
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) {
      const k = a[i].slice(2);
      if (a[i + 1] && !a[i + 1].startsWith("--")) { out[k] = a[i + 1]; i++; }
      else out[k] = true;
    }
  }
  return out;
}

async function askYes(file: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ans: string = await new Promise((res) => rl.question(`Update ${file}? [y/N]: `, res));
    return /^y(es)?$/i.test(ans.trim());
  } finally { rl.close(); }
}

function renderText(text: string, inp: Inputs): string {
  const vals: Record<string, string> = {
    PROJECT_NAME: inp.projectName, PROJECT_SLUG: inp.projectSlug, GITHUB_ORG: inp.githubOrg,
    MEMBER_LIST: inp.members.join(", "), MEMBER_PIPE: inp.members.join("|"),
    DOMAIN_ONELINER: inp.domainOneliner, DOMAIN_SEED_TERMS: inp.domainSeedTerms,
    STACK_DESC: inp.stackDesc, MODEL_ID: inp.modelId, CREDENTIAL_VAR: inp.credentialVar,
    LEARNING_DEPTH: inp.learningDepth,
    V1_SCOPE: `see PERSONALIZATION.log.md (${inp.domainOneliner.slice(0, 80)}…)`,
  };
  let out = text;
  for (const [k, v] of Object.entries(vals)) out = out.split(`{{${k}}}`).join(v);
  return out;
}

async function main() {
  const args = parseArgs();
  const templateRoot = resolve(String(args.template ?? "."));
  const downstreamRoot = resolve(String(args.downstream ?? "."));
  const yesAll = Boolean(args.yes);
  const nonInteractive = Boolean(args["non-interactive"]);
  // Adopted projects carry their inputs in the machine sync record so later
  // releases re-render without re-asking. Explicit --input always wins.
  let inputPath = typeof args.input === "string" ? String(args.input) : "";
  let fromSyncRecord = false;
  if (!inputPath) {
    const recordPath = join(downstreamRoot, ".template-sync.json");
    try {
      const rec = JSON.parse(readFileSync(recordPath, "utf8"));
      if (rec && rec.inputs) {
        inputPath = recordPath;
        fromSyncRecord = true;
      }
    } catch {}
  }
  if (!inputPath) inputPath = join(templateRoot, "scripts", "template", "fixtures", "sample-inputs.json");
  if (!existsSync(join(templateRoot, "TEMPLATE-OWNERSHIP.md"))) {
    console.error(`Not a template checkout: ${templateRoot} (missing TEMPLATE-OWNERSHIP.md)`);
    process.exit(1);
  }
  if (!existsSync(join(downstreamRoot, "PERSONALIZATION.log.md"))) {
    console.error(`Not a bootstrapped project: ${downstreamRoot} (missing PERSONALIZATION.log.md)`);
    process.exit(1);
  }
  let inp: Inputs;
  if (fromSyncRecord) {
    inp = (JSON.parse(readFileSync(inputPath, "utf8")) as { inputs: Inputs }).inputs;
    console.log(`Using inputs from downstream ${".template-sync.json"} (adopt record).`);
  } else {
    inp = JSON.parse(readFileSync(inputPath, "utf8"));
  }
  if (typeof (inp as unknown as Record<string, unknown>).members === "string") {
    (inp as unknown as { members: string[] }).members =
      (inp as unknown as { members: string }).members.split(",").map((s: string) => s.trim());
  }

  // Show changelog for human judgment before any prompt.
  try {
    const log = readFileSync(join(templateRoot, "TEMPLATE-CHANGELOG.md"), "utf8");
    console.log("=== TEMPLATE-CHANGELOG (judge before pulling) ===\n" + log.split("\n").slice(0, 40).join("\n") + "\n=== end changelog ===\n");
  } catch {}

  const outcomes: Record<string, string[]> = { update: [], skip: [], conflict: [], protected: [], create: [] };

  // 1. Rendered template-owned files.
  for (const [srcRel, destRel] of Object.entries(TMPL_MAP)) {
    const src = join(templateRoot, srcRel);
    if (!existsSync(src)) continue;
    const expected = renderText(readFileSync(src, "utf8"), inp);
    const dest = join(downstreamRoot, destRel);
    if (!existsSync(dest)) {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, expected);
      outcomes.create.push(destRel);
      continue;
    }
    const current = readFileSync(dest, "utf8");
    if (current === expected) { outcomes.skip.push(destRel); continue; }
    // Diverged local specialization marker: never auto-apply, even with --yes.
    if (current.includes("LOCAL-EDIT")) {
      outcomes.conflict.push(destRel + " (local edits present; needs explicit per-file Yes)");
      continue;
    }
    let ok = yesAll;
    if (!nonInteractive && !yesAll) ok = await askYes(destRel);
    if (!nonInteractive && !yesAll && !ok) { outcomes.conflict.push(destRel + " (declined; needs explicit Yes)"); continue; }
    if (nonInteractive && !yesAll) { outcomes.conflict.push(destRel + " (differs; needs explicit Yes)"); continue; }
    writeFileSync(dest, expected);
    outcomes.update.push(destRel);
  }

  // 2. Root meta by direct copy (Yes-gated like the rest).
  for (const rel of META) {
    const src = join(templateRoot, rel);
    if (!existsSync(src)) continue;
    const expected = readFileSync(src, "utf8");
    const dest = join(downstreamRoot, rel);
    // sync-template.mts updating itself: write to downstream (self-update after Yes).
    if (!existsSync(dest)) {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, expected);
      outcomes.create.push(rel);
      continue;
    }
    if (readFileSync(dest, "utf8") === expected) { outcomes.skip.push(rel); continue; }
    let ok = yesAll;
    if (!nonInteractive && !yesAll) ok = await askYes(rel);
    if (!nonInteractive && !yesAll && !ok) { outcomes.conflict.push(rel + " (declined)"); continue; }
    if (nonInteractive && !yesAll) { outcomes.conflict.push(rel + " (differs; needs explicit Yes)"); continue; }
    writeFileSync(dest, expected);
    outcomes.update.push(rel);
  }

  // 3. Project-owned verification: confirm untouched (never written above by construction).
  const protectedCheck = ["CONTEXT.md", "README.md", "PERSONALIZATION.log.md"];
  for (const rel of protectedCheck) {
    if (existsSync(join(downstreamRoot, rel))) outcomes.protected.push(rel + " (untouched)");
  }

  // Append sync entry (append-only allowed).
  try {
    appendFileSync(join(downstreamRoot, "PERSONALIZATION.log.md"),
      `\n## Sync ${new Date().toISOString().slice(0, 10)}\n- Template: ${templateRoot}\n- update: ${outcomes.update.length} (${outcomes.update.join(", ")})\n- create: ${outcomes.create.length} (${outcomes.create.join(", ")})\n- skip: ${outcomes.skip.length}\n- conflict: ${outcomes.conflict.length} (${outcomes.conflict.join("; ")})\n`);
  } catch {}

  console.log(`sync-template outcomes: update=${outcomes.update.length} create=${outcomes.create.length} skip=${outcomes.skip.length} conflict=${outcomes.conflict.length} protected=${outcomes.protected.length}`);
  for (const f of outcomes.update) console.log(`  update: ${f}`);
  for (const f of outcomes.create) console.log(`  create: ${f}`);
  for (const f of outcomes.conflict) console.log(`  conflict: ${f}`);
  for (const f of outcomes.protected) console.log(`  protected: ${f}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
