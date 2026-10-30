#!/usr/bin/env tsx
/**
 * scripts/smoke-test-fixture.mts — smoke test executing bootstrap.mts into an
 * isolated temporary downstream project, asserting:
 * 1. bootstrap renders successfully and self-deletes template/
 * 2. rendered project passes strict typechecking (tsc --noEmit)
 * 3. token-audit passes on all rendered files (zero unrendered tokens)
 */
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(decodeURIComponent(new URL(import.meta.url).pathname)), "..");
const TSX = join(ROOT, "node_modules", ".bin", "tsx");
const TSC = join(ROOT, "node_modules", ".bin", "tsc");
const SANDBOX = join(tmpdir(), "agentic-fixture-smoke-" + Date.now());

console.log(`Setting up smoke-test sandbox at: ${SANDBOX}`);
rmSync(SANDBOX, { recursive: true, force: true });
mkdirSync(SANDBOX, { recursive: true });

// Copy working tree excluding node_modules, .git, .scratch
for (const entry of readdirSync(ROOT)) {
  if (["node_modules", ".git", ".scratch"].includes(entry)) continue;
  cpSync(join(ROOT, entry), join(SANDBOX, entry), { recursive: true });
}
// Copy node_modules so npx/tsx inside bootstrap uses local binary without network delay
cpSync(join(ROOT, "node_modules"), join(SANDBOX, "node_modules"), { recursive: true });

// 1. Run bootstrap.mts into SANDBOX
console.log("Running bootstrap.mts in sandbox...");
const boot = spawnSync(TSX, [
  join(SANDBOX, "template", "bootstrap.mts"),
  "--non-interactive",
  "--input", join(SANDBOX, "template", "scripts", "fixtures", "sample-inputs.json"),
], { cwd: SANDBOX, encoding: "utf8", timeout: 60_000 });

if (boot.status !== 0) {
  console.error("bootstrap.mts FAILED:\n" + boot.stdout + "\n" + boot.stderr);
  process.exit(1);
}
console.log("  ok: bootstrap.mts completed successfully");

// Verify template/ self-deleted
if (existsSync(join(SANDBOX, "template"))) {
  console.error("FAIL: template/ was not self-deleted by bootstrap");
  process.exit(1);
}
console.log("  ok: template/ payload self-deleted");

// 2. Run typecheck inside rendered fixture

console.log("Running typecheck inside rendered fixture...");
const tc = spawnSync(TSC, ["--noEmit"], { cwd: SANDBOX, encoding: "utf8", timeout: 60_000 });
if (tc.status !== 0) {
  console.error("Fixture typecheck FAILED:\n" + tc.stdout + "\n" + tc.stderr);
  process.exit(1);
}
console.log("  ok: rendered fixture passes strict typecheck (tsc --noEmit)");

// 3. Run token audit on rendered fixture files
console.log("Running token audit on rendered fixture files...");
const auditScript = join(SANDBOX, "scripts", "token-audit.mts");
if (!existsSync(auditScript)) {
  console.error("FAIL: scripts/token-audit.mts not present in rendered fixture");
  process.exit(1);
}
const audit = spawnSync(TSX, [auditScript], { cwd: SANDBOX, encoding: "utf8", timeout: 60_000 });
if (audit.status !== 0) {
  console.error("Token audit FAILED:\n" + audit.stdout + "\n" + audit.stderr);
  process.exit(1);
}
console.log("  ok: token audit passed with 0 unrendered tokens");

// Clean up
try { rmSync(SANDBOX, { recursive: true, force: true }); } catch {}
console.log("Fixture smoke test PASS: all checks succeeded.");
