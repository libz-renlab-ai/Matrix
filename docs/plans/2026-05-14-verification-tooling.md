# 验证框架(套件1 + GIF 录制 + 套件2 生成器)实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `docs/WORKFLOW.md` 第 3 步「两套验证」从概念落地成可执行工具 —— 任何 feature 都能跑出 before/after 硬证明、自动录真实屏幕 GIF、并生成一份 `docs/acceptance/SPEC.md` 规范的中文 HTML 验收报告。

**Architecture:** 沿用本仓库 subsystem #1(认领锁)的 `scripts/` + Functional Core / Imperative Shell 模式 —— 纯逻辑放 `scripts/verify/*-core.ts`(`node:test` 单测钉死),IO/编排放 `scripts/verify/*.ts`。GIF 录制的 Win32 窗口管理沿用已验证可用的 PowerShell(`docs/acceptance/2026-05-14-hook-moment-block/recording/` 是参照原型),由 TS 外壳参数化调用。HTML 生成器把人工样板 `report.html` 模板化:输入一份 manifest JSON,输出符合 `SPEC.md` 的自包含 HTML。

**Tech Stack:** TypeScript + `tsx`、`node:test`(node 22 内置)、ffmpeg(`gdigrab` 真实录屏 + 调色板转 GIF)、Windows PowerShell 5.1(Win32 窗口管理,需 UTF-8 BOM)。

---

## Scope Check —— 三部分就绪度不同,本计划只详写两部分

| 组件 | 就绪度 | 本计划处理方式 |
|---|---|---|
| **GIF 录制器** | 有可用原型(`recording/record.ps1` + `demo-scene.ps1` 已跑通真实录屏) | **Phase 1,详细 bite-sized** |
| **套件2 HTML 生成器** | 有可用样板(`report.html` + `SPEC.md` 已定规范) | **Phase 2,详细 bite-sized** |
| **套件1 复现验证代码框架** | 无原型,与 `fixtures/scenarios/`(`Scenario` 类型)、`packages/benchmark/`(runner/evaluator)既有机制纠缠 | **Phase 3,粗粒度大纲 + 建议单独 brainstorm**(见 Phase 3 开头) |

理由:writing-plans 的硬规矩是「No Placeholders / 每步给完整代码」。Phase 1/2 有真实原型可扎根,能写实;Phase 3 硬写会全是猜测与占位符 —— 它需要先做一轮 brainstorm,把「复现验证代码」与既有 `Scenario` / benchmark machinery 的边界定清楚,再单独出 plan。

---

## File Structure

```
scripts/verify/
  gif-core.ts          ← 纯逻辑:ffmpeg 命令构造、录制配置校验、捕获矩形计算。无 IO。
  gif-core.test.ts     ← node:test 单测,覆盖 gif-core 全部纯函数。
  record-gif.ts        ← Imperative Shell:接收 RecordConfig,调 PowerShell 窗口管理 + ffmpeg,产出 mp4 + GIF + 检查帧。
  win-record.ps1       ← Win32 窗口管理(EnumWindows/SetWindowPos/PostMessage)+ ffmpeg gdigrab。由 record-gif.ts 参数化调用。
  report-core.ts       ← 纯逻辑:把 ReportManifest 渲染成 SPEC.md 规范的 HTML 字符串。无 IO。
  report-core.test.ts  ← node:test 单测,覆盖 report-core 渲染与校验。
  gen-report.ts        ← Imperative Shell:读 manifest.json + 资产文件,调 report-core,写 report.html 到 docs/acceptance/<slug>/。
  report-template.ts   ← HTML 模板与内联 CSS 常量(从人工样板 report.html 提炼)。
```

约定:与 subsystem #1 一致 —— `scripts/` 下不进 pnpm workspace,用 `tsx` 跑、`node:test` 测;`*-core.ts` 严禁 import `fs`/`child_process`。

---

## Phase 1 —— GIF 录制器

把 `docs/acceptance/2026-05-14-hook-moment-block/recording/` 的原型脚本,变成「给一份配置就能录任意终端 demo」的参数化工具。

### Task 1: gif-core —— ffmpeg 命令构造(纯逻辑)

