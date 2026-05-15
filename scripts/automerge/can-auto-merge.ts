// scripts/automerge/can-auto-merge.ts
//
// 纯门控逻辑:输入 PR metadata → 输出是否能自动 squash 合主分支。
// 严禁 import fs / child_process —— IO 在 auto-merge.yml 的 shell step。
// 见 docs/plans/2026-05-15-auto-merge.md Task 1。

export interface PrSnapshot {
  number: number;
  baseRefName: string;
  isDraft: boolean;
  body: string;
  labels: string[];
  state: "OPEN" | "CLOSED" | "MERGED";
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  /** GitHub 上 review/verdict 这条 commit status 的状态 */
  reviewVerdictState: "success" | "failure" | "pending" | "missing";
  /** PR head 是否在仓库内(非 fork) */
  isFromInternalRepo: boolean;
}

export interface AutoMergeDecision {
  merge: boolean;
  /** 不论通过与否,都给一个 reason 便于审计 */
  reason: string;
}

export function canAutoMerge(pr: PrSnapshot): AutoMergeDecision {
  if (pr.state !== "OPEN") {
    return { merge: false, reason: `PR state=${pr.state},非 OPEN,跳过` };
  }
  if (pr.isDraft) {
    return { merge: false, reason: `PR 是 draft,跳过` };
  }
  if (!pr.isFromInternalRepo) {
    return { merge: false, reason: `PR 来自外部 fork,跳过(安全策略)` };
  }
  if (pr.baseRefName !== "main") {
    return {
      merge: false,
      reason: `baseRefName=${pr.baseRefName} ≠ main,stacked PR 在 squash 模型下会丢数据,跳过(见 POSTPR.md)`,
    };
  }
  if (pr.labels.includes("do-not-merge")) {
    return { merge: false, reason: `PR 带 do-not-merge label` };
  }
  if (containsVisualProof(pr.body)) {
    return {
      merge: false,
      reason: `PR body 含 "## Visual proof of work" → 走 human-merge(VISUAL-PROOF-HUMAN-MERGE.md 钉死)`,
    };
  }
  if (pr.reviewVerdictState !== "success") {
    return {
      merge: false,
      reason: `review/verdict commit status = ${pr.reviewVerdictState},非 success`,
    };
  }
  if (pr.mergeable !== "MERGEABLE") {
    return {
      merge: false,
      reason: `mergeable=${pr.mergeable},等 GitHub 重算或解冲突`,
    };
  }
  return {
    merge: true,
    reason: `所有门控通过 —— review verdict success + base main + no flags + mergeable`,
  };
}

function containsVisualProof(body: string): boolean {
  // POSTPR.md / VISUAL-PROOF-HUMAN-MERGE.md 钉的章节标题。
  // 大小写不敏感、允许任意空白(tab / 多个空格);锚定到行首避免假阳性。
  return /^\s*##\s+visual\s+proof\s+of\s+work/im.test(body);
}
