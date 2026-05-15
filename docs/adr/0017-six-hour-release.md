# ADR-0017: Release cadence — push + 6h schedule + manual dispatch

**Status:** Accepted (2026-05-15)
**Context:** WORKFLOW.md 第 8 步要求「主分支代码,每 6 小时自动打一个 release 版本」。原 `release-branch.yml` 仅在 push 到 main 时触发,缺定时打卡通道。

## 决议

`release-branch.yml` 触发器从单路 push 扩成三路:

1. `push: branches: [main]` —— 保留(auto-merge 落 commit 后立即发,延迟 ~1 分钟)
2. `schedule: - cron: '0 */6 * * *'` —— 每 UTC 0/6/12/18 点跑一次(覆盖「长时间无 PR 但仍想刷新 release-meta」的场景)
3. `workflow_dispatch` —— 人手补发出口(带 `reason` input)

加 early-exit 守门(`publish` job 第一步):把 `GITHUB_SHA` 与 gh-pages 上 `latest.json.sha` 比对,相等 → 跳过本 job 后续全部 step(避免 schedule 跑到一半发现没变更还把 latest.json / release branch 重写一遍 / 撞 `gh release create` 已存在)。

## 为什么是 6h(而非 1h / 24h)

- **1h**:对绝大多数变化无意义 —— 主分支大部分时间没有合并;cron 频率高 = CI 配额浪费、release page 噪音。
- **24h**:对急 fix 太慢 —— 「我刚 merge 了一个 hotfix,要等到明天才发?」不合理。
- **6h**:折中。auto-merge 路径正常工作时,push 触发已经覆盖了主路;schedule 兜底「workflow_run 罕见挂掉 / push 触发被吞 / 无 PR 但仍想刷 release-meta」三类边缘情况。一天 4 次发布,既够新鲜又不噪音。

## 早退守门为什么必要

- schedule 必然会跑到「main 自上次 release 之后无变更」的窗口。无守门则:
  - `gh release create` 因 tag 已存在 idempotent skip(已有逻辑)
  - 但后续仍 force-push release 分支 + 重写 latest.json + push gh-pages —— 这些是真改动,会让所有下游 consumer 把同一 SHA 重新拉一次。浪费。
- 守门把 `GITHUB_SHA` vs `latest.json.sha` 一比即知,~1 秒成本。

## 备选方案与理由

- (备选) **删除 push 触发,只留 schedule** —— 实现最小,但 hotfix 延迟最坏 6h。否决:与 auto-merge 的「中间无人工关卡」哲学冲突。
- (备选) **每个 6h 节拍都先 bump version** —— 强行制造变更。否决:会污染版本号语义。
- (备选) **package.json bump 由 release workflow 自己做** —— 跨 workflow_run 改源文件,鸡生蛋。否决。

## 关联

- WORKFLOW.md 第 8 步「每 6 小时自动打一个 release」
- `docs/plans/2026-05-15-six-hour-release.md` —— 实施 plan
- `.github/workflows/release-branch.yml` —— 改造目标
