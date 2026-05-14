# 认领锁(Claim/Lock)实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 issue 可以被「grill 锁」和「执行锁」原子认领,24h 未交付自动撤锁 —— 几十个并发 CC 不撞车的地基。

**Architecture:** Functional Core / Imperative Shell。纯逻辑(解析认领评论、判定锁状态、判定过期)放 `scripts/lock-core.ts`,可独立测试;IO 外壳(调 `gh` CLI)放 `scripts/lock.ts`,spawner 可注入。锁 = 一个 GitHub label(`lock:grill` / `lock:exec`)+ 一条机器可解析的认领评论(带 ISO 时间戳)。24h sweeper 是一个每小时 cron 的 GitHub Action。

**Tech Stack:** TypeScript + `tsx`、`node:test`(node 22 内置)、`gh` CLI、GitHub Actions。

---

## 设计要点

**两个锁 = 两个 label**
- `lock:grill` —— 第 2 步「挖方案」前上;贴出方案后由认领者自己 `release`;或 24h 后 sweeper 自动撤。
- `lock:exec` —— 第 3 步「执行」前上;完成后 `release`;或 24h 后自动撤。
- 不变量:同一 issue 同一时刻最多一个 `lock:grill` + 一个 `lock:exec`。

**认领评论格式**(机器可解析,HTML 注释做锚点):
```
<!-- teamagent-lock:grill claimer="alice@host-1/sess-abc" at="2026-05-14T08:30:00Z" -->
🔒 **grill 锁** · 由 `alice@host-1/sess-abc` 认领于 `2026-05-14T08:30:00Z`
```
`claimer` = `${USER}@${HOSTNAME}/${SESSION}`;`at` 的 ISO 时间戳驱动 24h 过期判定。

**抢锁竞态处理**(沿用旧范式验证过的「let the first go」):
1. 读当前 labels + comments → 判定锁状态。
2. 若已锁且未过期 → 退出,输出 `deferred`。
3. 若未锁(或已过期)→ 先贴认领评论,再加 label。
4. 加完 label 后**重读一次**:若发现有多条同类认领评论(别的 CC 同时抢)→ 比时间戳,**不是最早的那个就撤回自己的评论+label,退出 `deferred`**;是最早的 → `acquired`。

**File Structure:**
- `scripts/lock-core.ts` —— 纯函数:解析/格式化认领评论、判定锁状态、判定过期、判定抢锁结果。无 IO。
- `scripts/lock.ts` —— CLI 外壳:`claim` / `release` / `status` / `sweep` 四个子命令;调 `gh`;spawner 可注入。
- `scripts/lock-core.test.ts` —— `node:test` 单测,覆盖 lock-core 全部纯函数。
- `scripts/setup-lock-labels.sh` —— 一次性:在仓库创建 `lock:grill` / `lock:exec` 两个 label。
- `.github/workflows/lock-sweeper.yml` —— 每小时 cron,跑 `tsx scripts/lock.ts sweep`。
- `package.json` —— 加 `test:lock` script。

---

## Task 1:lock-core 类型与认领评论解析/格式化

**Files:**
- Create: `scripts/lock-core.ts`
- Test: `scripts/lock-core.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// scripts/lock-core.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatClaimComment, parseClaimComment } from "./lock-core.ts";

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
```

- [ ] **Step 2: 跑测试,确认失败**

Run: `tsx --test scripts/lock-core.test.ts`
Expected: FAIL —— `lock-core.ts` 不存在 / 导出未定义。

- [ ] **Step 3: 写最小实现**

```ts
// scripts/lock-core.ts
export type LockKind = "grill" | "exec";

export interface ClaimComment {
  kind: LockKind;
  claimer: string;
  at: string; // ISO 8601
}

const ANCHOR_RE =
  /<!--\s*teamagent-lock:(grill|exec)\s+claimer="([^"]*)"\s+at="([^"]*)"\s*-->/;

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

export function parseClaimComment(body: string): ClaimComment | null {
  const m = ANCHOR_RE.exec(body);
  if (!m) return null;
  return { kind: m[1] as LockKind, claimer: m[2]!, at: m[3]! };
}
```

- [ ] **Step 4: 跑测试,确认通过**

