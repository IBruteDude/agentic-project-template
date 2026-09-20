#!/usr/bin/env tsx
/**
 * scripts/bootstrap.mts — fire-once template wizard.
 *
 * Renders docs/template/*.tmpl + scripts/template/* tokens into a clean project,
 * writes PERSONALIZATION.log.md + .template-sync.json (machine inputs for later
 * sync-template pulls), runs token + wording audits, then self-deletes plus
 * template sources. Reruns are NOT supported (log is the record).
 *
 * Canonical path is agent-driven (see README): the agent collects inputs, then:
 *   npx tsx scripts/bootstrap.mts [--input <inputs.json>] [--yes]
 *   npx tsx scripts/bootstrap.mts --non-interactive --input <json>   # fixture proof / CI
 *
 * Identity inputs have NO placeholder defaults: projectName, projectSlug,
 * githubOrg, members[], domainOneliner, domainSeedTerms. Interactive runs
 * re-prompt until answered; non-interactive runs fail loudly when missing.
 * Optional knobs keep defaults: teamSize (derived), learningDepth, stackDesc,
 * modelId (default opencode/big-pickle), credentialVar (default OPENCODE_API_KEY).
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { createInterface } from "node:readline";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const DOCS_TMPL = join(ROOT, "docs", "template");
const SCRIPTS_TMPL = join(ROOT, "scripts", "template");
const FIXTURE_DEFAULT = join(SCRIPTS_TMPL, "fixtures", "sample-inputs.json");

const TOKENS = [
  "PROJECT_NAME", "PROJECT_SLUG", "GITHUB_ORG", "MEMBER_LIST", "MEMBER_PIPE",
  "DOMAIN_ONELINER", "DOMAIN_SEED_TERMS", "STACK_DESC", "MODEL_ID",
  "CREDENTIAL_VAR", "LEARNING_DEPTH", "V1_SCOPE",
] as const;

// Schooling metaphors: must be zero in rendered project files (excludes vendored
// skills, TEMPLATE-CHANGELOG history, PERSONALIZATION log, and this wizard itself).
const SCHOOLING = ["academy", "school", "mission", "lesson"];

type Inputs = {
  projectName: string; projectSlug: string; githubOrg: string; members: string[];
  domainOneliner: string; domainSeedTerms: string; teamSize: string;
  learningDepth: string; stackDesc: string; modelId: string; credentialVar: string;
};

function parseArgs(): { inputPath?: string; nonInteractive: boolean; yes: boolean } {
  const a = process.argv.slice(2);
  let inputPath: string | undefined;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--input" && a[i + 1]) inputPath = a[i + 1];
    if (a[i].startsWith("--input=")) inputPath = a[i].slice("--input=".length);
  }
  return {
    inputPath,
    nonInteractive: a.includes("--non-interactive"),
    yes: a.includes("--yes") || a.includes("--non-interactive"),
  };
}

async function ask(q: string, def: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ans: string = await new Promise((res) => rl.question(`${q} [${def}]: `, res));
    return ans.trim() || def;
  } finally { rl.close(); }
}

async function collect(cliInput?: Partial<Inputs>, nonInteractive = false): Promise<Inputs> {
  // Identity inputs: no placeholder defaults. Interactive re-prompts until
  // answered; non-interactive fails loudly instead of rendering placeholders.
  const required = async (key: keyof Inputs, q: string): Promise<string> => {
    const v = cliInput?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length) return (v as unknown as string[]).join(", ");
    if (nonInteractive) {
      console.error(`Missing required input '${String(key)}': pass --input JSON with all identity fields (no placeholder defaults).`);
      process.exit(1);
    }
    let ans = "";
    while (!ans) ans = await ask(q, "");
    return ans;
  };
  const optional = async (key: keyof Inputs, q: string, def: string): Promise<string> => {
    const v = cliInput?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length) return (v as unknown as string[]).join(", ");
    if (nonInteractive) return def;
    return ask(q, def);
  };
  const membersRaw = await required("members" as keyof Inputs, "Team members (comma-separated usernames)");
  const members = membersRaw.split(",").map((s) => s.trim()).filter(Boolean);
  return {
    projectName: await required("projectName", "Project name (Title Case)"),
    projectSlug: await required("projectSlug", "Project slug (lowercase, repo name)"),
    githubOrg: await required("githubOrg", "GitHub org / owner"),
    members,
    domainOneliner: await required("domainOneliner", "Domain one-liner"),
    domainSeedTerms: await required("domainSeedTerms", "Domain seed terms (comma-separated)"),
    teamSize: await optional("teamSize", "Team size", String(members.length || 3)),
    learningDepth: await optional("learningDepth", "Learning depth (guided | intake-only)", "guided"),
    stackDesc: await optional("stackDesc", "Stack (free text; unknown parts get VERIFY-TODOs)", "Node 22 + TypeScript + Docker"),
    modelId: await optional("modelId", "Model id", "opencode/big-pickle"),
    credentialVar: await optional("credentialVar", "Credential env-var for the model (VERIFY-TODO if unsure)", "OPENCODE_API_KEY"),
  };
}

// destination map: template source -> rendered project path
function destFor(srcRel: string): string | null {
  const norm = srcRel.replace(/\\/g, "/");
  // docs/template/*.tmpl -> final prose path
  const docsMap: Record<string, string> = {
    "docs/template/README.md.tmpl": "README.md",
    "docs/template/AGENTS.md.tmpl": "AGENTS.md",
    "docs/template/CONTRIBUTING.md.tmpl": "CONTRIBUTING.md",
    "docs/template/CONTEXT.md.tmpl": "CONTEXT.md",
    "docs/template/domain.md.tmpl": "docs/agents/domain.md",
    "docs/template/git-workflow.md.tmpl": "docs/agents/git-workflow.md",
    "docs/template/issue-tracker.md.tmpl": "docs/agents/issue-tracker.md",
    "docs/template/personal-status.md.tmpl": "docs/agents/personal-status.md",
    "docs/template/triage-labels.md.tmpl": "docs/agents/triage-labels.md",
    "docs/template/knowledge-index.md.tmpl": "docs/knowledge/inbox/INDEX.md",
    "docs/template/adr-readme.md.tmpl": "docs/adr/README.md",
    "docs/template/adr-0000-template.md.tmpl": "docs/adr/0000-template.md",
  };
  if (docsMap[norm]) return join(ROOT, docsMap[norm]);
  // scripts/template/* -> final runnable path
  const scriptsMap: Record<string, string> = {
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
  if (scriptsMap[norm]) return join(ROOT, scriptsMap[norm]);
  return null;
}

function renderText(text: string, inp: Inputs): string {
  const memberList = inp.members.join(", ");
  const memberPipe = inp.members.join("|");
  const vals: Record<string, string> = {
    PROJECT_NAME: inp.projectName, PROJECT_SLUG: inp.projectSlug, GITHUB_ORG: inp.githubOrg,
    MEMBER_LIST: memberList, MEMBER_PIPE: memberPipe, DOMAIN_ONELINER: inp.domainOneliner,
    DOMAIN_SEED_TERMS: inp.domainSeedTerms, STACK_DESC: inp.stackDesc, MODEL_ID: inp.modelId,
    CREDENTIAL_VAR: inp.credentialVar, LEARNING_DEPTH: inp.learningDepth, V1_SCOPE: `see PERSONALIZATION.log.md (${inp.domainOneliner.slice(0, 80)}…)`,
  };
  let out = text;
  for (const [k, v] of Object.entries(vals)) out = out.split(`{{${k}}}`).join(v);
  return out;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function audit(root: string): { tokens: string[]; schooling: string[] } {
  const skipDirs = ["node_modules", ".git", ".scratch", "docs/template", "scripts/template"];
  const skipFiles = ["scripts/bootstrap.mts", "scripts/adopt.mts", "PERSONALIZATION.log.md", "TEMPLATE-CHANGELOG.md", "scripts/sync-template.mts", "scripts/token-audit.mts", ".template-sync.json"];
  // Runtime prompt placeholders (sandcastle lane-safe prompts) — intentional, not bootstrap tokens.
  const allowedPlaceholders = new Set(["ISSUE_NUMBER", "ISSUE_TITLE", "BRANCH"]);
  const tokenHits: string[] = [];
  const schoolingHits: string[] = [];
  const files = walk(root).filter((f) => {
    const rel = f.slice(root.length + 1).replace(/\\/g, "/");
    if (skipDirs.some((d) => rel === d || rel.startsWith(d + "/"))) return false;
    if (skipFiles.some((s) => rel === s || rel.endsWith("/" + s))) return false;
    if (rel.startsWith(".agents/skills/")) return false; // vendored upstream skills
    if (!/\.(md|mts|json|ts|js|sh|mts\.tmpl|md\.tmpl)$/.test(f) && !/Dockerfile|\.gitignore|\.env\.example$/.test(f)) return false;
    return true;
  });
  for (const f of files) {
    let t: string;
    try { t = readFileSync(f, "utf8"); } catch { continue; }
    const rel = f.slice(root.length + 1);
    const tmAll = t.match(/\{\{[A-Z][A-Z0-9_]+\}\}/g) ?? [];
    const tm = tmAll.filter((m) => !allowedPlaceholders.has(m.slice(2, -2)));
    if (tm.length) tokenHits.push(`${rel}: ${[...new Set(tm)].join(", ")}`);
    // wording audit only on prose-ish files
    if (/\.(md|md\.tmpl)$/.test(f)) {
      for (const w of SCHOOLING) {
        const re = new RegExp(`\\b${w}s?\\b`, "i");
        if (re.test(t)) { schoolingHits.push(`${rel}: schooling '${w}'`); break; }
      }
    }
  }
  return { tokens: tokenHits, schooling: schoolingHits };
}

// Single version source shared with adopt: the top `## X.Y.Z` line of
// TEMPLATE-CHANGELOG.md, so both writers can never disagree (no skew).
function templateVersion(): string {
  try {
    const log = readFileSync(join(ROOT, "TEMPLATE-CHANGELOG.md"), "utf8");
    const m = log.match(/^##\s+([0-9]+\.[0-9]+\.[0-9]+)/m);
    if (m) return m[1];
  } catch {}
  return "unknown";
}

async function main() {
  const { inputPath, nonInteractive } = parseArgs();
  let cliInput: Partial<Inputs> = {};
  const p = inputPath ?? (existsSync(FIXTURE_DEFAULT) ? FIXTURE_DEFAULT : undefined);
  if (p && existsSync(p)) {
    try { cliInput = JSON.parse(readFileSync(p, "utf8")); }
    catch (e) { console.error(`Cannot parse input JSON ${p}:`, e); process.exit(1); }
  }
  // normalize members array from fixture
  if (typeof (cliInput as Record<string, unknown>).members === "string") {
    cliInput.members = (cliInput as unknown as { members: string }).members.split(",").map((s: string) => s.trim()) as unknown as string[];
  }
  const inp = await collect(cliInput, nonInteractive);

  // render
  const sources = [...walk(DOCS_TMPL), ...walk(SCRIPTS_TMPL)]
    .filter((f) => !f.includes(`${"/"}fixtures${"/"}`))
    .filter((f) => f.endsWith(".tmpl"));
  if (sources.length === 0) { console.error("No .tmpl sources found under docs/template + scripts/template."); process.exit(1); }
  const rendered: string[] = [];
  for (const src of sources) {
    const rel = src.slice(ROOT.length + 1).replace(/\\/g, "/");
    const dest = destFor(rel);
    if (!dest) { console.log(`skip (no destination): ${rel}`); continue; }
    const text = readFileSync(src, "utf8");
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, renderText(text, inp));
    rendered.push(dest.slice(ROOT.length + 1));
  }

  // personalization log
  const log = `# Personalization log\n\nRendered from agentic-project-template by fire-once \`scripts/bootstrap.mts\`.\nReruns are not supported; hand-tune from here. Template sources + wizard self-deleted after success.\n\n- Date: ${new Date().toISOString().slice(0, 10)}\n- Project: ${inp.projectName} (${inp.projectSlug}) — org \`${inp.githubOrg}\`\n- Members: ${inp.members.join(", ")} (team size ${inp.teamSize})\n- Domain: ${inp.domainOneliner}\n- Domain seed terms: ${inp.domainSeedTerms}\n- Learning depth: ${inp.learningDepth} (guided = walkthroughs + intake; intake-only = inbox without walkthroughs)\n- Stack: ${inp.stackDesc}\n  - VERIFY-TODO: confirm package manager / test / typecheck commands for this stack; adapt \`.sandcastle/Dockerfile\` + \`package.json\` scripts.\n- Model: ${inp.modelId} via \`OPENCODE_MODEL\` (default in \`.sandcastle/main.mts\`, override in \`.sandcastle/.env\`)\n- Credential var: \`${inp.credentialVar}\`\n  - VERIFY-TODO: confirm the credential for this model on the host (\`opencode providers login\` or the env var) for headless runs.\n- Rendered ${rendered.length} files:\n${rendered.map((r) => `  - \`${r}\``.trim()).join("\n")}\n\n## Verify\n\n- [ ] \`npx tsx scripts/token-audit.mts\` passes (0 tokens, wording clean).\n- [ ] \`cp .sandcastle/.env.example .sandcastle/.env\`, then fill \`GH_TOKEN\` + model credential (never committed).\n- [ ] First issue map created; \`gh issue list\` works from host and sandbox.\n`;
  writeFileSync(join(ROOT, "PERSONALIZATION.log.md"), log);

  // machine sync record: template source, version, inputs. sync-template reads
  // it when --input is omitted, so later releases pull without re-asking.
  const record = { template: ROOT, version: templateVersion(), inputs: inp };
  writeFileSync(join(ROOT, ".template-sync.json"), JSON.stringify(record, null, 2) + "\n");

  // audit before self-delete
  const { tokens, schooling } = audit(ROOT);
  console.log(`\nRendered ${rendered.length} files. Audit: ${tokens.length} token hits, ${schooling.length} schooling hits.`);
  for (const h of [...tokens, ...schooling]) console.log("  FAIL:", h);
  if (tokens.length || schooling.length) {
    console.error("Audit FAILED — fix templates/inputs, then re-run before deleting anything.");
    process.exit(1);
  }

  // fire-once self-delete: wizard + template sources
  try { rmSync(join(ROOT, "scripts", "bootstrap.mts"), { force: true }); } catch {}
  try { rmSync(DOCS_TMPL, { recursive: true, force: true }); } catch {}
  try { rmSync(SCRIPTS_TMPL, { recursive: true, force: true }); } catch {}
  console.log("Bootstrap complete. Wizard + docs/template + scripts/template removed. See PERSONALIZATION.log.md.");
}

main().catch((e) => { console.error(e); process.exit(1); });
