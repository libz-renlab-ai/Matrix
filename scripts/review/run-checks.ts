// scripts/review/run-checks.ts
//
// Imperative Shell:跑 WORKFLOW.md 第 4 步两条标准。
//   - 标准 1:读套件 1 产出的 repro-result.json,要求 verdict = "pass"
//   - 标准 2:测试全过 + 工作树干净 + 与 baseBranch 无冲突
//
// 见 docs/plans/2026-05-15-local-review-loop.md Task 3。

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import type { CriterionResult, LoopOptions } from "./review-types.ts";

/** 标准 1:读套件 1 产出的 repro-result.json,要求 verdict = "pass" */
export function checkReproPass(reproResultPath: string): CriterionResult {
  if (!existsSync(reproResultPath)) {
    return {
      id: "repro-pass", ok: false,
      summary: `missing repro-result.json: ${reproResultPath}`,
      details: "先跑套件 1 产出该文件,再跑 review。\n  npx tsx scripts/verify/repro-cli.ts <spec.ts> --out <dir>",
    };
  }
  let parsed: { verdict?: string; verdictReason?: string };
  try {
    parsed = JSON.parse(readFileSync(reproResultPath, "utf-8")) as { verdict?: string; verdictReason?: string };
  } catch (e) {
    return {
      id: "repro-pass", ok: false,
      summary: `repro-result.json 解析失败`,
      details: String(e),
    };
  }
  const verdict = parsed.verdict ?? "<missing verdict>";
  if (verdict === "pass") {
    return {
      id: "repro-pass", ok: true,
      summary: `verdict=pass`,
      details: parsed.verdictReason ?? "",
    };
  }
  return {
    id: "repro-pass", ok: false,
    summary: `verdict=${verdict}`,
    details: parsed.verdictReason ?? "(无 verdictReason)",
  };
}

interface MergeCheckOpts {
  repoRoot: string;
  baseBranch: string;
  testCommand: string;
  testArgs: string[];
}

/** 标准 2:测试全过 + 工作树干净 + 与 baseBranch 无冲突 */
export function checkTestsAndMergeClean(opts: MergeCheckOpts): CriterionResult {
  // 1) 跑测试
  // Windows 下 .cmd / .bat / .ps1 等 shim 通过 spawnSync 直调会 EINVAL,
  // 必须走 shell: true 才能解析 PATHEXT(node 子进程不会自动做)。
  const needsShell = process.platform === "win32"
    && /\.(cmd|bat|ps1)$/i.test(opts.testCommand);
  const tests = spawnSync(opts.testCommand, opts.testArgs, {
    cwd: opts.repoRoot, encoding: "utf-8", shell: needsShell,
  });
  if (tests.error) {
    return {
      id: "tests-and-merge-clean", ok: false,
      summary: `test command spawn 失败(${tests.error.message})`,
      details: `cmd: ${opts.testCommand} ${opts.testArgs.join(" ")}`,
    };
  }
  if (tests.status !== 0) {
    return {
      id: "tests-and-merge-clean", ok: false,
      summary: `tests failing (exit ${tests.status})`,
      details: trimTo((tests.stdout ?? "") + (tests.stderr ?? ""), 4000),
    };
  }

  // 2) 工作树干净
  const status = spawnSync("git", ["status", "--porcelain"], {
    cwd: opts.repoRoot, encoding: "utf-8",
  });
  const dirtyLines = status.stdout.trim().length > 0
    ? status.stdout.trim().split(/\r?\n/)
    : [];
  if (dirtyLines.length > 0) {
    return {
      id: "tests-and-merge-clean", ok: false,
      summary: `tests pass; working tree dirty (${dirtyLines.length} entries)`,
      details: dirtyLines.slice(0, 50).join("\n"),
    };
  }

  // 3) 与 baseBranch 无冲突(fetch + merge-tree;无副作用)
  spawnSync("git", ["fetch", "origin", opts.baseBranch], {
    cwd: opts.repoRoot, encoding: "utf-8",
  });
  // git 2.38+ 的 merge-tree --write-tree 输出 tree OID + 冲突文件;
  // 旧版输出 diff 形式。两种形式里有冲突都会出现 "<<<<<<<" 或 exit !=0;以此作主信号。
  const mergeTree = spawnSync("git", ["merge-tree", `origin/${opts.baseBranch}`, "HEAD"], {
    cwd: opts.repoRoot, encoding: "utf-8",
  });
  const merged = (mergeTree.stdout ?? "") + (mergeTree.stderr ?? "");
  if (merged.includes("<<<<<<<") || mergeTree.status !== 0) {
    // 抓冲突文件名(两种格式都尝试):
    //   旧:"changed in both ... base ... <mode> <oid> <path>"
    //   新:"CONFLICT (content): <path>" 或仅 <path> 列在末尾
    const filesOldFmt = [...merged.matchAll(/^changed in both[\s\S]*?\n {2}base\s+\S+ \S+ (\S+)$/gm)].map((m) => m[1]!);
    const filesNewFmt = [...merged.matchAll(/CONFLICT \(.+?\): (.+)/g)].map((m) => m[1]!);
    const conflictFiles = [...new Set([...filesOldFmt, ...filesNewFmt])];
    return {
      id: "tests-and-merge-clean", ok: false,
      summary: `merge conflict with origin/${opts.baseBranch}`,
      details: conflictFiles.length ? conflictFiles.join("\n") : trimTo(merged, 2000),
    };
  }

  return {
    id: "tests-and-merge-clean", ok: true,
    summary: `tests pass + tree clean + no conflict with ${opts.baseBranch}`,
    details: "",
  };
}

function trimTo(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + `\n…(truncated ${s.length - n} chars)` : s;
}

/** 跑两条标准,返回 [criterion1, criterion2] */
export function runAllChecks(opts: { repoRoot: string; loop: LoopOptions }): CriterionResult[] {
  const c1 = checkReproPass(opts.loop.reproResultPath);
  const c2 = checkTestsAndMergeClean({
    repoRoot: opts.repoRoot,
    baseBranch: opts.loop.baseBranch,
    testCommand: opts.loop.testCommand,
    testArgs: opts.loop.testArgs,
  });
  return [c1, c2];
}
