# 套件 1 · 复现验证代码框架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prereq:** 先读 `docs/plans/2026-05-15-suite-1-brainstorm.md` —— 4 条决议是本 plan 的输入。

**Goal:** 把 `docs/WORKFLOW.md` 第 3 步「两套验证 · 套件 1」从概念落地成可跑工具。任何 feature 写一份 `ReproSpec`,就能跑出**结构化 verdict (pass/fail/ambiguous)** + **可选 GIF**;CI 与本地都能跑。

**Architecture:** Functional core / Imperative shell —— `repro-core.ts` 纯逻辑(matcher 求值、verdict 计算、worktree 命令构造),严禁 import `node:fs`/`node:child_process`;`worktree-shell.ts`、`repro-runner.ts`、`repro-cli.ts` 是 IO/编排层。两个 git worktree(baseline + current)切代码态;ReproSpec 的 `env` 字段叠加切运行时状态。GIF 录制复用 `verification-tooling.md` Phase 1 的 `recordGif()`,在 CLI 里默认调一次。

**Tech Stack:** TypeScript + `tsx` + `node:test`(node 22 内置)+ `git worktree` + `node:child_process` + (可选) Phase 1 ffmpeg gdigrab。Windows 上 junction 用 `fs.symlinkSync(target, path, "junction")`。

---

## File Structure

```
scripts/verify/
  repro-types.ts         ← ReproSpec / ReproResult / ResultMatcher / DemoScene / StepResult / Verdict
  repro-core.ts          ← 纯逻辑:evalMatcher / computeVerdict / buildWorktreeAddArgs / makeBaselineDir
  repro-core.test.ts     ← node:test 单测,覆盖 repro-core 全部纯函数
  worktree-shell.ts      ← Imperative shell:git worktree add/remove + node_modules junction
  repro-runner.ts        ← Imperative shell:在 baseline + current 两侧跑 steps、收集 StepResult
  repro-cli.ts           ← CLI 入口:read spec → run → 可选 recordGif → 写 ReproResult JSON + 退出码
fixtures/repro-specs/
  hook-moment-block.ts   ← 第一份 ReproSpec 样板(把 hook-moment-block 验收改写为可执行)
  README.md              ← 「怎么写一份 ReproSpec」约定
```

**Naming:** 与 `verification-tooling.md` Phase 1/2 的 `gif-*.ts`/`report-*.ts` 平行,均放 `scripts/verify/`,不进 pnpm workspace,用 `tsx` 跑、`node:test` 测。

---

## Task 1: `repro-types.ts` —— 类型定义

**Files:**
- Create: `scripts/verify/repro-types.ts`

- [ ] **Step 1: 写类型(无运行时代码,仅 type 导出)**

