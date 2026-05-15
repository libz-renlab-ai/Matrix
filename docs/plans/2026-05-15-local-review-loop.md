# 本地 Review 自动打回循环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `docs/WORKFLOW.md` 第 4 步「另开独立 subagent 跑 2 条标准的本地 review,不通过打回重做、循环至通过」落成可跑工具 —— 任何执行 CC 在做完 feature 后,跑一条命令就触发 review;不通过则用 Claude Code 的 `Agent` 工具自动派一个执行 subagent 修,然后再 review,直到通过或达上限。

**Architecture:** Functional core / Imperative shell —— `review-core.ts` 纯逻辑(把「2 条标准」的 outcome 合成 verdict、判定打回理由分类),严禁 IO;`run-checks.ts` 跑测试 + 检查冲突 + 读 ReproResult 是 IO 层;`loop-driver.ts` 是循环编排,负责派打回 subagent 与判定终止。本计划与 `2026-05-15-suite-1-repro-framework.md` 是消费/被消费关系 —— review 标准 1 直接 cat 套件 1 的 `repro-result.json`,不重复实现 verdict 逻辑。

**Tech Stack:** TypeScript + `tsx` + `node:test` + `pnpm test` + `git status` + Claude Code `Agent` tool(由 `loop-driver.ts` 通过 stdin/stdout 间接驱动 —— 见 Task 5 的 fallback 说明)。

---

## File Structure

```
scripts/review/
  review-types.ts          ← ReviewVerdict / Criterion / FixDirective 类型
  review-core.ts           ← 纯逻辑:汇总 2 条标准 → verdict;失败原因分类
  review-core.test.ts      ← node:test 单测
  run-checks.ts            ← Imperative shell:跑 pnpm test、git 冲突检查、读 repro-result.json
  review-cli.ts            ← CLI:跑一次 review,输出 review-verdict.json + 退出码
  loop-driver.ts           ← Imperative shell:review → 不过派打回 subagent → 再 review,循环
.claude/skills/local-review/
  SKILL.md                 ← 给 review subagent 的角色指令(2 条标准 + 输出格式)
  fix-directive-prompt.md  ← 给打回 subagent 的「修这个,然后 stop」prompt 模板
```

**Naming:** 与 `scripts/verify/` 平行,放 `scripts/review/`。`scripts/` 整体是「Imperative Shell + Core」的脚本区,与 pnpm workspace 隔离,用 `tsx` 跑、`node:test` 测。

---

## Task 1: `review-types.ts` —— 类型

**Files:**
- Create: `scripts/review/review-types.ts`

- [ ] **Step 1: 写类型**

```ts
// scripts/review/review-types.ts

/** WORKFLOW.md 第 4 步钉死的 2 条标准 */
export type CriterionId =
  | "repro-pass"               // 标准 1:套件 1 跑出 verdict = "pass"
  | "tests-and-merge-clean";   // 标准 2:pnpm test 全过 + git 工作树干净 + 与 main 无冲突

export interface CriterionResult {
  id: CriterionId;
  ok: boolean;
  /** 给人看的简述,1 行 */
  summary: string;
  /** 详细信息,可多行;ok=true 时可能为空 */
  details: string;
}

export type ReviewVerdict = "pass" | "fail";

export interface ReviewResult {
  generatedAt: string;
  verdict: ReviewVerdict;
  criteria: CriterionResult[];
  /** verdict=fail 时,给打回 subagent 的结构化指令(给 LLM 作 prompt 用)*/
  fixDirective?: FixDirective;
}

export interface FixDirective {
  /** kebab-case 失败类型,便于 loop-driver 防止「同一类失败连续打回 N 次」 */
  failureKind: "repro-fail" | "repro-ambiguous" | "tests-failing" | "merge-conflict" | "dirty-tree" | "missing-repro-result";
  /** 给打回 subagent 一段可读 prompt,描述「要修什么、修完怎么自检」 */
  prompt: string;
}

export interface LoopOptions {
  /** 最多打回几次后强制停止(默认 3)。防止死循环。 */
  maxRetries: number;
  /** 跑 review 的 ReproResult 路径(套件 1 产出) */
  reproResultPath: string;
  /** 评测时基于哪个 base ref 比对(默认 main) */
  baseBranch: string;
  /** 跑测试用的命令 */
  testCommand: string;
  testArgs: string[];
}
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit --target es2022 --module node16 --moduleResolution node16 scripts/review/review-types.ts`
Expected: PASS