**Files:**
- Create: `scripts/verify/gif-core.ts`
- Test: `scripts/verify/gif-core.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// scripts/verify/gif-core.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGdigrabArgs, buildGifPaletteArgs, computeCaptureRect } from "./gif-core.ts";

test("buildGdigrabArgs 生成固定区域录屏参数", () => {
  const args = buildGdigrabArgs({ x: 8, y: 0, w: 1096, h: 730, durationSec: 40, outPath: "C:/t/demo.mp4" });
  assert.deepEqual(args, [
    "-hide_banner", "-loglevel", "warning", "-stats",
    "-f", "gdigrab", "-framerate", "12",
    "-offset_x", "8", "-offset_y", "0", "-video_size", "1096x730",
    "-i", "desktop", "-t", "40", "-pix_fmt", "yuv420p", "-y", "C:/t/demo.mp4",
  ]);
});

test("computeCaptureRect 把窗口矩形内移 8px 避开隐形边框", () => {
  // 窗口贴屏幕左上角 (0,0,1120,760) → 捕获区内移 8px、整体缩 16px 宽
  assert.deepEqual(computeCaptureRect({ winX: 0, winY: 0, winW: 1120, winH: 760, inset: 8 }),
    { x: 8, y: 0, w: 1096, h: 744 });
});

test("buildGifPaletteArgs 生成两遍调色板命令对", () => {
  const { palettegen, paletteuse } = buildGifPaletteArgs({ mp4: "C:/t/demo.mp4", gif: "C:/t/demo.gif", palette: "C:/t/pal.png", fps: 11, width: 900 });
  assert.ok(palettegen.includes("palettegen=stats_mode=diff"));
  assert.ok(palettegen.includes("-update")); // ffmpeg 8 写单图需 -update 1
  assert.ok(paletteuse.includes("paletteuse=dither=bayer:bayer_scale=3"));
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx tsx --test scripts/verify/gif-core.test.ts`
Expected: FAIL —— `Cannot find module './gif-core.ts'`

- [ ] **Step 3: 写最小实现**

```ts
// scripts/verify/gif-core.ts
export interface GdigrabOpts { x: number; y: number; w: number; h: number; durationSec: number; outPath: string; }
export function buildGdigrabArgs(o: GdigrabOpts): string[] {
  return [
    "-hide_banner", "-loglevel", "warning", "-stats",
    "-f", "gdigrab", "-framerate", "12",
    "-offset_x", String(o.x), "-offset_y", String(o.y), "-video_size", `${o.w}x${o.h}`,
    "-i", "desktop", "-t", String(o.durationSec), "-pix_fmt", "yuv420p", "-y", o.outPath,
  ];
}

export interface WinRect { winX: number; winY: number; winW: number; winH: number; inset: number; }
export function computeCaptureRect(r: WinRect): { x: number; y: number; w: number; h: number } {
  return { x: r.winX + r.inset, y: r.winY, w: r.winW - r.inset * 2, h: r.winH - r.inset * 2 };
}

export interface PaletteOpts { mp4: string; gif: string; palette: string; fps: number; width: number; }
export function buildGifPaletteArgs(o: PaletteOpts): { palettegen: string[]; paletteuse: string[] } {
  const scale = `fps=${o.fps},scale=${o.width}:-1:flags=lanczos`;
  return {
    palettegen: ["-hide_banner", "-loglevel", "error", "-i", o.mp4, "-vf", `${scale},palettegen=stats_mode=diff`, "-update", "1", "-y", o.palette],
    paletteuse: ["-hide_banner", "-loglevel", "error", "-i", o.mp4, "-i", o.palette, "-lavfi", `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`, "-y", o.gif],
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx tsx --test scripts/verify/gif-core.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: commit**

```bash
git add scripts/verify/gif-core.ts scripts/verify/gif-core.test.ts
git commit -m "feat(verify): add gif-core — ffmpeg arg construction for GIF recording"
```

### Task 2: win-record.ps1 —— 参数化的 Win32 录制脚本

**Files:**
- Create: `scripts/verify/win-record.ps1`(以 `docs/acceptance/2026-05-14-hook-moment-block/recording/record.ps1` 为蓝本)

- [ ] **Step 1: 从参照原型派生,改成接收参数**

把样板 `record.ps1` 里写死的 `$winX/$winY/...`、场景脚本路径、`-t` 时长、捕获矩形、输出路径,全部改成脚本 `param()`:

```powershell
# scripts/verify/win-record.ps1
param(
  [Parameter(Mandatory)][string]$SceneScript,   # 在被录窗口里跑的 .ps1
  [Parameter(Mandatory)][string]$WindowTitle,   # 场景脚本设置的窗口标题,用于 EnumWindows 精确匹配
  [Parameter(Mandatory)][string]$OutMp4,
  [int]$WinX = 0, [int]$WinY = 0, [int]$WinW = 1120, [int]$WinH = 760,
  [int]$CapX = 8, [int]$CapY = 0, [int]$CapW = 1096, [int]$CapH = 730,
  [int]$DurationSec = 40
)
```

其余照搬样板:`Add-Type` 的 `Win` 类(`EnumWindows`/`SetWindowPos`/`ShowWindow`/`PostMessage` + `FindByTitle`/`CountByTitle`/`CloseAllByTitle`)、录制前后 `CloseAllByTitle` 清僵尸窗口、`SetWindowPos` 置顶、`ffmpeg gdigrab` 录制、`PostMessage(WM_CLOSE)` 精确关闭。**绝不 `Stop-Process` Windows Terminal 进程**(注释里写明原因 —— 它同时托管其它终端窗口)。

- [ ] **Step 2: 手动冒烟**

```powershell
# 用样板场景脚本验证参数化版能跑通
& scripts/verify/win-record.ps1 -SceneScript "docs/acceptance/2026-05-14-hook-moment-block/recording/demo-scene.ps1" `
  -WindowTitle "TADEMOREC" -OutMp4 "$env:TEMP/verify-smoke.mp4" -DurationSec 40
```
Expected: 退出码 0,`$env:TEMP/verify-smoke.mp4` 存在且 > 100KB,运行中无残留 TADEMOREC 窗口。