```ts
// scripts/verify/repro-types.ts
import type { Scenario } from "../../packages/core/src/index.js";

/** 一个 step 是 baseline / current 两侧都要执行的一条命令。 */
export interface ReproStep {
  /** 给人看的 step 名,出现在 ReproResult 与 GIF 字幕里 */
  name: string;
  /** 可执行命令 + 参数。直接 spawn,不走 shell。 */
  command: string;
  args: string[];
  /** 在 step 级追加的环境变量(优先级高于 ReproSpec.baseline/current.env)。 */
  env?: Record<string, string>;
  /** 默认 30s;超时即标 step 失败、verdict ambiguous。 */
  timeoutMs?: number;
  /** 默认 cwd = repro 当前侧的 worktree 根目录。 */
  cwd?: string;
}

/** baseline (改动前) 怎么切。`ref` 缺省 = `git merge-base HEAD <baseRef>` */
export interface BaselineRef {
  ref?: string;                      // git ref;default 见 makeBaselineRef
  baseBranch?: string;               // default "main"
  env?: Record<string, string>;      // 该侧统一附加 env(被 ReproStep.env 覆写)
}

/** current (改动后) 怎么切。本期固定 = 跑 suite-1 的当前 worktree。 */
export interface CurrentRef {
  env?: Record<string, string>;
}

export interface DemoScene {
  /** 在被录窗口里跑的 .ps1(脚本自行设置 windowTitle 与运行 ReproSpec.steps 的等价命令) */
  sceneScript: string;
  windowTitle: string;
  durationSec: number;
}

export interface ResultMatcher {
  exitCode?: number;
  stdoutContains?: string[];
  stdoutNotContains?: string[];
  stderrContains?: string[];
  stderrNotContains?: string[];
}

export interface ReproSpec {
  id: string;                        // kebab-case,比如 "hook-moment-block"
  description: string;
  baseline: BaselineRef;
  current: CurrentRef;
  steps: ReproStep[];                // 至少 1 条
  /** 期望:把所有 steps 的合并输出送进 matcher。 */
  expect: { before: ResultMatcher; after: ResultMatcher };
  /** matcher 类 feature 可引用现成 Scenario 复用其 phaseA/B/C 元数据 */
  scenario?: Scenario;
  /** 给 GIF 录制用的可视化重演脚本。无此字段则 CLI 不录 GIF。 */
  demoScene?: DemoScene;
}

/** 单个 step 的实际执行结果(baseline + current 各自一份)。 */
export interface StepResult {
  stepName: string;
  exitCode: number | null;           // null = timeout
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export type Verdict = "pass" | "fail" | "ambiguous";

export interface SideResult {
  side: "before" | "after";
  steps: StepResult[];
  /** 该侧 matcher 的判定:matcher 全部命中 = ok */
  matcherOk: boolean;
  matcherReasons: string[];
}

export interface ReproResult {
  specId: string;
  generatedAt: string;               // ISO
  before: SideResult;
  after: SideResult;
  /** 顶层 verdict:pass=before 期望成立 + after 期望成立 + 两侧期望确实不同;
   *  fail=有一侧期望未达;ambiguous=两侧期望"看起来都成立"或"都不成立" → 对比未严谨。 */
  verdict: Verdict;
  verdictReason: string;
}
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit --target es2022 --moduleResolution node16 --module node16 scripts/verify/repro-types.ts`
Expected: PASS (no errors). 如果报 `Scenario` 解析失败,改 import 路径为 packages/core 的实际入口(本仓库现状 `packages/core/src/index.js`)。

- [ ] **Step 3: commit**

```bash
git add scripts/verify/repro-types.ts
git commit -m "feat(verify): add repro-types — ReproSpec/ReproResult/ResultMatcher types for suite-1"
```

---

## Task 2: `repro-core.ts` —— 纯逻辑(matcher / verdict / worktree 命令构造)

**Files:**
- Create: `scripts/verify/repro-core.ts`
- Test: `scripts/verify/repro-core.test.ts`

- [ ] **Step 1: 写失败测试(8 条)**

```ts
// scripts/verify/repro-core.test.ts
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
  assert.match(r.reasons[0], /exitCode/);
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

test("mergeStepOutputs: 把多个 step 拼成单个 StepResult,exitCode 取最后一个非 0(或最后一个 0)", () => {
  const merged = mergeStepOutputs([
    okStep({ stdout: "a", exitCode: 0 }),
    okStep({ stdout: "b", exitCode: 1 }),
    okStep({ stdout: "c", exitCode: 0 }),
  ]);
  assert.equal(merged.exitCode, 1);   // 最近的非 0 优先
  assert.equal(merged.stdout, "a\nb\nc");
});

test("computeVerdict: before 期望成立 + after 期望成立 + 两侧期望不同 → pass", () => {
  const before: SideResult = { side: "before", steps: [], matcherOk: true, matcherReasons: [] };
  const after: SideResult = { side: "after", steps: [], matcherOk: true, matcherReasons: [] };
  const r = computeVerdict(before, after,
    { stdoutContains: ["通过"] }, { stdoutContains: ["deny"] });
  assert.equal(r.verdict, "pass");
});

test("computeVerdict: 任一侧 matcherOk 为 false → fail", () => {
  const before: SideResult = { side: "before", steps: [], matcherOk: false, matcherReasons: ["缺 通过"] };
  const after: SideResult = { side: "after", steps: [], matcherOk: true, matcherReasons: [] };
  const r = computeVerdict(before, after, {}, {});
  assert.equal(r.verdict, "fail");
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx tsx --test scripts/verify/repro-core.test.ts`
Expected: FAIL —— `Cannot find module './repro-core.ts'`

- [ ] **Step 3: 实现 `repro-core.ts`**

