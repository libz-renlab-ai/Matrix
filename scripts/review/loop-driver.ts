// scripts/review/loop-driver.ts
//
// Imperative Shell:循环编排 —— review-cli → 不过派 fix subagent → 等 fix-marker → 再 review,
// 直到 verdict=pass、达 maxRetries 上限、或 subagent skip。
// 见 docs/plans/2026-05-15-local-review-loop.md Task 5。

import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import path from "node:path";
import { runAllChecks } from "./run-checks.ts";
import { aggregateVerdict } from "./review-core.ts";
import type { LoopOptions, ReviewResult } from "./review-types.ts";

interface DriverOpts extends LoopOptions {
  outDir: string;
  /** "agent" = 用 Claude Code Agent tool 派 subagent;"manual" = 打印 prompt 后 exit,人接手 */
  fixMode: "agent" | "manual";
}

function tmpRoot(): string {
  return process.platform === "win32"
    ? (process.env["TEMP"] ?? "C:/Windows/Temp")
    : "/tmp";
}
const FIX_MARKER = path.join(tmpRoot(), "fix-marker");

function parseArgv(argv: string[]): DriverOpts {
  const o: DriverOpts = {
    maxRetries: 3,
    reproResultPath: "",
    baseBranch: "main",
    testCommand: "C:/bzli/Matrix/node_modules/.bin/tsx.cmd",
    testArgs: ["--test", "scripts/lock-core.test.ts"],
    outDir: "",
    // 默认 manual —— Agent tool IPC hook 还未落地;见 SKILL.md
    fixMode: process.env["CLAUDE_CODE_AGENT"] === "1" ? "agent" : "manual",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--repro") o.reproResultPath = argv[++i]!;
    else if (a === "--out") o.outDir = argv[++i]!;
    else if (a === "--max-retries") o.maxRetries = Number(argv[++i]!);
    else if (a === "--base") o.baseBranch = argv[++i]!;
    else if (a === "--test-cmd") {
      const parts = argv[++i]!.trim().split(/\s+/);
      o.testCommand = parts[0]!;
      o.testArgs = parts.slice(1);
    } else if (a === "--fix-mode") {
      o.fixMode = argv[++i] as "agent" | "manual";
    }
  }
  if (!o.reproResultPath) {
    throw new Error(
      "用法: tsx scripts/review/loop-driver.ts --repro <path> [--out <dir>] [--max-retries 3] [--fix-mode agent|manual] [--test-cmd \"<cmd>\"]",
    );
  }
  if (!o.outDir) o.outDir = path.dirname(o.reproResultPath);
  return o;
}

interface Attempt {
  attempt: number;
  verdict: "pass" | "fail";
  failureKind?: string;
  fixOutcome?: "fixed" | "skipped" | "no-marker" | "manual-mode";
  fixSkipReason?: string;
}

function runOneRound(opts: DriverOpts): ReviewResult {
  const criteria = runAllChecks({ repoRoot: process.cwd(), loop: opts });
  return aggregateVerdict(criteria);
}

async function dispatchFixSubagent(prompt: string): Promise<{ outcome: "fixed" | "skipped" | "no-marker"; skipReason?: string }> {
  // Claude Code 的 Agent tool 是 host CC 的特性,不是 Node API。
  // driver 只能通过约定 IPC 触发:写 fix-prompt + 落 fix-pending 文件;
  // 期待 host CC hook 监听 fix-pending → 用 Agent tool 派 subagent →
  // subagent 修完 echo done > fix-marker(或 echo "skip:<reason>" > fix-marker)。
  // hook 还未实现 → 调本函数实际会卡在轮询。Agent 模式默认关闭(见 fixMode 默认值)。
  const tmp = tmpRoot();
  const promptFile = path.join(tmp, "fix-prompt");
  const pendingFile = path.join(tmp, "fix-pending");
  writeFileSync(promptFile, prompt, "utf-8");
  writeFileSync(pendingFile, new Date().toISOString(), "utf-8");
  console.log(`[driver] 已写 ${promptFile} + ${pendingFile};等待 host hook 派 subagent...`);

  const start = Date.now();
  const TIMEOUT = 30 * 60 * 1000;
  while (Date.now() - start < TIMEOUT) {
    if (existsSync(FIX_MARKER)) {
      const content = readFileSync(FIX_MARKER, "utf-8").trim();
      unlinkSync(FIX_MARKER);
      if (existsSync(pendingFile)) unlinkSync(pendingFile);
      if (content.startsWith("skip:")) {
        return { outcome: "skipped", skipReason: content.slice(5).trim() };
      }
      return { outcome: "fixed" };
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return { outcome: "no-marker" };
}

async function main(): Promise<void> {
  const opts = parseArgv(process.argv.slice(2));
  mkdirSync(opts.outDir, { recursive: true });
  const attempts: Attempt[] = [];
  let final: ReviewResult | null = null;

  for (let i = 1; i <= opts.maxRetries + 1; i++) {
    console.log(`\n=== Round ${i}/${opts.maxRetries + 1} ===`);
    const r = runOneRound(opts);
    final = r;
    if (r.verdict === "pass") {
      attempts.push({ attempt: i, verdict: "pass" });
      console.log(`[driver] verdict=pass —— 退出循环`);
      break;
    }
    const fd = r.fixDirective!;
    console.log(`[driver] verdict=fail (${fd.failureKind})`);
    if (i > opts.maxRetries) {
      attempts.push({ attempt: i, verdict: "fail", failureKind: fd.failureKind });
      console.log(`[driver] 已达 maxRetries=${opts.maxRetries},停止循环`);
      break;
    }
    if (opts.fixMode === "manual") {
      attempts.push({
        attempt: i, verdict: "fail",
        failureKind: fd.failureKind, fixOutcome: "manual-mode",
      });
      console.log(`[driver] fix-mode=manual,打印 prompt 后退出 —— 由人接手`);
      console.log(`\n---- FIX PROMPT ----\n${fd.prompt}\n--------------------\n`);
      break;
    }
    const { outcome, skipReason } = await dispatchFixSubagent(fd.prompt);
    attempts.push({
      attempt: i, verdict: "fail",
      failureKind: fd.failureKind,
      fixOutcome: outcome,
      fixSkipReason: skipReason,
    });
    if (outcome === "skipped") {
      console.log(`[driver] subagent skip;停止循环。理由: ${skipReason ?? "(无)"}`);
      break;
    }
    if (outcome === "no-marker") {
      console.log(`[driver] 等待 fix-marker 超时 —— 停止循环`);
      break;
    }
    console.log(`[driver] subagent 报告已修,准备下一轮 review...`);
  }

  const outFile = path.join(opts.outDir, "review-verdict.json");
  writeFileSync(outFile, JSON.stringify({ ...final, attempts }, null, 2), "utf-8");
  console.log(`\n[driver] 最终: verdict=${final!.verdict}  → ${outFile}`);
  process.exit(final!.verdict === "pass" ? 0 : 1);
}

main().catch((e: Error) => { console.error(e); process.exit(2); });