- [ ] **Step 3: commit**

```bash
git add scripts/review/review-types.ts
git commit -m "feat(review): add review-types — CriterionResult/ReviewVerdict/FixDirective"
```

---

## Task 2: `review-core.ts` —— 纯逻辑(汇总 verdict + 失败原因分类)

**Files:**
- Create: `scripts/review/review-core.ts`
- Test: `scripts/review/review-core.test.ts`

- [ ] **Step 1: 写失败测试(6 条)**

```ts
// scripts/review/review-core.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateVerdict, classifyFailure, formatFixPrompt } from "./review-core.ts";
import type { CriterionResult } from "./review-types.ts";

const passRepro: CriterionResult = { id: "repro-pass", ok: true, summary: "verdict=pass", details: "" };
const failRepro: CriterionResult = { id: "repro-pass", ok: false, summary: "verdict=fail", details: "before 期望未达: stdout 缺关键字 \"deny\"" };
const ambiguousRepro: CriterionResult = { id: "repro-pass", ok: false, summary: "verdict=ambiguous", details: "before 也命中了 after 的期望" };
const passTests: CriterionResult = { id: "tests-and-merge-clean", ok: true, summary: "tests pass + tree clean", details: "" };
const failTests: CriterionResult = { id: "tests-and-merge-clean", ok: false, summary: "23/100 tests failing", details: "FAIL packages/core/src/foo.test.ts ..." };
const dirtyTree: CriterionResult = { id: "tests-and-merge-clean", ok: false, summary: "tests pass; working tree dirty (3 files)", details: " M src/x.ts\n?? note.md" };

test("aggregateVerdict: 两条都 ok → pass", () => {
  const r = aggregateVerdict([passRepro, passTests]);
  assert.equal(r.verdict, "pass");
  assert.equal(r.fixDirective, undefined);
});

test("aggregateVerdict: 任一不 ok → fail + 带 fixDirective", () => {
  const r = aggregateVerdict([failRepro, passTests]);
  assert.equal(r.verdict, "fail");
  assert.ok(r.fixDirective);
  assert.equal(r.fixDirective!.failureKind, "repro-fail");
});

test("classifyFailure: repro 各种情况", () => {
  assert.equal(classifyFailure(failRepro).failureKind, "repro-fail");
  assert.equal(classifyFailure(ambiguousRepro).failureKind, "repro-ambiguous");
  const missing: CriterionResult = { id: "repro-pass", ok: false, summary: "missing repro-result.json", details: "" };
  assert.equal(classifyFailure(missing).failureKind, "missing-repro-result");
});

test("classifyFailure: tests 失败 vs 工作树脏 vs 冲突", () => {
  assert.equal(classifyFailure(failTests).failureKind, "tests-failing");
  assert.equal(classifyFailure(dirtyTree).failureKind, "dirty-tree");
  const conflict: CriterionResult = { id: "tests-and-merge-clean", ok: false, summary: "merge conflict with main", details: "" };
  assert.equal(classifyFailure(conflict).failureKind, "merge-conflict");
});

test("formatFixPrompt: 包含失败类别 + details + 「修完怎么自检」", () => {
  const p = formatFixPrompt({ failureKind: "tests-failing", prompt: "" }, failTests);
  assert.match(p, /tests-failing/);
  assert.match(p, /23\/100/);
  assert.match(p, /pnpm test/);             // 修完后该跑啥
});

test("aggregateVerdict 多失败:fixDirective 取「优先级高」的失败 (repro > tests > tree)", () => {
  const r = aggregateVerdict([failRepro, failTests]);
  assert.equal(r.fixDirective!.failureKind, "repro-fail");   // repro 比 tests 优先
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx tsx --test scripts/review/review-core.test.ts`
Expected: FAIL —— `Cannot find module './review-core.ts'`

- [ ] **Step 3: 实现 `review-core.ts`**