- [ ] **Step 3: commit**

```bash
git add scripts/verify/win-record.ps1
git commit -m "feat(verify): add win-record.ps1 — parameterized Win32 + gdigrab recorder"
```

### Task 3: record-gif.ts —— 录制编排外壳

**Files:**
- Create: `scripts/verify/record-gif.ts`

- [ ] **Step 1: 实现 Imperative Shell**

```ts
// scripts/verify/record-gif.ts
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { buildGifPaletteArgs } from "./gif-core.ts";

export interface RecordConfig {
  sceneScript: string;   // 被录窗口里跑的 .ps1(需自行设置窗口标题为 windowTitle)
  windowTitle: string;
  outDir: string;        // mp4 / gif / 检查帧的输出目录
  durationSec: number;
  gifFps?: number;       // 默认 11
  gifWidth?: number;     // 默认 900
}

export function recordGif(cfg: RecordConfig): { mp4: string; gif: string } {
  const mp4 = path.join(cfg.outDir, "demo.mp4");
  const gif = path.join(cfg.outDir, "demo.gif");
  const palette = path.join(cfg.outDir, "palette.png");
  // 1. 录 mp4(PowerShell 窗口管理 + gdigrab)
  const ps = spawnSync("powershell", ["-NoProfile", "-File",
    path.join(import.meta.dirname, "win-record.ps1"),
    "-SceneScript", cfg.sceneScript, "-WindowTitle", cfg.windowTitle,
    "-OutMp4", mp4, "-DurationSec", String(cfg.durationSec)],
    { stdio: "inherit", windowsHide: true });
  if (ps.status !== 0 || !existsSync(mp4)) throw new Error(`录制失败,退出码 ${ps.status}`);
  // 2. mp4 → GIF(两遍调色板)
  const { palettegen, paletteuse } = buildGifPaletteArgs({ mp4, gif, palette, fps: cfg.gifFps ?? 11, width: cfg.gifWidth ?? 900 });
  if (spawnSync("ffmpeg", palettegen, { windowsHide: true }).status !== 0) throw new Error("palettegen 失败");
  if (spawnSync("ffmpeg", paletteuse, { windowsHide: true }).status !== 0) throw new Error("paletteuse 失败");
  return { mp4, gif };
}
```

- [ ] **Step 2: 冒烟验证**

```bash
npx tsx -e "import {recordGif} from './scripts/verify/record-gif.ts'; console.log(recordGif({sceneScript:'docs/acceptance/2026-05-14-hook-moment-block/recording/demo-scene.ts'.replace('.ts','.ps1'), windowTitle:'TADEMOREC', outDir:process.env.TEMP, durationSec:40}))"
```
Expected: 打印 `{ mp4: ..., gif: ... }`,两个文件都存在。

- [ ] **Step 3: commit**

