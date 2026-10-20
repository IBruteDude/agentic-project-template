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
 * - the rendered skills-lock.json is the 40-pin two-vendor manifest (27 matt
 *   + 13 pstack, flat pstack skillPaths, matt tdd/teach intact)
 * - the adopt path renders the map into a fresh downstream and on a diverged
 *   later run prints the AGENTS NOTICE while keeping the file byte-identical
 *
 * The scratch dir is a working-tree COPY, not a git clone: the spec's
 * uncommitted changes must be exercised, and bootstrap self-deletes the
 * sandbox's template/ (fire-once), so the real tree is never touched.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  // Rendered lock: the bootstrap-rendered skills-lock.json is the 40-pin
  // two-vendor manifest (27 matt + 13 pstack), pstack on flat paths, matt's
  // same-name skills (tdd/teach) still pinned.
  {
    let lock: { skills: Record<string, { source: string; skillPath: string }> } | null = null;
    try { lock = JSON.parse(readFileSync(join(SANDBOX, "skills-lock.json"), "utf8")); }
    catch (e) { console.error(`rendered lock read/parse failed: ${e instanceof Error ? e.message : String(e)}`); }
    const entries = Object.entries(lock?.skills ?? {});
    const matt = entries.filter(([, s]) => s.source === "mattpocock/skills");
    const pstack = entries.filter(([, s]) => s.source === "backnotprop/pstack");
    check("rendered skills-lock.json pins exactly 40 skills (27 matt + 13 pstack)",
      lock !== null && entries.length === 40 && matt.length === 27 && pstack.length === 13);
    check("rendered pstack entries carry all 13 pinned skills on flat skillPath shapes",
      lock !== null && PACK.every((name) =>
        lock!.skills[name] !== undefined && lock!.skills[name].source === "backnotprop/pstack"
        && lock!.skills[name].skillPath === `skills/${name}/SKILL.md`));
    check("matt continuity intact: tdd + teach remain pinned from mattpocock/skills",
      lock !== null && lock.skills["tdd"]?.source === "mattpocock/skills"
        && lock.skills["teach"]?.source === "mattpocock/skills");
  }
}

// 3. Adopt path: adopt straight from this working tree's template/ into a
// scratch downstream (uncommitted changes exercised, like the bootstrap copy):
// first with no AGENTS.md (map renders, AGENTS seed lands), then with a
// diverged downstream AGENTS.md (loud NOTICE; seed-only machinery keeps the
// file byte-identical; the identical map skips under template ownership).
const ADOPT_BASE = join(tmpdir(), "opencode", "skills-map-test-adopt");
rmSync(ADOPT_BASE, { recursive: true, force: true });
mkdirSync(join(ADOPT_BASE, "fresh"), { recursive: true });
function adopt(downstream: string): { status: number | null; out: string } {
  const args = [
    join(ROOT, "template", "adopt.mts"), "--downstream", downstream,
    "--template", join(ROOT, "template"),
    "--input", join(ROOT, "template", "scripts", "fixtures", "sample-inputs.json"),
    "--yes", "--non-interactive",
  ];
  const r = existsSync(localTsx)
    ? spawnSync(localTsx, args, { cwd: ROOT, encoding: "utf8", timeout: 300_000 })
    : spawnSync("npx", ["tsx", ...args], { cwd: ROOT, encoding: "utf8", timeout: 300_000 });
  return { status: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}
const ds = join(ADOPT_BASE, "fresh");
const dsAgents = join(ds, "AGENTS.md");
const adopt1 = adopt(ds);
check("adopt into a downstream with no AGENTS.md renders the map and seeds AGENTS.md",
  adopt1.status === 0 && existsSync(join(ds, "docs", "agents", "skills-map.md"))
    && existsSync(dsAgents) && adopt1.out.includes("create: docs/agents/skills-map.md"));

const diverged = `${existsSync(dsAgents) ? readFileSync(dsAgents, "utf8") : ""}\n## Team-local override (smoke fixture)\n- Diverged on purpose; the seed must not take this back.\n`;
try { writeFileSync(dsAgents, diverged); } catch {}
const adopt2 = adopt(ds);
check("adopt over a diverged AGENTS.md prints the NOTICE, keeps the file byte-identical, and leaves the map protected",
  adopt2.out.includes("NOTICE: AGENTS.md seed differs") && readFileSync(dsAgents, "utf8") === diverged
    && adopt2.out.includes("skip: docs/agents/skills-map.md"));

try { rmSync(ADOPT_BASE, { recursive: true, force: true }); } catch {}

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