```ts
// scripts/review/review-core.ts
import type { CriterionResult, FixDirective, ReviewResult } from "./review-types.ts";

const FAILURE_PRIORITY: FixDirective["failureKind"][] = [
  "missing-repro-result",
  "repro-fail",
  "repro-ambiguous",
  "merge-conflict",
  "tests-failing",
  "dirty-tree",
];

export function classifyFailure(c: CriterionResult): FixDirective {
  if (c.ok) throw new Error("classifyFailure 不应被调用 ok=true 的 criterion");
  if (c.id === "repro-pass") {
    if (c.summary.includes("missing")) return { failureKind: "missing-repro-result", prompt: "" };
    if (c.summary.includes("ambiguous")) return { failureKind: "repro-ambiguous", prompt: "" };
    return { failureKind: "repro-fail", prompt: "" };
  }
  // c.id === "tests-and-merge-clean"
  const s = c.summary.toLowerCase();
  if (s.includes("conflict")) return { failureKind: "merge-conflict", prompt: "" };
  if (s.includes("dirty") || s.includes("untracked")) return { failureKind: "dirty-tree", prompt: "" };
  return { failureKind: "tests-failing", prompt: "" };
}

export function aggregateVerdict(criteria: CriterionResult[]): ReviewResult {
  const fails = criteria.filter((c) => !c.ok);
  if (fails.length === 0) {
    return { generatedAt: new Date().toISOString(), verdict: "pass", criteria };
  }
  // 取优先级最高的 fail
  const classified = fails.map((c) => ({ c, fd: classifyFailure(c) }));
  classified.sort((a, b) => FAILURE_PRIORITY.indexOf(a.fd.failureKind) - FAILURE_PRIORITY.indexOf(b.fd.failureKind));
  const top = classified[0];
  return {
    generatedAt: new Date().toISOString(),
    verdict: "fail",
    criteria,
    fixDirective: { ...top.fd, prompt: formatFixPrompt(top.fd, top.c) },
  };
}

export function formatFixPrompt(fd: FixDirective, c: CriterionResult): string {
  const headerByKind: Record<FixDirective["failureKind"], string> = {
    "repro-fail":             "套件 1 复现验证 verdict=fail —— before/after 对比未严谨成立",
    "repro-ambiguous":        "套件 1 复现验证 verdict=ambiguous —— 两侧期望可互换命中,对比不严谨",
    "missing-repro-result":   "找不到 repro-result.json —— 你还没跑套件 1,或 spec 路径错了",
    "merge-conflict":         "与 main 有合并冲突",
    "tests-failing":          "全量测试有失败用例",
    "dirty-tree":             "工作树有未提交改动",
  };
  const selfCheckByKind: Record<FixDirective["failureKind"], string> = {
    "repro-fail":             "重跑 `npx tsx scripts/verify/repro-cli.ts <spec> --no-gif`,看 verdict=pass",
    "repro-ambiguous":        "重审 ReproSpec.expect.before/after 是否真互斥;改完重跑 repro-cli",
    "missing-repro-result":   "先跑 `npx tsx scripts/verify/repro-cli.ts <spec>`",
    "merge-conflict":         "`git fetch origin && git rebase origin/main`,解冲突后重跑 review",
    "tests-failing":          "`pnpm test` 退出码 0",
    "dirty-tree":             "`git status` 干净(无 M / 无 ??),要么提交要么 .gitignore",
  };
  return [
    `## 失败类别: ${fd.failureKind}`,
    `**问题**:${headerByKind[fd.failureKind]}`,
    ``,
    `### 详情`,
    "```",
    c.details || c.summary,
    "```",
    ``,
    `### 修完后怎么自检`,
    selfCheckByKind[fd.failureKind],
    ``,
    `### 边界`,
    `- 只动**与本失败类别直接相关**的代码;**不要顺手 refactor**。`,
    `- 修好后用 \`echo done > /tmp/fix-marker\` 落一个标记文件,然后 stop。loop-driver 检测到标记会重跑 review。`,
  ].join("\n");
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx tsx --test scripts/review/review-core.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: commit**

```bash
git add scripts/review/review-core.ts scripts/review/review-core.test.ts
git commit -m "feat(review): add review-core — verdict aggregation + failure classification"
```

---

## Task 3: `run-checks.ts` —— 标准 1+2 的实际跑法

**Files:**
- Create: `scripts/review/run-checks.ts`

- [ ] **Step 1: 实现 imperative shell**

