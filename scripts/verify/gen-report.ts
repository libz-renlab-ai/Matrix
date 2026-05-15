// scripts/verify/gen-report.ts
//
// Imperative Shell:读 <reportDir>/manifest.json + 校验引用资产存在 + 调 renderReport + 写 report.html。
// 见 docs/plans/2026-05-14-verification-tooling.md Phase 2 Task 5。
//
// 用法:
//   npx tsx scripts/verify/gen-report.ts <reportDir>
// 在 <reportDir> 内需有:
//   manifest.json       —— ReportManifest 的 JSON
//   <manifest.gifPath>            —— 真实屏幕录像
//   <manifest.before.still>       —— before 静态图
//   <manifest.after.still>        —— after 静态图
// 产出:
//   <reportDir>/report.html

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { renderReport } from "./report-core.ts";
import type { ReportManifest } from "./report-core.ts";

export function genReport(reportDir: string): string {
  const manifestPath = path.join(reportDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`缺 manifest.json: ${manifestPath}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as ReportManifest;

  // SPEC 要求自包含、可核验 —— 校验 manifest 引用的资产确实存在
  const missing: string[] = [];
  for (const rel of [manifest.gifPath, manifest.before.still, manifest.after.still]) {
    if (!existsSync(path.join(reportDir, rel))) missing.push(rel);
  }
  if (missing.length > 0) {
    throw new Error(`manifest 引用的资产不存在: ${missing.join(", ")}`);
  }

  const html = renderReport(manifest);
  const out = path.join(reportDir, "report.html");
  writeFileSync(out, html, "utf-8");
  return out;
}

// CLI 入口:tsx 直接跑时 import.meta.url === pathToFileURL(process.argv[1]).href
const isCli = (() => {
  try {
    const argv1 = process.argv[1];
    if (!argv1) return false;
    return import.meta.url.endsWith(path.basename(argv1)) || import.meta.url.includes("/gen-report.ts");
  } catch { return false; }
})();
if (isCli) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("用法: tsx scripts/verify/gen-report.ts <reportDir>");
    process.exit(2);
  }
  try {
    const out = genReport(dir);
    console.log("生成:", out);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
