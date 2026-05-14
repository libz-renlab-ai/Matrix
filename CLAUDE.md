# TeamAgent 开发约定

本文件给 Claude Code 读 —— 在此项目内工作时必须遵守以下约定。

## 项目是什么

TeamAgent 是给 Claude Code(及其他 AI coding agent)装的自进化规则引擎:从用户每次纠正里提炼可复用规则,在 PreToolUse hook 拦下 AI 重复犯错。pnpm monorepo,CLI 入口 `packages/cli/src/bin.ts`。

## 架构元约束

- **Functional Core, Imperative Shell**:`packages/core/` 下禁止 import `fs` / `node:fs` / `node:child_process` / 任何 IO 模块。核心逻辑是纯函数,副作用源(时间等)通过参数注入。
- **新增 Port 先写契约测试再写实现**:契约测试套件放 `packages/ports/src/__tests__/*-contract.ts`,通过 `@teamagent/ports/contracts` subpath 暴露;任何 Port 的新实现必须复用对应契约套件。
- **归因走 AttributionBus**:组件不得直接 `console.log` 用户可见信息。"系统帮你做了什么"通过 `bus.emit(event)` 发结构化事件,由 Renderer 渲染。
- **Walking Skeleton 不断裂**:milestone 结束的 commit 必须全绿、`pnpm teamagent skeleton-demo` 跑通。

## 开发节奏

- **TDD**:先写测试(红)→ 最小实现(绿)→ commit。
- **小 commit**:每个 commit 一件"概念上完整的小事",跑得通、测试绿。commit message 用 `feat(...)` / `fix(...)` / `refactor(...)` 格式。
- **PR 用普通 PR,不要 draft PR**。未准备好就本地修到验证通过再开。

## 用户沟通语言

本项目面向中文协作,agent 与用户沟通默认用中文。即使用户用英文问项目规则、工具、流程、状态、实现或 PR 相关事项,也用中文回答。只有用户明确要英文文案、代码、命令、JSON、日志或第三方接口字段时,才保留必要英文。

## 跑命令

```bash
pnpm install          # 首次 / 依赖变动后
pnpm test             # 跑所有测试
pnpm typecheck        # 所有包的 tsc --noEmit
pnpm teamagent <cmd>  # 跑 CLI(`pnpm teamagent --help` 列全部子命令)
pnpm frontend:dev     # 跑 landing 前端 dev server(见下)
```

## 测试在哪里跑

并行跑全量 `pnpm test` 会让 scheduler 队列饱和(决策与权衡见 `docs/adr/0013-inner-loop-on-ci.md`),所以:

| 跑什么 | 在哪 | 命令 |
|---|---|---|
| 全量 `pnpm test` / `pnpm verify` | CI on `wip/**` | `git push origin HEAD:wip/<name>` 触发 `inner-loop.yml` |
| 单文件 targeted | 本地(秒级允许) | `pnpm vitest run path/to/x.test.ts` |
| PR-gate 全套 | CI on PR / main | `ci.yml`(ubuntu + windows + typecheck) |

操作手册见 `docs/INNER-LOOP-TESTING.md`。

## Frontend = `landing/rocketteam`

active frontend 是 `landing/rocketteam/` —— RocketTeam(Next.js 14 + Tailwind + React 18),源自 upstream hrdAI3/RocketTeam,已 vendoring 进本仓库(TeamAgent 侧 patch 已合并、server-only 路由已剥离),直接编辑。详见 `landing/README.md`。

根脚本(在仓库根执行):

```bash
pnpm frontend:install   # 安装 RocketTeam 依赖
pnpm frontend:dev       # 本地 Next.js dev server
pnpm frontend:build     # next build
```

不内嵌进 pnpm workspace:RocketTeam 用 React 18 / 不同 vitest 版本,与本仓库现有版本冲突;根脚本 + 子目录内 npm install 是最少破坏面。

## 语义匹配

Matcher 是 BM25+dense RRF + soft-AND 打分,所有规则(含 practice 类)都参与运行时匹配。新版表现异常时回滚:env `TEAMAGENT_MATCHER=legacy`。

## 已知限制

- **Windows 下 vitest 并发 OOM**:`vitest.config.ts` 强制 `fileParallelism: false`,测试顺序跑,不要打开并发。
- 不要在本地并发跑全量测试(scheduler 饱和);本地用单文件 `pnpm vitest run` + `pnpm teamagent skeleton-demo` 视觉验证。

## 参考文档

- `docs/ARCHITECTURE.md` —— 架构概念
- `docs/PLAN-RESEARCH-REPORT.md` —— plan / research / report 三类文档的 single source of truth
- `docs/CONTEXT.md` —— 领域术语表
- `docs/CLAUDEFAST.md` —— `claudefast`(便宜/快速 profile 跑非交互测试的本地 wrapper)约定
- `docs/knowledge/INDEX.md` —— 项目知识索引(项目知识通过此文件和 `.claude/skills/` 传播,不再由本文件里的 managed block 承载)
