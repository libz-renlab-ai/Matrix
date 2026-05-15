---
name: local-review
description: 本地 review 自动循环 —— 跑 WORKFLOW.md 的 2 条标准,不通过自动派打回 subagent 修,循环至通过或达上限
---

# local-review skill

## 何时调用

执行 CC 完成一个 feature 后,调本 skill 触发本地 review 循环;
也支持人手动 `/local-review` 触发。

## 怎么跑

```bash
# 直接调 driver(skill 实际就是包了一层文档 + 派 subagent 的 prompt 模板)
npx tsx scripts/review/loop-driver.ts \
  --repro docs/acceptance/<date>-<id>/repro-result.json \
  --max-retries 3
```

## 2 条标准(WORKFLOW.md 第 4 步钉死)

1. **before/after 对比成立** —— 套件 1 跑出 `verdict: "pass"`(不是 `fail` 也不是 `ambiguous`)
2. **全量测试全过 + 合并无冲突** —— `pnpm test` 退出 0,工作树无未提交改动,与 `origin/main` 无冲突

## 行为

- 跑 review-cli → verdict=pass → 落 `review-verdict.json`、exit 0、完事
- 跑 review-cli → verdict=fail → 派一个 fresh subagent(用 Claude Code 的 `Agent` 工具),
  把 `fixDirective.prompt` 喂给它;subagent 修完落 `$TEMP/fix-marker` 标记;
  driver 检测到标记重跑 review-cli;循环。
- 重试次数达 `--max-retries`(默认 3) → 停止、exit 非 0;
  累计 fix 历史写到 `review-verdict.json` 的 `attempts[]` 字段。

## 当前默认是 `--fix-mode manual`(重要)

「verdict=fail 自动派 subagent 去修」依赖一个**还没实现**的宿主 hook:
driver 写 `$TEMP/fix-prompt` + `$TEMP/fix-pending`,hook 监听到后用 Agent tool 派 subagent。
在 hook 落地之前,driver 默认走 `--fix-mode manual` —— 第一次 fail 就把 fix prompt 打印 + 退出非 0,
由人手动派 CC 去修。

`--fix-mode agent` 会正常运行,但若 hook 缺席,会卡在等 fix-marker 直到超时(30 分钟)。
跨子系统 follow-up 见 `docs/plans/2026-05-15-INDEX.md` 末段「跨子系统 follow-up」。

## 派打回 subagent 的 prompt 模板

见 `fix-directive-prompt.md`。

## 默认测试命令

worktree 里没装独立 `.bin/`,且 vitest config 不抓 `scripts/`,
所以 driver 默认 `--test-cmd "C:/bzli/Matrix/node_modules/.bin/tsx.cmd --test scripts/lock-core.test.ts"`。
项目级真实 review 请显式传:

```bash
--test-cmd "pnpm test"          # 全量(在主仓库 root 跑)
--test-cmd "C:/bzli/Matrix/node_modules/.bin/vitest.cmd run packages/core"  # 包级
```
