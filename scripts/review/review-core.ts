// scripts/review/review-core.ts
//
// 纯逻辑:把「2 条标准」的 CriterionResult 汇总为 ReviewResult,失败按类别分类,
// 给打回 subagent 写 fix prompt。
// 严禁 import fs / child_process —— IO 在 run-checks.ts / loop-driver.ts。
// 见 docs/plans/2026-05-15-local-review-loop.md Task 2。

import type {
  CriterionResult,
  FixDirective,
  ReviewResult,
} from "./review-types.ts";

/** 同时有多种失败时,优先打回最根本的那个 —— 数组顺序 = 优先级(越靠前越优先)。 */
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
  const s = c.summary.toLowerCase();
  if (c.id === "repro-pass") {
    if (s.includes("missing")) return { failureKind: "missing-repro-result", prompt: "" };
    if (s.includes("ambiguous")) return { failureKind: "repro-ambiguous", prompt: "" };
    return { failureKind: "repro-fail", prompt: "" };
  }
  // c.id === "tests-and-merge-clean"
  if (s.includes("conflict")) return { failureKind: "merge-conflict", prompt: "" };
  if (s.includes("dirty") || s.includes("untracked")) return { failureKind: "dirty-tree", prompt: "" };
  return { failureKind: "tests-failing", prompt: "" };
}

export function aggregateVerdict(criteria: CriterionResult[]): ReviewResult {
  const generatedAt = new Date().toISOString();
  const fails = criteria.filter((c) => !c.ok);
  if (fails.length === 0) {
    return { generatedAt, verdict: "pass", criteria };
  }
  // 取优先级最高的 fail
  const classified = fails.map((c) => ({ c, fd: classifyFailure(c) }));
  classified.sort((a, b) =>
    FAILURE_PRIORITY.indexOf(a.fd.failureKind) - FAILURE_PRIORITY.indexOf(b.fd.failureKind),
  );
  const top = classified[0]!;
  return {
    generatedAt,
    verdict: "fail",
    criteria,
    fixDirective: { ...top.fd, prompt: formatFixPrompt(top.fd, top.c) },
  };
}

const HEADER_BY_KIND: Record<FixDirective["failureKind"], string> = {
  "repro-fail":             "套件 1 复现验证 verdict=fail —— before/after 对比未严谨成立",
  "repro-ambiguous":        "套件 1 复现验证 verdict=ambiguous —— 两侧期望可互换命中,对比不严谨",
  "missing-repro-result":   "找不到 repro-result.json —— 你还没跑套件 1,或 spec 路径错了",
  "merge-conflict":         "与 main 有合并冲突",
  "tests-failing":          "全量测试有失败用例",
  "dirty-tree":             "工作树有未提交改动",
};

const SELF_CHECK_BY_KIND: Record<FixDirective["failureKind"], string> = {
  "repro-fail":             "重跑 `npx tsx scripts/verify/repro-cli.ts <spec> --no-gif`,看 verdict=pass",
  "repro-ambiguous":        "重审 ReproSpec.expect.before/after 是否真互斥(互换不应都命中);改完重跑 repro-cli",
  "missing-repro-result":   "先跑 `npx tsx scripts/verify/repro-cli.ts <spec>`,确认产物落到 review 指定的 --repro 路径",
  "merge-conflict":         "`git fetch origin && git rebase origin/main`,解冲突后重跑 review",
  "tests-failing":          "`pnpm test` 退出码 0(或对应的 --test-cmd 退出 0)",
  "dirty-tree":             "`git status` 干净(无 M / 无 ??),要么提交要么 .gitignore",
};

export function formatFixPrompt(fd: FixDirective, c: CriterionResult): string {
  return [
    `## 失败类别: ${fd.failureKind}`,
    `**问题**:${HEADER_BY_KIND[fd.failureKind]}`,
    ``,
    `### 详情`,
    "```",
    c.summary + (c.details ? `\n\n${c.details}` : ""),
    "```",
    ``,
    `### 修完后怎么自检`,
    SELF_CHECK_BY_KIND[fd.failureKind],
    ``,
    `### 边界`,
    `- 只动**与本失败类别直接相关**的代码;**不要顺手 refactor**。`,
    `- 修好后用 \`echo done > /tmp/fix-marker\`(Windows 等价 \`echo done > %TEMP%\\fix-marker\`)落一个标记文件,然后 stop。`,
    `  loop-driver 检测到标记会重跑 review。`,
  ].join("\n");
}