Run: `tsx --test scripts/lock-core.test.ts`
Expected: PASS（3 个 test）。

- [ ] **Step 5: commit**

```bash
git add scripts/lock-core.ts scripts/lock-core.test.ts
git commit -m "feat(lock): claim-comment parse/format core"
```

---

## Task 2:lock-core 锁状态判定 + 过期判定

**Files:**
- Modify: `scripts/lock-core.ts`
- Test: `scripts/lock-core.test.ts`

- [ ] **Step 1: 追加失败测试**

```ts
import {
  determineLockState,
  isLockExpired,
  type IssueSnapshot,
} from "./lock-core.ts";

const snap = (labels: string[], comments: string[]): IssueSnapshot => ({
  labels,
  comments: comments.map((body) => ({ body })),
});

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

test("determineLockState: 有 label 但无认领评论 → locked 但 at 缺失(视为可被 sweeper 清)", () => {
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
```

- [ ] **Step 2: 跑测试,确认失败**

Run: `tsx --test scripts/lock-core.test.ts`
Expected: FAIL —— `determineLockState` / `isLockExpired` / `IssueSnapshot` 未定义。

- [ ] **Step 3: 写实现(追加到 lock-core.ts)**

```ts
export interface IssueSnapshot {
  labels: string[];
  comments: { body: string }[];
}

export interface LockState {
  locked: boolean;
  claimer?: string;
  at?: string;
}

const LABEL_OF: Record<LockKind, string> = {
  grill: "lock:grill",
  exec: "lock:exec",
};

export function determineLockState(
  issue: IssueSnapshot,
  kind: LockKind,
): LockState {
  if (!issue.labels.includes(LABEL_OF[kind])) return { locked: false };
  // 取最早的同 kind 认领评论(最早 = 真正的持有者)
  const claims = issue.comments
    .map((c) => parseClaimComment(c.body))
    .filter((c): c is ClaimComment => c !== null && c.kind === kind)
    .sort((a, b) => a.at.localeCompare(b.at));
  const first = claims[0];
  return { locked: true, claimer: first?.claimer, at: first?.at };
}

const TTL_HOURS = 24;

export function isLockExpired(at: string | undefined, now: Date): boolean {
  if (!at) return true;
  const ageMs = now.getTime() - new Date(at).getTime();
  return ageMs > TTL_HOURS * 3600 * 1000;
}

export function lockLabel(kind: LockKind): string {
  return LABEL_OF[kind];
}
```

- [ ] **Step 4: 跑测试,确认通过**

Run: `tsx --test scripts/lock-core.test.ts`
Expected: PASS（全部 test）。

- [ ] **Step 5: commit**

```bash
git add scripts/lock-core.ts scripts/lock-core.test.ts
git commit -m "feat(lock): lock-state + expiry core logic"
```

---

## Task 3:lock-core 抢锁竞态判定

**Files:**
- Modify: `scripts/lock-core.ts`
- Test: `scripts/lock-core.test.ts`

- [ ] **Step 1: 追加失败测试**

```ts
import { decideClaimOutcome } from "./lock-core.ts";

test("decideClaimOutcome: 贴评论后只有自己一条 → acquired", () => {
  const mine = formatClaimComment("grill", "alice@h1/s1", "2026-05-14T08:30:00Z");
  const out = decideClaimOutcome(snap(["lock:grill"], [mine]), "grill", "alice@h1/s1");
  assert.equal(out, "acquired");
});

test("decideClaimOutcome: 有更早的他人认领评论 → race-lost", () => {
  const earlier = formatClaimComment("grill", "bob@h2/s9", "2026-05-14T08:29:00Z");
  const mine = formatClaimComment("grill", "alice@h1/s1", "2026-05-14T08:30:00Z");
  const out = decideClaimOutcome(snap(["lock:grill"], [earlier, mine]), "grill", "alice@h1/s1");
  assert.equal(out, "race-lost");
});

test("decideClaimOutcome: 自己是最早的一条 → acquired", () => {
  const mine = formatClaimComment("grill", "alice@h1/s1", "2026-05-14T08:29:00Z");
  const later = formatClaimComment("grill", "bob@h2/s9", "2026-05-14T08:30:00Z");
  const out = decideClaimOutcome(snap(["lock:grill"], [mine, later]), "grill", "alice@h1/s1");
  assert.equal(out, "acquired");
});
```

