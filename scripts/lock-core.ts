/**
 * lock-core.ts — 认领锁的纯逻辑(Functional Core)。
 *
 * 无 IO。解析/格式化认领评论、判定锁状态、判定 24h 过期、判定抢锁竞态结果。
 * IO 外壳(调 `gh` CLI)在 scripts/lock.ts。
 */

export type LockKind = "grill" | "exec";

export interface ClaimComment {
  kind: LockKind;
  claimer: string;
  /** ISO 8601 时间戳 */
  at: string;
}

export interface IssueSnapshot {
  labels: string[];
  comments: { body: string }[];
}

export interface LockState {
  locked: boolean;
  /** 最早一条认领评论的认领者(真正的持有者) */
  claimer?: string;
  /** 最早一条认领评论的 ISO 时间戳 */
  at?: string;
}

export type ClaimOutcome = "acquired" | "race-lost";

const ANCHOR_RE =
  /<!--\s*teamagent-lock:(grill|exec)\s+claimer="([^"]*)"\s+at="([^"]*)"\s*-->/;

const LABEL_OF: Record<LockKind, string> = {
  grill: "lock:grill",
  exec: "lock:exec",
};

const TTL_HOURS = 24;

/** 锁对应的 GitHub label 名。 */
export function lockLabel(kind: LockKind): string {
  return LABEL_OF[kind];
}

/** 格式化一条认领评论:HTML 注释锚点(机器可解析)+ 人类可读行。 */
export function formatClaimComment(
  kind: LockKind,
  claimer: string,
  at: string,
): string {
  const label = kind === "grill" ? "grill 锁" : "执行锁";
  return (
    `<!-- teamagent-lock:${kind} claimer="${claimer}" at="${at}" -->\n` +
    `🔒 **${label}** · 由 \`${claimer}\` 认领于 \`${at}\``
  );
}

/** 从评论正文解析认领锚点;非认领评论返回 null。 */
export function parseClaimComment(body: string): ClaimComment | null {
  const m = ANCHOR_RE.exec(body);
  if (!m) return null;
  return { kind: m[1] as LockKind, claimer: m[2]!, at: m[3]! };
}

/** 取某 kind 的所有认领评论,按时间戳升序(最早在前)。 */
function claimsOf(issue: IssueSnapshot, kind: LockKind): ClaimComment[] {
  return issue.comments
    .map((c) => parseClaimComment(c.body))
    .filter((c): c is ClaimComment => c !== null && c.kind === kind)
    .sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * 判定某 kind 的锁状态。label 存在即视为 locked;claimer/at 取最早一条认领评论
 * (label 在但评论缺失时 at 为 undefined,会被 sweeper 视为可清)。
 */
export function determineLockState(
  issue: IssueSnapshot,
  kind: LockKind,
): LockState {
  if (!issue.labels.includes(LABEL_OF[kind])) return { locked: false };
  const first = claimsOf(issue, kind)[0];
  return { locked: true, claimer: first?.claimer, at: first?.at };
}

/** 锁是否已超过 24h。at 为 undefined(无时间戳)视为已过期。 */
export function isLockExpired(at: string | undefined, now: Date): boolean {
  if (!at) return true;
  const ageMs = now.getTime() - new Date(at).getTime();
  return ageMs > TTL_HOURS * 3600 * 1000;
}

/**
 * 贴完认领评论 + 加完 label 后,重读快照判定抢锁结果。
 * 「let the first go」:最早一条认领评论是自己 → acquired,否则 race-lost。
 */
export function decideClaimOutcome(
  issue: IssueSnapshot,
  kind: LockKind,
  me: string,
): ClaimOutcome {
  const claims = claimsOf(issue, kind);
  if (claims.length === 0) return "race-lost"; // 异常:label 在但评论没了
  return claims[0]!.claimer === me ? "acquired" : "race-lost";
}