```bash
git add scripts/verify/record-gif.ts
git commit -m "feat(verify): add record-gif.ts — orchestration shell over win-record + ffmpeg"
```

---

## Phase 2 —— 套件2 HTML 报告生成器

把人工样板 `docs/acceptance/2026-05-14-hook-moment-block/report.html` 模板化:输入结构化数据,输出符合 `docs/acceptance/SPEC.md` 的自包含 HTML。

### Task 4: report-core —— manifest → HTML 渲染(纯逻辑)

**Files:**
- Create: `scripts/verify/report-core.ts`
- Create: `scripts/verify/report-template.ts`
- Test: `scripts/verify/report-core.test.ts`

- [ ] **Step 1: 定义 ReportManifest 类型 + 写失败测试**

```ts
// scripts/verify/report-core.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReport, validateManifest } from "./report-core.ts";
import type { ReportManifest } from "./report-core.ts";

const sample: ReportManifest = {
  feature: "PreToolUse hook 拦截重复犯的错",
  date: "2026-05-14",
  verdict: { status: "pass", line: "已实现,并通过验证" },
  whatItIs: "把团队踩过的坑记下来,等 AI 又要踩同一个坑时拦住它。",
  gifPath: "demo.gif",
  before: { tag: "之前 · 知识库是空的", still: "assets/still-before.png", text: "命令被放行。", evidence: "▸ 决策: 通过 (无规则命中)" },
  after: { tag: "之后 · 经验已进知识库", still: "assets/still-after.png", text: "同样的命令被拦下。", evidence: "▸ 决策: deny" },
  criteria: [{ ok: true, title: "同输入单变量结果相反", body: "..." }],
  reproSteps: ["跑空知识库 demo hook", "init 加载 pack", "再跑一遍"],
  coverage: { covered: ["真实知识库 + 真实匹配引擎"], notCovered: ["编辑器内端到端"] },
  footer: { env: "Windows 11 · Node 22", recordMethod: "ffmpeg gdigrab 真实录屏" },
};

test("validateManifest 接受合法 manifest", () => {
  assert.deepEqual(validateManifest(sample), { ok: true, errors: [] });
});

test("validateManifest 拒绝缺 before/after 的 manifest", () => {
  const bad = { ...sample, after: undefined } as unknown as ReportManifest;
  const r = validateManifest(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("after")));
});

test("renderReport 产出自包含 HTML,含结论横幅与 before/after", () => {
  const html = renderReport(sample);
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.includes("已实现,并通过验证"));
  assert.ok(html.includes('src="demo.gif"'));
  assert.ok(html.includes('src="assets/still-before.png"'));
  assert.ok(html.includes('src="assets/still-after.png"'));
  assert.ok(!html.includes("http://") && !html.includes("https://")); // 自包含,无外部依赖
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx tsx --test scripts/verify/report-core.test.ts`
Expected: FAIL —— `Cannot find module './report-core.ts'`

- [ ] **Step 3: 实现 report-template.ts(从样板提炼)**

把 `docs/acceptance/2026-05-14-hook-moment-block/report.html` 的 `<style>` 块与各 section 骨架,提炼成模板常量与小函数:

```ts
// scripts/verify/report-template.ts
export const INLINE_CSS = `/* 从 report.html 的 <style> 原样搬入:--green/--amber/... 变量、.verdict/.ba/.term 等 */`;
export function htmlShell(title: string, body: string): string {
  return `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${title}</title>\n<style>${INLINE_CSS}</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
}
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

- [ ] **Step 4: 实现 report-core.ts**