```ts
// scripts/verify/repro-core.ts
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
  const exitCode = lastNonZero?.exitCode ?? steps[steps.length - 1].exitCode;
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
  const beforeMergedAfter = sideMatchesMerged(before, afterMatcher);
  const afterMergedBefore = sideMatchesMerged(after, beforeMatcher);
  if (beforeMergedAfter && afterMergedBefore) {
    return { verdict: "ambiguous", verdictReason: "before 也命中了 after 的期望,且 after 也命中了 before 的期望 —— 对比未严谨成立" };
  }
  return { verdict: "pass", verdictReason: "before 与 after 期望均成立,且对比严谨" };
}

function sideMatchesMerged(side: SideResult, m: ResultMatcher): boolean {
  // 简化:在 SideResult 没有保留 mergedStep 的情况下,这里近似看 matcherReasons 数组。
  // 真正的"互换 matcher" sanity check 由 repro-runner 在 SideResult 上额外存一份 mergedStep。
  // 本函数为占位 —— Step 4 中 runner 会把 mergedStep 通过另一个签名的 computeVerdict 传入。
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
```

> 注:`sideMatchesMerged` 在本 task 是占位返回 false(测试只覆盖 pass / fail,不测 ambiguous)。Task 4 重构 `computeVerdict` 接收 `mergedBefore: StepResult, mergedAfter: StepResult` 直接做互换 sanity,占位函数届时删除。这是有意分两步,避免 core 单测依赖 runner 才有的数据结构。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx tsx --test scripts/verify/repro-core.test.ts`
Expected: PASS (8/8)

- [ ] **Step 5: commit**

```bash
git add scripts/verify/repro-core.ts scripts/verify/repro-core.test.ts
git commit -m "feat(verify): add repro-core — pure matcher eval + verdict + worktree cmd construction"
```

---

## Task 3: `worktree-shell.ts` —— git worktree 编排 + node_modules junction

**Files:**
- Create: `scripts/verify/worktree-shell.ts`

- [ ] **Step 1: 实现 Imperative Shell**

```ts
// scripts/verify/worktree-shell.ts
import { spawnSync } from "node:child_process";
import { mkdtempSync, symlinkSync, existsSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { buildWorktreeAddArgs, buildWorktreeRemoveArgs, makeBaselineDir } from "./repro-core.ts";

export interface BaselinePrep {
  /** baseline worktree 的绝对路径 */
  dir: string;
  /** baseline 检出的 ref(实际值,resolveBaselineRef 之后) */
  ref: string;
  /** 调它清理 baseline worktree(只在调用方 finally 里跑) */
  cleanup: () => void;
}

/** 解析 BaselineRef.ref:有就用、没有就 git merge-base HEAD <baseBranch>(默认 main)。 */
export function resolveBaselineRef(repoRoot: string, ref: string | undefined, baseBranch: string | undefined): string {
  if (ref && ref.length > 0) return ref;
  const branch = baseBranch ?? "main";
  const r = spawnSync("git", ["merge-base", "HEAD", branch], { cwd: repoRoot, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git merge-base HEAD ${branch} 失败: ${r.stderr.trim()}`);
  return r.stdout.trim();
}

/** 在 os.tmpdir() 下建一个 baseline worktree,返回路径与 cleanup。 */
export function prepareBaselineWorktree(opts: { repoRoot: string; specId: string; ref: string }): BaselinePrep {
  const rand6 = createHash("sha256").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, 6);
  const dir = makeBaselineDir(tmpdir(), opts.specId, rand6);
  const r = spawnSync("git", buildWorktreeAddArgs(dir, opts.ref), { cwd: opts.repoRoot, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git worktree add 失败: ${r.stderr.trim()}`);
  const cleanup = () => {
    const rm = spawnSync("git", buildWorktreeRemoveArgs(dir), { cwd: opts.repoRoot, encoding: "utf-8" });
    if (rm.status !== 0) {
      // 不抛 —— 清理失败不该掩盖原始错误;但要打印
      process.stderr.write(`[warn] git worktree remove 失败: ${rm.stderr.trim()}\n`);
    }
  };
  return { dir, ref: opts.ref, cleanup };
}

/** 若两侧 package.json + pnpm-lock.yaml hash 一致,把 current 的 node_modules 以 junction 方式挂到 baseline,省去 install。
 *  返回 true 表示成功 junction;false 表示 hash 不一致或 junction 失败,调用方应跑 `pnpm install`。 */
export function tryJunctionNodeModules(currentDir: string, baselineDir: string): boolean {
  const currentLock = path.join(currentDir, "pnpm-lock.yaml");
  const baselineLock = path.join(baselineDir, "pnpm-lock.yaml");
  const currentPkg = path.join(currentDir, "package.json");
  const baselinePkg = path.join(baselineDir, "package.json");
  if (!existsSync(currentLock) || !existsSync(baselineLock)) return false;
  const lockSame = sha(readFileSync(currentLock)) === sha(readFileSync(baselineLock));
  const pkgSame = sha(readFileSync(currentPkg)) === sha(readFileSync(baselinePkg));
  if (!(lockSame && pkgSame)) return false;
  const currentNm = path.join(currentDir, "node_modules");
  const baselineNm = path.join(baselineDir, "node_modules");
  if (!existsSync(currentNm) || !statSync(currentNm).isDirectory()) return false;
  if (existsSync(baselineNm)) return false;       // 已存在 → 不覆盖
  try {
    // Windows: junction;其它平台: dir symlink
    const type = process.platform === "win32" ? "junction" : "dir";
    symlinkSync(currentNm, baselineNm, type);
    return true;
  } catch {
    return false;
  }
}

function sha(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** 测试钩子:让 unit/smoke 能注入临时 mkdtemp 路径 */
export function _internalMkdtemp(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}
```

- [ ] **Step 2: 手动冒烟**

```bash
npx tsx -e "
import { resolveBaselineRef, prepareBaselineWorktree, tryJunctionNodeModules } from './scripts/verify/worktree-shell.ts';
const root = process.cwd();
const ref = resolveBaselineRef(root, undefined, 'main');
console.log('baseline ref =', ref);
const prep = prepareBaselineWorktree({ repoRoot: root, specId: 'smoke', ref });
console.log('baseline dir =', prep.dir);
const j = tryJunctionNodeModules(root, prep.dir);
console.log('junction node_modules =', j);
prep.cleanup();
console.log('cleanup ok');
"
```

Expected:
```
baseline ref = <some sha>
baseline dir = <tmp>/repro-baseline-smoke-<6hex>
junction node_modules = true       # 当 baseline 与 current package.json/lock 一致时
cleanup ok
```

- [ ] **Step 3: commit**

```bash
git add scripts/verify/worktree-shell.ts
git commit -m "feat(verify): add worktree-shell — git worktree + node_modules junction for baseline prep"
```

---

## Task 4: `repro-runner.ts` —— 在两侧跑 steps + 计算 verdict

**Files:**
- Create: `scripts/verify/repro-runner.ts`
- Modify: `scripts/verify/repro-core.ts:1-200`(把 `computeVerdict` 改成接收 `mergedBefore/mergedAfter` 双参版,删掉 Task 2 的 `sideMatchesMerged` 占位)
- Modify: `scripts/verify/repro-core.test.ts`(同步 `computeVerdict` 调用签名;新增 1 个 ambiguous 测试)

- [ ] **Step 1: 重构 `computeVerdict`(删占位、接 mergedStep)**

```ts
// scripts/verify/repro-core.ts —— 仅替换 computeVerdict + 删除 sideMatchesMerged
export function computeVerdict(
  before: SideResult,
  after: SideResult,
  mergedBefore: StepResult,
  mergedAfter: StepResult,
  beforeMatcher: ResultMatcher,
  afterMatcher: ResultMatcher,
): { verdict: Verdict; verdictReason: string } {
  if (!before.matcherOk || !after.matcherOk) {
    const why: string[] = [];
    if (!before.matcherOk) why.push(`before 期望未达: ${before.matcherReasons.join("; ")}`);
    if (!after.matcherOk) why.push(`after 期望未达: ${after.matcherReasons.join("; ")}`);
    return { verdict: "fail", verdictReason: why.join(" | ") };
  }
  // 互换 matcher sanity
  const beforeUnderAfter = evalMatcher(mergedBefore, afterMatcher);
  const afterUnderBefore = evalMatcher(mergedAfter, beforeMatcher);
  if (beforeUnderAfter.ok && afterUnderBefore.ok) {
    return { verdict: "ambiguous", verdictReason: "before 也命中了 after 的期望,且 after 也命中了 before 的期望 —— 对比未严谨" };
  }
  return { verdict: "pass", verdictReason: "before 与 after 期望均成立,且互换 matcher 后对比仍区分两侧" };
}
```

- [ ] **Step 2: 改 `repro-core.test.ts`(更新签名 + 加 ambiguous 测试)**

Task 2 的 8 个测试里只有 2 个调 `computeVerdict`(测试编号 #6 + #7),其它 6 个不动。逐字替换那 2 个为新签名,并在末尾追加 ambiguous 测试:

```ts
// === 替换 Task 2 第 #6 个测试(原 "computeVerdict: 两条都 ok → pass") ===
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

// === 替换 Task 2 第 #7 个测试(原 "computeVerdict: 任一侧 matcherOk false → fail") ===
test("computeVerdict: 任一侧 matcherOk 为 false → fail", () => {
  const before: SideResult = { side: "before", steps: [], matcherOk: false, matcherReasons: ["缺 通过"] };
  const after: SideResult = { side: "after", steps: [], matcherOk: true, matcherReasons: [] };
  const mergedBefore = okStep();
  const mergedAfter = okStep();
  const r = computeVerdict(before, after, mergedBefore, mergedAfter, {}, {});
  assert.equal(r.verdict, "fail");
});

// === 新增第 9 个测试 ===
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
```

其它 6 个测试(`evalMatcher` × 4 + `mergeStepOutputs` × 1 + `buildWorktreeAddArgs/Remove` × 1)**不调用 computeVerdict,无需改动**。

- [ ] **Step 3: 跑测试确认通过(9/9)**

Run: `npx tsx --test scripts/verify/repro-core.test.ts`
Expected: PASS (9/9)

- [ ] **Step 4: 实现 `repro-runner.ts`**

```ts
// scripts/verify/repro-runner.ts
import { spawn } from "node:child_process";
import { evalMatcher, mergeStepOutputs, computeVerdict } from "./repro-core.ts";
import type {
  ReproSpec, ReproResult, ReproStep, SideResult, StepResult,
} from "./repro-types.ts";

interface RunSideOpts {
  side: "before" | "after";
  cwd: string;                                 // 该侧的 worktree 根目录
  baselineEnv: Record<string, string>;         // ReproSpec.baseline.env / current.env
  steps: ReproStep[];
}

async function runStep(step: ReproStep, defaultCwd: string, sideEnv: Record<string, string>): Promise<StepResult> {
  const start = Date.now();
  const env = { ...process.env, ...sideEnv, ...(step.env ?? {}) };
  const timeoutMs = step.timeoutMs ?? 30_000;
  return new Promise<StepResult>((resolve) => {
    const child = spawn(step.command, step.args, {
      cwd: step.cwd ?? defaultCwd, env, windowsHide: true, shell: false,
    });
    let stdout = ""; let stderr = ""; let timedOut = false;
    child.stdout.on("data", (b) => { stdout += b.toString(); });
    child.stderr.on("data", (b) => { stderr += b.toString(); });
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        stepName: step.name,
        exitCode: timedOut ? null : code,
        stdout, stderr,
        durationMs: Date.now() - start,
        timedOut,
      });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({
        stepName: step.name, exitCode: null, stdout, stderr: stderr + `\n[spawn error] ${e.message}`,
        durationMs: Date.now() - start, timedOut: false,
      });
    });
  });
}

