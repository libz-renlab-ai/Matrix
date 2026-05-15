# 开发工作流

本文档是本项目从 **issue → release** 的**唯一权威工作流**。它取代旧的
FIXEDFLOW / Symphony / 双 driver 那一整套(见文末「本文档取代了什么」)。

**设计原则:人类只碰两个点 —— 想方案、审 PR;其余全部由 CC / 自动化完成。**

```
1 提 issue
   │
2 挖方案 ──[grill 锁]── 用 grill-me 挖出完整方案 → 贴 issue 评论区
   │
3 执行方案 ──[执行锁]── 写代码 + 两套验证
   │
4 本地 review ── 另开独立 subagent review(2 条标准)
   │              不通过 → 打回执行 CC 重做 → 再 review,循环至通过
5 提 PR → 远程 review ── 远程 CC 自动评审(同 2 条标准)
   │
6 合并到个人开发分支  ┐
   │                  ├─ 远程 review 一过 → 一路自动合,无人工关卡
7 合并到主分支        ┘
   │
8 每 6 小时自动发一个 release
```

## 角色

| 角色 | 做什么 |
|---|---|
| **人类** | 只两件事:① 第 2 步用 `grill-me` 想 issue 的解决方案;② 审 PR —— 看 HTML+GIF 验收报告做最终拍板 |
| **CC / 自动化** | 其余全部:执行、本地 review、远程 review、合并、发版 |

## 详细流程

### 1 · 提 issue
团队任何人都可以提 issue —— 发现的问题、想要的功能。不卡格式。

### 2 · 挖方案(产出:方案,不是代码)
- **谁**:任何人的任何 CC,挑一个还没人认领的 issue。
- **先上锁**(grill 锁):动脑之前先锁住该 issue —— 声明「方案我来想」。
- **怎么挖**:用 `grill-me` skill —— CC 反复深入对话,把 issue 里每一处模糊、歧义、多解的地方逐一逼问、定夺,直到方案**完整、无悬而未决的分支**。
- **产出**:把完整方案贴到该 issue 的评论区。
- **锁释放**:方案贴入评论区即释放;或上锁满 **24h 仍未贴** → 锁自动撤,issue 重新开放。
- 参考:`docs/CLAIM-LOCK.md`(认领锁:上锁 / 释放 / 查状态 / 24h 自动撤的完整流程)。

### 3 · 执行方案(产出:代码 + 两套验证)
- **谁**:任何人的任何 CC —— **可以不是第 2 步想方案的人**(方案在评论区是公开的)。
- **先上锁**(执行锁):执行前锁住「执行权」。
- **在哪干**:独立 git worktree + feature 分支,**绝不直接碰主干**。
- **干什么**:实现 issue 的方案 + 写下方「两套验证」。
- **锁释放**:做完(代码 + 两套验证 + 本地 review 通过)即释放;或上锁满 **24h 仍未完成** → 锁自动撤。
- 参考:`docs/CLAIM-LOCK.md`(认领锁:上锁 / 释放 / 查状态 / 24h 自动撤的完整流程)。

### 两套验证(每次提交代码强制带齐)

**套件 1 · 复现验证代码** —— 给机器看的硬证明
- 是**代码**,不是文档,可自动跑。
- 能**完整复现这个 feature**。
- 内置 **before/after 对比**:同一套验证,在改动前的代码上跑 → 复现「feature 未实现」;在改动后的代码上跑 → 复现「feature 已实现」。
- 跑的过程**自带录制一段验收 GIF**。
- 参考:`docs/PLAN-RESEARCH-REPORT.md` 的 judge harness。

**套件 2 · 验收报告** —— 给人(CEO)看的报告
- 套件 1 实际跑过一遍后,系统录 GIF + 截图。
- GIF 嵌入一份 **HTML 报告**,中文。
- 硬要求:**非常严谨、不能浮于表面** —— 让 CEO **一眼**就能判断 feature 到底实现没实现。
- 参考:`docs/acceptance/SPEC.md`(验收报告规范)+ `docs/acceptance/2026-05-14-hook-moment-block/`(人工产出的参照样板)。

