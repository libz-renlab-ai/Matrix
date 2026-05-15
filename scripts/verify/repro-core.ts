// scripts/verify/repro-core.ts
//
// Suite-1 functional core. 严禁 import node:fs / node:child_process / node:os —— IO/编排在 sibling shells。
// 实现见 docs/plans/2026-05-15-suite-1-repro-framework.md Task 2。
//
// 注:本期 computeVerdict 留了一个 sideMatchesMerged 占位返回 false(只覆盖 pass / fail);
// Task 4 重构 computeVerdict 接收 mergedBefore/mergedAfter,届时占位删除并补 ambiguous case。

import type { ResultMatcher, SideResult, StepResult, Verdict } from "./repro-types.ts";

export function evalMatcher(actual: StepResult, m: ResultMatcher): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (m.exitCode !== undefined && actual.exitCode !== m.exitCode) {
    reasons.push(`exitCode 期望 ${m.exitCode},实际 ${actual.exitCode}`);
  }
  for (const needle of m.stdoutContains ?? []) {
    if (!actual.stdout.includes(needle)) reasons.push(`stdout 缺关键字: ${JSON.stringify(needle)}`);
  }
  for (const needle of m.stdoutNotContains ?? []) {
    if (actual.stdout.includes(needle)) reasons.push(`stdout 不应含: ${JSON.stringify(needle)}`);
  }
  for (const needle of m.stderrContains ?? []) {
    if (!actual.stderr.includes(needle)) reasons.push(`stderr 缺关键字: ${JSON.stringify(needle)}`);
  }
  for (const needle of m.stderrNotContains ?? []) {
    if (actual.stderr.includes(needle)) reasons.push(`stderr 不应含: ${JSON.stringify(needle)}`);
  }
  return { ok: reasons.length === 0, reasons };
}

/** 把多个 step 的 stdout/stderr 拼成单个 StepResult(用于喂给 matcher)。
 *  exitCode 规则:任一非 0 → 取最近的非 0;否则取最后一个(0)。
 *  这样既能复现「中途某步失败」,又不会被无关 0 退出码淹没真问题。 */
export function mergeStepOutputs(steps: StepResult[]): StepResult {
  if (steps.length === 0) {
    return { stepName: "<empty>", exitCode: 0, stdout: "", stderr: "", durationMs: 0, timedOut: false };
  }
  const stdout = steps.map((s) => s.stdout).join("\n");
  const stderr = steps.map((s) => s.stderr).join("\n");
  const durationMs = steps.reduce((sum, s) => sum + s.durationMs, 0);
  const timedOut = steps.some((s) => s.timedOut);
  const lastNonZero = [...steps].reverse().find((s) => s.exitCode !== 0 && s.exitCode !== null);
  const exitCode = lastNonZero?.exitCode ?? steps[steps.length - 1]!.exitCode;
  return { stepName: "<merged>", exitCode, stdout, stderr, durationMs, timedOut };
}

export function computeVerdict(
  before: SideResult,
  after: SideResult,
  beforeMatcher: ResultMatcher,
  afterMatcher: ResultMatcher,
): { verdict: Verdict; verdictReason: string } {
  if (!before.matcherOk || !after.matcherOk) {
    const why: string[] = [];
    if (!before.matcherOk) why.push(`before 期望未达: ${before.matcherReasons.join("; ")}`);
    if (!after.matcherOk) why.push(`after 期望未达: ${after.matcherReasons.join("; ")}`);
    return { verdict: "fail", verdictReason: why.join(" | ") };
  }
  // 两侧 matcherOk 都为 true,但要进一步 sanity:对换 matcher 结果应该 fail,
  // 否则说明两侧输出几乎一样 → 对比未严谨成立,标 ambiguous。
  // 本期占位:Task 4 重构后 computeVerdict 接收 mergedBefore/mergedAfter,届时真做互换 sanity。
  const beforeMergedAfter = sideMatchesMerged(before, afterMatcher);
  const afterMergedBefore = sideMatchesMerged(after, beforeMatcher);
  if (beforeMergedAfter && afterMergedBefore) {
    return { verdict: "ambiguous", verdictReason: "before 也命中了 after 的期望,且 after 也命中了 before 的期望 —— 对比未严谨成立" };
  }
  return { verdict: "pass", verdictReason: "before 与 after 期望均成立,且对比严谨" };
}

function sideMatchesMerged(side: SideResult, m: ResultMatcher): boolean {
  // 占位:Task 4 中 runner 会把 mergedStep 通过另一个签名的 computeVerdict 传入。
  // 本函数为占位 —— 现在覆盖不到 ambiguous case。
  void side; void m;
  return false;
}

export function buildWorktreeAddArgs(path: string, ref: string): string[] {
  return ["worktree", "add", "--detach", path, ref];
}

export function buildWorktreeRemoveArgs(path: string): string[] {
  return ["worktree", "remove", "--force", path];
}

export function makeBaselineDir(tmpDir: string, specId: string, rand6: string): string {
  // 路径段全部 ASCII;Windows 下 git worktree 对 unicode 路径偶有问题
  return `${tmpDir.replace(/[\\/]+$/, "")}/repro-baseline-${specId}-${rand6}`;
}
