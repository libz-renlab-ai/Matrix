# 套件 1（复现验证代码框架）Brainstorm 笔记

> **上下文**:`docs/plans/2026-05-14-verification-tooling.md` Phase 3 显式地把 4 个设计问题
> 列为「需先 brainstorm 后再出独立 plan」。本笔记给出决议 + 理由,作为
> `2026-05-15-suite-1-repro-framework.md` 的输入。看 plan 之前先看本笔记。
>
> **决议层级**:本文是 brainstorm,不是 ADR;落地后若证伪可在 plan 里覆盖。但
> 4 条决议直接决定模块边界与类型签名,**改决议=改 plan**。

---

## 一图速览

| # | 问题 | 决议 |
|---|---|---|
| Q1 | 与既有 `Scenario` 的关系 | 新类型 `ReproSpec` 当输入;matcher 类 feature 内嵌 `Scenario` 引用复用 |
| Q2 | before/after 怎么切代码态 | **两个 git worktree** 主路 + 环境变量叠加做次级状态切换 |
| Q3 | suite-1 怎么「自带录 GIF」 | 解耦:suite-1 出结构化 `ReproResult`;同 spec 的 `demoScene` 字段独立喂给 Phase 1 `recordGif()` |
| Q4 | judge 接到哪 | 两层:① suite-1 内置**确定性 matcher 判定**(无 LLM);② 独立 subagent review 走另一个子系统 |

---

## Q1: 与 `Scenario` 的关系

### 现状
`fixtures/scenarios/*.ts` 已有 6 个 `Scenario`,每个三段结构(`phaseA` 纠正 / `phaseB` 提炼规则 / `phaseC` 拦截)。这是 TeamAgent **核心 matcher 行为**的验证形态。

### 备选
- (a) **套件 1 输入 = Scenario**:所有要验证的 feature 都套进 phaseA/B/C 三段。
- (b) **套件 1 输入 = 新类型 `ReproSpec`**:与 Scenario 解耦。

### 决议:(b) + 内嵌 Scenario 字段
`ReproSpec` 是新的、更宽的输入。当 feature 恰好是 matcher 类时,内嵌 Scenario 引用复用现成定义。

### 理由
- 不是所有 feature 都 Scenario 形 ——「6 小时定时 release」跟 phaseA/B/C 毫无关系。强套会扭曲。
- Scenario 仍然是 matcher 类 feature 最佳建模工具,不该重复发明 → 用嵌套复用。
- hook-moment-block 这类已有 Scenario 的 feature,ReproSpec 写起来很轻:
  ```ts
  { id: "hook-moment-block", scenario: momentDayjsScenario, baseline: {...}, expect: {...} }
  ```

### 形态
```ts
interface ReproSpec {
  id: string;                                     // 比如 "hook-moment-block"
  description: string;
  baseline: BaselineRef;                          // 怎么切到 before 态
  current: CurrentRef;                            // 怎么切到 after 态(一般是当前 worktree)
  steps: ReproStep[];                             // 在每个态下要跑的命令
  expect: { before: ResultMatcher; after: ResultMatcher };  // 期望结果
  scenario?: Scenario;                            // optional:matcher 类 feature 引用现成 Scenario
  demoScene?: DemoScene;                          // optional:给 GIF 录制用的可视化重演脚本
}
```

---

## Q2: before/after 怎么切

### 现状
样板(hook-moment-block)用 **环境变量** 切:`USERPROFILE` 指向不同 HOME 路径,从而切换知识库 DB 状态。这只对「数据驱动差异」的 feature 有效;对「代码层面差异」(绝大多数 feature)没用。

### 备选
- (a) **`git stash` + 切换** —— 跑 before 时 stash 改动,跑 after 时 unstash。
- (b) **两个 worktree** —— 预先建 baseline 和 current 两个 worktree,各跑各的。
- (c) **环境变量切换** —— 只切运行时状态,代码不变。

### 决议:(b) 主路 + (c) 叠加

**主路:两个 git worktree**:
- `baseline` worktree 检出到 `BaselineRef.ref`(默认值 = `git merge-base HEAD main`,即当前 PR 起点之前的代码)
- `current` worktree = 跑 suite-1 的位置(即当前 worktree)
- suite-1 在两侧分别 `pnpm install`(若 lock 文件不同) + 跑 `steps`,捕获结构化结果
- 跑完销毁 baseline worktree:`git worktree remove --force <path>`