```ts
// scripts/verify/report-core.ts
import { htmlShell, esc } from "./report-template.ts";

export interface ReportManifest {
  feature: string; date: string;
  verdict: { status: "pass" | "warn" | "fail"; line: string };
  whatItIs: string;
  gifPath: string;
  before: { tag: string; still: string; text: string; evidence: string };
  after: { tag: string; still: string; text: string; evidence: string };
  criteria: Array<{ ok: boolean; title: string; body: string }>;
  reproSteps: string[];
  coverage: { covered: string[]; notCovered: string[] };
  footer: { env: string; recordMethod: string };
}

export function validateManifest(m: ReportManifest): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const k of ["feature", "date", "whatItIs", "gifPath"] as const)
    if (!m?.[k]) errors.push(`缺字段: ${k}`);
  if (!m?.verdict?.line) errors.push("缺字段: verdict.line");
  if (!m?.before?.still || !m?.before?.evidence) errors.push("缺字段: before(still/evidence)");
  if (!m?.after?.still || !m?.after?.evidence) errors.push("缺字段: after(still/evidence)");
  if (!m?.criteria?.length) errors.push("criteria 不能为空 —— 验收标准是报告核心");
  if (!m?.coverage?.notCovered?.length) errors.push("coverage.notCovered 不能为空 —— SPEC 要求写明未覆盖项");
  return { ok: errors.length === 0, errors };
}

export function renderReport(m: ReportManifest): string {
  const v = validateManifest(m);
  if (!v.ok) throw new Error(`manifest 不合法: ${v.errors.join("; ")}`);
  const badge = m.verdict.status === "pass" ? "✅" : m.verdict.status === "warn" ? "⚠️" : "❌";
  const body = [
    `<header><div class="kicker">TEAMAGENT · 验收报告</div><h1>${esc(m.feature)}</h1><div class="sub">${esc(m.date)}</div></header>`,
    `<div class="wrap">`,
    `<div class="verdict"><div class="badge">${badge}</div><div class="vtext"><h2>${esc(m.verdict.line)}</h2></div></div>`,
    `<section><h3>这个功能是什么</h3><div class="card"><p class="lead">${esc(m.whatItIs)}</p></div></section>`,
    `<section><h3>真实屏幕录像</h3><div class="card gif-wrap"><img src="${esc(m.gifPath)}" alt="真实屏幕录像"></div></section>`,
    renderBeforeAfter(m),
    renderCriteria(m),
    renderEvidence(m),
    renderRepro(m),
    renderCoverage(m),
    renderFooter(m),
    `</div>`,
  ].join("\n");
  return htmlShell(`验收报告 · ${m.feature}`, body);
}

// renderBeforeAfter / renderCriteria / renderEvidence / renderRepro / renderCoverage / renderFooter:
// 各自把 manifest 对应字段套进样板 report.html 里对应 section 的 HTML 骨架。
// 实现时逐 section 对照 report.html 原文,字段用 esc() 转义。
```

> 实现者注意:`renderBeforeAfter` 等 6 个小函数,逐一对照 `docs/acceptance/2026-05-14-hook-moment-block/report.html` 里对应 `<section>` 的真实 HTML 结构来写,字段值一律 `esc()`。每个函数配 1 条 `node:test`(断言关键字段出现在输出里)。

- [ ] **Step 5: 跑测试确认通过**

Run: `npx tsx --test scripts/verify/report-core.test.ts`
Expected: PASS

- [ ] **Step 6: commit**

```bash
git add scripts/verify/report-core.ts scripts/verify/report-template.ts scripts/verify/report-core.test.ts
git commit -m "feat(verify): add report-core — ReportManifest → SPEC-compliant HTML"
```

### Task 5: gen-report.ts —— 报告生成外壳

**Files:**
- Create: `scripts/verify/gen-report.ts`

- [ ] **Step 1: 实现 Imperative Shell**

```ts
// scripts/verify/gen-report.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { renderReport } from "./report-core.ts";
import type { ReportManifest } from "./report-core.ts";

// 用法: npx tsx scripts/verify/gen-report.ts <reportDir>
// <reportDir> 内需有 manifest.json + demo.gif + assets/*;产出 <reportDir>/report.html
export function genReport(reportDir: string): string {
  const manifestPath = path.join(reportDir, "manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`缺 manifest.json: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as ReportManifest;
  // 校验引用的资产文件确实存在(SPEC 要求自包含、可核验)
  for (const rel of [manifest.gifPath, manifest.before.still, manifest.after.still]) {
    if (!existsSync(path.join(reportDir, rel))) throw new Error(`manifest 引用的资产不存在: ${rel}`);
  }
  const html = renderReport(manifest);
  const out = path.join(reportDir, "report.html");
  writeFileSync(out, html, "utf-8");
  return out;
}

