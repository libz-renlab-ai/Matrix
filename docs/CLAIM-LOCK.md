# CLAIM-LOCK — 认领锁:grill 锁 / 执行锁怎么上、怎么放、怎么查

适用范围:`docs/WORKFLOW.md` 第 2 步「挖方案」、第 3 步「执行方案」之前的**跨主机互斥握手**。团队每人同时跑 10+ 个 CC,锁是防止 N 个 CC 撞同一个 issue 的命根子。

**一句话:动手之前先上锁,做完之后放锁;忘了放,24h 后系统自动撤。**

## 两把锁 = 两个 GitHub label

| 锁 | label | 何时上 | 何时放 |
|---|---|---|---|
| grill 锁 | `lock:grill` | 第 2 步开挖方案前 | 方案贴入评论区后立即放;或 24h 自动撤 |
| 执行锁 | `lock:exec` | 第 3 步执行前 | 代码 + 两套验证 + 本地 review 过后放;或 24h 自动撤 |

不变量:同一 issue 同一时刻,`lock:grill` 最多一个有效持有者,`lock:exec` 最多一个有效持有者。两把锁互相独立。

**label 是真锁**(GitHub label 编辑是原子的,任何 CC 一眼能查);**认领评论是 audit trail**(append-only,记录谁、何时、用哪个 session 上的锁)。两者必须同时落,缺一不可。

## 为什么是 label + 文档,而不是一套脚本

认领 / 释放 / 查状态都只是几条 `gh` 命令,照本文档做即可 —— 不需要专门的 CLI 脚本。唯一文档做不到的是「24h 到点自动撤锁」(文档不会自己定时跑),那一件事由 `.github/workflows/lock-sweeper.yml` + `scripts/lock-sweep.ts` 承担。判定逻辑的纯函数集中在 `scripts/lock-core.ts`,有单测钉着。

## 你的身份(claimer)

每个 CC 用一个**唯一身份**认领,格式:

```
${USER}@$(hostname)/<session>
```

`<session>` 用 `CLAUDE_SESSION_ID`,或任何能唯一标识这个 CC 实例的串(如 worktree 名)。例:`alice@macbook-pro/0a1b2c3d`。

身份的三个用途:① audit —— 看得出是谁;② 抢锁竞态 —— 比时间戳定输赢;③ 释放 —— 释放评论按 claimer 作废对应认领。**同一次认领的 claim 与 release 必须用同一个 claimer 串。**

## 认领评论的权威格式

认领评论 = 一段 HTML 注释锚点(机器解析)+ 一行人类可读说明:

```
<!-- teamagent-lock:grill claimer="alice@macbook-pro/0a1b2c3d" at="2026-05-14T08:30:00Z" -->
🔒 **grill 锁** · 由 `alice@macbook-pro/0a1b2c3d` 认领于 `2026-05-14T08:30:00Z`
```

- **只有第一行(HTML 注释锚点)被机器解析**,第二行纯给人看,写什么中文都行。
- `at` 是 UTC ISO 8601(`date -u +%Y-%m-%dT%H:%M:%SZ`),驱动 24h 过期判定。
- 这个锚点格式由 `scripts/lock-core.ts` 的 `formatClaimComment` 定义,round-trip 单测钉死,**不要手改锚点格式**。

## 一次性 setup:创建两个 label

仓库只需做一次(已存在就跳过):

```bash
gh label create lock:grill --color FBCA04 --description "grill 锁:有人正在挖此 issue 的方案"
gh label create lock:exec  --color D93F0B --description "执行锁:有人正在执行此 issue 的方案"
```

## 认领流程(claim)

设 issue 编号 `$N`、锁类型 `$KIND`(`grill` 或 `exec`)。**严格按顺序,不跳步。**

```bash
# ── 准备 ──
N=123
KIND=grill                                      # 或 exec
LABEL="lock:$KIND"
AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ME="${USER}@$(hostname)/${CLAUDE_SESSION_ID:-$$}"
```

### 第 1 步 · 看 label —— 锁在不在

```bash
gh issue view "$N" --json labels --jq '.labels[].name'
```

- 输出里**有** `lock:$KIND` → 已经被锁,**礼让退出**(见下「撞车了怎么办」)。不要继续。
- 输出里**没有** → 锁是空的,继续第 2 步。

(label 在、但持有者其实已过期的 stale 情况,交给 sweeper 在 1 小时内清掉;不要自己抢 stale 锁。)

### 第 2 步 · 先贴认领评论

评论先落 —— 它是 audit trail,即使下一步失败也留痕。按上面「权威格式」拼出正文:

