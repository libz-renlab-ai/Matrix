# 6 小时定时 Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `docs/WORKFLOW.md` 第 8 步「主分支代码,**每 6 小时自动打一个 release 版本**」落地。现状是 `release-branch.yml` 仅 `push: branches: [main]` 触发(`auto-merge` 推完才发);新增 `schedule: cron '0 */6 * * *'`,并加「该 SHA 已发过则 skip」的早退守门,避免无变更时重复 republish。

**Architecture:** 最小改动 —— 不重写 `release-branch.yml`,只在它头上加 `schedule` 触发 + 一个 early-exit step。Early-exit 把 `GITHUB_SHA` 与 `latest.json.sha` 对比(latest.json 是 release-branch.yml 自己产物,在 gh-pages),相等即 skip 整个 job。`workflow_dispatch` 也加上,作为人工触发出口。

**Tech Stack:** GitHub Actions(`schedule` cron + `workflow_dispatch`)+ `curl` 拉 latest.json。无新代码。

---

## File Structure

```
.github/workflows/
  release-branch.yml        ← 修改:加 schedule 触发 + early-exit step
docs/adr/
  0017-six-hour-release.md  ← ADR 记录决策(替换 push 为「push + schedule + dispatch」三触发器)
```

---

## Task 1: ADR —— 记录决策

**Files:**
- Create: `docs/adr/0017-six-hour-release.md`

> 写 ADR 是因为这变更直接影响所有 release consumer 的更新节奏(从「随 PR 合并立即发」变成「最多 6h 后发」)。半年后维护者会问「为什么是 6h?」,要有可追溯答案。

- [ ] **Step 1: 写 ADR**

```markdown
# ADR-0017: Release cadence — push + 6h schedule + manual dispatch

**Status:** Accepted (2026-05-15)
**Context:** WORKFLOW.md 第 8 步要求「每 6 小时自动打一个 release」。原 `release-branch.yml` 仅在 push 到 main 时触发。

## 决议

`release-branch.yml` 触发器改为三路:

1. `push: branches: [main]` —— 保留(auto-merge 落 commit 后立即发,延迟 ~1 分钟)
2. `schedule: - cron: '0 */6 * * *'` —— 每 UTC 0/6/12/18 点跑一次(覆盖「长时间无 PR 但仍想刷新 release-meta」的场景)
3. `workflow_dispatch` —— 人手补发出口

加 early-exit 守门:把 `GITHUB_SHA` 与 gh-pages 上 `latest.json.sha` 比对,相等 → skip 整个 job(避免 schedule 跑到一半发现没变更还把 latest.json 重写一遍 / 撞 `gh release create` 已存在)。

## 为什么是 6h(而非 1h / 24h)

- **1h**:对绝大多数变化无意义 —— 主分支大部分时间没有合并;cron 频率高 = CI 配额浪费、release page 噪音。
- **24h**:对急 fix 太慢 —— "我刚 merge 了一个 hotfix,要等到明天才发?" 不合理。
- **6h**:折中。auto-merge 路径正常工作时,push 触发已经覆盖了主路;schedule 兜底「workflow_run 罕见挂掉 / push 触发被吞 / 无 PR 但仍想刷 release-meta」三类边缘情况。一天 4 次发布,既够新鲜又不噪音。

## 早退守门为什么必要

- schedule 必然会跑到「main 自上次 release 之后无变更」的窗口。无守门则:
  - `gh release create` 因 tag 已存在 idempotent skip(已有逻辑)
  - 但后续仍 force-push release 分支 + 重写 latest.json + push gh-pages —— 这些是真改动,会让所有下游 consumer 把同一 SHA 重新拉一次。浪费。
- 守门把 `GITHUB_SHA` vs `latest.json.sha` 一比即知,~1 秒成本。

## 备选方案与理由

- (备选) **删除 push 触发,只留 schedule** —— 实现最小,但 hotfix 延迟最坏 6h。否决。
- (备选) **每个 6h 节拍都先 bump version** —— 强行制造变更。否决,会污染版本号语义。
- (备选) **package.json bump 由 release workflow 自己做** —— 跨 workflow_run 改源文件,鸡生蛋。否决。
```

- [ ] **Step 2: commit**

```bash
git add docs/adr/0017-six-hour-release.md
git commit -m "docs(adr): add 0017 — six-hour release cadence + early-exit guard"
```

---

## Task 2: 改 `release-branch.yml`

**Files:**
- Modify: `.github/workflows/release-branch.yml`(只加触发器与 early-exit,不动现有 publish 逻辑)

- [ ] **Step 1: 加触发器**

把文件顶部的 `on:` 段从:
```yaml
on:
  push:
    branches: [main]
```
改成:
```yaml
on:
  push:
    branches: [main]
  schedule:
    # 每 6 小时一次:UTC 00:00 / 06:00 / 12:00 / 18:00
    # 见 docs/adr/0017-six-hour-release.md
    - cron: '0 */6 * * *'
  workflow_dispatch:
    inputs:
      reason:
        description: 'Why are you manually triggering?'
        required: false
        default: 'manual'
```

- [ ] **Step 2: 在 `publish` job 第一个 step 加早退守门**

在 `jobs.publish.steps` 的开头(`uses: actions/checkout@v5` 之前)插入:

