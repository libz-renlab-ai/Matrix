// scripts/review/review-core.test.ts
//
// Task 2 of docs/plans/2026-05-15-local-review-loop.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateVerdict, classifyFailure, formatFixPrompt } from "./review-core.ts";
import type { CriterionResult } from "./review-types.ts";

const passRepro: CriterionResult = { id: "repro-pass", ok: true, summary: "verdict=pass", details: "" };
const failRepro: CriterionResult = { id: "repro-pass", ok: false, summary: "verdict=fail", details: "before 期望未达: stdout 缺关键字 \"deny\"" };
const ambiguousRepro: CriterionResult = { id: "repro-pass", ok: false, summary: "verdict=ambiguous", details: "before 也命中了 after 的期望" };
const passTests: CriterionResult = { id: "tests-and-merge-clean", ok: true, summary: "tests pass + tree clean", details: "" };
const failTests: CriterionResult = { id: "tests-and-merge-clean", ok: false, summary: "tests failing (exit 1): 23/100 tests failing", details: "FAIL packages/core/src/foo.test.ts ..." };
const dirtyTree: CriterionResult = { id: "tests-and-merge-clean", ok: false, summary: "tests pass; working tree dirty (3 entries)", details: " M src/x.ts\n?? note.md" };

test("aggregateVerdict: 两条都 ok → pass,无 fixDirective", () => {
  const r = aggregateVerdict([passRepro, passTests]);
  assert.equal(r.verdict, "pass");
  assert.equal(r.fixDirective, undefined);
});

test("aggregateVerdict: 任一不 ok → fail + 带 fixDirective", () => {
  const r = aggregateVerdict([failRepro, passTests]);
  assert.equal(r.verdict, "fail");
  assert.ok(r.fixDirective, "fixDirective 必须存在");
  assert.equal(r.fixDirective!.failureKind, "repro-fail");
  assert.ok(r.fixDirective!.prompt.length > 0, "prompt 必须填充");
});

test("classifyFailure: repro 三种情况(fail / ambiguous / missing)", () => {
  assert.equal(classifyFailure(failRepro).failureKind, "repro-fail");
  assert.equal(classifyFailure(ambiguousRepro).failureKind, "repro-ambiguous");
  const missing: CriterionResult = { id: "repro-pass", ok: false, summary: "missing repro-result.json: foo/bar", details: "" };
  assert.equal(classifyFailure(missing).failureKind, "missing-repro-result");
});

test("classifyFailure: tests 失败 vs 工作树脏 vs 冲突", () => {
  assert.equal(classifyFailure(failTests).failureKind, "tests-failing");
  assert.equal(classifyFailure(dirtyTree).failureKind, "dirty-tree");
  const conflict: CriterionResult = { id: "tests-and-merge-clean", ok: false, summary: "merge conflict with origin/main", details: "" };
  assert.equal(classifyFailure(conflict).failureKind, "merge-conflict");
});

test("formatFixPrompt: 包含失败类别 + details + 自检步骤 + 边界", () => {
  const p = formatFixPrompt({ failureKind: "tests-failing", prompt: "" }, failTests);
  assert.match(p, /tests-failing/, "应含失败类别");
  assert.match(p, /23\/100/, "应含 details 内容");
  assert.match(p, /pnpm test/, "应含修完自检步骤");
  assert.match(p, /边界/, "应含约束边界");
  assert.match(p, /fix-marker/, "应说明如何回报已修");
});

test("aggregateVerdict 多失败:fixDirective 按优先级(repro > tests > tree)", () => {
  const r = aggregateVerdict([failRepro, failTests]);
  assert.equal(r.fixDirective!.failureKind, "repro-fail");
});

test("aggregateVerdict 多失败 ambiguous + dirty-tree:ambiguous 优先", () => {
  const r = aggregateVerdict([ambiguousRepro, dirtyTree]);
  assert.equal(r.fixDirective!.failureKind, "repro-ambiguous");
});

test("classifyFailure: ok=true 抛错(防误用)", () => {
  assert.throws(() => classifyFailure(passRepro), /classifyFailure 不应被调用/);
});