**叠加层:环境变量**。对于「同一份代码、不同运行时状态」的 feature(hook-moment-block 是典型),ReproSpec 在 baseline / current 各自 `env` 字段里塞环境变量做次级切换:
```ts
baseline: { ref: "HEAD~1", env: { USERPROFILE: "C:/tmp/empty-home" } }
current:  {                env: { USERPROFILE: "C:/tmp/loaded-home" } }
```

### 理由
- (a) `git stash` 与 vitest 跑测试代码本身互锁 —— stash 跑测试代码会移动测试文件,极易串台/死锁。 ❌
- (b) 两个 worktree:与项目已有 `.claude/worktrees/` 习惯一致;隔离干净;可并行(本期串行跑,留扩展余地)。 ✅
- (c) 单独 env 不够通用,但作为补充能优雅描述「数据状态」差异。 ✅

### 实现要点
- 走 `git worktree add <tmpDir>/repro-baseline-<rand> <ref>` —— 不污染主仓库;用完 `git worktree remove --force <path>` 清理。
- baseline 路径放在 `os.tmpdir()` 下,每次运行用 6 位随机后缀避免撞车。
- 执行 `pnpm install` 之前先尝试 junction `node_modules`(Windows: `fs.symlinkSync(target, path, "junction")`) 大幅省时;若两侧 `package.json`/`pnpm-lock.yaml` hash 不一致则放弃 junction、老实重装。
- baseline worktree 不能 reuse `current` 的 `node_modules` 目录(可能含 current 引入的新包);用 junction 不算 reuse 内容,只是省 IO,所以 hash 一致才安全。

---

## Q3: suite-1 怎么「自带录 GIF」

### 现状
WORKFLOW.md 套件 1 第 4 条硬要求写明:「跑的过程**自带录制一段验收 GIF**」。字面读起来像「suite-1 跑的同时启动录屏」,但实际两件事**应该解耦**:
- suite-1 跑在 CI / 后台,无 GUI、无可见窗口
- GIF 录的是真实终端窗口里发生的事(Phase 1 的 `gdigrab` 是 Win32 GUI 强依赖)

### 决议:解耦 + 共享 `ReproSpec.demoScene`
- **suite-1 的产出是结构化结果**(`ReproResult`):before/after 各跑一次的命令输出 + 退出码 + matcher 判定。
- **GIF 录制是一个并行的、可选的步骤**:用同一份 `ReproSpec.demoScene`,调 Phase 1 `recordGif()` 在可见终端里重演 before→after。
- 「自带」语义体现在 **suite-1 CLI 入口默认会触发录 GIF**(除非 `--no-gif` 或检测到无 Win32 环境)。这样「跑 suite-1 就有 GIF」对调用者是真的,实现上是「runner 之后立即调 recorder」。

```
suite-1 CLI 入口
  ├─ runRepro(spec)        → ReproResult       (结构化, CI/本地都跑)
  └─ 若 spec.demoScene 且 Win32 且 !--no-gif:
       recordGif(spec.demoScene) → demo.gif    (可选可视化)
```

### 理由
- 让 suite-1 强制在录屏环境里跑 → CI 上没桌面,跑不了。
- 让 recorder 「内嵌 suite-1 跑两遍」 → 录屏过程慢、易碎,suite-1 不该被它拖垮。
- 解耦后:suite-1 在 CI 里照样跑(出 verdict);GIF 在本地或专用录屏 runner 上跑(出可视化证据);各自独立、各自重试。

### `DemoScene` 形态
```ts
interface DemoScene {
  sceneScript: string;     // 在被录窗口里跑的 .ps1(脚本自行设置 windowTitle)
  windowTitle: string;
  durationSec: number;
}
```

样板 `hook-moment-block/recording/demo-scene.ps1` 已经是这个形态,迁移成本几乎为零。

---

## Q4: judge 接到哪

### 现状
- `docs/PLAN-RESEARCH-REPORT.md` 强调:第三方 judge harness、**禁止自评**。
- `packages/benchmark/evaluator.ts` 是**正则模式匹配**(`compiledWrongRegex` / `compiledCorrectRegex`),用于 benchmark **群组对比**(PRR 计算),不是通用「feature 是否实现」判官。
- `.claude/skills/visual-proof-pr/judge-harness.md` 是**视觉化产出存在性检查**(`finalized.html` 是否在、PR body 是否提到 visual proof),跟 feature implementation verdict 也无关。
- 所以**没有现成 judge harness 可直接复用**。