```yaml
      - name: Early exit if HEAD already released
        id: guard
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        shell: bash
        run: |
          # 比 GITHUB_SHA 与 gh-pages 上 latest.json.sha,相等 → skip
          # 拉 latest.json(release 目标 URL,见 release-branch.yml 末段「Publish latest.json to gh-pages」)
          PUBLISHED_URL="https://${{ github.repository_owner }}.github.io/$(echo '${{ github.repository }}' | cut -d/ -f2)/latest.json"
          # 如果 latest.json 还没存在(首次 release),不 skip
          if ! curl -fsSL "$PUBLISHED_URL" -o /tmp/latest.json 2>/dev/null; then
            echo "latest.json 不存在(首次 release?) → 继续发布"
            echo "skip=false" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          PUBLISHED_SHA=$(jq -r '.sha // empty' /tmp/latest.json)
          if [[ "$PUBLISHED_SHA" == "$GITHUB_SHA" ]]; then
            echo "GITHUB_SHA=$GITHUB_SHA 已发布过(latest.json.sha 一致) → skip"
            echo "skip=true" >> "$GITHUB_OUTPUT"
            # 不 fail,只 skip 后续 step;workflow 总体仍 success
          else
            echo "GITHUB_SHA=$GITHUB_SHA  vs  published=$PUBLISHED_SHA → 继续发布"
            echo "skip=false" >> "$GITHUB_OUTPUT"
          fi
```

然后给后续**每个** step 加 `if: steps.guard.outputs.skip != 'true'` 守门。`release-branch.yml` 现在的 `publish` job 共 **12 个 step**(读你当前的 yml 自己数一遍核对),逐个改成下方右栏:

| # | 原 step 起始行 | 改成 |
|---|---|---|
| 1 | `- uses: actions/checkout@v5` | `- if: steps.guard.outputs.skip != 'true'`<br>`  uses: actions/checkout@v5` |
| 2 | `- uses: pnpm/action-setup@v5` | `- if: steps.guard.outputs.skip != 'true'`<br>`  uses: pnpm/action-setup@v5` |
| 3 | `- uses: actions/setup-node@v5` | `- if: steps.guard.outputs.skip != 'true'`<br>`  uses: actions/setup-node@v5` |
| 4 | `- run: pnpm install --frozen-lockfile` | `- if: steps.guard.outputs.skip != 'true'`<br>`  run: pnpm install --frozen-lockfile` |
| 5 | `- run: pnpm --filter teamagent build` | `- if: steps.guard.outputs.skip != 'true'`<br>`  run: pnpm --filter teamagent build` |
| 6 | `- name: Detect version` | 保留 `name`/`id`/`run`,在 `name:` 上方插一行 `if: steps.guard.outputs.skip != 'true'`(位置见下方完整片段) |
| 7 | `- name: Pack tarball` | 同 #6 |
| 8 | `- name: Stage release artifacts` | 同 #6 |
| 9 | `- name: Create GitHub Release (idempotent)` | 同 #6 |
| 10 | `- name: Force-push release branch` | 同 #6 |
| 11 | `- name: Resolve PR creator for merge commit (post-merge auto-update feature)` | 同 #6 |
| 12 | `- name: Publish latest.json to gh-pages (issue #313 Tier 1)` | 同 #6 |

`name:` 形 step 的 `if:` 加法示例(以 #6 Detect version 为例,其它 #7–#12 同样模板,只换 `name`/`id`/`run` 内容):

```yaml
      - name: Detect version
        if: steps.guard.outputs.skip != 'true'
        id: version
        run: |
          # ... 原内容不动 ...
```

> **检查方式**:改完后跑 `grep -c "if: steps.guard.outputs.skip" .github/workflows/release-branch.yml` 应输出 **12**(对应 12 个 step 都加上)。少一个就是漏了。

- [ ] **Step 3: 端到端验证**

> **冒烟方式**:开个 throwaway PR 把改后的 `release-branch.yml` 推到 main(走完整 PR + auto-merge 流程),然后:
>
> 1. push 触发的 `release-branch` 应正常发(因为 SHA 是新的)
> 2. **立刻** workflow_dispatch 手动再触发一次:
>    ```bash
>    gh workflow run release-branch.yml --ref main -f reason=guard-test
>    gh run watch
>    ```
>    应看到 `Early exit if HEAD already released` step 输出 `skip=true`,后续 step 都 skip,workflow 总体 success。
> 3. 等 6h(或临时把 cron 改成 `*/5 * * * *` 做加速测,测完改回)看到 schedule 触发同样 skip。

- [ ] **Step 4: commit**

```bash
git add .github/workflows/release-branch.yml
git commit -m "feat(release): add 6h schedule + workflow_dispatch + early-exit guard (ADR-0017)"
```

---

## Self-Review

**1. Spec coverage:** WORKFLOW.md 第 8 步「每 6 小时」→ `cron '0 */6 * * *'` 直接对应。守门 step 把「无变更时跳过 republish」的隐性需求显式化(WORKFLOW.md 没说,但所有「定时发布」型 workflow 的常识)。**已知缺口**:无。

**2. Placeholder scan:** ADR 里的备选方案段是文档要求,不是 plan placeholder。所有 yaml 改动都是真命令、真表达式。

**3. Type consistency:** 不涉及代码 type;触发器命名(`push`/`schedule`/`workflow_dispatch`)与现有 workflow 风格一致。

## Execution Handoff

Plan complete。推荐执行路径:

1. **前置**:无强制前置;但若 `auto-merge.yml` 已上线(`2026-05-15-auto-merge.md`),本 plan 的 PR 自己就能走完整流程被合掉,顺便实测端到端。
2. **执行**:Task 1–2 串行,~30 分钟手动操作 + 一次 cron 等待。
3. **验收**:`gh workflow run release-branch.yml -f reason=verify`,看到 guard step 在第二次跑时 skip = end-to-end ok。
