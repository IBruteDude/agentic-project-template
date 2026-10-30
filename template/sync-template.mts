#!/usr/bin/env tsx
/**
 * template/sync-template.mts — pull-style template updater with 3-way baseline
 * conflict protection and verifiable applied-revision sync receipts.
 *
 * Pulls a template release into an already-bootstrapped downstream project.
 * Locally modified files are protected by three-way comparison against the
 * recorded baseline hash in `.template-receipt.json`.
 *
 * Usage:
 *   npx tsx template/sync-template.mts --template <template-checkout>/template --downstream <project> [--input <inputs.json>] [--yes] [--non-interactive]
 *   npx tsx template/sync-template.mts --downstream <project> --record-baseline
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync, renameSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

type Inputs = {
  projectName: string; projectSlug: string; githubOrg: string; members: string[];
  domainOneliner: string; domainSeedTerms: string; teamSize: string;
  learningDepth: string; stackDesc: string; modelId: string; credentialVar: string;
};

export interface FileBaseline {
  type: "template-owned" | "meta-copy" | "seed-only";
  baselineHash: string;
  status: "applied" | "notified" | "diverged-unbaselined";
}

export interface UnresolvedEntry {
  path: string;
  reason: string;
  retainedBaselineHash: string;
}

export interface TemplateReceipt {
  $schema?: string;
  schemaVersion: 1;
  sourceCommit: string;
  templateVersion: string;
  appliedAt: string;
  status: "complete" | "partial";
  files: Record<string, FileBaseline>;
  unresolved?: UnresolvedEntry[];
}

// Template-owned destinations (relative). Canonical list in TEMPLATE-OWNERSHIP.md.
const TMPL_MAP: Record<string, string> = {
  "docs/CONTRIBUTING.md.tmpl": "CONTRIBUTING.md",
  "docs/domain.md.tmpl": "docs/agents/domain.md",
  "docs/git-workflow.md.tmpl": "docs/agents/git-workflow.md",
  "docs/issue-tracker.md.tmpl": "docs/agents/issue-tracker.md",
  "docs/personal-status.md.tmpl": "docs/agents/personal-status.md",
  "docs/skills-map.md.tmpl": "docs/agents/skills-map.md",
  "docs/triage-labels.md.tmpl": "docs/agents/triage-labels.md",
  "docs/knowledge-index.md.tmpl": "docs/knowledge/inbox/INDEX.md",
  "docs/adr-readme.md.tmpl": "docs/adr/README.md",
  "docs/adr-0000-template.md.tmpl": "docs/adr/0000-template.md",
  "scripts/package.json.tmpl": "package.json",
  "scripts/root-gitignore.tmpl": ".gitignore",
  "scripts/skills-lock.json.tmpl": "skills-lock.json",
  "scripts/sandcastle-main.mts.tmpl": ".sandcastle/main.mts",
  "scripts/sandcastle-env-example.tmpl": ".sandcastle/.env.example",
  "scripts/sandcastle-dockerfile.tmpl": ".sandcastle/Dockerfile",
  "scripts/sandcastle-gitignore.tmpl": ".sandcastle/.gitignore",
  "scripts/sandcastle-plan-prompt.md.tmpl": ".sandcastle/plan-prompt.md",
  "scripts/sandcastle-implement-prompt.md.tmpl": ".sandcastle/implement-prompt.md",
  "scripts/sandcastle-review-prompt.md.tmpl": ".sandcastle/review-prompt.md",
  "scripts/token-audit.mts.tmpl": "scripts/token-audit.mts",
  "scripts/lock-preflight.mts.tmpl": "scripts/lock-preflight.mts",
  "scripts/build-reports-index.mts.tmpl": "scripts/build-reports-index.mts",
  "scripts/pages-reports.yml.tmpl": ".github/workflows/pages-reports.yml",
  "scripts/tsconfig.json.tmpl": "tsconfig.json",
  "scripts/skills/brief/SKILL.md": ".agents/skills/brief/SKILL.md",
  "scripts/skills/brief/agents/openai.yaml": ".agents/skills/brief/agents/openai.yaml",
  "scripts/skills/wrap/SKILL.md": ".agents/skills/wrap/SKILL.md",
  "scripts/skills/wrap/agents/openai.yaml": ".agents/skills/wrap/agents/openai.yaml",
  "scripts/skills/publish-report/SKILL.md": ".agents/skills/publish-report/SKILL.md",
  "scripts/skills/publish-report/agents/openai.yaml": ".agents/skills/publish-report/agents/openai.yaml",
};

const META_COPY: Record<string, string> = {
  "TEMPLATE-OWNERSHIP.md": "TEMPLATE-OWNERSHIP.md",
  "TEMPLATE-CHANGELOG.md": "TEMPLATE-CHANGELOG.md",
  "sync-template.mts": "scripts/sync-template.mts",
};

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function getSourceCommit(templateRoot: string): string {
  try {
    const sha = execSync("git rev-parse HEAD", { cwd: templateRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (sha) {
      try {
        const dirty = execSync("git status --porcelain", { cwd: templateRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
        return dirty ? `${sha}-dirty` : sha;
      } catch {
        return sha;
      }
    }
  } catch {}
  return "unversioned-release";
}

export function readReceipt(downstreamRoot: string): TemplateReceipt | null {
  const p = join(downstreamRoot, ".template-receipt.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function writeReceiptAtomic(downstreamRoot: string, receipt: TemplateReceipt): void {
  const receiptPath = join(downstreamRoot, ".template-receipt.json");
  const tmpPath = join(downstreamRoot, ".template-receipt.json.tmp");
  writeFileSync(tmpPath, JSON.stringify(receipt, null, 2) + "\n");
  renameSync(tmpPath, receiptPath);
}

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

export function templateVersion(templateRoot: string): string {
  try {
    const log = readFileSync(join(templateRoot, "TEMPLATE-CHANGELOG.md"), "utf8");
    const m = log.match(/^##\s+([0-9]+\.[0-9]+\.[0-9]+)/m);
    if (m) return m[1];
  } catch {}
  return "unknown";
}

function downstreamSyncVersion(downstreamRoot: string): string {
  try {
    const rec = JSON.parse(readFileSync(join(downstreamRoot, ".template-sync.json"), "utf8"));
    if (rec && typeof rec.version === "string" && rec.version) return rec.version;
  } catch {}
  return "unknown";
}

function printSeedDiff(current: string, expected: string, maxLines = 40): void {
  const cur = current.split("\n");
  const exp = expected.split("\n");
  const n = Math.max(cur.length, exp.length);
  let shown = 0;
  for (let i = 0; i < n && shown < maxLines; i++) {
    const c = cur[i] ?? "";
    const e = exp[i] ?? "";
    if (c !== e) {
      if (c !== "") { console.log(`  - downstream:${i + 1}: ${c.slice(0, 200)}`); shown++; }
      if (e !== "" && shown < maxLines) { console.log(`  + seed:${i + 1}: ${e.slice(0, 200)}`); shown++; }
    }
  }
  if (shown >= maxLines) console.log(`  ... (diff truncated at ${maxLines} lines)`);
}

async function main() {
  const args = parseArgs();
  const templateRoot = resolve(String(args.template ?? (existsSync(join(".", "template", "TEMPLATE-OWNERSHIP.md")) ? join(".", "template") : ".")));
  const downstreamRoot = resolve(String(args.downstream ?? "."));
  const yesAll = Boolean(args.yes);
  const nonInteractive = Boolean(args["non-interactive"]);
  const recordBaselineMode = Boolean(args["record-baseline"]);

  if (!existsSync(join(templateRoot, "TEMPLATE-OWNERSHIP.md"))) {
    console.error(`Not a template checkout: ${templateRoot} (missing TEMPLATE-OWNERSHIP.md)`);
    process.exit(1);
  }
  if (!existsSync(join(downstreamRoot, "PERSONALIZATION.log.md"))) {
    console.error(`Not a bootstrapped project: ${downstreamRoot} (missing PERSONALIZATION.log.md)`);
    process.exit(1);
  }

  // Load inputs
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
  if (!inputPath) inputPath = join(templateRoot, "scripts", "fixtures", "sample-inputs.json");

  let inp: Inputs;
  if (fromSyncRecord) {
    inp = (JSON.parse(readFileSync(inputPath, "utf8")) as { inputs: Inputs }).inputs;
    console.log(`Using inputs from downstream .template-sync.json (bootstrap/adopt record).`);
  } else {
    inp = JSON.parse(readFileSync(inputPath, "utf8"));
  }
  if (typeof (inp as unknown as Record<string, unknown>).members === "string") {
    (inp as unknown as { members: string[] }).members =
      (inp as unknown as { members: string }).members.split(",").map((s: string) => s.trim());
  }

  const tmplVersion = templateVersion(templateRoot);
  const srcCommit = getSourceCommit(templateRoot);

  // --- MODE: --record-baseline ---
  if (recordBaselineMode) {
    console.log(`Recording legacy baseline for ${downstreamRoot}...`);
    const receipt: TemplateReceipt = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      schemaVersion: 1,
      sourceCommit: srcCommit,
      templateVersion: tmplVersion !== "unknown" ? tmplVersion : downstreamSyncVersion(downstreamRoot),
      appliedAt: new Date().toISOString(),
      status: "complete",
      files: {},
      unresolved: [],
    };

    let cleanCount = 0;
    let divergedCount = 0;

    for (const [srcRel, destRel] of Object.entries(TMPL_MAP)) {
      const src = join(templateRoot, srcRel);
      if (!existsSync(src)) continue;
      const expected = renderText(readFileSync(src, "utf8"), inp);
      const expectedHash = sha256(expected);
      const dest = join(downstreamRoot, destRel);
      if (existsSync(dest)) {
        const curHash = sha256(readFileSync(dest));
        if (curHash === expectedHash) {
          receipt.files[destRel] = { type: "template-owned", baselineHash: expectedHash, status: "applied" };
          cleanCount++;
        } else {
          // Diverged legacy customization: record expected baseline with diverged status, NEVER record curHash as clean!
          receipt.files[destRel] = { type: "template-owned", baselineHash: expectedHash, status: "diverged-unbaselined" };
          receipt.unresolved!.push({ path: destRel, reason: "legacy-diverged", retainedBaselineHash: expectedHash });
          divergedCount++;
        }
      }
    }

    for (const [srcRel, destRel] of Object.entries(META_COPY)) {
      const src = join(templateRoot, srcRel);
      if (!existsSync(src)) continue;
      const expected = readFileSync(src, "utf8");
      const expectedHash = sha256(expected);
      const dest = join(downstreamRoot, destRel);
      if (existsSync(dest)) {
        const curHash = sha256(readFileSync(dest));
        if (curHash === expectedHash) {
          receipt.files[destRel] = { type: "meta-copy", baselineHash: expectedHash, status: "applied" };
          cleanCount++;
        } else {
          receipt.files[destRel] = { type: "meta-copy", baselineHash: expectedHash, status: "diverged-unbaselined" };
          receipt.unresolved!.push({ path: destRel, reason: "legacy-diverged", retainedBaselineHash: expectedHash });
          divergedCount++;
        }
      }
    }

    // Seed-only AGENTS.md
    const agentsSrc = join(templateRoot, "docs/AGENTS.md.tmpl");
    if (existsSync(agentsSrc)) {
      const expectedSeed = renderText(readFileSync(agentsSrc, "utf8"), inp);
      receipt.files["AGENTS.md"] = { type: "seed-only", baselineHash: sha256(expectedSeed), status: "notified" };
    }

    if (divergedCount > 0) receipt.status = "partial";
    writeReceiptAtomic(downstreamRoot, receipt);
    console.log(`Recorded baseline receipt (.template-receipt.json): ${cleanCount} clean, ${divergedCount} diverged. Zero project files modified.`);
    process.exit(0);
  }

  // --- MODE: Standard sync ---
  try {
    const log = readFileSync(join(templateRoot, "TEMPLATE-CHANGELOG.md"), "utf8");
    console.log("=== TEMPLATE-CHANGELOG (judge before pulling) ===\n" + log.split("\n").slice(0, 40).join("\n") + "\n=== end changelog ===\n");
  } catch {}

  const oldReceipt = readReceipt(downstreamRoot);
  const newReceipt: TemplateReceipt = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    schemaVersion: 1,
    sourceCommit: srcCommit,
    templateVersion: tmplVersion,
    appliedAt: new Date().toISOString(),
    status: "complete",
    files: {},
    unresolved: [],
  };

  const outcomes: Record<string, string[]> = { update: [], skip: [], conflict: [], protected: [], create: [], noticed: [] };

  // 1. Rendered template-owned files.
  for (const [srcRel, destRel] of Object.entries(TMPL_MAP)) {
    const src = join(templateRoot, srcRel);
    if (!existsSync(src)) continue;
    const expected = renderText(readFileSync(src, "utf8"), inp);
    const expectedHash = sha256(expected);
    const dest = join(downstreamRoot, destRel);

    if (!existsSync(dest)) {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, expected);
      outcomes.create.push(destRel);
      newReceipt.files[destRel] = { type: "template-owned", baselineHash: expectedHash, status: "applied" };
      continue;
    }

    const current = readFileSync(dest, "utf8");
    const currentHash = sha256(current);
    const oldEntry = oldReceipt?.files[destRel];
    const oldBaseline = oldEntry?.baselineHash;

    // Rule 1: Destination Equality Override
    if (currentHash === expectedHash) {
      outcomes.skip.push(destRel);
      newReceipt.files[destRel] = { type: "template-owned", baselineHash: expectedHash, status: "applied" };
      continue;
    }

    // Rule 2: Clean baseline comparison
    const isCleanBaseline = oldBaseline && currentHash === oldBaseline && oldEntry.status === "applied";

    if (isCleanBaseline) {
      let ok = yesAll;
      if (!nonInteractive && !yesAll) ok = await askYes(destRel);
      if (!ok) {
        outcomes.conflict.push(destRel + " (declined; needs explicit Yes)");
        newReceipt.status = "partial";
        newReceipt.unresolved!.push({ path: destRel, reason: "declined", retainedBaselineHash: oldBaseline });
        newReceipt.files[destRel] = oldEntry;
        continue;
      }
      writeFileSync(dest, expected);
      outcomes.update.push(destRel);
      newReceipt.files[destRel] = { type: "template-owned", baselineHash: expectedHash, status: "applied" };
    } else {
      // Diverged customization or unbaselined legacy file
      if (nonInteractive) {
        outcomes.conflict.push(destRel + " (diverged from baseline; refused overwrite under bulk --yes)");
        newReceipt.status = "partial";
        newReceipt.unresolved!.push({ path: destRel, reason: "diverged-conflict", retainedBaselineHash: oldBaseline ?? expectedHash });
        if (oldEntry) newReceipt.files[destRel] = oldEntry;
        continue;
      }
      // Interactive resolution
      const ok = await askYes(destRel + " [DIVERGED CONFLICT]");
      if (!ok) {
        outcomes.conflict.push(destRel + " (conflict kept; declined)");
        newReceipt.status = "partial";
        newReceipt.unresolved!.push({ path: destRel, reason: "declined", retainedBaselineHash: oldBaseline ?? expectedHash });
        if (oldEntry) newReceipt.files[destRel] = oldEntry;
        continue;
      }
      writeFileSync(dest, expected);
      outcomes.update.push(destRel);
      newReceipt.files[destRel] = { type: "template-owned", baselineHash: expectedHash, status: "applied" };
    }
  }

  // 1b. AGENTS.md seed-only + notify
  {
    const src = join(templateRoot, "docs/AGENTS.md.tmpl");
    if (existsSync(src)) {
      const expected = renderText(readFileSync(src, "utf8"), inp);
      const expectedHash = sha256(expected);
      const dest = join(downstreamRoot, "AGENTS.md");
      const tmplVer = templateVersion(templateRoot);
      const downVer = downstreamSyncVersion(downstreamRoot);
      const seedMaybeChanged = tmplVer === "unknown" || downVer === "unknown" || tmplVer !== downVer;

      if (!existsSync(dest)) {
        if (existsSync(join(downstreamRoot, "CLAUDE.md"))) {
          console.log(`NOTICE: AGENTS.md seed is absent downstream but CLAUDE.md exists — skipping recreate (one entrypoint only).`);
          outcomes.noticed.push("AGENTS.md (recreate skipped: CLAUDE.md present)");
        } else {
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, expected);
          outcomes.create.push("AGENTS.md (seed-only recreate, was absent)");
          newReceipt.files["AGENTS.md"] = { type: "seed-only", baselineHash: expectedHash, status: "notified" };
        }
      } else {
        const current = readFileSync(dest, "utf8");
        newReceipt.files["AGENTS.md"] = { type: "seed-only", baselineHash: expectedHash, status: "notified" };
        if (current === expected) {
          outcomes.skip.push("AGENTS.md");
        } else if (!seedMaybeChanged) {
          outcomes.protected.push("AGENTS.md (differs from seed; seed unchanged, silent)");
        } else {
          console.log(`NOTICE: AGENTS.md seed changed (template ${tmplVer} vs downstream sync ${downVer}). Project-owned file kept — see TEMPLATE-CHANGELOG.md and hand-merge if you care.`);
          printSeedDiff(current, expected);
          outcomes.noticed.push("AGENTS.md (seed differs; NOTICE printed, kept)");
        }
      }
    }
  }

  // 2. Root meta by direct copy
  for (const [srcRel, destRel] of Object.entries(META_COPY)) {
    const src = join(templateRoot, srcRel);
    if (!existsSync(src)) continue;
    const expected = readFileSync(src, "utf8");
    const expectedHash = sha256(expected);
    const dest = join(downstreamRoot, destRel);

    if (!existsSync(dest)) {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, expected);
      outcomes.create.push(destRel);
      newReceipt.files[destRel] = { type: "meta-copy", baselineHash: expectedHash, status: "applied" };
      continue;
    }

    const current = readFileSync(dest, "utf8");
    const currentHash = sha256(current);
    const oldEntry = oldReceipt?.files[destRel];
    const oldBaseline = oldEntry?.baselineHash;

    if (currentHash === expectedHash) {
      outcomes.skip.push(destRel);
      newReceipt.files[destRel] = { type: "meta-copy", baselineHash: expectedHash, status: "applied" };
      continue;
    }

    const isCleanBaseline = oldBaseline && currentHash === oldBaseline && oldEntry.status === "applied";

    if (isCleanBaseline) {
      let ok = yesAll;
      if (!nonInteractive && !yesAll) ok = await askYes(destRel);
      if (!ok) {
        outcomes.conflict.push(destRel + " (declined)");
        newReceipt.status = "partial";
        newReceipt.unresolved!.push({ path: destRel, reason: "declined", retainedBaselineHash: oldBaseline });
        newReceipt.files[destRel] = oldEntry;
        continue;
      }
      writeFileSync(dest, expected);
      outcomes.update.push(destRel);
      newReceipt.files[destRel] = { type: "meta-copy", baselineHash: expectedHash, status: "applied" };
    } else {
      if (nonInteractive) {
        outcomes.conflict.push(destRel + " (diverged from baseline; refused overwrite under bulk --yes)");
        newReceipt.status = "partial";
        newReceipt.unresolved!.push({ path: destRel, reason: "diverged-conflict", retainedBaselineHash: oldBaseline ?? expectedHash });
        if (oldEntry) newReceipt.files[destRel] = oldEntry;
        continue;
      }
      const ok = await askYes(destRel + " [DIVERGED CONFLICT]");
      if (!ok) {
        outcomes.conflict.push(destRel + " (conflict kept; declined)");
        newReceipt.status = "partial";
        newReceipt.unresolved!.push({ path: destRel, reason: "declined", retainedBaselineHash: oldBaseline ?? expectedHash });
        if (oldEntry) newReceipt.files[destRel] = oldEntry;
        continue;
      }
      writeFileSync(dest, expected);
      outcomes.update.push(destRel);
      newReceipt.files[destRel] = { type: "meta-copy", baselineHash: expectedHash, status: "applied" };
    }
  }

  // 3. Project-owned verification
  const protectedCheck = ["CONTEXT.md", "README.md", "PERSONALIZATION.log.md", ".template-receipt.json"];
  for (const rel of protectedCheck) {
    if (existsSync(join(downstreamRoot, rel))) outcomes.protected.push(rel + " (untouched)");
  }

  // Write receipt atomically
  writeReceiptAtomic(downstreamRoot, newReceipt);

  // Append sync entry
  try {
    appendFileSync(join(downstreamRoot, "PERSONALIZATION.log.md"),
      `\n## Sync ${new Date().toISOString().slice(0, 10)}\n- Template: ${templateRoot}\n- Receipt status: ${newReceipt.status}\n- update: ${outcomes.update.length} (${outcomes.update.join(", ")})\n- create: ${outcomes.create.length} (${outcomes.create.join(", ")})\n- skip: ${outcomes.skip.length}\n- conflict: ${outcomes.conflict.length} (${outcomes.conflict.join("; ")})\n- noticed: ${outcomes.noticed.length} (${outcomes.noticed.join("; ")})\n`);
  } catch {}

  console.log(`sync-template outcomes: update=${outcomes.update.length} create=${outcomes.create.length} skip=${outcomes.skip.length} conflict=${outcomes.conflict.length} protected=${outcomes.protected.length} noticed=${outcomes.noticed.length}`);
  for (const f of outcomes.update) console.log(`  update: ${f}`);
  for (const f of outcomes.create) console.log(`  create: ${f}`);
  for (const f of outcomes.conflict) console.log(`  conflict: ${f}`);
  for (const f of outcomes.protected) console.log(`  protected: ${f}`);
  for (const f of outcomes.noticed) console.log(`  noticed: ${f}`);

  if (outcomes.conflict.length > 0 && nonInteractive) {
    console.error(`\nsync-template FAILED: ${outcomes.conflict.length} conflict(s) encountered in non-interactive mode.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