### 4 · 本地 review
执行的 CC 完成后,**另开一个独立 subagent 来 review**(不是执行 CC 自己自检 —— 避免自己给自己打分)。**过关标准 2 条**:
1. **before/after 对比成立** —— 退回改动前的代码跑套件 1 → 复现「未实现」;切到改动后 → 复现「已实现」。两边都对得上。
2. **全量测试全过 + 合并无冲突**。

**不通过就打回**:review subagent 判定不通过 → 退回执行 CC 重新完成 → 改完再开 subagent review → **循环直到通过**,才能进入第 5 步提 PR。
- 参考:`docs/POSTPR.md`、`docs/adr/0007-local-review-skill-as-review-gate.md`。

### 5 · 提 PR → 远程 review
- 本地 review 过 → 提一个 PR(普通 PR,非 draft)。
- PR 由**远程 CC 自动评审**(独立于本地的复核 —— 本地自检一遍 + 远程独立复核一遍 = 双保险)。
- 远程标准 = 本地**同款 2 条**。

### 6–7 · 合并(个人开发分支 → 主分支)
- 远程 review 一过 → 代码先合入提交者的**个人开发分支**,再合入**主分支**。
- 这两步之间**没有人工关卡** —— 远程 review 通过即一路自动合到主分支。
- 参考:`docs/COMMIT-FLOW.md`、`docs/BEFORE-MERGE.md`。

### 8 · 每 6 小时发 release
主分支代码,**每 6 小时自动打一个 release 版本**。

## 两把锁(并发协调的核心)

团队每人会同时跑 10+ 个 CC,锁是防止 N 个 CC 撞车的命根子。

| 锁 | 何时上 | 何时释放 |
|---|---|---|
| **grill 锁** | 第 2 步开挖方案前 | 方案贴入评论区;或满 24h 未贴自动撤 |
| **执行锁** | 第 3 步执行前 | 完成(代码 + 验证 + 本地 review 过);或满 24h 未完成自动撤 |

**规则**:同一个 issue,同一时刻只能有一个 grill 锁、一个执行锁。grill 锁与执行锁是两个独立阶段的锁。锁的具体实现机制见「实现状态」。

## review 标准(本地第 4 步、远程第 5 步,同款 2 条)

1. **before/after 差分**:改动前的代码 → 复现 feature 未实现;改动后的代码 → 复现 feature 已实现。
2. **全量测试全过,且合并无冲突。**

这两条本地、远程**完全一致** —— 本地由独立 subagent review(不通过则打回重做,循环至通过),远程由另一个 CC 独立复核。

## 分支模型

- 干活:独立 worktree + feature 分支,基于主干,**不堆叠**(no stacked PR)。
- 流向:feature 分支 → 个人开发分支 → 主分支。
- 全量测试只在 CI 跑,本地只跑单文件(见 `docs/INNER-LOOP-TESTING.md`、`docs/adr/0013-inner-loop-on-ci.md`)。

## 实现状态(诚实标注:哪些已就绪,哪些待搭)

