// scripts/verify/gif-core.test.ts
//
// 纯逻辑测试:ffmpeg 命令构造、捕获矩形计算、调色板两遍命令对。
// 见 docs/plans/2026-05-14-verification-tooling.md Phase 1 Task 1。

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGdigrabArgs,
  buildGifPaletteArgs,
  computeCaptureRect,
} from "./gif-core.ts";

test("buildGdigrabArgs 生成固定区域录屏参数", () => {
  const args = buildGdigrabArgs({ x: 8, y: 0, w: 1096, h: 730, durationSec: 40, outPath: "C:/t/demo.mp4" });
  assert.deepEqual(args, [
    "-hide_banner", "-loglevel", "warning", "-stats",
    "-f", "gdigrab", "-framerate", "12",
    "-offset_x", "8", "-offset_y", "0", "-video_size", "1096x730",
    "-i", "desktop", "-t", "40", "-pix_fmt", "yuv420p", "-y", "C:/t/demo.mp4",
  ]);
});

test("computeCaptureRect 把窗口矩形内移 inset 像素避开隐形边框", () => {
  // 窗口贴屏幕左上角 (0,0,1120,760) → 捕获区内移 8px、整体缩 16px 宽 16px 高
  assert.deepEqual(
    computeCaptureRect({ winX: 0, winY: 0, winW: 1120, winH: 760, inset: 8 }),
    { x: 8, y: 0, w: 1104, h: 744 },
  );
});

test("buildGifPaletteArgs 生成两遍调色板命令对", () => {
  const { palettegen, paletteuse } = buildGifPaletteArgs({
    mp4: "C:/t/demo.mp4", gif: "C:/t/demo.gif", palette: "C:/t/pal.png", fps: 11, width: 900,
  });
  // palettegen 必须有 stats_mode=diff(适合屏幕录像稳定 palette)
  assert.ok(palettegen.some((a) => a.includes("palettegen=stats_mode=diff")));
  // ffmpeg 8 写单图 palette 需 -update 1
  assert.ok(palettegen.includes("-update"));
  // paletteuse 必须用 bayer dither(高对比度文本表现更稳)
  assert.ok(paletteuse.some((a) => a.includes("paletteuse=dither=bayer:bayer_scale=3")));
});