async function runSide(opts: RunSideOpts, matcher: import("./repro-types.ts").ResultMatcher): Promise<{ side: SideResult; merged: StepResult }> {
  const stepResults: StepResult[] = [];
  for (const step of opts.steps) {
    stepResults.push(await runStep(step, opts.cwd, opts.baselineEnv));
  }
  const merged = mergeStepOutputs(stepResults);
  const m = evalMatcher(merged, matcher);
  const side: SideResult = { side: opts.side, steps: stepResults, matcherOk: m.ok, matcherReasons: m.reasons };
  return { side, merged };
}

export interface RunReproOpts {
  spec: ReproSpec;
  currentDir: string;          // 一般 = process.cwd()
  baselineDir: string;         // 由 worktree-shell.prepareBaselineWorktree 提供
}

export async function runRepro(opts: RunReproOpts): Promise<ReproResult> {
  const { spec, currentDir, baselineDir } = opts;
  const before = await runSide({
    side: "before", cwd: baselineDir,
    baselineEnv: spec.baseline.env ?? {}, steps: spec.steps,
  }, spec.expect.before);
  const after = await runSide({
    side: "after", cwd: currentDir,
    baselineEnv: spec.current.env ?? {}, steps: spec.steps,
  }, spec.expect.after);
  const v = computeVerdict(
    before.side, after.side,
    before.merged, after.merged,
    spec.expect.before, spec.expect.after,
  );
  return {
    specId: spec.id,
    generatedAt: new Date().toISOString(),
    before: before.side,
    after: after.side,
    verdict: v.verdict,
    verdictReason: v.verdictReason,
  };
}
```

- [ ] **Step 5: commit**

```bash
git add scripts/verify/repro-runner.ts scripts/verify/repro-core.ts scripts/verify/repro-core.test.ts
git commit -m "feat(verify): add repro-runner — run steps on baseline+current sides, compute verdict"
```

---

## Task 5: `repro-cli.ts` —— CLI 入口(读 spec → 跑 → 可选录 GIF → 写 JSON)

**Files:**
- Create: `scripts/verify/repro-cli.ts`

> **依赖**:本 task 默认调用 `recordGif()` —— 它在 `verification-tooling.md` Phase 1 Task 3 产出。如果 Phase 1 还没实现,把第 4 步的 `import { recordGif } from "./record-gif.ts"` 改成 `const recordGif = (..._args: unknown[]) => { throw new Error("recordGif 未实现 —— 见 verification-tooling.md Phase 1"); };`,并跑 `npx tsx scripts/verify/repro-cli.ts <spec> --no-gif` 跑通骨架。

- [ ] **Step 1: 实现 CLI**

```ts
// scripts/verify/repro-cli.ts
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { resolveBaselineRef, prepareBaselineWorktree, tryJunctionNodeModules } from "./worktree-shell.ts";
import { runRepro } from "./repro-runner.ts";
import type { ReproSpec, ReproResult } from "./repro-types.ts";
import { recordGif } from "./record-gif.ts";   // 见上方 Phase 1 依赖说明

