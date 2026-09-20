#!/usr/bin/env tsx
/**
 * scripts/adopt.mts — install the full agentic setup into an existing project in place.
 *
 * Additive by default: missing template-owned files are created, existing files
 * are left as-is and reported as conflicts for an explicit per-file Yes
 * (overwrite or skip), and anything outside the template-owned list is never
 * written. Product code never changes under adoption.
 *
 * Usage (run from a template checkout against an old repo path — same shape as
 * the updater):
 *   npx tsx scripts/adopt.mts --downstream <old-project> [--template <template-checkout>]
 *     [--input <inputs.json>] [--yes] [--non-interactive]
 *
 * - --template defaults to the parent of this file's directory (the template checkout root).
 * - --downstream is required and must differ from --template.
 * - --input is the same shape as the bootstrap fixture. When omitted, values
 *   are infer-then-confirm: slug + org from the downstream git remote, project
 *   name from the downstream package manifest with directory-name fallback,
 *   members and the rest from fixture defaults. Every inferred value is shown
 *   for confirmation in interactive mode.
 * - --yes applies the additive writes (creates + package-manifest merge +
 *   sync record) without prompting. Overwrites of existing template-owned
 *   files always need an interactive per-file Yes and are never applied by
 *   --yes alone. Without --yes in non-interactive mode, conflicts re-report
 *   and nothing overwrites.
 *
 * Collision policy:
 * - Missing template-owned file -> create (no Yes needed).
 * - Identical file -> skip (reruns are a safe no-op).
 * - Differing template-owned file -> conflict (left as-is; interactive
 *   per-file Yes overwrites, otherwise stays conflict).
 * - README.md + CONTEXT.md (glossary) -> always protected: created from the
 *   template only when absent, otherwise reported untouched with no prompt
 *   and kept byte-identical.
 * - package.json -> the sole structural merge: missing scripts and
 *   dependencies are added, existing entries are kept, dependency version
 *   conflicts resolve semver-higher-wins with a report line. Merge applies
 *   with --yes or an interactive per-file Yes; otherwise reported as conflict.
 * - Anything outside the template-owned list (product code, local-only paths,
 *   team-created files) -> never written.
 *
 * Records:
 * - Human log PERSONALIZATION.log.md (inputs plus what was created versus
 *   conflicted versus merged versus protected, consistent with bootstrap).
 *   Created when absent, appended (never rewritten) when present.
 * - Machine record .template-sync.json holding template source, version, and
 *   inputs for future updater renders. The updater reads it when --input is
 *   omitted, so later releases pull without re-asking.
 *
 * Outcomes per file: create / skip / conflict / protected / merged / update.
 * Reruns are idempotent: identical files skip, conflicts re-report, protected
 * stay untouched, merged manifest skips once applied.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { createInterface } from "node:readline";
import { execSync } from "node:child_process";

const ADOPT_FILE = new URL(import.meta.url).pathname;
const ADOPT_DIR = dirname(ADOPT_FILE);
// This file lives at <template-root>/scripts/adopt.mts; the template checkout
// root is its parent.
const TEMPLATE_DEFAULT = resolve(ADOPT_DIR, "..");

type Inputs = {
  projectName: string; projectSlug: string; githubOrg: string; members: string[];
  domainOneliner: string; domainSeedTerms: string; teamSize: string;
  learningDepth: string; stackDesc: string; modelId: string; credentialVar: string;
};

// Template-owned rendered files (same set the wizard renders; README + CONTEXT
// handled separately as always-protected).
const ADOPT_MAP: Record<string, string> = {
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
  // Static team skills (verified token-free; render is a no-op).
  "scripts/template/skills/brief/SKILL.md": ".agents/skills/brief/SKILL.md",
  "scripts/template/skills/brief/agents/openai.yaml": ".agents/skills/brief/agents/openai.yaml",
  "scripts/template/skills/wrap/SKILL.md": ".agents/skills/wrap/SKILL.md",
  "scripts/template/skills/wrap/agents/openai.yaml": ".agents/skills/wrap/agents/openai.yaml",
};

// Always-protected: created only when absent, otherwise untouched with no prompt.
const PROTECTED_MAP: Record<string, string> = {
  "docs/template/README.md.tmpl": "README.md",
  "docs/template/CONTEXT.md.tmpl": "CONTEXT.md",
};

// Root meta synced by direct copy (no tokens). Adopt itself stays in the
// template checkout only and is never copied downstream.
const META = ["TEMPLATE-OWNERSHIP.md", "TEMPLATE-CHANGELOG.md", "scripts/sync-template.mts"];

const SYNC_RECORD = ".template-sync.json";
const PERSONALIZATION_LOG = "PERSONALIZATION.log.md";

// Knowledge/guide/note vocabulary only outside this list (audit helper).
const SCHOOLING = ["academy", "school", "mission", "lesson"];

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

async function ask(q: string, def: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ans: string = await new Promise((res) => rl.question(`${q} [${def}]: `, res));
    return ans.trim() || def;
  } finally { rl.close(); }
}

async function askYes(file: string, what: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ans: string = await new Promise((res) => rl.question(`${what} ${file}? [y/N]: `, res));
    return /^y(es)?$/i.test(ans.trim());
  } finally { rl.close(); }
}

function parseRemote(url: string): { org: string; slug: string } | null {
  const t = url.trim().replace(/\.git$/, "");
  let m = t.match(/github\.com[:/]([^/]+)\/([^/]+)$/);
  if (m) return { org: m[1], slug: m[2] };
  return null;
}

function inferRemote(downstreamRoot: string): { org: string; slug: string } | null {
  try {
    const url = execSync("git remote get-url origin", { cwd: downstreamRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (url) return parseRemote(url);
  } catch {}
  try {
    const cfg = readFileSync(join(downstreamRoot, ".git", "config"), "utf8");
    const m = cfg.match(/url\s*=\s*(.+)/);
    if (m) return parseRemote(m[1]);
  } catch {}
  return null;
}

function inferManifestName(downstreamRoot: string): string | null {
  try {
    const pkg = JSON.parse(readFileSync(join(downstreamRoot, "package.json"), "utf8"));
    if (typeof pkg.name === "string" && pkg.name.trim()) return pkg.name.trim();
  } catch {}
  return null;
}

function toTitleCase(slug: string): string {
  return slug.split(/[-_./\s]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || slug;
}

function loadFixtureDefaults(templateRoot: string): Partial<Inputs> {
  try {
    const p = join(templateRoot, "scripts", "template", "fixtures", "sample-inputs.json");
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  } catch {}
  return {};
}

function templateVersion(templateRoot: string): string {
  try {
    const log = readFileSync(join(templateRoot, "TEMPLATE-CHANGELOG.md"), "utf8");
    const m = log.match(/^##\s+([0-9]+\.[0-9]+\.[0-9]+)/m);
    if (m) return m[1];
  } catch {}
  return "unknown";
}

async function collect(
  cliInput: Partial<Inputs>,
  templateRoot: string,
  downstreamRoot: string,
  nonInteractive: boolean,
): Promise<{ inputs: Inputs; inferred: Record<string, string> }> {
  const fixture = loadFixtureDefaults(templateRoot);
  const remote = inferRemote(downstreamRoot);
  const manifestName = inferManifestName(downstreamRoot);
  const dirBase = basename(resolve(downstreamRoot));

  const dirSlug = dirBase.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || dirBase;
  const inferred: Record<string, string> = {
    projectSlug: String(cliInput.projectSlug ?? remote?.slug ?? dirSlug),
    githubOrg: String(cliInput.githubOrg ?? remote?.org ?? fixture.githubOrg ?? "acme-org"),
    projectName: String(cliInput.projectName ?? (manifestName ? toTitleCase(manifestName) : toTitleCase(dirBase))),
  };

  const str = async (key: keyof Inputs, question: string, def: string): Promise<string> => {
    const v = cliInput[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (nonInteractive) return def;
    return ask(`${question} (inferred: ${def})`, def);
  };

  const membersDefRaw = cliInput.members ?? fixture.members ?? ["ada", "bilal", "camelia"];
  const membersDef = Array.isArray(membersDefRaw) ? (membersDefRaw as string[]).join(", ") : String(membersDefRaw);
  const membersRaw = nonInteractive
    ? membersDef
    : await ask(`Team members, comma-separated (default: ${membersDef})`, membersDef);
  const members = membersRaw.split(",").map((s) => s.trim()).filter(Boolean);

  const inputs: Inputs = {
    projectSlug: await str("projectSlug", "Project slug (repo name)", inferred.projectSlug),
    githubOrg: await str("githubOrg", "GitHub org / owner", inferred.githubOrg),
    projectName: await str("projectName", "Project name (Title Case)", inferred.projectName),
    members,
    domainOneliner: await str("domainOneliner", "Domain one-liner",
      String(cliInput.domainOneliner ?? fixture.domainOneliner ?? "Small-business cash tracking.")),
    domainSeedTerms: await str("domainSeedTerms", "Domain seed terms",
      String(cliInput.domainSeedTerms ?? fixture.domainSeedTerms ?? "entry, balance, correction")),
    teamSize: await str("teamSize", "Team size",
      String(cliInput.teamSize ?? fixture.teamSize ?? String(members.length || 1))),
    learningDepth: await str("learningDepth", "Learning depth (guided | intake-only)",
      String(cliInput.learningDepth ?? fixture.learningDepth ?? "guided")),
    stackDesc: await str("stackDesc", "Stack (free text; unknown parts get VERIFY-TODOs)",
      String(cliInput.stackDesc ?? fixture.stackDesc ?? "Node 22 + TypeScript + Docker")),
    modelId: await str("modelId", "Model id",
      String(cliInput.modelId ?? fixture.modelId ?? "opencode/big-pickle")),
    credentialVar: await str("credentialVar", "Credential env-var for the model (VERIFY-TODO if unsure)",
      String(cliInput.credentialVar ?? fixture.credentialVar ?? "OPENCODE_API_KEY")),
  };
  return { inputs, inferred };
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

function splitVersion(v: string): number[] | null {
  const m = v.trim().replace(/^[v=^\s~<>=\s]+/, "").match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1] ?? 0), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

// Semver-higher-wins for dependency version conflicts (implementer discretion
// per spec; recorded in the template changelog).
function higherVersion(a: string, b: string): string | null {
  const pa = splitVersion(a);
  const pb = splitVersion(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pb[i] > pa[i]) return b;
    if (pa[i] > pb[i]) return a;
  }
  return a;
}

type MergeReport = { lines: string[]; merged: Record<string, unknown>; changed: boolean };

function mergeManifest(existingRaw: string, expectedRaw: string): MergeReport {
  const lines: string[] = [];
  let existing: Record<string, unknown>;
  let expected: Record<string, unknown>;
  try { existing = JSON.parse(existingRaw); }
  catch { return { lines: ["existing package.json is not valid JSON; left untouched"], merged: {}, changed: false }; }
  try { expected = JSON.parse(expectedRaw); }
  catch { return { lines: ["template package.json failed to parse; left untouched"], merged: {}, changed: false }; }

  const merged: Record<string, unknown> = { ...existing };
  let changed = false;

  // Top-level scalar/meta fields: keep existing, add missing.
  for (const [k, v] of Object.entries(expected)) {
    if (k === "scripts" || k === "dependencies" || k === "devDependencies") continue;
    if (!(k in merged)) {
      (merged as Record<string, unknown>)[k] = v;
      lines.push(`added field '${k}'`);
      changed = true;
    }
  }

  // Scripts: missing added, existing kept.
  const expScripts = (expected.scripts ?? {}) as Record<string, string>;
  const curScripts = ((merged.scripts ?? {}) as Record<string, string>);
  for (const [k, v] of Object.entries(expScripts)) {
    if (!(k in curScripts)) {
      curScripts[k] = v;
      lines.push(`added script '${k}': '${v}'`);
      changed = true;
    } else {
      lines.push(`kept existing script '${k}'`);
    }
  }
  merged.scripts = curScripts;

  // Dependencies: missing added, existing kept, version conflicts higher-wins.
  for (const section of ["dependencies", "devDependencies"] as const) {
    const expDeps = ((expected[section] ?? {}) as Record<string, string>);
    const curDeps = (((merged[section] ?? {}) as unknown) as Record<string, string>);
    for (const [k, v] of Object.entries(expDeps)) {
      const unit = section === "dependencies" ? "dependency" : "devDependency";
      if (!(k in curDeps)) {
        curDeps[k] = v;
        lines.push(`added ${unit} '${k}@${v}'`);
        changed = true;
      } else if (curDeps[k] !== v) {
        const winner = higherVersion(curDeps[k], v);
        if (winner && winner !== curDeps[k]) {
          lines.push(`${unit} '${k}' version conflict: existing '${curDeps[k]}' vs template '${v}' -> kept higher '${winner}'`);
          curDeps[k] = winner;
          changed = true;
        } else if (winner) {
          lines.push(`kept existing ${unit} '${k}@${curDeps[k]}' (higher or equal vs template '${v}')`);
        } else {
          lines.push(`kept existing ${unit} '${k}@${curDeps[k]}' (unparseable vs template '${v}')`);
        }
      }
    }
    merged[section] = curDeps;
  }

  return { lines, merged, changed };
}

function auditDownstream(root: string): { tokens: string[]; schooling: string[] } {
  const skipDirs = ["node_modules", ".git", ".scratch", "docs/template", "scripts/template"];
  const skipFiles = [
    PERSONALIZATION_LOG, "TEMPLATE-CHANGELOG.md", "scripts/sync-template.mts", "scripts/adopt.mts",
    "scripts/token-audit.mts", SYNC_RECORD,
  ];
  const allowedPlaceholders = new Set(["ISSUE_NUMBER", "ISSUE_TITLE", "BRANCH"]);
  const tokenHits: string[] = [];
  const schoolingHits: string[] = [];
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    if (!existsSync(dir)) return out;
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      try {
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else out.push(p);
      } catch {}
    }
    return out;
  };
  for (const f of walk(root)) {
    const rel = f.slice(root.length + 1).replace(/\\/g, "/");
    if (skipDirs.some((d) => rel === d || rel.startsWith(d + "/"))) continue;
    if (skipFiles.some((s) => rel === s || rel.endsWith("/" + s))) continue;
    if (rel.startsWith(".agents/skills/")) continue;
    if (!/\.(md|mts|json|ts|js|sh)$/.test(f) && !/Dockerfile|\.gitignore|\.env\.example$/.test(f)) continue;
    let t: string;
    try { t = readFileSync(f, "utf8"); } catch { continue; }
    const tmAll = t.match(/\{\{[A-Z][A-Z0-9_]+\}\}/g) ?? [];
    const tm = tmAll.filter((m) => !allowedPlaceholders.has(m.slice(2, -2)));
    if (tm.length) tokenHits.push(`${rel}: ${[...new Set(tm)].join(", ")}`);
    if (/\.md$/.test(f)) {
      for (const w of SCHOOLING) {
        if (new RegExp(`\\b${w}s?\\b`, "i").test(t)) { schoolingHits.push(`${rel}: schooling '${w}'`); break; }
      }
    }
  }
  return { tokens: tokenHits, schooling: schoolingHits };
}

async function main() {
  const args = parseArgs();
  const templateRoot = resolve(String(args.template ?? TEMPLATE_DEFAULT));
  const downstreamArg = args.downstream;
  if (!downstreamArg || typeof downstreamArg !== "string") {
    console.error("Usage: npx tsx scripts/adopt.mts --downstream <old-project> [--template <checkout>] [--input <json>] [--yes] [--non-interactive]");
    process.exit(1);
  }
  const downstreamRoot = resolve(downstreamArg);
  const yesAll = Boolean(args.yes);
  const nonInteractive = Boolean(args["non-interactive"]);
  const inputPath = typeof args.input === "string" ? String(args.input) : undefined;

  if (!existsSync(join(templateRoot, "TEMPLATE-OWNERSHIP.md"))) {
    console.error(`Not a template checkout: ${templateRoot} (missing TEMPLATE-OWNERSHIP.md)`);
    process.exit(1);
  }
  if (!existsSync(downstreamRoot)) {
    console.error(`Downstream path does not exist: ${downstreamRoot}`);
    process.exit(1);
  }
  if (templateRoot === downstreamRoot) {
    console.error("Template and downstream must differ: run from a template checkout against an old repo path.");
    process.exit(1);
  }

  let cliInput: Partial<Inputs> = {};
  if (inputPath) {
    if (!existsSync(inputPath)) {
      console.error(`Input file not found: ${inputPath}`);
      process.exit(1);
    }
    try { cliInput = JSON.parse(readFileSync(inputPath, "utf8")); }
    catch (e) { console.error(`Cannot parse input JSON ${inputPath}:`, e); process.exit(1); }
  }
  if (typeof (cliInput as Record<string, unknown>).members === "string") {
    cliInput.members = (cliInput as unknown as { members: string }).members.split(",").map((s: string) => s.trim()) as unknown as string[];
  }

  const { inputs: inp } = await collect(cliInput, templateRoot, downstreamRoot, nonInteractive);
  const version = templateVersion(templateRoot);

  console.log(`Adopting ${downstreamRoot} from template ${templateRoot} (version ${version}).`);
  console.log(`Inputs: ${inp.projectName} (${inp.projectSlug}) org ${inp.githubOrg} members ${inp.members.join(", ")} stack '${inp.stackDesc}' model ${inp.modelId}.`);

  const outcomes: Record<string, string[]> = { create: [], skip: [], conflict: [], protected: [], merged: [], update: [] };
  const mergeLines: string[] = [];

  // 1. Always-protected glossary + README: create only when absent.
  for (const [srcRel, destRel] of Object.entries(PROTECTED_MAP)) {
    const src = join(templateRoot, srcRel);
    if (!existsSync(src)) continue;
    const dest = join(downstreamRoot, destRel);
    if (!existsSync(dest)) {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, renderText(readFileSync(src, "utf8"), inp));
      outcomes.create.push(destRel + " (protected seed, was absent)");
    } else {
      outcomes.protected.push(destRel + " (untouched)");
    }
  }

  // 2. Template-owned files (package.json handled as merge below).
  for (const [srcRel, destRel] of Object.entries(ADOPT_MAP)) {
    if (destRel === "package.json") continue;
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
    if (readFileSync(dest, "utf8") === expected) { outcomes.skip.push(destRel); continue; }
    if (!nonInteractive && !yesAll) {
      const ok = await askYes(destRel, "Overwrite");
      if (ok) {
        writeFileSync(dest, expected);
        outcomes.update.push(destRel + " (per-file Yes)");
      } else {
        outcomes.conflict.push(destRel + " (declined; needs explicit Yes)");
      }
      continue;
    }
    outcomes.conflict.push(destRel + " (differs; needs explicit per-file Yes)");
  }

  // 3. Root meta by direct copy (same additive policy; never overwrites with --yes alone).
  for (const rel of META) {
    const src = join(templateRoot, rel);
    if (!existsSync(src)) continue;
    const expected = readFileSync(src, "utf8");
    const dest = join(downstreamRoot, rel);
    if (!existsSync(dest)) {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, expected);
      outcomes.create.push(rel);
      continue;
    }
    if (readFileSync(dest, "utf8") === expected) { outcomes.skip.push(rel); continue; }
    if (!nonInteractive && !yesAll) {
      const ok = await askYes(rel, "Overwrite");
      if (ok) {
        writeFileSync(dest, expected);
        outcomes.update.push(rel + " (per-file Yes)");
      } else {
        outcomes.conflict.push(rel + " (declined)");
      }
      continue;
    }
    outcomes.conflict.push(rel + " (differs; needs explicit per-file Yes)");
  }

  // 4. Package manifest: sole structural merge.
  {
    const src = join(templateRoot, "scripts", "template", "package.json.tmpl");
    const expectedRaw = renderText(readFileSync(src, "utf8"), inp);
    const dest = join(downstreamRoot, "package.json");
    if (!existsSync(dest)) {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, expectedRaw);
      outcomes.create.push("package.json (was absent)");
    } else {
      const currentRaw = readFileSync(dest, "utf8");
      if (currentRaw === expectedRaw) {
        outcomes.skip.push("package.json");
      } else {
        const { lines, merged, changed } = mergeManifest(currentRaw, expectedRaw);
        mergeLines.push(...lines);
        if (!changed) {
          outcomes.skip.push("package.json (merge: no changes)");
        } else if (yesAll) {
          writeFileSync(dest, JSON.stringify(merged, null, 2) + "\n");
          outcomes.merged.push("package.json");
        } else if (!nonInteractive) {
          console.log("Proposed package.json merge:");
          for (const l of lines) console.log(`  merge: ${l}`);
          const ok = await askYes("package.json", "Merge runner wiring into");
          if (ok) {
            writeFileSync(dest, JSON.stringify(merged, null, 2) + "\n");
            outcomes.merged.push("package.json");
          } else {
            outcomes.conflict.push("package.json (merge declined; needs explicit Yes)");
          }
        } else {
          outcomes.conflict.push("package.json (differs; rerun with --yes to merge)");
        }
      }
    }
  }

  // 5. Machine sync record (inputs for future updater renders without re-asking).
  {
    const record = { template: templateRoot, version, inputs: inp };
    const recordRaw = JSON.stringify(record, null, 2) + "\n";
    const dest = join(downstreamRoot, SYNC_RECORD);
    if (!existsSync(dest)) {
      writeFileSync(dest, recordRaw);
      outcomes.create.push(SYNC_RECORD);
    } else {
      try {
        const cur = JSON.parse(readFileSync(dest, "utf8"));
        const same = JSON.stringify({ template: cur.template, version: cur.version, inputs: cur.inputs }) ===
          JSON.stringify({ template: record.template, version: record.version, inputs: record.inputs });
        // Same template+version+inputs -> skip (idempotent). Template path may
        // differ across checkouts, so compare version+inputs when paths differ.
        const sameInputs = JSON.stringify(cur.inputs) === JSON.stringify(record.inputs) &&
          String(cur.version) === String(record.version);
        if (same || sameInputs) {
          outcomes.skip.push(SYNC_RECORD);
        } else if (yesAll) {
          writeFileSync(dest, recordRaw);
          outcomes.update.push(SYNC_RECORD);
        } else if (!nonInteractive) {
          const ok = await askYes(SYNC_RECORD, "Update machine sync record");
          if (ok) {
            writeFileSync(dest, recordRaw);
            outcomes.update.push(SYNC_RECORD);
          } else {
            outcomes.conflict.push(SYNC_RECORD + " (declined)");
          }
        } else {
          outcomes.conflict.push(SYNC_RECORD + " (differs; needs explicit Yes)");
        }
      } catch {
        if (yesAll || !nonInteractive) {
          if (yesAll || await askYes(SYNC_RECORD, "Rewrite machine sync record")) {
            writeFileSync(dest, recordRaw);
            outcomes.update.push(SYNC_RECORD + " (rewrote unparseable)");
          } else {
            outcomes.conflict.push(SYNC_RECORD + " (unparseable; declined)");
          }
        } else {
          outcomes.conflict.push(SYNC_RECORD + " (unparseable; needs explicit Yes)");
        }
      }
    }
  }

  // 6. Human personalization log (consistent with bootstrap; append-only).
  {
    const dest = join(downstreamRoot, PERSONALIZATION_LOG);
    const entry = `\n## Adopt ${new Date().toISOString().slice(0, 10)}\n- Template: ${templateRoot} (version ${version})\n- Project: ${inp.projectName} (${inp.projectSlug}) — org \`${inp.githubOrg}\`\n- Members: ${inp.members.join(", ")} (team size ${inp.teamSize})\n- Domain: ${inp.domainOneliner}\n- Domain seed terms: ${inp.domainSeedTerms}\n- Learning depth: ${inp.learningDepth}\n- Stack: ${inp.stackDesc}\n  - VERIFY-TODO: confirm package manager / test / typecheck commands for this stack; adapt \`.sandcastle/Dockerfile\` + \`package.json\` scripts.\n- Model: ${inp.modelId} via \`OPENCODE_MODEL\`\n- Credential var: \`${inp.credentialVar}\`\n- Outcomes: create=${outcomes.create.length} skip=${outcomes.skip.length} conflict=${outcomes.conflict.length} protected=${outcomes.protected.length} merged=${outcomes.merged.length} update=${outcomes.update.length}\n`;
    if (!existsSync(dest)) {
      const log = `# Personalization log\n\nAdopted into an existing project by \`scripts/adopt.mts\` (additive; reruns are a safe no-op).\n\n- Date: ${new Date().toISOString().slice(0, 10)}\n- Project: ${inp.projectName} (${inp.projectSlug}) — org \`${inp.githubOrg}\`\n- Members: ${inp.members.join(", ")} (team size ${inp.teamSize})\n- Domain: ${inp.domainOneliner}\n- Domain seed terms: ${inp.domainSeedTerms}\n- Learning depth: ${inp.learningDepth} (guided = walkthroughs + intake; intake-only = inbox without walkthroughs)\n- Stack: ${inp.stackDesc}\n  - VERIFY-TODO: confirm package manager / test / typecheck commands for this stack; adapt \`.sandcastle/Dockerfile\` + \`package.json\` scripts.\n- Model: ${inp.modelId} via \`OPENCODE_MODEL\` (default in \`.sandcastle/main.mts\`, override in \`.sandcastle/.env\`)\n- Credential var: \`${inp.credentialVar}\`\n  - VERIFY-TODO: confirm the credential for this model on the host (\`opencode providers login\` or the env var) for headless runs.\n- Created (${outcomes.create.length}): ${outcomes.create.join(", ") || "—"}\n- Conflicted (${outcomes.conflict.length}): ${outcomes.conflict.join("; ") || "—"}\n- Protected (${outcomes.protected.length}): ${outcomes.protected.join("; ") || "—"}\n- Merged (${outcomes.merged.length}): ${outcomes.merged.join(", ") || "—"}\n${entry}\n## Verify\n\n- [ ] \`npx tsx scripts/token-audit.mts\` passes (0 tokens, wording clean).\n- [ ] \`cp .sandcastle/.env.example .sandcastle/.env\`, then fill \`GH_TOKEN\` + model credential (never committed).\n- [ ] First issue map created; \`gh issue list\` works from host and sandbox.\n`;
      writeFileSync(dest, log);
      outcomes.create.push(PERSONALIZATION_LOG + " (adopt record)");
    } else {
      try { appendFileSync(dest, entry); }
      catch (e) { console.error(`Cannot append ${PERSONALIZATION_LOG}:`, e); }
    }
  }

  const { tokens, schooling } = auditDownstream(downstreamRoot);
  console.log(`\nadopt outcomes: create=${outcomes.create.length} skip=${outcomes.skip.length} conflict=${outcomes.conflict.length} protected=${outcomes.protected.length} merged=${outcomes.merged.length} update=${outcomes.update.length}`);
  for (const f of outcomes.create) console.log(`  create: ${f}`);
  for (const f of outcomes.merged) console.log(`  merged: ${f}`);
  for (const f of outcomes.update) console.log(`  update: ${f}`);
  for (const f of outcomes.skip) console.log(`  skip: ${f}`);
  for (const f of outcomes.conflict) console.log(`  conflict: ${f}`);
  for (const f of outcomes.protected) console.log(`  protected: ${f}`);
  for (const l of mergeLines) console.log(`  package-merge: ${l}`);
  console.log(`Audit: ${tokens.length} token hits, ${schooling.length} wording hits.`);
  for (const h of [...tokens, ...schooling]) console.log("  FAIL:", h);
  if (tokens.length || schooling.length) {
    console.error("Audit FAILED — adopted tree has unrendered tokens or wording hits. Fix inputs or templates, then re-run (safe no-op for identical files).");
    process.exit(1);
  }
  console.log(`Adopt complete. Human record: ${PERSONALIZATION_LOG}; machine record: ${SYNC_RECORD} (updater reads it when --input is omitted).`);
  console.log("Next: cp .sandcastle/.env.example .sandcastle/.env, fill GH_TOKEN + model credential, run scripts/token-audit.mts, pull later releases with scripts/sync-template.mts.");
}

main().catch((e) => { console.error(e); process.exit(1); });
