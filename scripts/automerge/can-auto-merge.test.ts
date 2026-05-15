// scripts/automerge/can-auto-merge.test.ts
//
// Task 1 of docs/plans/2026-05-15-auto-merge.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import { canAutoMerge } from "./can-auto-merge.ts";
import type { PrSnapshot } from "./can-auto-merge.ts";

const ok: PrSnapshot = {
  number: 1,
  baseRefName: "main",
  isDraft: false,
  body: "Feature X",
  labels: [],
  state: "OPEN",
  mergeable: "MERGEABLE",
  reviewVerdictState: "success",
  isFromInternalRepo: true,
};

test("基本通过:全条件 OK → merge=true", () => {
  const r = canAutoMerge(ok);
  assert.equal(r.merge, true);
});

test("draft → skip", () => {
  const r = canAutoMerge({ ...ok, isDraft: true });
  assert.equal(r.merge, false);
  assert.match(r.reason, /draft/);
});

test("base 非 main → skip(POSTPR squash 模型禁止 stacked)", () => {
  const r = canAutoMerge({ ...ok, baseRefName: "user/dev" });
  assert.equal(r.merge, false);
  assert.match(r.reason, /baseRefName|stacked/);
});

test("PR body 含 ## Visual proof of work → skip(human-merge only)", () => {
  const r = canAutoMerge({
    ...ok,
    body: "Feature X\n\n## Visual proof of work\n\n![gif](demo.gif)",
  });
  assert.equal(r.merge, false);
  assert.match(r.reason, /visual.proof/i);
});

test("Visual proof 标题大小写/空白宽松匹配", () => {
  const variants = [
    "## VISUAL PROOF OF WORK\n\nx",
    "  ##   visual    proof    of    work  \n\nx",
    "Feature\n\n##\tvisual proof of work\n",
  ];
  for (const body of variants) {
    assert.equal(canAutoMerge({ ...ok, body }).merge, false, `应 skip: ${body.slice(0, 30)}`);
  }
});

test("有 do-not-merge label → skip", () => {
  assert.equal(canAutoMerge({ ...ok, labels: ["do-not-merge"] }).merge, false);
});

test("review/verdict status 非 success → skip(failure / pending / missing)", () => {
  assert.equal(canAutoMerge({ ...ok, reviewVerdictState: "failure" }).merge, false);
  assert.equal(canAutoMerge({ ...ok, reviewVerdictState: "pending" }).merge, false);
  assert.equal(canAutoMerge({ ...ok, reviewVerdictState: "missing" }).merge, false);
});

test("外部 fork PR → skip(pr-review.yml 也不评审外部 fork,这里兜底)", () => {
  assert.equal(canAutoMerge({ ...ok, isFromInternalRepo: false }).merge, false);
});

test("PR state CLOSED/MERGED → skip(重入兜底)", () => {
  assert.equal(canAutoMerge({ ...ok, state: "CLOSED" }).merge, false);
  assert.equal(canAutoMerge({ ...ok, state: "MERGED" }).merge, false);
});

test("mergeable=CONFLICTING/UNKNOWN → skip", () => {
  assert.equal(canAutoMerge({ ...ok, mergeable: "CONFLICTING" }).merge, false);
  assert.equal(canAutoMerge({ ...ok, mergeable: "UNKNOWN" }).merge, false);
});

test("通过时 reason 也填充(便于审计)", () => {
  const r = canAutoMerge(ok);
  assert.equal(r.merge, true);
  assert.ok(r.reason.length > 0, "通过时也应该写 reason");
});