### 决议:两层 judge,互不重叠

**Layer A —— suite-1 内置确定性 matcher 判定(无 LLM)**
- ReproSpec 包含 `expect: { before: ResultMatcher; after: ResultMatcher }`
- `ResultMatcher` 是结构化断言:`{ exitCode?, stdoutContains?, stdoutNotContains?, stderrContains?, stderrNotContains? }`
- suite-1 跑完后自动比对实际输出与 matcher → `verdict: "pass" | "fail" | "ambiguous"`
- 这是 WORKFLOW.md 说的「给机器看的硬证明」。

**Layer B —— 独立 subagent review(不在套件 1 范围)**
- 跑完套件 1 + 套件 2 之后,由另一个独立 subagent 审「verdict 真不真、对比真严不严、有无浮于表面」。
- 这是「**本地 review 循环**」子系统的工作,详见 `2026-05-15-local-review-loop.md`。

### 为什么 Layer A 必须无 LLM
- WORKFLOW.md 套件 1 第 1 条硬要求:「**给机器看的硬证明,是代码不是文档,可自动跑**」。LLM 判定**不是「硬」**(同输入两次结果可能不同,无法 reproducible)。
- 「判断力」全在 ReproSpec 作者手里:作者怎么定义 matcher,就是怎么定义「feature 实现」。这把"什么算 feature 实现"的责任明确放在**写 ReproSpec 的人**身上 —— 这是健康的。
- LLM 该用在 Layer B(评审报告整体是否严谨),而非 Layer A(feature 是否触发)。

### `ResultMatcher` 形态
```ts
interface ResultMatcher {
  exitCode?: number;
  stdoutContains?: string[];
  stdoutNotContains?: string[];
  stderrContains?: string[];
  stderrNotContains?: string[];
  // 后续可扩展(本期不做): customAssertion?: (r: StepResult) => { ok: boolean; reason: string };
}
function evalMatcher(actual: StepResult, m: ResultMatcher): { ok: boolean; reasons: string[] };
```

`ambiguous` verdict 的产生:before 命中 after 的 matcher,或 after 命中 before 的 matcher,说明对比未严谨成立 —— suite-1 不擅自二选一,标 ambiguous 让 Layer B 看。

---

## 决议对 plan 形态的影响(模块边界落锤)

`2026-05-15-suite-1-repro-framework.md` 的文件结构由上面 4 个决议直接推出来:

```
scripts/verify/
  repro-types.ts         ← ReproSpec / ReproResult / ResultMatcher / DemoScene 类型
  repro-core.ts          ← 纯逻辑:matcher 求值、verdict 计算、worktree 命令构造
  repro-core.test.ts     ← node:test 单测
  worktree-shell.ts      ← Imperative shell:git worktree 增删 + node_modules junction
  repro-runner.ts        ← Imperative shell:在 baseline + current 两侧跑 steps、收集 StepResult
  repro-cli.ts           ← CLI 入口:read spec → run → 可选 recordGif → 写 ReproResult JSON
fixtures/repro-specs/
  hook-moment-block.ts   ← 第一份 ReproSpec 样板(把 hook-moment-block 验收改写为可执行)
  README.md              ← 怎么写一份 ReproSpec
```

文件结构与 Phase 1/2 的 `scripts/verify/gif-*.ts` / `report-*.ts` 平行,沿用同一套 functional-core / imperative-shell 模式。

---

## 验证清单(写 plan 时勾)

- [ ] 4 条决议都被 plan 的某个 Task 落地
- [ ] `repro-types.ts` 类型签名与本文 Q1/Q2/Q3/Q4 描述一致
- [ ] `repro-core.test.ts` 至少覆盖:① matcher 求值;② verdict 计算(pass/fail/ambiguous 三态都有);③ worktree 命令构造
- [ ] `repro-cli.ts` 默认行为与 Q3 决议一致(自动调 recordGif,可关)
- [ ] hook-moment-block ReproSpec 样板能 end-to-end 跑出 `verdict: "pass"`
