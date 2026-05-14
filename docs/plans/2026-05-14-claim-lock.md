# 认领锁(Claim/Lock)实施计划 — 修订版

> **修订说明(2026-05-14)**:本计划取代同名的初版「7 任务脚本重型方案」(初版要建
> `scripts/lock.ts` 一个 `claim`/`release`/`status`/`sweep` 四子命令 CLI + 可注入 spawner)。
> 用户审阅后认为脚本太重 —— 认领 / 释放 / 查状态本就是几条 `gh` 命令,文档约束即可;
> 真正非代码做不到的只有「24h 到点自动撤锁」。**修订后:认领/释放/查状态走文档,
> 只保留一个最小定时脚本 `scripts/lock-sweep.ts` + 一个 workflow 做自动撤锁。**

**Goal:** 让 issue 可以被「grill 锁」和「执行锁」原子认领,24h 未交付自动撤锁 —— 几十个并发 CC 不撞车的地基。

**Architecture:** 锁 = 一个 GitHub label(`lock:grill` / `lock:exec`)+ 一条机器可解析的认领评论。认领 / 释放 / 查状态由 CC 照 `docs/CLAIM-LOCK.md` 跑几条 `gh` 命令完成,无专用 CLI。唯一的代码是 24h sweeper:纯逻辑 `scripts/lock-core.ts`(Functional Core,有单测)+ 最小 IO 外壳 `scripts/lock-sweep.ts` + 每小时 cron 的 `.github/workflows/lock-sweeper.yml`。

**Tech Stack:** TypeScript + `tsx`、`node:test`(node 22 内置)、`gh` CLI、GitHub Actions。

---

## 设计要点

**两个锁 = 两个 label**:`lock:grill`(第 2 步挖方案前上)、`lock:exec`(第 3 步执行前上)。同一 issue 同一时刻每把锁最多一个有效持有者。

**两种锚点评论(append-only,从不编辑/删除)**:
- 认领:`<!-- teamagent-lock:<kind> claimer="..." at="<ISO>" -->`
- 释放:`<!-- teamagent-unlock:<kind> claimer="..." -->`

**「当前持有者」判定**(`holdingClaim`):最早一条**仍有效**的认领 = 未过期(24h 内)+ 该 claimer 没贴过对应释放。三个推论:
- 「最早」→ let the first go,先到先得。
- 「未过期」→ 残留的旧认领锚点不会把新认领者顶掉。
- 「未释放」→ 持有者提前释放后,他还没过期的认领锚点也不会再被算作持有者。
后两条合起来堵死了「label 撤了但认领锚点还在 → 下一个认领者死锁」这个坑。

**抢锁竞态**(`docs/CLAIM-LOCK.md` 第 5 步,文档约束):贴评论 → 加 label → **重读** → 在有效认领里挑最早一条;是自己 → acquired,是别人 → 贴释放评论作废自己的认领,礼让退出(不撤 label,label 归赢家)。

**File Structure:**
- `scripts/lock-core.ts` —— 纯函数:格式化/解析认领+释放锚点、判过期、判持有者。无 IO。
- `scripts/lock-core.test.ts` —— `node:test` 单测,覆盖 lock-core 全部纯函数。
- `scripts/lock-sweep.ts` —— 最小 IO 外壳:扫挂锁 issue → `holdingClaim` 判定 → 撤过期锁的 label + 贴说明。
- `.github/workflows/lock-sweeper.yml` —— 每小时 cron 跑 `lock-sweep.ts`。
- `docs/CLAIM-LOCK.md` —— 认领 / 释放 / 查状态 / 撞车礼让的完整文档化流程。

---

## Task 1 — lock-core 纯逻辑 + 单测 ✅ 完成

`scripts/lock-core.ts` 导出:`LockKind`、`ClaimComment`、`UnlockMarker`、`lockLabel`、
`formatClaimComment` / `parseClaimComment`、`formatUnlockComment` / `parseUnlockMarker`、
`isLockExpired`、`holdingClaim`。`scripts/lock-core.test.ts` 19 个 `node:test` 用例,
含「残留锚点不死锁」「提前释放不死锁」两个关键回归。

