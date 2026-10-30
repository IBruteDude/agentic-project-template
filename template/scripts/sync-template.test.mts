#!/usr/bin/env tsx
/**
 * template/scripts/sync-template.test.mts — plain-TS integration test suite
 * for sync-template.mts provenance receipts and baseline conflict detection.
 *
 * Exercises sync-template.mts CLI against isolated temporary directories:
 * 1. Clean update advances template files and updates .template-receipt.json.
 * 2. Consecutive repeat sync runs perform zero writes and report clean skip.
 * 3. Unmarked customization halts under --yes --non-interactive with exit 1,
 *    emits conflict warning, and leaves destination byte-identical.
 * 4. Legacy --record-baseline creates valid receipt with zero file modifications
 *    and protects diverged files on subsequent updates.
 * 5. Partial sync retains existing trusted baselines for skipped/conflicted files.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

const ROOT = resolve(dirname(decodeURIComponent(new URL(import.meta.url).pathname)), "..", "..");
const TEMPLATE_DIR = join(ROOT, "template");
const SYNC_CLI = join(ROOT, "template", "sync-template.mts");
const TSX = join(ROOT, "node_modules", ".bin", "tsx");

function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

function runSync(args: string[]): { code: number | null; stdout: string; stderr: string; out: string } {
  const r = spawnSync(TSX, [SYNC_CLI, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30_000,
  });
  const stdout = r.stdout ?? "";
  const stderr = r.stderr ?? "";
  return { code: r.status, stdout, stderr, out: `${stdout}\n${stderr}`.trim() };
}

const sampleInputs = {
  projectName: "Test Project",
  projectSlug: "test-project",
  githubOrg: "test-org",
  members: ["tester1", "tester2"],
  domainOneliner: "An automated test harness for template sync.",
  domainSeedTerms: "test, sync, harness",
  teamSize: "2-5",
  learningDepth: "intermediate",
  stackDesc: "TypeScript, Node.js",
  modelId: "test-model",
  credentialVar: "TEST_API_KEY",
};

function createSandbox(name: string): string {
  const dir = join(tmpdir(), "opencode", "sync-template-test", name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  // Minimal downstream project setup
  writeFileSync(join(dir, "PERSONALIZATION.log.md"), "# Personalization Log\n\n- Seeded.\n");
  writeFileSync(
    join(dir, ".template-sync.json"),
    JSON.stringify(
      {
        version: "0.1.0",
        template: TEMPLATE_DIR,
        inputs: sampleInputs,
        syncedAt: "2026-01-01T00:00:00.000Z",
      },
      null,
      2
    ) + "\n"
  );
  writeFileSync(join(dir, "README.md"), "# Downstream README (Project-owned)\n");
  writeFileSync(join(dir, "CONTEXT.md"), "# Downstream Context (Project-owned)\n");
  return dir;
}

const cases: Array<{ name: string; ok: boolean; detail?: string }> = [];

// Case 1: Clean update advances files and updates .template-receipt.json
{
  const sb = createSandbox("clean-update");
  // Seed CONTRIBUTING.md with old content and corresponding baseline in receipt
  const oldContributing = "Old Contributing Content v0.1.0\n";
  writeFileSync(join(sb, "CONTRIBUTING.md"), oldContributing);

  const initialReceipt = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    schemaVersion: 1,
    sourceCommit: "initial0000000000",
    templateVersion: "0.1.0",
    appliedAt: "2026-01-01T00:00:00.000Z",
    status: "complete",
    files: {
      "CONTRIBUTING.md": {
        type: "template-owned",
        baselineHash: sha256(oldContributing),
        status: "applied",
      },
    },
    unresolved: [],
  };
  writeFileSync(join(sb, ".template-receipt.json"), JSON.stringify(initialReceipt, null, 2) + "\n");

  const r = runSync(["--template", TEMPLATE_DIR, "--downstream", sb, "--yes", "--non-interactive"]);
  const receiptAfter = JSON.parse(readFileSync(join(sb, ".template-receipt.json"), "utf8"));
  const contributingAfter = readFileSync(join(sb, "CONTRIBUTING.md"), "utf8");

  const ok =
    r.code === 0 &&
    contributingAfter !== oldContributing &&
    receiptAfter.status === "complete" &&
    receiptAfter.files["CONTRIBUTING.md"]?.status === "applied" &&
    receiptAfter.files["CONTRIBUTING.md"]?.baselineHash === sha256(contributingAfter) &&
    receiptAfter.files["AGENTS.md"]?.type === "seed-only";

  cases.push({
    name: "Clean update advances template files and updates receipt to complete",
    ok: Boolean(ok),
    detail: ok ? undefined : `code: ${r.code}, out: ${r.out}`,
  });

  // Case 2: Consecutive sync runs perform zero writes and report clean skip
  const rRepeat = runSync(["--template", TEMPLATE_DIR, "--downstream", sb, "--yes", "--non-interactive"]);
  const contributingRepeat = readFileSync(join(sb, "CONTRIBUTING.md"), "utf8");
  const receiptRepeat = JSON.parse(readFileSync(join(sb, ".template-receipt.json"), "utf8"));

  const okRepeat =
    rRepeat.code === 0 &&
    contributingRepeat === contributingAfter &&
    rRepeat.stdout.includes("update=0") &&
    receiptRepeat.status === "complete";

  cases.push({
    name: "Consecutive sync runs perform zero writes and report clean skip",
    ok: Boolean(okRepeat),
    detail: okRepeat ? undefined : `code: ${rRepeat.code}, out: ${rRepeat.out}`,
  });

  rmSync(sb, { recursive: true, force: true });
}

// Case 3: Unmarked customization halts under --yes --non-interactive with exit 1
{
  const sb = createSandbox("unmarked-customization");
  const oldContributing = "Old Baseline Contributing Content\n";
  const customContributing = "Heavily customized project contributing rules!\nNo LOCAL-EDIT comment here.\n";
  writeFileSync(join(sb, "CONTRIBUTING.md"), customContributing);

  const initialReceipt = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    schemaVersion: 1,
    sourceCommit: "initial0000000000",
    templateVersion: "0.1.0",
    appliedAt: "2026-01-01T00:00:00.000Z",
    status: "complete",
    files: {
      "CONTRIBUTING.md": {
        type: "template-owned",
        baselineHash: sha256(oldContributing),
        status: "applied",
      },
    },
    unresolved: [],
  };
  writeFileSync(join(sb, ".template-receipt.json"), JSON.stringify(initialReceipt, null, 2) + "\n");

  const r = runSync(["--template", TEMPLATE_DIR, "--downstream", sb, "--yes", "--non-interactive"]);
  const contributingAfter = readFileSync(join(sb, "CONTRIBUTING.md"), "utf8");
  const receiptAfter = JSON.parse(readFileSync(join(sb, ".template-receipt.json"), "utf8"));

  const ok =
    r.code === 1 &&
    r.out.includes("conflict(s) encountered in non-interactive mode") &&
    r.out.includes("CONTRIBUTING.md") &&
    contributingAfter === customContributing && // Preserved byte-identical!
    receiptAfter.status === "partial" &&
    receiptAfter.unresolved.some((u: { path: string }) => u.path === "CONTRIBUTING.md");

  cases.push({
    name: "Unmarked customization halts under --yes --non-interactive with exit 1 and preserves file byte-identical",
    ok: Boolean(ok),
    detail: ok ? undefined : `code: ${r.code}, out: ${r.out}`,
  });

  rmSync(sb, { recursive: true, force: true });
}

// Case 4: Legacy --record-baseline creates valid receipt without touching project files and protects conflicts
{
  const sb = createSandbox("legacy-baseline");
  // Seed customized CONTRIBUTING.md and a clean scripts/token-audit.mts (copy from template)
  const customContributing = "Legacy custom contributing guide.\n";
  writeFileSync(join(sb, "CONTRIBUTING.md"), customContributing);

  const tokenAuditSrc = join(TEMPLATE_DIR, "scripts", "token-audit.mts.tmpl");
  mkdirSync(join(sb, "scripts"), { recursive: true });
  writeFileSync(join(sb, "scripts", "token-audit.mts"), readFileSync(tokenAuditSrc, "utf8"));

  const readmeBefore = readFileSync(join(sb, "README.md"), "utf8");

  // Run --record-baseline
  const rRecord = runSync(["--template", TEMPLATE_DIR, "--downstream", sb, "--record-baseline"]);
  const receipt = JSON.parse(readFileSync(join(sb, ".template-receipt.json"), "utf8"));
  const contributingAfterRecord = readFileSync(join(sb, "CONTRIBUTING.md"), "utf8");
  const readmeAfterRecord = readFileSync(join(sb, "README.md"), "utf8");

  const okRecord =
    rRecord.code === 0 &&
    contributingAfterRecord === customContributing &&
    readmeAfterRecord === readmeBefore &&
    receipt.status === "partial" &&
    receipt.files["CONTRIBUTING.md"]?.status === "diverged-unbaselined" &&
    receipt.files["scripts/token-audit.mts"]?.status === "applied" &&
    receipt.unresolved.some((u: { path: string; reason: string }) => u.path === "CONTRIBUTING.md" && u.reason === "legacy-diverged");

  cases.push({
    name: "Legacy --record-baseline records diverged status with zero file modifications",
    ok: Boolean(okRecord),
    detail: okRecord ? undefined : `code: ${rRecord.code}, out: ${rRecord.out}`,
  });

  // Subsequent sync must refuse to overwrite the diverged CONTRIBUTING.md
  const rNextSync = runSync(["--template", TEMPLATE_DIR, "--downstream", sb, "--yes", "--non-interactive"]);
  const contributingAfterSync = readFileSync(join(sb, "CONTRIBUTING.md"), "utf8");

  const okConflict =
    rNextSync.code === 1 &&
    rNextSync.out.includes("CONTRIBUTING.md") &&
    contributingAfterSync === customContributing;

  cases.push({
    name: "Diverged-unbaselined files remain protected conflicts on subsequent sync",
    ok: Boolean(okConflict),
    detail: okConflict ? undefined : `code: ${rNextSync.code}, out: ${rNextSync.out}`,
  });

  rmSync(sb, { recursive: true, force: true });
}

// Case 5: Partial sync retains prior trusted baseline for conflicted files
{
  const sb = createSandbox("partial-sync");
  const trustedContributingBaseline = "Trusted Prior Baseline Contributing\n";
  const customContributing = "Locally modified contributing\n";
  writeFileSync(join(sb, "CONTRIBUTING.md"), customContributing);

  const initialReceipt = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    schemaVersion: 1,
    sourceCommit: "initial0000000000",
    templateVersion: "0.1.0",
    appliedAt: "2026-01-01T00:00:00.000Z",
    status: "complete",
    files: {
      "CONTRIBUTING.md": {
        type: "template-owned",
        baselineHash: sha256(trustedContributingBaseline),
        status: "applied",
      },
    },
    unresolved: [],
  };
  writeFileSync(join(sb, ".template-receipt.json"), JSON.stringify(initialReceipt, null, 2) + "\n");

  const r = runSync(["--template", TEMPLATE_DIR, "--downstream", sb, "--yes", "--non-interactive"]);
  const receiptAfter = JSON.parse(readFileSync(join(sb, ".template-receipt.json"), "utf8"));

  const ok =
    r.code === 1 &&
    receiptAfter.status === "partial" &&
    receiptAfter.files["CONTRIBUTING.md"]?.baselineHash === sha256(trustedContributingBaseline) &&
    receiptAfter.files["CONTRIBUTING.md"]?.status === "applied";

  cases.push({
    name: "Partial sync retains prior trusted baseline hash for conflicted files",
    ok: Boolean(ok),
    detail: ok ? undefined : `receipt: ${JSON.stringify(receiptAfter)}`,
  });

  rmSync(sb, { recursive: true, force: true });
}

let failures = 0;
for (const c of cases) {
  if (c.ok) console.log(`  ok: ${c.name}`);
  else {
    failures++;
    console.error(`  FAIL: ${c.name}`);
    if (c.detail) console.error(`    Detail: ${c.detail}`);
  }
}

if (failures) {
  console.error(`sync-template.test FAILED (${failures}/${cases.length}).`);
  process.exit(1);
}
console.log(`sync-template.test PASS: ${cases.length}/${cases.length}.`);
