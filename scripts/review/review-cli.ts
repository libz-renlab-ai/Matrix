// scripts/review/review-cli.ts
//
// CLI 入口:跑一次 review(两条标准),写 review-verdict.json,退出码反映 verdict。
// 见 docs/plans/2026-05-15-local-review-loop.md Task 4。
//
// 用法:
//   tsx scripts/review/review-cli.ts --repro <path> [--out <dir>]
//                                    [--test-cmd "<cmd> <args>"] [--base main]

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { runAllChecks } from "./run-checks.ts";
import { aggregateVerdict } from "./review-core.ts";
import type { LoopOptions } from "./review-types.ts";

interface CliOpts {
  reproResult: string;
  out: string;
  testCmd: string;
  baseBranch: string;
}

function parseArgv(argv: string[]): CliOpts {
  const o: CliOpts = {
    reproResult: "",
    out: "",
    // 默认:scripts/lock-core.test.ts 用 tsx --test 跑(node:test runner);
    // 项目级真实 review 应传 --test-cmd "pnpm test" 或绝对路径的 vitest.cmd
    testCmd: "C:/bzli/Matrix/node_modules/.bin/tsx.cmd --test scripts/lock-core.test.ts",
    baseBranch: "main",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--repro") o.reproResult = argv[++i]!;
    else if (a === "--out") o.out = argv[++i]!;
    else if (a === "--test-cmd") o.testCmd = argv[++i]!;
    else if (a === "--base") o.baseBranch = argv[++i]!;
  }
  if (!o.reproResult) {
    throw new Error(
      "用法: tsx scripts/review/review-cli.ts --repro <path> [--out <dir>] [--test-cmd \"<cmd>\"] [--base main]",
    );
  }
  if (!o.out) o.out = path.dirname(o.reproResult);
  return o;
}

function splitTestCmd(s: string): { command: string; args: string[] } {
  // 简单分隔:按空白切;不支持引号里的空格(本地脚本场景够用)。
  const parts = s.trim().split(/\s+/);
  return { command: parts[0]!, args: parts.slice(1) };
}

function main(): void {
  const o = parseArgv(process.argv.slice(2));
  const { command, args } = splitTestCmd(o.testCmd);
  const loop: LoopOptions = {
    maxRetries: 3,
    reproResultPath: o.reproResult,
    baseBranch: o.baseBranch,
    testCommand: command,
    testArgs: args,
  };
  const criteria = runAllChecks({ repoRoot: process.cwd(), loop });
  const result = aggregateVerdict(criteria);
  mkdirSync(o.out, { recursive: true });
  const outFile = path.join(o.out, "review-verdict.json");
  writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");
  console.log(`[review] verdict=${result.verdict}  → ${outFile}`);
  if (result.fixDirective) {
    console.log(`[review] failureKind=${result.fixDirective.failureKind}`);
    console.log(`[review] fix prompt 见 review-verdict.json 的 fixDirective.prompt 字段;loop-driver 会取用。`);
  }
  process.exit(result.verdict === "pass" ? 0 : 1);
}

main();
