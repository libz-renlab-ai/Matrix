// scripts/verify/list-specs-core.test.ts
//
// Issue #3 Gap 1: 给 ReproSpec 加 ci: { skip?: boolean; reason?: string }
// 字段后,pr-review.yml 的 list-specs job 需要把 ci.skip = true 的 spec
// 过滤出去。这里测的是「过滤」纯函数。
//
// 与同目录 list-specs-core.ts 配对,严禁 import fs / child_process。

import { test } from "node:test";
import assert from "node:assert/strict";
import { filterCiSpecs, type DiscoveredSpec } from "./list-specs-core.ts";

test("filterCiSpecs: 空数组 → 两边都空", () => {
  const r = filterCiSpecs([]);
  assert.deepEqual(r, { included: [], excluded: [] });
});

test("filterCiSpecs: 无 ci 字段 → 全部 included", () => {
  const specs: DiscoveredSpec[] = [
    { file: "fixtures/repro-specs/a.ts" },
    { file: "fixtures/repro-specs/b.ts" },
  ];
  const r = filterCiSpecs(specs);
  assert.deepEqual(r.included, ["fixtures/repro-specs/a.ts", "fixtures/repro-specs/b.ts"]);
  assert.deepEqual(r.excluded, []);
});

test("filterCiSpecs: ci.skip = false → included(不是 truthy 就算保留)", () => {
  const r = filterCiSpecs([{ file: "x.ts", ci: { skip: false } }]);
  assert.deepEqual(r.included, ["x.ts"]);
  assert.deepEqual(r.excluded, []);
});

test("filterCiSpecs: ci 字段存在但无 skip → included", () => {
  const r = filterCiSpecs([{ file: "x.ts", ci: { reason: "无意义,因为没 skip" } }]);
  assert.deepEqual(r.included, ["x.ts"]);
  assert.deepEqual(r.excluded, []);
});

test("filterCiSpecs: ci.skip = true + reason → excluded + 带 reason", () => {
  const r = filterCiSpecs([
    { file: "fixtures/repro-specs/hook-moment-block.ts", ci: { skip: true, reason: "需 demo-stage 目录预置" } },
  ]);
  assert.deepEqual(r.included, []);
  assert.deepEqual(r.excluded, [
    { file: "fixtures/repro-specs/hook-moment-block.ts", reason: "需 demo-stage 目录预置" },
  ]);
});

test("filterCiSpecs: ci.skip = true 但无 reason → excluded + 默认 reason 'ci.skip = true'", () => {
  const r = filterCiSpecs([{ file: "x.ts", ci: { skip: true } }]);
  assert.equal(r.included.length, 0);
  assert.equal(r.excluded.length, 1);
  assert.equal(r.excluded[0]!.reason, "ci.skip = true");
});

test("filterCiSpecs: 混合 —— included 与 excluded 都正确分桶且保序", () => {
  const r = filterCiSpecs([
    { file: "a.ts" },
    { file: "b.ts", ci: { skip: true, reason: "原因 B" } },
    { file: "c.ts", ci: { skip: false } },
    { file: "d.ts", ci: { skip: true } },                // 无 reason 走默认
  ]);
  assert.deepEqual(r.included, ["a.ts", "c.ts"]);
  assert.deepEqual(r.excluded, [
    { file: "b.ts", reason: "原因 B" },
    { file: "d.ts", reason: "ci.skip = true" },
  ]);
});