```ts
// scripts/review/run-checks.ts
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import type { CriterionResult, LoopOptions } from "./review-types.ts";

/** 标准 1:读套件 1 产出的 repro-result.json,要求 verdict = "pass" */
export function checkReproPass(reproResultPath: string): CriterionResult {
  if (!existsSync(reproResultPath)) {
    return {
      id: "repro-pass", ok: false,
      summary: `missing repro-result.json: ${reproResultPath}`,
      details: "先跑套件 1 产出该文件,再跑 review。",
    };
  }
  let parsed: { verdict?: string; verdictReason?: string };
  try { parsed = JSON.parse(readFileSync(reproResultPath, "utf-8")); }
  catch (e) {
    return { id: "repro-pass", ok: false, summary: `repro-result.json 解析失败`, details: String(e) };
  }
  const verdict = parsed.verdict ?? "<missing verdict>";
  if (verdict === "pass") {
    return { id: "repro-pass", ok: true, summary: `verdict=pass`, details: parsed.verdictReason ?? "" };
  }
  return {
    id: "repro-pass", ok: false,
    summary: `verdict=${verdict}`,
    details: parsed.verdictReason ?? `(无 verdictReason)`,
  };
}

/** 标准 2:测试全过 + 工作树干净 + 与 baseBranch 无冲突 */
export function checkTestsAndMergeClean(opts: { repoRoot: string; baseBranch: string; testCommand: string; testArgs: string[] }): CriterionResult {
  const tests = spawnSync(opts.testCommand, opts.testArgs, { cwd: opts.repoRoot, encoding: "utf-8" });
  if (tests.status !== 0) {
    return {
      id: "tests-and-merge-clean", ok: false,
      summary: `tests failing (exit ${tests.status})`,
      details: trimTo(tests.stdout + tests.stderr, 4000),
    };
  }
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: opts.repoRoot, encoding: "utf-8" });
  const dirtyLines = status.stdout.trim().length > 0 ? status.stdout.trim().split(/\r?\n/) : [];
  if (dirtyLines.length > 0) {
    return {
      id: "tests-and-merge-clean", ok: false,
      summary: `tests pass; working tree dirty (${dirtyLines.length} entries)`,
      details: dirtyLines.slice(0, 50).join("\n"),
    };
  }
  // 检查与 baseBranch 是否会冲突:fetch + merge-tree(无副作用)
  spawnSync("git", ["fetch", "origin", opts.baseBranch], { cwd: opts.repoRoot, encoding: "utf-8" });
  const mergeTree = spawnSync("git", ["merge-tree", `origin/${opts.baseBranch}`, "HEAD"],
    { cwd: opts.repoRoot, encoding: "utf-8" });
  // git merge-tree 输出含 "<<<<<<<" 即有冲突
  if (mergeTree.stdout.includes("<<<<<<<")) {
    const conflictFiles = [...mergeTree.stdout.matchAll(/^changed in both[\s\S]*?\n  base\s+\S+ \S+ (\S+)$/gm)]
      .map((m) => m[1]);
    return {
      id: "tests-and-merge-clean", ok: false,
      summary: `merge conflict with origin/${opts.baseBranch}`,
      details: conflictFiles.length ? conflictFiles.join("\n") : trimTo(mergeTree.stdout, 2000),
    };
  }
  return { id: "tests-and-merge-clean", ok: true, summary: `tests pass + tree clean + no conflict with ${opts.baseBranch}`, details: "" };
}

function trimTo(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + `\n…(truncated ${s.length - n} chars)` : s;
}

/** 跑两条标准,返回 [criterion1, criterion2] */
export function runAllChecks(opts: { repoRoot: string; loop: LoopOptions }): CriterionResult[] {
  const c1 = checkReproPass(opts.loop.reproResultPath);
  const c2 = checkTestsAndMergeClean({
    repoRoot: opts.repoRoot, baseBranch: opts.loop.baseBranch,
    testCommand: opts.loop.testCommand, testArgs: opts.loop.testArgs,
  });
  return [c1, c2];
}
```

- [ ] **Step 2: 冒烟**

