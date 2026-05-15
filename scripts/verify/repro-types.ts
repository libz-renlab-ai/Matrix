// scripts/verify/repro-types.ts
//
// Suite-1 (复现验证代码框架) 的类型定义。
// 设计决议见 docs/plans/2026-05-15-suite-1-brainstorm.md;
// 实施 plan 见 docs/plans/2026-05-15-suite-1-repro-framework.md。
//
// 与本文件同目录的 repro-core.ts 严禁 import fs / child_process —— 它是 functional core;
// IO/编排在 worktree-shell.ts / repro-runner.ts / repro-cli.ts。

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

/** baseline (改动前) 怎么切。`ref` 缺省 = `git merge-base HEAD <baseBranch>` */
export interface BaselineRef {
  ref?: string;                      // git ref;default 见 worktree-shell.resolveBaselineRef
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

/** CI 行为配置。skip=true 时 pr-review.yml 的 list-specs job 会把此 spec 从
 *  repro matrix 里过滤掉,并把它当显式豁免计入 verdict(不再让 spec 无脑 fail)。
 *  典型用例:依赖手工预置目录 / Windows-only / 需 root 权限等无法在 Ubuntu runner 上重现的 spec。
 *  纯过滤逻辑见 scripts/verify/list-specs-core.ts; issue #3 Gap 1 落地此字段。 */
export interface SpecCi {
  skip?: boolean;
  /** 给人看的跳过原因;verdict comment 与日志都会展示。 */
  reason?: string;
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
  /** CI 上的行为配置;主要给 pr-review.yml 的 list-specs job 读。 */
  ci?: SpecCi;
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
