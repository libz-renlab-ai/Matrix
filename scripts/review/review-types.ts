// scripts/review/review-types.ts
//
// 本地 review 自动循环的类型定义。
// 见 docs/plans/2026-05-15-local-review-loop.md Task 1。

/** WORKFLOW.md 第 4 步钉死的 2 条标准。 */
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
  /** verdict=fail 时,给打回 subagent 的结构化指令(给 LLM 作 prompt 用) */
  fixDirective?: FixDirective;
}

export interface FixDirective {
  /** kebab-case 失败类型,便于 loop-driver 防止「同一类失败连续打回 N 次」。 */
  failureKind:
    | "repro-fail"
    | "repro-ambiguous"
    | "tests-failing"
    | "merge-conflict"
    | "dirty-tree"
    | "missing-repro-result";
  /** 给打回 subagent 一段可读 prompt,描述「要修什么、修完怎么自检」。 */
  prompt: string;
}

export interface LoopOptions {
  /** 最多打回几次后强制停止(默认 3)。防止死循环。 */
  maxRetries: number;
  /** 跑 review 的 ReproResult 路径(套件 1 产出)。 */
  reproResultPath: string;
  /** 评测时基于哪个 base ref 比对(默认 main)。 */
  baseBranch: string;
  /** 跑测试用的命令(可执行文件)。 */
  testCommand: string;
  testArgs: string[];
}
