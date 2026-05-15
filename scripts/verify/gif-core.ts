// scripts/verify/gif-core.ts
//
// 纯逻辑:ffmpeg 命令构造、录制配置校验、捕获矩形计算。无 IO,所有 IO 由 record-gif.ts 承担。
// 见 docs/plans/2026-05-14-verification-tooling.md Phase 1 Task 1。

export interface GdigrabOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  durationSec: number;
  outPath: string;
}

/** ffmpeg gdigrab 录屏参数:固定区域、12fps、yuv420p(兼容性最好)。 */
export function buildGdigrabArgs(o: GdigrabOpts): string[] {
  return [
    "-hide_banner", "-loglevel", "warning", "-stats",
    "-f", "gdigrab", "-framerate", "12",
    "-offset_x", String(o.x), "-offset_y", String(o.y), "-video_size", `${o.w}x${o.h}`,
    "-i", "desktop", "-t", String(o.durationSec), "-pix_fmt", "yuv420p", "-y", o.outPath,
  ];
}

export interface WinRect {
  winX: number;
  winY: number;
  winW: number;
  winH: number;
  /** 捕获区相对窗口的内移像素(避开 Win11 隐形边框)。 */
  inset: number;
}

/** 从窗口矩形算实际录屏的捕获矩形:四边各内移 inset 像素。 */
export function computeCaptureRect(r: WinRect): { x: number; y: number; w: number; h: number } {
  return {
    x: r.winX + r.inset,
    y: r.winY,
    w: r.winW - r.inset * 2,
    h: r.winH - r.inset * 2,
  };
}

export interface PaletteOpts {
  mp4: string;
  gif: string;
  palette: string;
  fps: number;
  width: number;
}

/** 两遍调色板:第一遍 palettegen 生成最优调色板,第二遍 paletteuse 用它转 GIF。
 *  屏幕录像里高对比度文本用 bayer dither + bayer_scale=3 最稳;
 *  stats_mode=diff 让 palette 偏向变化区域(=终端文字)而非静态背景。 */
export function buildGifPaletteArgs(o: PaletteOpts): { palettegen: string[]; paletteuse: string[] } {
  const scale = `fps=${o.fps},scale=${o.width}:-1:flags=lanczos`;
  return {
    palettegen: [
      "-hide_banner", "-loglevel", "error",
      "-i", o.mp4,
      "-vf", `${scale},palettegen=stats_mode=diff`,
      "-update", "1",
      "-y", o.palette,
    ],
    paletteuse: [
      "-hide_banner", "-loglevel", "error",
      "-i", o.mp4,
      "-i", o.palette,
      "-lavfi", `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
      "-y", o.gif,
    ],
  };
}