```bash
# 假设当前 worktree 干净 + tests 全过 + 套件 1 已跑过
npx tsx -e "
import { runAllChecks } from './scripts/review/run-checks.ts';
const cs = runAllChecks({
  repoRoot: process.cwd(),
  loop: {
    maxRetries: 3,
    reproResultPath: 'docs/acceptance/2026-05-15-hook-moment-block-repro/repro-result.json',
    baseBranch: 'main',
    testCommand: 'pnpm', testArgs: ['vitest', 'run', 'scripts/lock-core.test.ts'],
  },
});
console.log(JSON.stringify(cs, null, 2));
"
```

Expected: 两条 criterion 都打印 `ok: true` 或合理的失败说明(取决于当前仓库状态)。

- [ ] **Step 3: commit**

```bash
git add scripts/review/run-checks.ts
git commit -m "feat(review): add run-checks — execute the 2 WORKFLOW criteria (repro + tests/merge)"
```

---

## Task 4: `review-cli.ts` —— 跑一次 review,出 verdict JSON

**Files:**
- Create: `scripts/review/review-cli.ts`

- [ ] **Step 1: 实现**

```ts
// scripts/review/review-cli.ts
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { runAllChecks } from "./run-checks.ts";
import { aggregateVerdict } from "./review-core.ts";
import type { LoopOptions } from "./review-types.ts";

interface CliOpts { reproResult: string; out: string; testCmd: string; baseBranch: string; }

function parseArgv(argv: string[]): CliOpts {
  const o: CliOpts = { reproResult: "", out: "", testCmd: "pnpm test", baseBranch: "main" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repro") o.reproResult = argv[++i];
    else if (a === "--out") o.out = argv[++i];
    else if (a === "--test-cmd") o.testCmd = argv[++i];
    else if (a === "--base") o.baseBranch = argv[++i];
  }
  if (!o.reproResult) throw new Error("用法: tsx scripts/review/review-cli.ts --repro <path> [--out <dir>] [--test-cmd \"pnpm test\"] [--base main]");
  if (!o.out) o.out = path.dirname(o.reproResult);
  return o;
}

function main(): void {
  const o = parseArgv(process.argv.slice(2));
  const [cmd, ...args] = o.testCmd.split(/\s+/);
  const loop: LoopOptions = {
    maxRetries: 3,
    reproResultPath: o.reproResult,
    baseBranch: o.baseBranch,
    testCommand: cmd, testArgs: args,
  };
  const criteria = runAllChecks({ repoRoot: process.cwd(), loop });
  const result = aggregateVerdict(criteria);
  mkdirSync(o.out, { recursive: true });
  const outFile = path.join(o.out, "review-verdict.json");
  writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");
  console.log(`[review] verdict=${result.verdict}  → ${outFile}`);
  if (result.fixDirective) {
    console.log(`[review] fix prompt 在 review-verdict.json 的 fixDirective.prompt 字段;loop-driver 会取用。`);
  }
  process.exit(result.verdict === "pass" ? 0 : 1);
}

main();
```

- [ ] **Step 2: 端到端**

```bash
# 用一个已跑过套件 1 的 repro-result 做 input
npx tsx scripts/review/review-cli.ts \
  --repro docs/acceptance/2026-05-15-hook-moment-block-repro/repro-result.json \
  --test-cmd "pnpm vitest run scripts/lock-core.test.ts" \
  --out /tmp/review-out
echo "exit code: $?"
cat /tmp/review-out/review-verdict.json | head -30
```

Expected: 退出码 0(全过)或 1(有失败)+ 文件内容含 `verdict` / `criteria` / 可选 `fixDirective`。

- [ ] **Step 3: commit**

```bash
git add scripts/review/review-cli.ts
git commit -m "feat(review): add review-cli — run criteria once, write review-verdict.json"
```

---

## Task 5: SKILL.md + loop-driver.ts —— 派打回 subagent + 循环

> **关于 subagent**:WORKFLOW.md 要求「另开一个独立 subagent 来 review」。本计划的策略是:
> - **review 步骤**:由 `review-cli.ts` 直接做 —— 它是确定性脚本,自然就是「另开的、独立的」(不在执行 CC 的对话上下文里)。
> - **打回步骤**:由 `loop-driver.ts` 通过 Claude Code `Agent` 工具派一个 fresh subagent 去修。`loop-driver.ts` 自己跑在 Claude Code 里(用户/CC 触发),`Agent` 工具是 CC 内置的 spawn-fresh-subagent 机制。
> - **fallback**:若执行环境不在 Claude Code 内(比如纯 CI),`loop-driver.ts` 跑到第一次 fail 时打印 fix prompt 并 exit 非 0,把决策交给人 —— 因为没有 Agent tool 可调,自动循环不可能。

