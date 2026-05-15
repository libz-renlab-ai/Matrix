// scripts/verify/record-gif.ts
//
// Imperative Shell:接收 RecordConfig,调 PowerShell(win-record.ps1)真实录屏出 mp4,
// 再调两遍 ffmpeg(palettegen + paletteuse)把 mp4 转成 GIF。
// 见 docs/plans/2026-05-14-verification-tooling.md Phase 1 Task 3。
//
// 纯逻辑(ffmpeg args / palette args)在 gif-core.ts,本文件只做 IO + 编排。

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGifPaletteArgs } from "./gif-core.ts";

export interface RecordConfig {
  /** 被录窗口里跑的 .ps1(需自行设置窗口标题为 windowTitle) */
  sceneScript: string;
  windowTitle: string;
  /** mp4 / gif / palette / 检查帧的输出目录 */
  outDir: string;
  durationSec: number;
  /** GIF 帧率,默认 11 */
  gifFps?: number;
  /** GIF 宽度(px),按比例缩高;默认 900 */
  gifWidth?: number;
}

/** 录 mp4 → 调色板 → GIF。返回两个产物的绝对路径。 */
export function recordGif(cfg: RecordConfig): { mp4: string; gif: string } {
  if (process.platform !== "win32") {
    throw new Error(`recordGif 当前仅支持 Windows(gdigrab),实际平台 ${process.platform}`);
  }
  if (!existsSync(cfg.sceneScript)) throw new Error(`sceneScript 不存在: ${cfg.sceneScript}`);
  mkdirSync(cfg.outDir, { recursive: true });

  const mp4 = path.resolve(cfg.outDir, "demo.mp4");
  const gif = path.resolve(cfg.outDir, "demo.gif");
  const palette = path.resolve(cfg.outDir, "palette.png");

  // 1. 录 mp4(PowerShell 窗口管理 + gdigrab)
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const psScript = path.join(scriptDir, "win-record.ps1");
  if (!existsSync(psScript)) throw new Error(`win-record.ps1 不存在: ${psScript}`);

  const ps = spawnSync(
    "powershell",
    [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psScript,
      "-SceneScript", cfg.sceneScript,
      "-WindowTitle", cfg.windowTitle,
      "-OutMp4", mp4,
      "-DurationSec", String(cfg.durationSec),
    ],
    { stdio: "inherit", windowsHide: true },
  );
  if (ps.status !== 0 || !existsSync(mp4)) {
    throw new Error(`录制失败(powershell exit=${ps.status},mp4 exists=${existsSync(mp4)})`);
  }

  // 2. mp4 → palette → GIF(两遍调色板)
  const { palettegen, paletteuse } = buildGifPaletteArgs({
    mp4, gif, palette,
    fps: cfg.gifFps ?? 11,
    width: cfg.gifWidth ?? 900,
  });

  const gen = spawnSync("ffmpeg", palettegen, { stdio: "inherit", windowsHide: true });
  if (gen.status !== 0 || !existsSync(palette)) {
    throw new Error(`palettegen 失败(exit=${gen.status})`);
  }
  const use = spawnSync("ffmpeg", paletteuse, { stdio: "inherit", windowsHide: true });
  if (use.status !== 0 || !existsSync(gif)) {
    throw new Error(`paletteuse 失败(exit=${use.status})`);
  }

  return { mp4, gif };
}