验证:`npx tsx --test scripts/lock-core.test.ts` → 19/19 pass。

## Task 2 — lock-sweep.ts 最小 sweeper 外壳 ✅ 完成

`scripts/lock-sweep.ts`:对 `grill` / `exec` 两 kind,`gh issue list --label` 列挂锁 issue,
逐个 `gh issue view --json comments` 读评论,`holdingClaim` 返回 undefined(无有效持有者)
→ `gh issue edit --remove-label` + `gh issue comment` 贴纯文本说明(不含锚点,免得被当成新认领)。
`gh` 调用失败即退出码 1。

验证:`npx tsx scripts/lock-sweep.ts` → 本地 Matrix 仓库当前无锁,输出 `swept 0`,退出码 0。

## Task 3 — lock-sweeper.yml workflow ✅ 完成

`.github/workflows/lock-sweeper.yml`:`schedule` 每小时(`37 * * * *`,避开整点)+ `workflow_dispatch`,
`issues: write` 权限,checkout/pnpm/setup-node @v5(对齐 `inner-loop.yml`),`pnpm tsx scripts/lock-sweep.ts`。

## Task 4 — docs/CLAIM-LOCK.md + WORKFLOW.md 接线 ✅ 完成

`docs/CLAIM-LOCK.md` 新建:两把锁、claimer 身份、认领锚点权威格式、一次性 label setup、
认领 5 步(含「第 4 步重读、第 5 步判定」)、释放流程、查状态、24h 自动撤锁、撞车礼让。
`docs/WORKFLOW.md`:第 2/3 步的「参考」指向 `CLAIM-LOCK.md`,实现状态表「两把锁」一行翻 ✅。

## Task 5 — 上线 + 端到端验证 ⏳ 待办

- [ ] 在 Matrix 仓库执行一次性 setup:`gh label create lock:grill ...` / `lock:exec ...`。
- [ ] `workflow_dispatch` 手动触发 `lock-sweeper.yml` 跑一次,确认 CI 上能跑通。
- [ ] **两套验证(GIF + HTML 报告)**:按 `docs/WORKFLOW.md` 出验收物。
      ⚠️ **依赖子系统 #2(验证工具)** —— GIF 录制器与 HTML 报告生成器尚未搭建
      (见 `docs/WORKFLOW.md` 实现状态表)。本子系统的 GIF+HTML 验收报告在 #2 就绪后补。
      在此之前,验收靠:lock-core 单测 19/19、sweeper 本地冒烟、`holdingClaim` 的死锁回归用例。

---

## 验收标准(本子系统「跑起来」的定义)

1. ✅ `npx tsx --test scripts/lock-core.test.ts` 全绿(19/19)。
2. ✅ `scripts/lock-sweep.ts` 本地冒烟可跑、`gh` 失败有清晰报错。
3. ✅ `docs/CLAIM-LOCK.md` 覆盖认领/释放/查状态/撞车的完整可执行流程。
4. ⏳ `lock:grill` / `lock:exec` 两个 label 已在 Matrix 仓库创建。
5. ⏳ `lock-sweeper.yml` `workflow_dispatch` 手动触发能跑通。
6. ⏳ 两套验证(GIF + HTML)—— 阻塞于子系统 #2。

## 不在本计划范围内(后续子系统)

- grill / exec 锁与「挖方案」「执行」步骤的实际挂接 —— 属于工作流落地。
- 旧 FIXEDFLOW 的 `grilling` / `grill-working` 旧锁机制、`PRE-GRILL-CLAIM.md` /
  `PRE-IMPLEMENT-CLAIM.md` / `HOW-TO-CLAIM-ISSUE.md` 旧文档的拆除 —— 属于 #6「拆旧」,
  在新锁验证可用后进行。