**Files:**
- Create: `.claude/skills/local-review/SKILL.md`
- Create: `.claude/skills/local-review/fix-directive-prompt.md`
- Create: `scripts/review/loop-driver.ts`

- [ ] **Step 1: 写 SKILL.md(给 review subagent 的角色卡)**

```markdown
<!-- .claude/skills/local-review/SKILL.md -->
---
name: local-review
description: 本地 review 自动循环 —— 跑 WORKFLOW.md 的 2 条标准,不通过自动派打回 subagent 修,循环至通过或达上限
---

# local-review skill

## 何时调用

执行 CC 完成一个 feature 后,调本 skill 触发本地 review 循环。也支持人手动 `/local-review`。

## 怎么跑

```bash
# 直接调用 driver(skill 实际就是包了一层文档)
npx tsx scripts/review/loop-driver.ts \
  --repro docs/acceptance/<date>-<id>/repro-result.json \
  --max-retries 3
```

## 2 条标准(WORKFLOW.md 第 4 步钉死)

1. **before/after 对比成立** —— 套件 1 跑出 `verdict: "pass"`(不是 `fail` 也不是 `ambiguous`)
2. **全量测试全过 + 合并无冲突** —— `pnpm test` 退出 0,工作树无未提交改动,与 `origin/main` 无冲突

## 行为

- 跑 review-cli → verdict=pass → 落 review-verdict.json,exit 0,完事
- 跑 review-cli → verdict=fail → 派一个 fresh subagent(用 Agent tool),把 `fixDirective.prompt` 喂给它;subagent 修完落 `/tmp/fix-marker` 标记;driver 检测到标记重跑 review-cli;循环
- 重试次数达 `--max-retries`(默认 3) → 停止,exit 非 0,把累计 fix 历史写到 review-verdict.json 的 `attempts[]` 字段

## 当前默认是 `--fix-mode manual`(重要)

「verdict=fail 自动派 subagent 去修」依赖一个**还没实现**的宿主 hook(driver 写 `/tmp/fix-pending`,hook 监听到后用 Agent tool 派 subagent)。在 hook 落地之前,driver 默认走 `--fix-mode manual` —— 第一次 fail 就把 fix prompt 打印出来 + 退出非 0,由人手动派 CC 去修。

`--fix-mode agent` 会正常运行,但若 hook 缺席,会卡在等 fix-marker 直到超时(默认 30 分钟)。要追这个跨子系统 follow-up,见 `docs/plans/2026-05-15-INDEX.md` 末段「跨子系统 follow-up」。

## 派打回 subagent 的 prompt 模板

见 `fix-directive-prompt.md`。
```

- [ ] **Step 2: 写 fix-directive-prompt.md**

```markdown
<!-- .claude/skills/local-review/fix-directive-prompt.md -->
你是一个执行 subagent,被本地 review 循环派回来「修一个 review 失败」。

## 任务

{{fixDirective.prompt}}

## 约束(硬性)

- **只动与本失败类别直接相关的代码**。不要顺手 refactor、不要 reorganize 文件、不要改无关测试。
- 修完用 `Bash` 跑 `echo done > /tmp/fix-marker` 落标记文件,然后 stop。
  loop-driver 看到标记会自动重跑 review;**你不要自己跑 review**。
- 如果你判断这次失败**不应在本 PR 修**(超出范围、应另开 issue),写个 `echo "skip: <理由>" > /tmp/fix-marker` 然后 stop。
  driver 看到 `skip:` 会停循环、把理由报给上游。

## 边界

- 不开新 PR、不切分支、不 commit、不 push。改完留在工作树里,driver 会处理 commit 时机。
```

- [ ] **Step 3: 写 loop-driver.ts**