- [ ] **Step 2: 跑测试,确认失败**

Run: `tsx --test scripts/lock-core.test.ts`
Expected: FAIL —— `decideClaimOutcome` 未定义。

- [ ] **Step 3: 写实现(追加到 lock-core.ts)**

```ts
export type ClaimOutcome = "acquired" | "race-lost";

export function decideClaimOutcome(
  issue: IssueSnapshot,
  kind: LockKind,
  me: string,
): ClaimOutcome {
  const claims = issue.comments
    .map((c) => parseClaimComment(c.body))
    .filter((c): c is ClaimComment => c !== null && c.kind === kind)
    .sort((a, b) => a.at.localeCompare(b.at));
  if (claims.length === 0) return "race-lost"; // 异常:label 在但评论没了
  return claims[0]!.claimer === me ? "acquired" : "race-lost";
}
```

- [ ] **Step 4: 跑测试,确认通过**

Run: `tsx --test scripts/lock-core.test.ts`
Expected: PASS（全部 test）。

- [ ] **Step 5: commit**

```bash
git add scripts/lock-core.ts scripts/lock-core.test.ts
git commit -m "feat(lock): claim-race resolution core logic"
```

---

## Task 4:lock.ts CLI 外壳(claim / release / status / sweep)

**Files:**
- Create: `scripts/lock.ts`
- Modify: `package.json`(加 `test:lock` script)

- [ ] **Step 1: 写 CLI 外壳**

`scripts/lock.ts` —— 用 `node:child_process` 的 `spawnSync` 调 `gh`,封装成可注入的 `gh()` 函数。子命令:
- `claim <grill|exec> <issue>` —— 读快照 → `determineLockState` → 未锁/已过期则贴认领评论(`gh issue comment`)+ 加 label(`gh issue edit --add-label`)→ 重读快照 → `decideClaimOutcome` → `race-lost` 则撤回自己评论+label,打印 `deferred`;`acquired` 打印 `acquired`。已锁且未过期 → 直接打印 `deferred`。
- `release <grill|exec> <issue>` —— `gh issue edit --remove-label`。
- `status <issue>` —— 打印两个锁的 `determineLockState` 结果(JSON)。
- `sweep` —— `gh issue list --label lock:grill` + `--label lock:exec`,逐个读快照,`isLockExpired` 为真则 `--remove-label` + 贴「⏰ 锁超过 24h 自动撤除」评论。

读快照:`gh issue view <n> --json labels,comments` → 映射成 `IssueSnapshot`。
退出码:`acquired`/成功 = 0;`deferred` = 0(不是错误,是正常「让别人先」);真正错误(gh 调用失败)= 1。
顶部写标准 header 注释(usage / 子命令 / 退出码),仿 `scripts/install-from-md.ts`。

- [ ] **Step 2: 加 package.json script**

在 `package.json` 的 `scripts` 加一行:
```json
"test:lock": "tsx --test scripts/lock-core.test.ts"
```

- [ ] **Step 3: 本地冒烟 —— 子命令能跑、参数错误有提示**

Run: `tsx scripts/lock.ts` （无参数）
Expected: 打印 usage,退出码非 0。
Run: `tsx scripts/lock.ts status 99999`（不存在的 issue）
Expected: gh 报错被捕获,打印清晰错误,退出码 1。

- [ ] **Step 4: 跑 lock-core 测试确认没被带坏**

Run: `pnpm test:lock`
Expected: PASS。

- [ ] **Step 5: commit**

```bash
git add scripts/lock.ts package.json
git commit -m "feat(lock): claim/release/status/sweep CLI"
```

---

## Task 5:label 初始化脚本

**Files:**
- Create: `scripts/setup-lock-labels.sh`

- [ ] **Step 1: 写脚本**

