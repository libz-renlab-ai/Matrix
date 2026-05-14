/**
 * lock-sweep.ts — 24h 自动撤锁。认领锁工作流里唯一必须是代码的环节。
 *
 * 认领 / 释放 / 查状态都走文档(docs/CLAIM-LOCK.md);文档唯一做不到的是「定时」。
 * 这个脚本由 .github/workflows/lock-sweeper.yml 每小时跑一次:扫描所有挂着
 * lock:grill / lock:exec label 的 open issue,凡是没有「未过期持有者」的
 * —— 认领评论超过 24h,或 label 在但认领评论缺失 —— 撤掉 label + 贴一条
 * 说明评论。
 *
 * Usage:
 *   pnpm tsx scripts/lock-sweep.ts        # 扫描并撤除过期锁
 *
 * 需要 gh CLI 已认证(CI 里由 GH_TOKEN 提供)。
 *
 * Exit codes:
 *   0 = 扫描完成(撤了 0 个或 N 个都算成功)
 *   1 = gh 调用失败 / 未认证
 */

import { spawnSync } from "node:child_process";
import { lockLabel, holdingClaim, type LockKind } from "./lock-core.ts";

const KINDS: LockKind[] = ["grill", "exec"];

/** 跑一条 gh 命令,返回 stdout;失败即抛(带 stderr)。 */
function gh(args: string[]): string {
  const r = spawnSync("gh", args, { encoding: "utf8", windowsHide: true });
  if (r.error) {
    throw new Error(`gh 调用失败(gh 是否已安装?):${r.error.message}`);
  }
  if (r.status !== 0) {
    throw new Error(
      `gh ${args.join(" ")} 退出码 ${r.status}\n${(r.stderr || "").trim()}`,
    );
  }
  return r.stdout;
}

interface IssueComment {
  body: string;
}

/** 撤一把锁:移除 label + 贴说明评论(纯文本,不含锚点,免得被当成新认领)。 */
function sweepOne(issue: number, kind: LockKind): void {
  const label = lockLabel(kind);
  gh(["issue", "edit", String(issue), "--remove-label", label]);
  gh([
    "issue",
    "comment",
    String(issue),
    "--body",
    `⏰ \`${label}\` 超过 24h 未交付,已自动撤除。issue 重新开放认领。`,
  ]);
  console.log(`  swept #${issue} (${label})`);
}

function main(): void {
  const now = new Date();
  let swept = 0;

  for (const kind of KINDS) {
    const label = lockLabel(kind);
    const issues = JSON.parse(
      gh([
        "issue",
        "list",
        "--label",
        label,
        "--state",
        "open",
        "--limit",
        "200",
        "--json",
        "number",
      ]),
    ) as { number: number }[];
    console.log(`${label}: ${issues.length} 个挂锁 issue`);

    for (const { number } of issues) {
      const comments = (JSON.parse(
        gh(["issue", "view", String(number), "--json", "comments"]),
      ).comments ?? []) as IssueComment[];
      if (holdingClaim(comments, kind, now) === undefined) {
        sweepOne(number, kind);
        swept++;
      }
    }
  }

  console.log(`done — swept ${swept} expired lock(s)`);
}

try {
  main();
} catch (e) {
  console.error(`lock-sweep 失败:${(e as Error).message}`);
  process.exit(1);
}