```ts
// scripts/review/loop-driver.ts
import { spawnSync } from "node:child_process";
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

const FIX_MARKER = process.platform === "win32"
  ? path.join(process.env.TEMP ?? "C:/Windows/Temp", "fix-marker")
  : "/tmp/fix-marker";

function parseArgv(argv: string[]): DriverOpts {
  const o: DriverOpts = {
    maxRetries: 3,
    reproResultPath: "",
    baseBranch: "main",
    testCommand: "pnpm",
    testArgs: ["test"],
    outDir: "",
    fixMode: process.env.CLAUDE_CODE_AGENT === "1" ? "agent" : "manual",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repro") o.reproResultPath = argv[++i];
    else if (a === "--out") o.outDir = argv[++i];
    else if (a === "--max-retries") o.maxRetries = Number(argv[++i]);
    else if (a === "--base") o.baseBranch = argv[++i];
    else if (a === "--test-cmd") {
      const parts = argv[++i].split(/\s+/);
      o.testCommand = parts[0]; o.testArgs = parts.slice(1);
    } else if (a === "--fix-mode") o.fixMode = argv[++i] as "agent" | "manual";
  }
  if (!o.reproResultPath) throw new Error("用法: tsx scripts/review/loop-driver.ts --repro <path> [--out <dir>] [--max-retries 3] [--fix-mode agent|manual]");
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

async function runOneRound(opts: DriverOpts): Promise<ReviewResult> {
  const criteria = runAllChecks({ repoRoot: process.cwd(), loop: opts });
  return aggregateVerdict(criteria);
}

async function dispatchFixSubagent(prompt: string): Promise<"fixed" | "skipped" | "no-marker"> {
  // Claude Code Agent tool 由宿主 CC 提供,不是 Node API。loop-driver 只能通过约定的 IPC 触发:
  // 把 prompt 写到 /tmp/fix-prompt,touch /tmp/fix-pending;宿主 CC 的 hook 监听到 fix-pending 后用
  // Agent tool 派一个 subagent,subagent 收到 fix-prompt、修完落 fix-marker。
  // 如果你跑这个 driver 时没启 hook,见 README;此处只做约定接口。
  const tmp = process.platform === "win32" ? (process.env.TEMP ?? "C:/Windows/Temp") : "/tmp";
  const promptFile = path.join(tmp, "fix-prompt");
  const pendingFile = path.join(tmp, "fix-pending");
  writeFileSync(promptFile, prompt, "utf-8");
  writeFileSync(pendingFile, new Date().toISOString(), "utf-8");
  console.log(`[driver] 写入 ${promptFile} + ${pendingFile};等待 hook 派 subagent 修...`);

  // 简单轮询 fix-marker(最多 30 分钟):subagent 修完会 echo done > fix-marker
  const start = Date.now();
  const TIMEOUT = 30 * 60 * 1000;
  while (Date.now() - start < TIMEOUT) {
    if (existsSync(FIX_MARKER)) {
      const content = readFileSync(FIX_MARKER, "utf-8").trim();
      unlinkSync(FIX_MARKER);
      if (existsSync(pendingFile)) unlinkSync(pendingFile);
      if (content.startsWith("skip:")) return "skipped";
      return "fixed";
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return "no-marker";
}

async function main(): Promise<void> {
  const opts = parseArgv(process.argv.slice(2));
  mkdirSync(opts.outDir, { recursive: true });
  const attempts: Attempt[] = [];
  let final: ReviewResult | null = null;

  for (let i = 1; i <= opts.maxRetries + 1; i++) {
    console.log(`\n=== Round ${i}/${opts.maxRetries + 1} ===`);
    const r = await runOneRound(opts);
    final = r;
    if (r.verdict === "pass") {
      attempts.push({ attempt: i, verdict: "pass" });
      console.log(`[driver] verdict=pass —— 退出循环`);
      break;
    }
    const fd = r.fixDirective!;
    console.log(`[driver] verdict=fail (${fd.failureKind})`);
    if (i > opts.maxRetries) {
      attempts.push({ attempt: i, verdict: "fail", failureKind: fd.failureKind, fixOutcome: undefined });
      console.log(`[driver] 已达 maxRetries=${opts.maxRetries},停止循环`);
      break;
    }
    if (opts.fixMode === "manual") {
      attempts.push({ attempt: i, verdict: "fail", failureKind: fd.failureKind, fixOutcome: "manual-mode" });
      console.log(`[driver] fix-mode=manual,打印 prompt 后退出 —— 由人接手`);
      console.log(`---- FIX PROMPT ----\n${fd.prompt}\n--------------------`);
      break;
    }
    const outcome = await dispatchFixSubagent(fd.prompt);
    attempts.push({ attempt: i, verdict: "fail", failureKind: fd.failureKind, fixOutcome: outcome });
    if (outcome === "skipped") {
      const skipMatch = fd.prompt.match(/skip:\s*(.+)/);
      console.log(`[driver] subagent skip;停止循环。理由: ${skipMatch?.[1] ?? "(无)"}`);
      break;
    }
    if (outcome === "no-marker") {
      console.log(`[driver] 等待 fix-marker 超时 —— 停止循环`);
      break;
    }
    console.log(`[driver] 已修,准备下一轮 review...`);
  }

  const outFile = path.join(opts.outDir, "review-verdict.json");
  writeFileSync(outFile, JSON.stringify({ ...final, attempts }, null, 2), "utf-8");
  console.log(`\n[driver] 最终: verdict=${final!.verdict}  → ${outFile}`);
  process.exit(final!.verdict === "pass" ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
```

