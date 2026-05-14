/**
 * lock-core.ts — 认领锁的纯逻辑(Functional Core)。
 *
 * 无 IO。格式化/解析认领评论与释放评论、判定 24h 过期、判定「当前持有者」。
 * 认领 / 释放 / 查状态走文档(docs/CLAIM-LOCK.md);本文件只服务于
 * 唯一必须是代码的环节 —— 24h 自动撤锁的 sweeper(scripts/lock-sweep.ts)。
 *
 * 锁的状态全部由 issue 评论里的两种锚点(append-only,从不编辑/删除)表达:
 *   - teamagent-lock:<kind>   认领锚点(带 claimer + ISO 时间戳)
 *   - teamagent-unlock:<kind> 释放锚点(带 claimer)—— 让认领作废,无需改旧评论
 */

export type LockKind = "grill" | "exec";

export interface ClaimComment {
  kind: LockKind;
  claimer: string;
  /** ISO 8601 时间戳 */
  at: string;
}

export interface UnlockMarker {
  kind: LockKind;
  claimer: string;
}

const ANCHOR_RE =
  /<!--\s*teamagent-lock:(grill|exec)\s+claimer="([^"]*)"\s+at="([^"]*)"\s*-->/;

const UNLOCK_RE =
  /<!--\s*teamagent-unlock:(grill|exec)\s+claimer="([^"]*)"\s*-->/;

const LABEL_OF: Record<LockKind, string> = {
  grill: "lock:grill",
  exec: "lock:exec",
};

const TTL_HOURS = 24;

const kindZh = (kind: LockKind): string =>
  kind === "grill" ? "grill 锁" : "执行锁";

/** 锁对应的 GitHub label 名。 */
export function lockLabel(kind: LockKind): string {
  return LABEL_OF[kind];
}

/**
 * 格式化一条认领评论:HTML 注释锚点(机器可解析)+ 人类可读行。
 * 这是认领评论的**唯一权威格式** —— docs/CLAIM-LOCK.md 让 CC 照着贴的
 * 模板就是这里的产物,round-trip 测试钉死它与 parseClaimComment 对得上。
 */
export function formatClaimComment(
  kind: LockKind,
  claimer: string,
  at: string,
): string {
  return (
    `<!-- teamagent-lock:${kind} claimer="${claimer}" at="${at}" -->\n` +
    `🔒 **${kindZh(kind)}** · 由 \`${claimer}\` 认领于 \`${at}\``
  );
}

/**
 * 格式化一条释放评论:解除某 claimer 对某 kind 锁的认领。
 * append-only —— 释放不去编辑/删除旧的认领评论,只追加这条让它作废。
 */
export function formatUnlockComment(kind: LockKind, claimer: string): string {
  return (
    `<!-- teamagent-unlock:${kind} claimer="${claimer}" -->\n` +
    `🔓 **${kindZh(kind)}** · 由 \`${claimer}\` 释放`
  );
}

/** 从评论正文解析认领锚点;非认领评论返回 null。 */
export function parseClaimComment(body: string): ClaimComment | null {
  const m = ANCHOR_RE.exec(body);
  if (!m) return null;
  return { kind: m[1] as LockKind, claimer: m[2]!, at: m[3]! };
}

/** 从评论正文解析释放锚点;非释放评论返回 null。 */
export function parseUnlockMarker(body: string): UnlockMarker | null {
  const m = UNLOCK_RE.exec(body);
  if (!m) return null;
  return { kind: m[1] as LockKind, claimer: m[2]! };
}

/**
 * 锁是否已超过 24h。at 为空、或不是合法时间戳,一律视为已过期
 * —— 无法证明「还活着」的锁就是可清的。
 */
export function isLockExpired(at: string | undefined, now: Date): boolean {
  if (!at) return true;
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > TTL_HOURS * 3600 * 1000;
}

/**
 * 判定某 kind 锁「当前的持有者」:最早一条**仍然有效**的认领评论。
 * 有效 = 未过期(24h 内)+ 该 claimer 没贴过对应 kind 的释放评论。
 *
 * - 「最早」—— let the first go,先到先得。
 * - 「未过期」—— 24h 前的认领是僵尸;sweeper 撤掉 label 后残留的旧锚点
 *   也不会把下一个认领者顶掉。
 * - 「未释放」—— 持有者提前释放(撤 label + 贴释放评论)后,他那条还没过期
 *   的认领锚点不会再被算作持有者(否则会死锁)。
 *
 * 返回 undefined = 没有有效持有者:label 若还在就是 stale,sweeper 应撤除。
 */
export function holdingClaim(
  comments: { body: string }[],
  kind: LockKind,
  now: Date,
): ClaimComment | undefined {
  const released = new Set(
    comments
      .map((c) => parseUnlockMarker(c.body))
      .filter((m): m is UnlockMarker => m !== null && m.kind === kind)
      .map((m) => m.claimer),
  );
  return comments
    .map((c) => parseClaimComment(c.body))
    .filter((c): c is ClaimComment => c !== null && c.kind === kind)
    .filter((c) => !isLockExpired(c.at, now))
    .filter((c) => !released.has(c.claimer))
    .sort((a, b) => a.at.localeCompare(b.at))[0];
}