interface CliOpts { specPath: string; outDir: string; noGif: boolean; }

function parseArgv(argv: string[]): CliOpts {
  const opts: CliOpts = { specPath: "", outDir: "", noGif: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-gif") opts.noGif = true;
    else if (a === "--out") opts.outDir = argv[++i];
    else if (!opts.specPath) opts.specPath = a;
  }
  if (!opts.specPath) throw new Error("用法: tsx scripts/verify/repro-cli.ts <spec.ts> [--out <dir>] [--no-gif]");
  if (!opts.outDir) opts.outDir = path.join("docs/acceptance", path.basename(opts.specPath, path.extname(opts.specPath)));
  return opts;
}

async function main(): Promise<void> {
  const opts = parseArgv(process.argv.slice(2));
  const repoRoot = process.cwd();
  // 1. 动态加载 ReproSpec
  const mod = await import(path.resolve(opts.specPath));
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

main().catch((e) => { console.error(e); process.exit(2); });
```

- [ ] **Step 2: 用临时空 spec 冒烟**

先建一个最小化空 spec(steps 只跑 `node -e "console.log('after')"`,baseline 输出会一样 → 期望是 fail/ambiguous,验证退出码非 0):

```bash
cat > /tmp/empty-spec.ts <<'TS'
import type { ReproSpec } from "C:/bzli/Matrix/scripts/verify/repro-types.ts";
const spec: ReproSpec = {
  id: "smoke-empty",
  description: "smoke test —— 两侧跑同样的命令,期望 ambiguous",
  baseline: {},
  current: {},
  steps: [{ name: "echo", command: process.execPath, args: ["-e", "console.log('hello')"] }],
  expect: {
    before: { stdoutContains: ["hello"] },
    after:  { stdoutContains: ["hello"] },
  },
};
export default spec;
TS
npx tsx scripts/verify/repro-cli.ts /tmp/empty-spec.ts --no-gif --out /tmp/smoke-out
echo "exit code: $?"
cat /tmp/smoke-out/repro-result.json | grep verdict
```

Expected:
- 退出码 = 1
- `repro-result.json` 里 `"verdict": "ambiguous"`(两侧输出一样,互换 matcher 双方都命中)

- [ ] **Step 3: commit**

```bash
git add scripts/verify/repro-cli.ts
git commit -m "feat(verify): add repro-cli — orchestrates baseline prep + run + optional GIF"
```

---

## Task 6: `fixtures/repro-specs/hook-moment-block.ts` —— 第一份真实样板

**Files:**
- Create: `fixtures/repro-specs/hook-moment-block.ts`
- Create: `fixtures/repro-specs/README.md`

> **背景**:把 `docs/acceptance/2026-05-14-hook-moment-block/` 的人工验收改写为可执行 ReproSpec。要 reproduce 现有样板的两屏:
> - before:`USERPROFILE=<empty home>` 跑 `teamagent demo hook Bash command="npm install moment"` → 输出含 `通过 (无规则命中)`
> - after:`USERPROFILE=<loaded home>` 跑同命令 → 输出含 `决策: deny` + `应改用` + `dayjs`
> 两侧代码都跑 **当前 worktree 的 dist/bin.js**(本 feature 跟代码无关,仅靠 env 切运行时状态)—— 因此 baseline.ref 用 HEAD,本质是「同代码、不同 env」。

- [ ] **Step 1: 写 spec**

```ts
// fixtures/repro-specs/hook-moment-block.ts
import path from "node:path";
import { momentDayjsScenario } from "../scenarios/moment-dayjs.ts";
import type { ReproSpec } from "../../scripts/verify/repro-types.ts";

// 注:本 feature 是「数据驱动」差异 —— 同代码、不同知识库状态,所以 baseline.ref = HEAD。
// stage 目录由调用方在 spec 跑之前预备(或手动按 docs/acceptance/2026-05-14-hook-moment-block/recording/README.md 准备)。
const stage = process.env.TA_DEMO_STAGE ?? "C:/Users/tianhaoxuan/ta-demo-stage";

const spec: ReproSpec = {
  id: "hook-moment-block",
  description: "PreToolUse hook 在「学到经验后」拦截 npm install moment,建议 dayjs",
  baseline: {
    ref: "HEAD",                                          // 同代码;差异在 env 切的知识库 home
    env: { USERPROFILE: `${stage}/home-empty`, HOME: `${stage}/home-empty` },
  },
  current: {
    env: { USERPROFILE: `${stage}/home-loaded`, HOME: `${stage}/home-loaded` },
  },
  steps: [
    {
      name: "demo-hook-npm-install-moment",
      command: process.execPath,                          // node
      args: [
        path.resolve("packages/teamagent/dist/bin.js"),
        "demo", "hook", "Bash", `command=npm install moment`,
      ],
      timeoutMs: 30_000,
    },
  ],
  expect: {
    before: {
      exitCode: 0,
      stdoutContains: ["通过 (无规则命中)"],
      stdoutNotContains: ["deny", "应改用"],
    },
    after: {
      exitCode: 0,
      stdoutContains: ["决策: deny", "应改用", "dayjs"],
      stdoutNotContains: ["通过 (无规则命中)"],
    },
  },
  scenario: momentDayjsScenario,                          // 复用现成 Scenario 元数据
  demoScene: {
    sceneScript: path.resolve("docs/acceptance/2026-05-14-hook-moment-block/recording/demo-scene.ps1"),
    windowTitle: "TADEMOREC",
    durationSec: 40,
  },
};

export default spec;
```

- [ ] **Step 2: 跑端到端**

> **前置**:`$stage/home-empty` 与 `$stage/home-loaded` 两个目录已按 `docs/acceptance/2026-05-14-hook-moment-block/recording/README.md` 备好(后者含 init 后的 `.viki/knowledge.db`)。若没备,先跑那份 README 的步骤,或 `set TA_DEMO_STAGE=<stage 目录>` 指向已备好的目录。

```bash
npx tsx scripts/verify/repro-cli.ts fixtures/repro-specs/hook-moment-block.ts --no-gif \
  --out docs/acceptance/2026-05-15-hook-moment-block-repro
```

Expected:
- 退出码 = 0
- `docs/acceptance/2026-05-15-hook-moment-block-repro/repro-result.json` 存在,`"verdict": "pass"`,`"verdictReason"` 含 "互换 matcher 后对比仍区分"

- [ ] **Step 3: 写 README(怎么写一份 ReproSpec)**

```markdown
<!-- fixtures/repro-specs/README.md -->
# 怎么写一份 ReproSpec

ReproSpec 是套件 1(复现验证代码框架)的输入。一份 spec ≈ 「这个 feature 是否实现」的可执行定义。
设计决议见 `docs/plans/2026-05-15-suite-1-brainstorm.md`,实现见 `scripts/verify/repro-*.ts`。

## 最小骨架

\`\`\`ts
import type { ReproSpec } from "../../scripts/verify/repro-types.ts";

const spec: ReproSpec = {
  id: "kebab-case-id",                // 建议与 docs/acceptance/<date>-<id>/ 一致
  description: "一句话说明这个 feature",
  baseline: { /* 怎么切到 before 态 */ },
  current:  { /* 一般留空,默认 = 当前 worktree */ },
  steps: [{
    name: "step-name",
    command: process.execPath,
    args: ["..."],
  }],
  expect: {
    before: { /* before 应满足的 ResultMatcher */ },
    after:  { /* after 应满足的 ResultMatcher */ },
  },
};
export default spec;
\`\`\`

## 三种典型 feature 的写法

### 1. 数据驱动差异(同代码、不同状态)
`baseline.ref = "HEAD"` + `baseline.env` / `current.env` 切运行时状态。样板:
[`hook-moment-block.ts`](./hook-moment-block.ts)。

### 2. 代码驱动差异(改了代码)
`baseline.ref` 留空 → CLI 自动算 `git merge-base HEAD main`。两侧分别在两个 worktree 跑同命令,期望产出不同。

### 3. 既改代码又依赖运行时状态
两侧都用 `env` 字段,`baseline.ref` 保持「PR 起点」即可。

## 怎么写好 `expect`

- **`stdoutContains` 写「后果」、不要写「过程」**。比如「拦截 moment」就写 `["deny", "应改用", "dayjs"]`(后果),
  不要写「调用 matcher」(过程)。
- **同时给 `stdoutNotContains`**。两侧应**互斥**才算严谨对比;否则 verdict 会是 `ambiguous`。
- **exitCode 谨慎用**。很多 CLI 即使逻辑失败也返回 0(把信息写在 stdout)。除非命令明确以 exitCode 区分两态,否则别钉 exitCode。

## 怎么 run

```bash
# 跑 spec(默认录 GIF;CI 上加 --no-gif)
npx tsx scripts/verify/repro-cli.ts fixtures/repro-specs/<your>.ts \
  --out docs/acceptance/<date>-<id>

# 看 verdict
cat docs/acceptance/<date>-<id>/repro-result.json | jq .verdict
```
```

- [ ] **Step 4: commit**

```bash
git add fixtures/repro-specs/hook-moment-block.ts fixtures/repro-specs/README.md docs/acceptance/2026-05-15-hook-moment-block-repro/
git commit -m "feat(verify): add hook-moment-block ReproSpec sample + README — first real suite-1 spec"
```

---

## Self-Review

**1. Spec coverage:** 4 条 brainstorm 决议:① Q1 ReproSpec 内嵌 Scenario → Task 1 类型;② Q2 两 worktree + env → Task 3 worktree-shell + Task 4 runner 双侧;③ Q3 解耦录 GIF → Task 5 CLI 末段;④ Q4 确定性 matcher → Task 2 evalMatcher + computeVerdict。`hook-moment-block` 样板覆盖 Q2 的「数据驱动差异」典型 + 复用 `momentDayjsScenario` 验证 Q1 的内嵌路径。**已知缺口**:Layer B(独立 subagent review)在另一份 plan(`2026-05-15-local-review-loop.md`)。

**2. Placeholder scan:** Task 2 `sideMatchesMerged` 是有意占位,Task 4 显式删除并替换 —— 在文档里说明而非偷偷留下。Task 5 对 `recordGif` 的依赖在 task 开头明确给了 fallback。无 "TBD" / "实现错误处理" 等空话。

**3. Type consistency:** `ReproSpec` 字段 `id/description/baseline/current/steps/expect/scenario/demoScene` 在 Task 1 定义,Task 5 CLI 使用 `spec.id/spec.baseline.ref/spec.demoScene`,Task 6 样板 export 的 `spec` 用同名字段。`StepResult` 字段在 Task 1 定义,Task 2 `mergeStepOutputs` 与 Task 4 `runStep` 都按同名字段构造。`computeVerdict` 签名 Task 2 → Task 4 显式重构(写在 Task 4 Step 1),不是隐式改动。

## Execution Handoff

Plan complete. 推荐执行路径:

1. **先确认前置**:Phase 1 `recordGif()`(`verification-tooling.md` Task 3)是否已实现?未实现也能跑本 plan 主体(Task 5 提供了 fallback);要跑 hook-moment-block 端到端 GIF 需先做 Phase 1。
2. **执行**:Task 1–6 串行(Task 4 重构 Task 2 的函数签名 → 不能跳序)。建议 subagent-driven,每 Task 一个独立 subagent。
3. **验收**:跑 `fixtures/repro-specs/hook-moment-block.ts` 端到端,看到 `verdict: "pass"` 即套件 1 落地。
