import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatClaimComment,
  parseClaimComment,
  determineLockState,
  isLockExpired,
  decideClaimOutcome,
  type IssueSnapshot,
} from "./lock-core.ts";

const snap = (labels: string[], comments: string[]): IssueSnapshot => ({
  labels,
  comments: comments.map((body) => ({ body })),
});

// --- Task 1: parse / format ---

test("formatClaimComment 产出可被 parseClaimComment 还原的块", () => {
  const body = formatClaimComment("grill", "alice@h1/s1", "2026-05-14T08:30:00Z");
  const parsed = parseClaimComment(body);
  assert.deepEqual(parsed, {
    kind: "grill",
    claimer: "alice@h1/s1",
    at: "2026-05-14T08:30:00Z",
  });
});

test("parseClaimComment 对非认领评论返回 null", () => {
  assert.equal(parseClaimComment("普通评论,不是锁"), null);
  assert.equal(parseClaimComment(""), null);
});

test("parseClaimComment 容忍锚点前后有其它文本", () => {
  const body = `前言\n<!-- teamagent-lock:exec claimer="bob@h2/s9" at="2026-05-14T09:00:00Z" -->\n🔒 ...`;
  assert.deepEqual(parseClaimComment(body), {
    kind: "exec",
    claimer: "bob@h2/s9",
    at: "2026-05-14T09:00:00Z",
  });
});

// --- Task 2: lock state + expiry ---

test("determineLockState: 无 label → unlocked", () => {
  const s = determineLockState(snap([], []), "grill");
  assert.equal(s.locked, false);
});

test("determineLockState: 有 label + 认领评论 → locked, 带 claimer/at", () => {
  const c = formatClaimComment("grill", "alice@h1/s1", "2026-05-14T08:30:00Z");
  const s = determineLockState(snap(["lock:grill"], [c]), "grill");
  assert.equal(s.locked, true);
  assert.equal(s.claimer, "alice@h1/s1");
  assert.equal(s.at, "2026-05-14T08:30:00Z");
});

test("determineLockState: 有 label 但无认领评论 → locked 但 at 缺失", () => {
  const s = determineLockState(snap(["lock:grill"], []), "grill");
  assert.equal(s.locked, true);
  assert.equal(s.at, undefined);
});

test("determineLockState: 只看对应 kind 的 label", () => {
  const s = determineLockState(snap(["lock:exec"], []), "grill");
  assert.equal(s.locked, false);
});

test("isLockExpired: 25h 前 → true", () => {
  const now = new Date("2026-05-14T10:00:00Z");
  assert.equal(isLockExpired("2026-05-13T09:00:00Z", now), true);
});

test("isLockExpired: 23h 前 → false", () => {
  const now = new Date("2026-05-14T10:00:00Z");
  assert.equal(isLockExpired("2026-05-13T11:00:00Z", now), false);
});

test("isLockExpired: at 为 undefined → true(无时间戳的锁视为可清)", () => {
  assert.equal(isLockExpired(undefined, new Date()), true);
});

// --- Task 3: claim-race resolution ---

test("decideClaimOutcome: 贴评论后只有自己一条 → acquired", () => {
  const mine = formatClaimComment("grill", "alice@h1/s1", "2026-05-14T08:30:00Z");
  const out = decideClaimOutcome(snap(["lock:grill"], [mine]), "grill", "alice@h1/s1");
  assert.equal(out, "acquired");
});

test("decideClaimOutcome: 有更早的他人认领评论 → race-lost", () => {
  const earlier = formatClaimComment("grill", "bob@h2/s9", "2026-05-14T08:29:00Z");
  const mine = formatClaimComment("grill", "alice@h1/s1", "2026-05-14T08:30:00Z");
  const out = decideClaimOutcome(
    snap(["lock:grill"], [earlier, mine]),
    "grill",
    "alice@h1/s1",
  );
  assert.equal(out, "race-lost");
});

test("decideClaimOutcome: 自己是最早的一条 → acquired", () => {
  const mine = formatClaimComment("grill", "alice@h1/s1", "2026-05-14T08:29:00Z");
  const later = formatClaimComment("grill", "bob@h2/s9", "2026-05-14T08:30:00Z");
  const out = decideClaimOutcome(
    snap(["lock:grill"], [mine, later]),
    "grill",
    "alice@h1/s1",
  );
  assert.equal(out, "acquired");
});
