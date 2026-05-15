// fixtures/repro-specs/hook-moment-block.ts
//
// 第一份真实 ReproSpec 样板 —— 把 docs/acceptance/2026-05-14-hook-moment-block/
// 的人工验收改写为可自动跑的 spec。
//
// 这个 feature 是「数据驱动差异」(同代码、不同知识库状态),所以 baseline.ref = HEAD,
// 两侧靠 env 切的 USERPROFILE 来切 teamagent 知识库 home。
//
// 前置:$TA_DEMO_STAGE/home-empty 与 $TA_DEMO_STAGE/home-loaded 两个目录已按
// docs/acceptance/2026-05-14-hook-moment-block/recording/README.md 备好。

import path from "node:path";
import { momentDayjsScenario } from "../scenarios/moment-dayjs.ts";
import type { ReproSpec } from "../../scripts/verify/repro-types.ts";

const stage = process.env["TA_DEMO_STAGE"] ?? "C:/Users/tianhaoxuan/ta-demo-stage";

const spec: ReproSpec = {
  id: "hook-moment-block",
  description: "PreToolUse hook 在「学到经验后」拦截 npm install moment,建议 dayjs",
  baseline: {
    ref: "HEAD",                                          // 同代码;差异在 env 切的知识库 home
    env: { USERPROFILE: `${stage}/home-empty`, HOME: `${stage}/home-empty` },
  },
  current: {
    env: { USERPROFILE: `${stage}/home-loaded`, HOME: `${stage}/home-loaded` },
  },
  steps: [
    {
      name: "demo-hook-npm-install-moment",
      command: process.execPath,                          // node
      args: [
        path.resolve("packages/teamagent/dist/bin.js"),
        "demo", "hook", "Bash", `command=npm install moment`,
      ],
      timeoutMs: 30_000,
    },
  ],
  expect: {
    before: {
      exitCode: 0,
      stdoutContains: ["通过 (无规则命中)"],
      stdoutNotContains: ["deny", "应改用"],
    },
    after: {
      exitCode: 0,
      stdoutContains: ["决策: deny", "应改用", "dayjs"],
      stdoutNotContains: ["通过 (无规则命中)"],
    },
  },
  scenario: momentDayjsScenario,                          // 复用现成 Scenario 元数据
  demoScene: {
    sceneScript: path.resolve("docs/acceptance/2026-05-14-hook-moment-block/recording/demo-scene.ps1"),
    windowTitle: "TADEMOREC",
    durationSec: 40,
  },
  // CI 上跳过此 spec —— baseline.ref="HEAD" 数据驱动差异依赖 $TA_DEMO_STAGE 下
  // home-empty/home-loaded 两份知识库目录预置(见上方注释),Ubuntu runner 没那
  // 目录、也没 Win32 EnumWindows 录 GIF 的能力。本地手工跑仍然有效。
  // 见 https://github.com/libz-renlab-ai/Matrix/issues/3 Gap 1。
  ci: {
    skip: true,
    reason: "需 $TA_DEMO_STAGE 下 home-empty/home-loaded 两份知识库目录预置 + 录 GIF 仅 Win32 可行",
  },
};

export default spec;
