import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatClaimComment,
  formatUnlockComment,
  parseClaimComment,
  parseUnlockMarker,
  isLockExpired,
  holdingClaim,
  lockLabel,
  type LockKind,
} from "./lock-core.ts";

const claim = (kind: LockKind, claimer: string, at: string) => ({
  body: formatClaimComment(kind, claimer, at),
});
const unlock = (kind: LockKind, claimer: string) => ({
  body: formatUnlockComment(kind, claimer),
});

// --- format / parse ---

test("formatClaimComment 产出可被 parseClaimComment 还原的块", () => {
  const body = formatClaimComment("grill", "alice@h1/s1", "2026-05-14T08:30:00Z");
  const parsed = parseClaimComment(body);
  assert.deepEqual(parsed, {
    kind: "grill",
    claimer: "alice@h1/s1",
    at: "2026-05-14T08:30:00Z",
  });
});

test("formatUnlockComment 产出可被 parseUnlockMarker 还原的块", () => {
  const body = formatUnlockComment("exec", "bob@h2/s9");
  assert.deepEqual(parseUnlockMarker(body), { kind: "exec", claimer: "bob@h2/s9" });
});

test("parseClaimComment 对非认领评论返回 null", () => {
  assert.equal(parseClaimComment("普通评论,不是锁"), null);
  assert.equal(parseClaimComment(""), null);
});

test("认领锚点与释放锚点互不误认", () => {
  // 认领评论不应被当成释放,释放评论不应被当成认领。
  assert.equal(parseUnlockMarker(formatClaimComment("grill", "a@h/s", "2026-05-14T08:30:00Z")), null);
  assert.equal(parseClaimComment(formatUnlockComment("grill", "a@h/s")), null);
});

test("parseClaimComment 容忍锚点前后有其它文本", () => {
  const body = `前言\n<!-- teamagent-lock:exec claimer="bob@h2/s9" at="2026-05-14T09:00:00Z" -->\n🔒 ...`;
  assert.deepEqual(parseClaimComment(body), {
    kind: "exec",
    claimer: "bob@h2/s9",
    at: "2026-05-14T09:00:00Z",
  });
});

test("lockLabel: kind → GitHub label 名", () => {
  assert.equal(lockLabel("grill"), "lock:grill");
  assert.equal(lockLabel("exec"), "lock:exec");
});

// --- expiry ---

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

test("isLockExpired: at 为非法时间戳 → true", () => {
  assert.equal(isLockExpired("garbage", new Date()), true);
  assert.equal(isLockExpired("", new Date()), true);
});

// --- holdingClaim:当前持有者 = 最早一条「未过期 + 未释放」的认领 ---

test("holdingClaim: 无认领评论 → undefined(label 若在即 stale)", () => {
  const now = new Date("2026-05-14T10:00:00Z");
  assert.equal(holdingClaim([], "grill", now), undefined);
  assert.equal(holdingClaim([{ body: "普通评论" }], "grill", now), undefined);
});

test("holdingClaim: 单条未过期认领 → 该认领者持有", () => {
  const now = new Date("2026-05-14T10:00:00Z");
  const h = holdingClaim(
    [claim("grill", "alice@h1/s1", "2026-05-14T08:30:00Z")],
    "grill",
    now,
  );
  assert.equal(h?.claimer, "alice@h1/s1");
});

test("holdingClaim: 唯一一条认领已过期 → undefined(sweeper 应撤 label)", () => {
  const now = new Date("2026-05-14T10:00:00Z");
  const h = holdingClaim(
    [claim("grill", "alice@h1/s1", "2026-05-13T08:00:00Z")],
    "grill",
    now,
  );
  assert.equal(h, undefined);
});

test("holdingClaim: 多条未过期 → 最早的那条持有(let the first go)", () => {
  const now = new Date("2026-05-14T10:00:00Z");
  const h = holdingClaim(
    [
      claim("grill", "bob@h2/s9", "2026-05-14T09:00:00Z"),
      claim("grill", "alice@h1/s1", "2026-05-14T08:30:00Z"),
    ],
    "grill",
    now,
  );
  assert.equal(h?.claimer, "alice@h1/s1");
});

test("holdingClaim: 旧锚点已过期 + 新认领未过期 → 新认领者持有(残留锚点不死锁)", () => {
  const now = new Date("2026-05-14T10:00:00Z");
  const h = holdingClaim(
    [
      claim("grill", "alice@h1/s1", "2026-05-13T08:00:00Z"), // 26h 前,僵尸
      claim("grill", "bob@h2/s9", "2026-05-14T09:30:00Z"), // 30min 前,活的
    ],
    "grill",
    now,
  );
  assert.equal(h?.claimer, "bob@h2/s9");
});

test("holdingClaim: 持有者提前释放 → 不再持有(释放锚点让认领作废)", () => {
  const now = new Date("2026-05-14T10:00:00Z");
  const h = holdingClaim(
    [
      claim("grill", "alice@h1/s1", "2026-05-14T08:30:00Z"),
      unlock("grill", "alice@h1/s1"),
    ],
    "grill",
    now,
  );
  assert.equal(h, undefined);
});

test("holdingClaim: 早认领者释放后,晚认领者接手(不死锁)", () => {
  const now = new Date("2026-05-14T10:00:00Z");
  const h = holdingClaim(
    [
      claim("grill", "alice@h1/s1", "2026-05-14T08:30:00Z"),
      claim("grill", "bob@h2/s9", "2026-05-14T09:00:00Z"),
      unlock("grill", "alice@h1/s1"),
    ],
    "grill",
    now,
  );
  assert.equal(h?.claimer, "bob@h2/s9");
});

test("holdingClaim: 释放锚点只作用于同名 claimer", () => {
  const now = new Date("2026-05-14T10:00:00Z");
  const h = holdingClaim(
    [
      claim("grill", "alice@h1/s1", "2026-05-14T08:30:00Z"),
      unlock("grill", "bob@h2/s9"), // 释放的是别人,不影响 alice
    ],
    "grill",
    now,
  );
  assert.equal(h?.claimer, "alice@h1/s1");
});

test("holdingClaim: 只看对应 kind", () => {
  const now = new Date("2026-05-14T10:00:00Z");
  const h = holdingClaim(
    [claim("exec", "alice@h1/s1", "2026-05-14T09:00:00Z")],
    "grill",
    now,
  );
  assert.equal(h, undefined);
});
