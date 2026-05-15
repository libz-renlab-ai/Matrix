// scripts/review/post-pr-comment.test.ts
//
// 只测纯渲染逻辑 —— gh CLI / GitHub API 在 CI 上端到端跑。
// Task 2 of docs/plans/2026-05-15-remote-review-bot.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderComment, COMMENT_MARKER } from "./post-pr-comment.ts";
import type { ReviewResult } from "./review-types.ts";

const passResult: ReviewResult = {
  generatedAt: "2026-05-15T10:00:00.000Z",
  verdict: "pass",
  criteria: [
    { id: "repro-pass", ok: true, summary: "verdict=pass", details: "" },
    { id: "tests-and-merge-clean", ok: true, summary: "tests pass + tree clean", details: "" },
  ],
};

const failResult: ReviewResult = {
  generatedAt: "2026-05-15T10:00:00.000Z",
  verdict: "fail",
  criteria: [
    { id: "repro-pass", ok: false, summary: "verdict=fail", details: "before 期望未达: stdout 缺关键字 \"deny\"" },
    { id: "tests-and-merge-clean", ok: true, summary: "tests pass + tree clean", details: "" },
  ],
  fixDirective: { failureKind: "repro-fail", prompt: "..." },
};

const ctx = { commitSha: "abc12345deadbeef", workflowRunUrl: "https://github.com/x/y/actions/runs/1" };

test("renderComment: pass 评论以 marker 开头,含 ✅ 与 verdict", () => {
  const c = renderComment(passResult, ctx);
  assert.ok(c.startsWith(COMMENT_MARKER), "必须以 marker 开头便于覆盖更新");
  assert.match(c, /✅/);
  assert.match(c, /verdict.*pass/i);
  assert.match(c, /abc1234/, "应含 commit sha 短形");
});

test("renderComment: fail 评论含 ❌ + 失败 details + run-url + 修复指引", () => {
  const c = renderComment(failResult, ctx);
  assert.match(c, /❌/);
  assert.match(c, /verdict.*fail/i);
  assert.match(c, /缺关键字/);
  assert.match(c, /github\.com\/x\/y/, "应链回 workflow run");
  assert.match(c, /loop-driver/, "fail 时应给修复指引");
});

test("COMMENT_MARKER 是 hidden HTML comment 且独特", () => {
  assert.match(COMMENT_MARKER, /^<!-- /);
  assert.match(COMMENT_MARKER, /pr-review-bot/);
});

test("renderComment: criteria table 同时含 ✅ 和 ❌ 列", () => {
  const c = renderComment(failResult, ctx);
  // 标准 1 fail, 标准 2 pass —— 两行表格都该出现
  assert.match(c, /repro-pass/);
  assert.match(c, /tests-and-merge-clean/);
  assert.match(c, /\|.+❌.+\|/, "应有 ❌ 表格行");
  assert.match(c, /\|.+✅.+\|/, "应有 ✅ 表格行");
});

test("renderComment: 评论里转义 pipe 字符,防止 markdown 表格炸", () => {
  const tricky: ReviewResult = {
    generatedAt: "2026-05-15T10:00:00.000Z",
    verdict: "fail",
    criteria: [
      { id: "repro-pass", ok: false, summary: "fail | pipe | inside", details: "" },
      { id: "tests-and-merge-clean", ok: true, summary: "ok", details: "" },
    ],
    fixDirective: { failureKind: "repro-fail", prompt: "" },
  };
  const c = renderComment(tricky, ctx);
  // summary 里有 |,渲染后应是 \|
  assert.match(c, /fail \\\| pipe \\\| inside/);
});
