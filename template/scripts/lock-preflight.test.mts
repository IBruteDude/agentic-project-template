#!/usr/bin/env tsx
/**
 * template/scripts/lock-preflight.test.mts — plain-TS spec for the lock
 * preflight check (the repo has no test runner; convention is a plain .mts
 * that spawns the check and asserts its exit contract, like the audits).
 *
 * Seam under test: the rendered CLI `npx tsx scripts/lock-preflight.mts <lock>`.
 * It catches dead upstream pins in any skills-lock manifest it is pointed at;
 * it does not catch hash drift (`npx skills update`'s job) or lock shape.
 *
 * Exit contract asserted here:
 * - a dead pin -> exit 1, naming the entry (name + skillPath + HTTP status)
 * - an all-live lock -> exit 0 with a PASS line
 * - an unverifiable entry -> inconclusive warning, exit 0 (never a false dead)
 *
 * The check materializes the .tmpl payload as the rendered
 * scripts/lock-preflight.mts before running (render is a no-op: no tokens), so
 * tests exercise exactly the artifact downstream projects run.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(decodeURIComponent(new URL(import.meta.url).pathname)), "..", "..");
const SRC = join(ROOT, "template", "scripts", "lock-preflight.mts.tmpl");
const FIXTURES = join(ROOT, "template", "scripts", "fixtures", "locks");
const TSX = join(ROOT, "node_modules", ".bin", "tsx");

// A control pin must resolve, or this box is offline and verdicts are meaningless.
try {
  const probe = await fetch("https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/implement-spec/SKILL.md", { method: "HEAD", signal: AbortSignal.timeout(10_000) });
  if (!probe.ok) throw new Error(`probe HTTP ${probe.status}`);
} catch (e) {
  console.log(`lock-preflight.test SKIP: upstream unreachable (${e instanceof Error ? e.message : String(e)})`);
  process.exit(0);
}

// Rendered-artifact sandbox: <sandbox>/scripts/lock-preflight.mts (script dir -1 = its ROOT).
const SANDBOX = join(tmpdir(), "opencode", "lock-preflight-test");
rmSync(SANDBOX, { recursive: true, force: true });
mkdirSync(join(SANDBOX, "scripts"), { recursive: true });
writeFileSync(join(SANDBOX, "scripts", "lock-preflight.mts"), readFileSync(SRC, "utf8"));

// Inconclusive-branch fixture: an unsupported sourceType is deterministic and
// network-independent — the entry can never be verified, so it must warn (a
// "could not be checked" line, exit 0) and never be reported dead. (A
// never-resolving host fixture is NOT usable here: sandbox HTTP proxies can
// 404 unresolvable hosts, mirroring a genuine dead pin.)
const UNCHECKED = join(SANDBOX, "unchecked.json");
writeFileSync(UNCHECKED, JSON.stringify({
  version: 1,
  skills: {
    "how": {
      "source": "backnotprop/pstack",
      "sourceType": "gitlab",
      "skillPath": "skills/how/SKILL.md",
      "computedHash": "fixture0000000000000000000000000000000000000000000000000000000000"
    }
  }
}, null, 2) + "\n");

function run(lockPath: string): { code: number | null; out: string } {
  const r = spawnSync(TSX, [join(SANDBOX, "scripts", "lock-preflight.mts"), lockPath], { cwd: ROOT, encoding: "utf8", timeout: 120_000 });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

const cases: Array<{ name: string; ok: boolean; detail?: string }> = [];
{
  const r = run(join(FIXTURES, "has-dead-pin.json"));
  const ok = r.code === 1
    && r.out.includes("FAILED (1)")
    && r.out.includes("dead-pin-regression-fixture")
    && r.out.includes("skills/engineering/dead-pin-regression-fixture/SKILL.md")
    && /HTTP (404|4[0-9][0-9])/.test(r.out)
    && !r.out.includes("implement-spec");
  cases.push({ name: "dead pin fails loud naming name + skillPath + HTTP status, live entries unblamed", ok });
}
{
  const r = run(join(FIXTURES, "all-live.json"));
  cases.push({ name: "all-live lock passes exit 0 with a PASS line", ok: r.code === 0 && r.out.includes("PASS") && r.out.includes("2/2 pins resolve live") });
}
{
  const r = run(UNCHECKED);
  cases.push({ name: "unverifiable entry (unsupported sourceType) warns, exit 0, never a false dead pin", ok: r.code === 0 && r.out.includes("could not be checked") && !/FAILED/.test(r.out) });
}
try { rmSync(SANDBOX, { recursive: true, force: true }); } catch {}

let failures = 0;
for (const c of cases) {
  if (c.ok) console.log(`  ok: ${c.name}`);
  else { failures++; console.error(`  FAIL: ${c.name}`); }
}
if (failures) {
  console.error(`lock-preflight.test FAILED (${failures}/${cases.length}).`);
  process.exit(1);
}
console.log(`lock-preflight.test PASS: ${cases.length}/${cases.length}.`);