const dir = process.argv[2];
if (dir) console.log("生成:", genReport(dir));
```

- [ ] **Step 2: 端到端验证 —— 重新生成人工样板**

把人工样板的数据写成 `manifest.json` 放进样板目录,跑 `npx tsx scripts/verify/gen-report.ts docs/acceptance/2026-05-14-hook-moment-block`,确认生成的 `report.html` 与人工版**结构等价**(用 Edge headless 截图比对:`msedge --headless=new --screenshot=...`)。

- [ ] **Step 3: commit**

```bash
git add scripts/verify/gen-report.ts docs/acceptance/2026-05-14-hook-moment-block/manifest.json
git commit -m "feat(verify): add gen-report.ts — reportDir → report.html, regenerates the reference sample"
```

---

## Phase 3 —— 套件1 复现验证代码框架(粗粒度,建议单独 brainstorm)

> **本 Phase 不是 bite-sized 计划。** 套件1(「能完整复现 feature、内置 before/after、跑的过程自带录 GIF」的代码框架)没有原型,且与 `fixtures/scenarios/`(`Scenario` 类型:`phaseA/phaseB/phaseC`)、`packages/benchmark/`(`runner.ts`/`evaluator.ts`)既有机制边界不清。硬写 bite-sized 步骤会全是猜测。
>
> **建议**:把 Phase 3 单独拉一轮 `superpowers:brainstorming`,先定清楚这几个问题,再出独立 plan:

需要先 brainstorm 定夺的设计问题:
1. **套件1 与既有 `Scenario` 的关系** —— `fixtures/scenarios/moment-dayjs.ts` 已有 `phaseA(纠正)/phaseB(提炼规则)/phaseC(拦截)` 三段结构。套件1 是复用 `Scenario` 当输入,还是另起一套?
2. **before/after 的「改动前代码」怎么拿** —— WORKFLOW.md 要求「退回改动前的代码跑套件1」。是靠 git stash / worktree 切换,还是靠环境变量切换(像本次样板用 `USERPROFILE` 切知识库状态那样)?不同 feature 形态不同,需要一个统一抽象。
3. **套件1 如何「自带录 GIF」** —— 套件1 是 TS 测试代码,GIF 录的是终端窗口。两者怎么衔接?是套件1 跑完后调 Phase 1 的 `recordGif()`,用一个「重放脚本」把套件1 的关键步骤在可见终端里再演一遍(像本次 `demo-scene.ps1`)?
4. **judge 由谁做** —— `docs/PLAN-RESEARCH-REPORT.md` 强调第三方 judge harness、禁止自评。套件1 的 pass/fail 判定接到哪。

粗粒度产出物(留待独立 plan 细化):
- `scripts/verify/repro-core.ts` —— 纯逻辑:before/after 结果对比、判定「对比是否成立」。
- `scripts/verify/repro-verify.ts` —— Imperative Shell:跑某 feature 的复现验证,产出结构化结果 + 触发 Phase 1 录 GIF。
- 一份「复现验证代码怎么写」的约定文档(类似 `SPEC.md` 之于套件2)。

---

## Self-Review

**1. Spec coverage:** `WORKFLOW.md` 两套验证 + `docs/acceptance/SPEC.md` 要求 —— Phase 1 覆盖「自带录真实 GIF」;Phase 2 覆盖「套件2 HTML 生成器」全部硬性要求(自包含、中文、嵌 GIF、结论横幅、before/after、原始证据、复现、严谨说明 —— `validateManifest` 逐条钉);Phase 3 覆盖套件1 但明确标为需先 brainstorm。**已知缺口**:套件1 未细化(有意为之,见 Scope Check)。

**2. Placeholder scan:** Phase 1/2 每个 code step 给了完整可跑代码;`renderBeforeAfter` 等 6 个 section 渲染函数给了明确实现指引(对照样板 HTML 逐 section)而非空话 —— 这是为控制计划篇幅的有意取舍,实现者有样板可依。Phase 3 明确声明为粗粒度,不算占位符违规。

**3. Type consistency:** `ReportManifest` 在 Task 4 定义,Task 5 `gen-report.ts` 引用一致;`RecordConfig`(Task 3)、`GdigrabOpts`/`WinRect`/`PaletteOpts`(Task 1)各自自洽;`buildGifPaletteArgs` 在 Task 1 定义、Task 3 引用,签名一致。

## Execution Handoff

本计划为夜间自动执行产出,留给用户晨间 review。建议执行路径:
1. **先 review 本计划 + 人工样板**(`docs/acceptance/2026-05-14-hook-moment-block/report.html`)—— 确认套件2 的形态符合预期。
2. Phase 1 + 2 可直接按 bite-sized 步骤执行(subagent-driven 或 inline 均可)。
3. Phase 3 执行前,先单独 brainstorm。