```bash
#!/usr/bin/env bash
# scripts/setup-lock-labels.sh — 一次性:在当前仓库创建认领锁用的两个 label。
# 幂等:label 已存在时 `gh label create` 会失败,用 `|| true` 跳过。
set -euo pipefail

gh label create "lock:grill" --color "FBCA04" --description "grill 锁:有人正在挖此 issue 的方案" || true
gh label create "lock:exec"  --color "D93F0B" --description "执行锁:有人正在执行此 issue 的方案" || true

echo "✅ lock:grill / lock:exec 已就绪"
```

- [ ] **Step 2: 跑一次,在 Matrix 仓库创建 label**

Run: `bash scripts/setup-lock-labels.sh`
Expected: 打印 `✅ lock:grill / lock:exec 已就绪`;`gh label list` 能看到这两个。

- [ ] **Step 3: commit**

```bash
git add scripts/setup-lock-labels.sh
git commit -m "feat(lock): label setup script"
```

---

## Task 6:24h sweeper GitHub Action

**Files:**
- Create: `.github/workflows/lock-sweeper.yml`

- [ ] **Step 1: 写 workflow**

仿 `.github/workflows/issue-conformance.yml` 的结构:
```yaml
name: Lock Sweeper

on:
  schedule:
    - cron: '23 * * * *'   # 每小时一次,避开整点
  workflow_dispatch:

permissions:
  issues: write
  contents: read

jobs:
  sweep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v5
      - uses: actions/setup-node@v5
        with:
          node-version: '22'
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Sweep expired locks
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: pnpm tsx scripts/lock.ts sweep
```

- [ ] **Step 2: 本地 dry 验证 sweep 逻辑**

Run: `tsx scripts/lock.ts sweep`（本地,Matrix 仓库当前无锁)
Expected: 打印「无过期锁」之类,退出码 0,不报错。

- [ ] **Step 3: commit**

```bash
git add .github/workflows/lock-sweeper.yml
git commit -m "feat(lock): hourly 24h lock sweeper workflow"
```

---

## Task 7:端到端验证(两套验证 + GIF + HTML 报告)

按 `docs/WORKFLOW.md` 的「两套验证」要求,给这个子系统出验收物。

**Files:**
- Create: `docs/plans/2026-05-14-claim-lock/verify.ts`（套件 1:复现验证代码)
- Create: `docs/plans/2026-05-14-claim-lock/report.html`（套件 2:验收报告)

- [ ] **Step 1: 写套件 1 —— 复现验证代码**

`verify.ts`:用注入的 fake gh spawner 跑一遍完整认领流程,断言:
- before(无 lock.ts)→ 认领能力不存在 → 复现「未实现」
- after(有 lock.ts)→ claim → status 显示 locked → release → status 显示 unlocked;并发两个 claimer → 只有最早的 acquired,另一个 race-lost → 复现「已实现」
- 录制过程 GIF(终端输出 → GIF;录制方案见「实现状态」待定项,Task 7 执行时定)

- [ ] **Step 2: 跑套件 1**

Run: `tsx docs/plans/2026-05-14-claim-lock/verify.ts`
Expected: 全部断言通过,产出 GIF。

- [ ] **Step 3: 写套件 2 —— HTML 验收报告**

`report.html`:中文、严谨、嵌入套件 1 的 GIF + 关键截图。让 CEO 一眼看出:认领锁能锁、能放、并发不撞车、24h 会自动撤。

- [ ] **Step 4: commit**

```bash
git add docs/plans/2026-05-14-claim-lock/
git commit -m "test(lock): end-to-end verification suite + acceptance report"
```

---

## 验收标准(本子系统「跑起来」的定义)

1. `pnpm test:lock` 全绿。
2. `lock:grill` / `lock:exec` 两个 label 已在 Matrix 仓库创建。
3. `tsx scripts/lock.ts claim/release/status/sweep` 四个子命令实测可用。
4. `lock-sweeper.yml` 已提交,`workflow_dispatch` 手动触发能跑通。
5. 套件 1 复现验证通过 + 套件 2 HTML 验收报告产出。

## 不在本计划范围内(后续子系统)

- grill / exec 锁与「挖方案」「执行」步骤的实际挂接 —— 属于 #2/#3 子系统。
- 旧 FIXEDFLOW 的 `grill-working` 等旧锁机制的拆除 —— 属于 #6「拆旧」,在新锁验证可用后进行。