- [ ] **Step 4: 冒烟(manual mode)**

```bash
# 制造一个失败:删 repro-result 触发 missing-repro-result
mkdir -p /tmp/loop-smoke && echo '{"verdict":"fail","verdictReason":"smoke"}' > /tmp/loop-smoke/repro-result.json
npx tsx scripts/review/loop-driver.ts --repro /tmp/loop-smoke/repro-result.json \
  --test-cmd "pnpm vitest run scripts/lock-core.test.ts" \
  --out /tmp/loop-smoke --max-retries 0 --fix-mode manual
echo "exit code: $?"
cat /tmp/loop-smoke/review-verdict.json | head -30
```

Expected: 退出码 1;`review-verdict.json` 含 `attempts: [{attempt:1,verdict:"fail",failureKind:"repro-fail",fixOutcome:"manual-mode"}]`,且 stdout 打印了完整 fix prompt。

- [ ] **Step 5: commit**

```bash
git add .claude/skills/local-review/ scripts/review/loop-driver.ts
git commit -m "feat(review): add loop-driver + local-review skill — review/fix-loop until pass"
```

---

## Self-Review

**1. Spec coverage:** WORKFLOW.md 第 4 步 4 个要素:① 独立 subagent → review-cli 是确定性独立脚本 + loop-driver 用 Agent tool 派打回(Task 5 IPC 约定);② 2 条标准 → run-checks 各实现一条(Task 3);③ 不通过打回重做 → loop-driver dispatchFixSubagent + fix-marker(Task 5);④ 循环至通过 → maxRetries 上限 + 优先级排序防同类反复打回(Task 2 FAILURE_PRIORITY)。**已知缺口**:Agent tool 的实际 spawn 在本计划是约定接口(写 fix-prompt + fix-pending,期待宿主 CC hook 处理) —— 完整 hook 实现属于「执行框架自动化」,见 INDEX.md 的「跨子系统 follow-up」段。

**2. Placeholder scan:** 无 TBD/TODO/「实现错误处理」类空话。`dispatchFixSubagent` 显式说明 IPC 约定,不是占位。`fix-mode=manual` 是显式 fallback,不是 placeholder。

**3. Type consistency:** `CriterionResult` Task 1 定义,Task 2/3/4/5 一致使用 `id/ok/summary/details`。`FixDirective.failureKind` Task 1 列出 6 种,Task 2 `classifyFailure` 与 `formatFixPrompt` 都覆盖全 6 种(无遗漏)。`LoopOptions` Task 1 定义,Task 3 `runAllChecks` 与 Task 5 `loop-driver` 都按同名字段构造。

## Execution Handoff

Plan complete. 推荐执行路径:

1. **前置**:套件 1(`2026-05-15-suite-1-repro-framework.md`)需先实现 —— review 标准 1 直接读它的产出。
2. **执行**:Task 1–5 串行。
3. **验收**:在套件 1 跑出 `verdict: pass` 的 ReproSpec 上跑 `loop-driver.ts`,看到 verdict=pass + 0 退出码;故意改坏一处再跑,看到 fix-prompt 自动生成。
