// scripts/verify/repro-cli.ts
//
// CLI 入口:read spec → 准备 baseline worktree → 跑 repro-runner → 可选 recordGif → 写 ReproResult JSON。
// 实现见 docs/plans/2026-05-15-suite-1-repro-framework.md Task 5。
//
// recordGif Phase 1 (verification-tooling.md) 还没实现,本期用 stub —— --no-gif 跑骨架,
// 真要录 GIF 时调 stub 会显式抛错告诉你去做 Phase 1。

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveBaselineRef, prepareBaselineWorktree, tryJunctionNodeModules } from "./worktree-shell.ts";
import { runRepro } from "./repro-runner.ts";
import type { ReproSpec, ReproResult } from "./repro-types.ts";

// === Phase 1 stub —— 真实实现来自 verification-tooling.md Phase 1 Task 3 ===
interface RecordGifConfig { sceneScript: string; windowTitle: string; durationSec: number; outDir: string; }
function recordGif(_cfg: RecordGifConfig): { mp4: string; gif: string } {
  throw new Error(
    "recordGif 还未实现(verification-tooling.md Phase 1 Task 3 待做)。" +
    "暂时跑 repro-cli 时加 --no-gif,跑骨架。",
  );
}

interface CliOpts { specPath: string; outDir: string; noGif: boolean; }

function parseArgv(argv: string[]): CliOpts {
  const opts: CliOpts = { specPath: "", outDir: "", noGif: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--no-gif") opts.noGif = true;
    else if (a === "--out") opts.outDir = argv[++i]!;
    else if (!opts.specPath) opts.specPath = a;
  }
  if (!opts.specPath) throw new Error("用法: tsx scripts/verify/repro-cli.ts <spec.ts> [--out <dir>] [--no-gif]");
  if (!opts.outDir) opts.outDir = path.join("docs/acceptance", path.basename(opts.specPath, path.extname(opts.specPath)));
  return opts;
}

async function main(): Promise<void> {
  const opts = parseArgv(process.argv.slice(2));
  const repoRoot = process.cwd();
  // 1. 动态加载 ReproSpec(Windows ESM 需 file:// URL)
  const specUrl = pathToFileURL(path.resolve(opts.specPath)).href;
  const mod = await import(specUrl);
  const spec: ReproSpec = mod.default ?? mod.spec;
  if (!spec || typeof spec.id !== "string") throw new Error(`${opts.specPath} 必须 export default 或 export const spec: ReproSpec`);
  mkdirSync(opts.outDir, { recursive: true });

  // 2. 准备 baseline worktree
  const ref = resolveBaselineRef(repoRoot, spec.baseline.ref, spec.baseline.baseBranch);
  const prep = prepareBaselineWorktree({ repoRoot, specId: spec.id, ref });
  console.log(`[baseline] ref=${ref} dir=${prep.dir}`);
  const junctioned = tryJunctionNodeModules(repoRoot, prep.dir);
  console.log(`[baseline] node_modules junction=${junctioned}${junctioned ? "" : "  (若 spec 跑命令需 deps,请手动到 baseline 跑 pnpm install,或在 spec.steps 里加 install step)"}`);

  let result: ReproResult;
  try {
    // 3. 跑 suite-1
    result = await runRepro({ spec, currentDir: repoRoot, baselineDir: prep.dir });
  } finally {
    prep.cleanup();
  }
  const jsonPath = path.join(opts.outDir, "repro-result.json");
  writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`[result] verdict=${result.verdict}  → ${jsonPath}`);

  // 4. 可选录 GIF
  const winRecordable = process.platform === "win32";
  if (spec.demoScene && !opts.noGif && winRecordable) {
    console.log(`[gif] recording demoScene → ${opts.outDir}`);
    const { gif, mp4 } = recordGif({
      sceneScript: spec.demoScene.sceneScript,
      windowTitle: spec.demoScene.windowTitle,
      durationSec: spec.demoScene.durationSec,
      outDir: opts.outDir,
    });
    console.log(`[gif] mp4=${mp4} gif=${gif}`);
  } else if (spec.demoScene && opts.noGif) {
    console.log(`[gif] skipped (--no-gif)`);
  } else if (spec.demoScene && !winRecordable) {
    console.log(`[gif] skipped (platform ${process.platform} 不支持 gdigrab)`);
  }

  // 5. 退出码:pass=0  fail/ambiguous=非 0
  process.exit(result.verdict === "pass" ? 0 : 1);
}

main().catch((e: Error) => { console.error(e); process.exit(2); });