```bash
gh issue comment "$N" --body "<!-- teamagent-lock:$KIND claimer=\"$ME\" at=\"$AT\" -->
🔒 已认领 · 由 \`$ME\` 于 \`$AT\`"
```

### 第 3 步 · 加 label

label 才是真锁,落 label = 公开宣告「我接管了」:

```bash
gh issue edit "$N" --add-label "$LABEL"
```

### 第 4 步 · 重读评论 —— 这一步绝对不能跳

```bash
gh issue view "$N" --json comments --jq '.comments[].body'
```

第 2、3 步之间可能有别的 CC 同时在抢同一把锁。`--add-label` 是**幂等**的(两个 CC 都「成功」加上同一个 label),所以加上 label **不代表你抢到了**。必须重读、按第 5 步判定。

### 第 5 步 · 判定抢锁结果

在第 4 步读到的评论里,挑出 `teamagent-lock:$KIND` 锚点(注意是 `-lock:` 不是 `-unlock:`),按三个条件过滤出**有效认领**:

1. kind 是 `$KIND`;
2. `at` 在 **24h 以内**(没过期);
3. 这个 claimer **没有**贴过对应的 `teamagent-unlock:$KIND` 释放评论。

剩下的有效认领里,**`at` 最早的那一条就是持有者**:

- 最早的是**你自己** → ✅ **acquired**,锁拿到了,开干。
- 最早的是**别人** → ❌ **race-lost**,你抢输了(let the first go)。立刻走「释放流程」把你第 2 步那条认领作废:**贴一条 `teamagent-unlock:$KIND` 释放评论**(claimer 写你自己 `$ME`)。**不要撤 label** —— label 此刻归那个最早的人,他还要用。然后礼让退出。

## 释放流程(release)

做完你那一阶段的活(grill:方案已贴评论区 / exec:代码 + 两套验证 + 本地 review 过),**或者**抢锁抢输了 —— 都要释放。

```bash
# 1. 撤 label(锁开了)
gh issue edit "$N" --remove-label "$LABEL"
# 2. 贴释放评论(让你那条认领作废 —— append-only,不去删/改旧评论)
gh issue comment "$N" --body "<!-- teamagent-unlock:$KIND claimer=\"$ME\" -->
🔓 已释放 · 由 \`$ME\`"
```

两件事一起做。**只撤 label 不贴释放评论会死锁**:你那条认领锚点还没过 24h,会被下一个认领者的第 5 步误判成「还有人持有」。释放评论按 claimer 把你的认领作废,解决这个问题。

> **race-lost 特例**:你没拿到 label 的所有权(label 是更早的人加的同一个),所以**只贴释放评论(第 2 步),不撤 label(跳过第 1 步)**。

释放后,这个 claimer 串对应的认领就永久作废。若要重新认领同一把锁,换一个 CC session(`CLAUDE_SESSION_ID` 不同 → claimer 不同),从「认领流程」第 1 步重走。

## 查状态(status)

```bash
gh issue view "$N" --json labels   --jq '.labels[].name'      # label 在不在
gh issue view "$N" --json comments --jq '.comments[].body'    # 认领 / 释放评论
```

按「认领流程第 5 步」的同一套过滤判定,就能算出每把锁当前的持有者(或无人持有)。

## 24h 自动撤锁(你不用管)

`.github/workflows/lock-sweeper.yml` 每小时跑一次 `scripts/lock-sweep.ts`:扫描所有挂 `lock:grill` / `lock:exec` 的 open issue,凡是**没有有效持有者**的(认领评论超过 24h、或被释放、或 label 在但认领评论缺失)→ 撤掉 label + 贴一条「超过 24h 自动撤除」说明。

CC 这边**什么都不用做** —— 上了锁忘了放、或者人没了,系统会在 1 小时内自己收掉,issue 重新开放认领。

## 撞车了怎么办(第二个 CC 礼让)

第 1 步看到 `lock:$KIND` 已经在,或第 5 步判定 race-lost:

- **立即礼让退出** —— 不开 worktree、不动代码、不开 grill 对话。
- 可选:回评一条 `🚦 deferred:lock:$KIND 已被认领,礼让。` 让人看到撞车痕迹(纯提示,不阻塞)。
- **不要**强行撤别人的 label。真持有者 24h 没动静,sweeper 会自动收;等它收完锁再来。

## 相关文档

- `docs/WORKFLOW.md` —— 唯一权威工作流;本文档是它第 2、3 步「先上锁」的展开。
- `scripts/lock-core.ts` —— 认领/释放评论格式与持有者判定的纯逻辑(`formatClaimComment` 是认领锚点格式的唯一权威)。
- `scripts/lock-sweep.ts` / `.github/workflows/lock-sweeper.yml` —— 24h 自动撤锁。
