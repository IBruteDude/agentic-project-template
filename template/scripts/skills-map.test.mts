#!/usr/bin/env tsx
/**
 * template/scripts/skills-map.test.mts — plain-TS spec for the rendered skills
 * map artifact (the repo has no test runner; convention is a plain .mts that
 * asserts its contract, like lock-preflight.test.mts).
 *
 * Seam under test: the dest maps in all three runners render
 * template/docs/skills-map.md.tmpl -> docs/agents/skills-map.md, and the seed
 * files make the map discoverable (AGENTS.md pointer, glossary terms).
 *
 * Asserted here, against a scratch copy of this working tree:
 * - every runner's dest map carries the entry (static check)
 * - a fixture bootstrap renders docs/agents/skills-map.md with both vendors,
 *   all 13 pinned pstack skills, the locked boundaries, and clean wording
 * - the rendered AGENTS.md seed carries the Engineering skills pointer
 * - the rendered CONTEXT.md carries both glossary terms in ## Language
 *
 * The scratch dir is a working-tree COPY, not a git clone: the spec's
 * uncommitted changes must be exercised, and bootstrap self-deletes the
 * sandbox's template/ (fire-once), so the real tree is never touched.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(decodeURIComponent(new URL(import.meta.url).pathname)), "..", "..");
const PACK = [
  "unslop", "how", "blast-radius", "technical-writing",
  "create-verification-skill", "maintain-verification-skill",
  "benchmark-checklist", "correct", "principle-attack-the-premise",
  "principle-boundary-discipline", "principle-make-operations-idempotent",
  "principle-explain-the-number", "principle-build-the-lever",
];
const BANNED = ["academy", "school", "mission", "lesson"];

const cases: Array<{ name: string; ok: boolean }> = [];
function check(name: string, ok: boolean): void {
  cases.push({ name, ok });
}

// 1. Dest-map wiring: each runner must map the artifact to its rendered path.
const runners: Array<[string, string, RegExp]> = [
  ["bootstrap.mts", "template/bootstrap.mts", /"template\/docs\/skills-map\.md\.tmpl":\s*"docs\/agents\/skills-map\.md"/],
  ["adopt.mts", "template/adopt.mts", /"docs\/skills-map\.md\.tmpl":\s*"docs\/agents\/skills-map\.md"/],
  ["sync-template.mts", "template/sync-template.mts", /"docs\/skills-map\.md\.tmpl":\s*"docs\/agents\/skills-map\.md"/],
];
for (const [name, rel, re] of runners) {
  check(`${name} dest map renders the map artifact`, re.test(readFileSync(join(ROOT, rel), "utf8")));
}

// 2. Scratch bootstrap renders the artifact (plus the seed pointers).
const SANDBOX = join(tmpdir(), "opencode", "skills-map-test");
rmSync(SANDBOX, { recursive: true, force: true });
mkdirSync(dirname(SANDBOX), { recursive: true });
cpSync(ROOT, SANDBOX, {
  recursive: true,
  filter: (src) => !/(^|[\\/])node_modules$/.test(src) && !/(^|[\\/])\.git($|\.)/.test(src) && !/(^|[\\/])\.scratch$/.test(src),
});

const bootArgs = [
  join(SANDBOX, "template", "bootstrap.mts"), "--non-interactive",
  "--input", join(SANDBOX, "template", "scripts", "fixtures", "sample-inputs.json"),
];
const localTsx = join(ROOT, "node_modules", ".bin", "tsx");
const boot = existsSync(localTsx)
  ? spawnSync(localTsx, bootArgs, { cwd: SANDBOX, encoding: "utf8", timeout: 300_000 })
  : spawnSync("npx", ["tsx", ...bootArgs], { cwd: SANDBOX, encoding: "utf8", timeout: 300_000 });
const bootOut = `${boot.stdout ?? ""}${boot.stderr ?? ""}`.trim();

if (boot.status !== 0) {
  check("fixture bootstrap exits 0 with the map in the rendered set", false);
  console.error(`bootstrap exit ${boot.status}:\n${bootOut.slice(-2000)}`);
} else {
  const handoff = join(SANDBOX, "PERSONALIZATION.log.md");
  check("fixture bootstrap exits 0 with the map in the rendered set",
    existsSync(handoff) && readFileSync(handoff, "utf8").includes("`docs/agents/skills-map.md`"));

  const mapPath = join(SANDBOX, "docs", "agents", "skills-map.md");
  check("rendered docs/agents/skills-map.md exists", existsSync(mapPath));
  if (existsSync(mapPath)) {
    const map = readFileSync(mapPath, "utf8");
    check("map names both vendors", map.includes("mattpocock/skills") && map.includes("backnotprop/pstack"));
    check("map lists all 13 pinned pstack skills", PACK.every((s) => map.includes(`\`${s}\``)));
    check("map states the locked pr/technical-writing boundary",
      map.includes("`pr` sets the PR body's structure") && map.includes("`technical-writing` sets the prose"));
    check("map states ask-matt routes the matt vendor only", /`ask-matt` routes the matt vendor only/.test(map));
    check("map states colliding/subsumed principles are absorbed as wording, not installed",
      map.includes("absorbed as wording, not installed"));
    check("map states the pack is you-typed, not model-invoked", map.includes("You-typed, not model-invoked"));
    check("map renders clean: no unrendered tokens, no banned wording",
      !/\{\{[A-Z][A-Z0-9_]+\}\}/.test(map) && !BANNED.some((w) => new RegExp(`\\b${w}s?\\b`, "i").test(map)));
  }

  const agentsPath = join(SANDBOX, "AGENTS.md");
  if (existsSync(agentsPath)) {
    const agents = readFileSync(agentsPath, "utf8");
    check("rendered AGENTS.md seed carries the Engineering skills section with the map pointer",
      agents.includes("### Engineering skills") && agents.includes("docs/agents/skills-map.md")
        && agents.includes("routes only the matt vendor"));
  } else {
    check("rendered AGENTS.md seed carries the Engineering skills section with the map pointer", false);
  }

  const contextPath = join(SANDBOX, "CONTEXT.md");
  if (existsSync(contextPath)) {
    const ctx = readFileSync(contextPath, "utf8");
    const lang = ctx.slice(ctx.indexOf("## Language"));
    check("rendered CONTEXT.md ## Language carries both glossary terms, alphabetical",
      lang.includes("**team skills**") && lang.includes("**upstream set**")
        && lang.indexOf("**team skills**") < lang.indexOf("**upstream set**"));
    check("rendered CONTEXT.md upstream-set wording names both vendors",
      /currently `mattpocock\/skills` and `backnotprop\/pstack`/.test(ctx));
  } else {
    check("rendered CONTEXT.md ## Language carries both glossary terms, alphabetical", false);
  }
}

try { rmSync(SANDBOX, { recursive: true, force: true }); } catch {}

let failures = 0;
for (const c of cases) {
  if (c.ok) console.log(`  ok: ${c.name}`);
  else { failures++; console.error(`  FAIL: ${c.name}`); }
}
if (failures) {
  console.error(`skills-map.test FAILED (${failures}/${cases.length}).`);
  process.exit(1);
}
console.log(`skills-map.test PASS: ${cases.length}/${cases.length}.`);
