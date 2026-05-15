# 怎么写一份 ReproSpec

ReproSpec 是套件 1(复现验证代码框架)的输入。一份 spec ≈「这个 feature 是否实现」的可执行定义。
设计决议见 [`docs/plans/2026-05-15-suite-1-brainstorm.md`](../../docs/plans/2026-05-15-suite-1-brainstorm.md),
实现见 [`scripts/verify/repro-*.ts`](../../scripts/verify/)。

## 最小骨架

```ts
import type { ReproSpec } from "../../scripts/verify/repro-types.ts";

const spec: ReproSpec = {
  id: "kebab-case-id",                // 建议与 docs/acceptance/<date>-<id>/ 一致
  description: "一句话说明这个 feature",
  baseline: { /* 怎么切到 before 态 */ },
  current:  { /* 一般留空,默认 = 当前 worktree */ },
  steps: [{
    name: "step-name",
    command: process.execPath,
    args: ["..."],
  }],
  expect: {
    before: { /* before 应满足的 ResultMatcher */ },
    after:  { /* after 应满足的 ResultMatcher */ },
  },
};
export default spec;
```

## 三种典型 feature 的写法

### 1. 数据驱动差异(同代码、不同状态)
`baseline.ref = "HEAD"` + `baseline.env` / `current.env` 切运行时状态。样板:
[`hook-moment-block.ts`](./hook-moment-block.ts)。

### 2. 代码驱动差异(改了代码)
`baseline.ref` 留空 → CLI 自动算 `git merge-base HEAD main`。两侧分别在两个 worktree 跑同命令,期望产出不同。

### 3. 既改代码又依赖运行时状态
两侧都用 `env` 字段,`baseline.ref` 保持「PR 起点」即可。

## 怎么写好 `expect`

- **`stdoutContains` 写「后果」、不要写「过程」**。比如「拦截 moment」就写 `["deny", "应改用", "dayjs"]`(后果),
  不要写「调用 matcher」(过程)。
- **同时给 `stdoutNotContains`**。两侧应**互斥**才算严谨对比;否则 verdict 会是 `ambiguous`。
- **exitCode 谨慎用**。很多 CLI 即使逻辑失败也返回 0(把信息写在 stdout)。除非命令明确以 exitCode 区分两态,否则别钉 exitCode。

## 怎么 run

```bash
# 跑 spec(默认录 GIF;CI 上加 --no-gif)
npx tsx scripts/verify/repro-cli.ts fixtures/repro-specs/<your>.ts \
  --out docs/acceptance/<date>-<id>

# 看 verdict
cat docs/acceptance/<date>-<id>/repro-result.json | jq .verdict
```

## 已知前置(spec 跑之前)

- 若 spec 里的 step 跑的是 `packages/teamagent/dist/bin.js`(常见情况),
  需先 `pnpm --filter teamagent build`。
- 若 spec 用 env 切 `USERPROFILE` 指向预备好的 stage 目录,
  目录得提前备好 —— 比如 `hook-moment-block` 的 stage 见
  [`docs/acceptance/2026-05-14-hook-moment-block/recording/README.md`](../../docs/acceptance/2026-05-14-hook-moment-block/recording/README.md)。