| 环节 | 状态 |
|---|---|
| `grill-me` 挖方案 | ✅ skill 已有 |
| 两套验证的「概念」 | ✅ judge harness / visual-proof 文档已有,可复用 |
| 套件 1 复现框架 | ✅ 已搭 —— `scripts/verify/repro-core.ts`(纯)+ `repro-runner.ts`(IO 壳) + `worktree-shell.ts`(基线 worktree)+ `repro-cli.ts`(orchestrator);ReproSpec 见 `docs/acceptance/2026-05-14-hook-moment-block/repro/`;Plan `docs/plans/2026-05-14-verification-tooling.md` |
| 套件 1 自带录 GIF | ✅ 已搭 —— `scripts/verify/gif-core.ts`(纯,ffmpeg arg 构造)+ `record-gif.ts`(spawn pwsh + ffmpeg gdigrab 真实录屏)+ `win-record.ps1`(Win32 窗口定位与生命周期);已接入 `repro-cli.ts`,跑完套件 1 自动出 GIF |
| 套件 2 HTML 报告生成 | ✅ 已搭 —— `scripts/verify/report-core.ts`(纯)+ `report-template.ts`(INLINE_CSS + 5 字符 XSS 转义)+ `gen-report.ts`(CLI);9 段中文报告,内嵌 GIF;ReportManifest schema 见 `docs/acceptance/2026-05-14-hook-moment-block/manifest.json` |
| 本地 review(独立 subagent + 打回循环) | ✅ 已搭 —— `scripts/review/review-core.ts`(纯,2 条标准 → CriterionResult → ReviewVerdict)+ `run-checks.ts`(IO 壳,repro-cli + 全量测试 + merge-tree 三检)+ `review-cli.ts` + `loop-driver.ts`(manual/agent 双模式);`.claude/skills/local-review/SKILL.md` 钉死契约 |
| 远程 CC 自动评审 | ✅ 已搭 —— `.github/workflows/pr-review.yml` 4-job(list-specs / repro matrix / tests / verdict),`if: always()` 守 verdict job;`scripts/review/post-pr-comment.ts` 用 `COMMENT_MARKER` 复用同一条评论 + 写 `review/verdict` commit status |
| 两把锁 + 24h 自动撤锁 | ✅ 已搭 —— `lock:grill` / `lock:exec` 两个 label 当锁,认领/释放/查状态走文档(`docs/CLAIM-LOCK.md`),24h 自动撤锁由 `scripts/lock-sweep.ts` + `.github/workflows/lock-sweeper.yml` 每小时跑;纯逻辑 `scripts/lock-core.ts` 有单测 |
| 个人开发分支 → 主分支 自动合 | ✅ 已搭 —— `.github/workflows/auto-merge.yml` 走 `workflow_run` 链式触发(pr-review 跑完 → 自动启动)→ `scripts/automerge/can-auto-merge.ts`(纯门控,7+ 条:draft / base!=main / do-not-merge / visual-proof / verdict / fork / mergeable / state)→ 通过则 `gh pr merge --squash --delete-branch` |
| 每 6 小时 release | ✅ 已搭 —— `release-branch.yml` 三路触发(push main + cron `0 */6 * * *` + workflow_dispatch),publish job 第一步早退守门(`GITHUB_SHA` vs `latest.json.sha` 比对,相等 skip 后续 12 个 step);ADR `docs/adr/0017-six-hour-release.md` |

## 本文档取代了什么

本文档一旦生效,以下旧文档**作废,应删除**:

- `docs/FIXEDFLOW.md` —— 旧的主工作流,本文档是其精简强化版
- `docs/SYMPHONY-FLOW.md` —— 自动 driver 方案,不再采用
- `docs/TWO-DRIVER-COEXISTENCE.md` —— 双 driver 共存,不再有双 driver
- `docs/3-METHODS-WORKFLOW.md` —— 三方法路由,不再需要

## 相关文档(本工作流复用的子文档)

- 锁 / 认领:`CLAIM-LOCK.md`
- 验证套件 1:`PLAN-RESEARCH-REPORT.md`
- 验证套件 2:`acceptance/SPEC.md`(验收报告规范)、`acceptance/2026-05-14-hook-moment-block/`(参照样板)。旧的 `VISUAL-PROOF-*` 已被 `acceptance/SPEC.md` 取代,待拆
- review:`POSTPR.md`、`adr/0007-local-review-skill-as-review-gate.md`
- 测试 / 合并:`INNER-LOOP-TESTING.md`、`adr/0013-inner-loop-on-ci.md`、`BEFORE-MERGE.md`、`COMMIT-FLOW.md`
- issue 生命周期:`ISSUE-LIFECYCLE.md`
