// scripts/verify/repro-core.test.ts
//
// Plan #1 Task 2 测试集 — 覆盖 repro-core 全部纯函数。
// 用 node:test(node 22 内置),无需第三方测试库。

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evalMatcher,
  computeVerdict,
  buildWorktreeAddArgs,
  buildWorktreeRemoveArgs,
  mergeStepOutputs,
} from "./repro-core.ts";
import type { ReproStep, ResultMatcher, SideResult, StepResult } from "./repro-types.ts";

const okStep = (over: Partial<StepResult> = {}): StepResult => ({
  stepName: "demo", exitCode: 0, stdout: "", stderr: "", durationMs: 1, timedOut: false, ...over,
});

test("evalMatcher: 无字段的 matcher 默认通过", () => {
  const r = evalMatcher(okStep(), {});
  assert.deepEqual(r, { ok: true, reasons: [] });
});

test("evalMatcher: exitCode 不匹配 → fail", () => {
  const r = evalMatcher(okStep({ exitCode: 1 }), { exitCode: 0 });
  assert.equal(r.ok, false);
  assert.match(r.reasons[0]!, /exitCode/);
});

test("evalMatcher: stdoutContains 全部命中才通过", () => {
  const s = okStep({ stdout: "决策: deny\n应改用: dayjs" });
  assert.equal(evalMatcher(s, { stdoutContains: ["deny", "dayjs"] }).ok, true);
  assert.equal(evalMatcher(s, { stdoutContains: ["deny", "missing-token"] }).ok, false);
});

test("evalMatcher: stdoutNotContains 任一命中即 fail", () => {
  const s = okStep({ stdout: "决策: 通过 (无规则命中)" });
  assert.equal(evalMatcher(s, { stdoutNotContains: ["deny"] }).ok, true);
  assert.equal(evalMatcher(s, { stdoutNotContains: ["通过"] }).ok, false);
});

test("mergeStepOutputs: 把多个 step 拼成单个 StepResult,exitCode 取最近的非 0", () => {
  const merged = mergeStepOutputs([
    okStep({ stdout: "a", exitCode: 0 }),
    okStep({ stdout: "b", exitCode: 1 }),
    okStep({ stdout: "c", exitCode: 0 }),
  ]);
  assert.equal(merged.exitCode, 1);   // 最近的非 0 优先
  assert.equal(merged.stdout, "a\nb\nc");
});

test("computeVerdict: before 期望成立 + after 期望成立 + 互换 matcher 区分两侧 → pass", () => {
  const before: SideResult = { side: "before", steps: [], matcherOk: true, matcherReasons: [] };
  const after: SideResult = { side: "after", steps: [], matcherOk: true, matcherReasons: [] };
  const mergedBefore = okStep({ stdout: "通过 (无规则命中)" });
  const mergedAfter = okStep({ stdout: "决策: deny  应改用: dayjs" });
  const r = computeVerdict(
    before, after, mergedBefore, mergedAfter,
    { stdoutContains: ["通过"] }, { stdoutContains: ["deny"] },
  );
  assert.equal(r.verdict, "pass");
});

test("computeVerdict: 任一侧 matcherOk 为 false → fail", () => {
  const before: SideResult = { side: "before", steps: [], matcherOk: false, matcherReasons: ["缺 通过"] };
  const after: SideResult = { side: "after", steps: [], matcherOk: true, matcherReasons: [] };
  const mergedBefore = okStep();
  const mergedAfter = okStep();
  const r = computeVerdict(before, after, mergedBefore, mergedAfter, {}, {});
  assert.equal(r.verdict, "fail");
});

test("computeVerdict: 互换 matcher 双方都命中 → ambiguous", () => {
  const before: SideResult = { side: "before", steps: [], matcherOk: true, matcherReasons: [] };
  const after: SideResult = { side: "after", steps: [], matcherOk: true, matcherReasons: [] };
  const sameOutput = okStep({ stdout: "X" });
  const r = computeVerdict(
    before, after, sameOutput, sameOutput,
    { stdoutContains: ["X"] }, { stdoutContains: ["X"] },
  );
  assert.equal(r.verdict, "ambiguous");
});

test("buildWorktreeAddArgs / buildWorktreeRemoveArgs: 命令拼装", () => {
  assert.deepEqual(
    buildWorktreeAddArgs("/tmp/repro-baseline-abc123", "deadbeef"),
    ["worktree", "add", "--detach", "/tmp/repro-baseline-abc123", "deadbeef"],
  );
  assert.deepEqual(
    buildWorktreeRemoveArgs("/tmp/repro-baseline-abc123"),
    ["worktree", "remove", "--force", "/tmp/repro-baseline-abc123"],
  );
});

// 让未直接使用的 import 不被 noUnusedLocals 报错(类型在测试 fixture 与对断言等价)
void ({} as unknown as ReproStep);
void ({} as unknown as ResultMatcher);
