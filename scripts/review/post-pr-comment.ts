// scripts/review/post-pr-comment.ts
//
// 把 review-verdict.json 渲染成 PR 评论 + post 或更新已有评论 + 设 commit status。
// 渲染部分是纯逻辑(有单测);gh CLI 调用部分在 CI 上端到端跑。
// 见 docs/plans/2026-05-15-remote-review-bot.md Task 2。

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { ReviewResult } from "./review-types.ts";

export const COMMENT_MARKER = "<!-- pr-review-bot:verdict-comment -->";

interface RenderCtx {
  commitSha: string;
  workflowRunUrl: string;
}

export function renderComment(r: ReviewResult, ctx: RenderCtx): string {
  const emoji = r.verdict === "pass" ? "✅" : "❌";
  const head = `${COMMENT_MARKER}\n## ${emoji} 远程评审 verdict: **${r.verdict}**`;
  const meta = `\n\n_commit \`${ctx.commitSha.slice(0, 7)}\` · [workflow run](${ctx.workflowRunUrl}) · ${r.generatedAt}_`;
  const criteriaTable = [
    "",
    "| 标准 | 结果 | 简述 |",
    "|---|---|---|",
    ...r.criteria.map((c) =>
      `| \`${c.id}\` | ${c.ok ? "✅" : "❌"} | ${escapeMd(c.summary)} |`,
    ),
  ].join("\n");
  const details = r.criteria
    .filter((c) => !c.ok && c.details)
    .map((c) => [
      "",
      `### ❌ ${c.id} 详情`,
      "```",
      c.details.slice(0, 4000),
      "```",
    ].join("\n"))
    .join("\n");
  const guide = r.verdict === "fail"
    ? `\n\n---\n_要修这个失败,请在本地按 \`docs/plans/2026-05-15-local-review-loop.md\` 跑 \`loop-driver.ts\`,push 修复 commit 即可触发本评论刷新。_`
    : "";
  return head + meta + criteriaTable + details + guide;
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

// ===== CLI 入口(本地不跑,CI 上跑) =====

interface CliOpts { verdictFile: string; pr: number; sha: string; runUrl: string; }

function parseArgv(argv: string[]): CliOpts {
  const o: CliOpts = { verdictFile: "", pr: 0, sha: "", runUrl: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--verdict") o.verdictFile = argv[++i]!;
    else if (a === "--pr") o.pr = Number(argv[++i]!);
    else if (a === "--sha") o.sha = argv[++i]!;
    else if (a === "--run-url") o.runUrl = argv[++i]!;
  }
  if (!o.verdictFile || !o.pr || !o.sha || !o.runUrl) {
    throw new Error("用法: --verdict <path> --pr <n> --sha <sha> --run-url <url>");
  }
  return o;
}

function postOrUpdateComment(pr: number, body: string): void {
  // 找现有的 marker 评论
  const list = spawnSync("gh", ["pr", "view", String(pr), "--json", "comments"], { encoding: "utf-8" });
  if (list.status !== 0) throw new Error(`gh pr view 失败: ${list.stderr}`);
  const parsed = JSON.parse(list.stdout) as { comments?: Array<{ id?: string; body?: string }> };
  const comments = parsed.comments ?? [];
  const existing = comments.find((c) => (c.body ?? "").startsWith(COMMENT_MARKER));
  if (existing && existing.id) {
    // gh 不直接支持 update comment,用 API
    const repo = process.env["GITHUB_REPOSITORY"];
    if (!repo) throw new Error("GITHUB_REPOSITORY env 未设");
    const r = spawnSync("gh", [
      "api", "--method", "PATCH",
      `repos/${repo}/issues/comments/${existing.id}`,
      "-f", `body=${body}`,
    ], { encoding: "utf-8" });
    if (r.status !== 0) throw new Error(`update comment 失败: ${r.stderr}`);
  } else {
    const r = spawnSync("gh", ["pr", "comment", String(pr), "--body", body], { encoding: "utf-8" });
    if (r.status !== 0) throw new Error(`gh pr comment 失败: ${r.stderr}`);
  }
}

function setCommitStatus(sha: string, state: "success" | "failure", description: string, runUrl: string): void {
  const repo = process.env["GITHUB_REPOSITORY"];
  if (!repo) throw new Error("GITHUB_REPOSITORY env 未设");
  const r = spawnSync("gh", [
    "api", "--method", "POST",
    `repos/${repo}/statuses/${sha}`,
    "-f", `state=${state}`,
    "-f", `context=review/verdict`,
    "-f", `description=${description}`,
    "-f", `target_url=${runUrl}`,
  ], { encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`set commit status 失败: ${r.stderr}`);
}

function main(): void {
  const o = parseArgv(process.argv.slice(2));
  const verdict = JSON.parse(readFileSync(o.verdictFile, "utf-8")) as ReviewResult;
  const body = renderComment(verdict, { commitSha: o.sha, workflowRunUrl: o.runUrl });
  postOrUpdateComment(o.pr, body);
  const desc = verdict.verdict === "pass"
    ? `全部通过`
    : `verdict=fail (${verdict.criteria.filter((c) => !c.ok).length} 项 fail)`;
  setCommitStatus(o.sha, verdict.verdict === "pass" ? "success" : "failure", desc, o.runUrl);
  console.log(`[post-pr-comment] verdict=${verdict.verdict},评论 + status 已更新`);
}

if (process.argv[1] && process.argv[1].endsWith("post-pr-comment.ts")) main();
