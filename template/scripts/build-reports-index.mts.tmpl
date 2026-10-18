#!/usr/bin/env tsx
/**
 * scripts/build-reports-index.mts — regenerate the static index for
 * agent-published HTML reports.
 *
 * Usage: npx tsx scripts/build-reports-index.mts <site-dir>
 *
 * <site-dir> is a checkout of the orphan `gh-pages` branch. The script scans
 * <site-dir>/reports/<slug>/index.html, extracts each page title, and writes
 * <site-dir>/reports/index.html (newest first) plus a <site-dir>/index.html
 * landing page. All links are relative: project Pages sites serve under
 * https://<owner>.github.io/<repo>/ and root-absolute paths would break.
 */

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pageTitle(dir: string, slug: string): string {
  try {
    const html = readFileSync(join(dir, "index.html"), "utf8");
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const t = (m?.[1] ?? "").replace(/\s+/g, " ").trim();
    if (t) return t;
  } catch {}
  return slug;
}

function main(): void {
  const siteDir = process.argv[2];
  if (!siteDir || !existsSync(siteDir) || !statSync(siteDir).isDirectory()) {
    console.error("Usage: build-reports-index.mts <site-dir>  (a checkout of the gh-pages branch)");
    process.exit(1);
  }
  const reportsDir = join(siteDir, "reports");
  let slugs: string[] = [];
  try {
    slugs = readdirSync(reportsDir).filter((e) => {
      if (e === "index.html") return false;
      try {
        return statSync(join(reportsDir, e)).isDirectory() && existsSync(join(reportsDir, e, "index.html"));
      } catch {
        return false;
      }
    });
  } catch {
    slugs = [];
  }
  slugs.sort().reverse();
  const items = slugs
    .map((s) => `    <li><a href="./${encodeURIComponent(s)}/">${escapeHtml(pageTitle(join(reportsDir, s), s))}</a></li>`)
    .join("\n");
  const list = items || "    <li>No reports published yet.</li>";
  const reportsIndex = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reports</title></head>
<body>
<h1>Reports</h1>
<ul>
${list}
</ul>
</body>
</html>
`;
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(join(reportsDir, "index.html"), reportsIndex);
  const landing = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reports</title><meta http-equiv="refresh" content="0; url=./reports/"></head>
<body><p><a href="./reports/">Reports</a></p></body>
</html>
`;
  writeFileSync(join(siteDir, "index.html"), landing);
  console.log(`Indexed ${slugs.length} report(s).`);
}

main();
