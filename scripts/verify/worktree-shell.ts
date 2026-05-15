// scripts/verify/worktree-shell.ts
//
// Imperative shell:git worktree 增删 + node_modules junction(Windows) / symlink(其它)。
// 实现见 docs/plans/2026-05-15-suite-1-repro-framework.md Task 3。

import { spawnSync } from "node:child_process";
import {
  mkdtempSync, symlinkSync, existsSync, statSync, readFileSync,
  lstatSync, unlinkSync, rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { buildWorktreeAddArgs, buildWorktreeRemoveArgs, makeBaselineDir } from "./repro-core.ts";

export interface BaselinePrep {
  /** baseline worktree 的绝对路径 */
  dir: string;
  /** baseline 检出的 ref(实际值,resolveBaselineRef 之后) */
  ref: string;
  /** 调它清理 baseline worktree(只在调用方 finally 里跑) */
  cleanup: () => void;
}

/** 解析 BaselineRef.ref:有就用、没有就 git merge-base HEAD <baseBranch>(默认 main)。 */
export function resolveBaselineRef(repoRoot: string, ref: string | undefined, baseBranch: string | undefined): string {
  if (ref && ref.length > 0) return ref;
  const branch = baseBranch ?? "main";
  const r = spawnSync("git", ["merge-base", "HEAD", branch], { cwd: repoRoot, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git merge-base HEAD ${branch} 失败: ${r.stderr.trim()}`);
  return r.stdout.trim();
}

/** 在 os.tmpdir() 下建一个 baseline worktree,返回路径与 cleanup。 */
export function prepareBaselineWorktree(opts: { repoRoot: string; specId: string; ref: string }): BaselinePrep {
  const rand6 = createHash("sha256").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, 6);
  const dir = makeBaselineDir(tmpdir(), opts.specId, rand6);
  const r = spawnSync("git", buildWorktreeAddArgs(dir, opts.ref), { cwd: opts.repoRoot, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git worktree add 失败: ${r.stderr.trim()}`);
  const cleanup = (): void => {
    // 关键(Windows):若 baseline 里有我们造的 node_modules junction,
    // 先解开它再让 git worktree remove 跑 —— 否则 git 会 recurse 失败,
    // 报「Directory not empty」(实测自 plan #1 Task 3 冒烟)。
    cleanupJunctionsIn(dir);
    const rm = spawnSync("git", buildWorktreeRemoveArgs(dir), { cwd: opts.repoRoot, encoding: "utf-8" });
    if (rm.status !== 0) {
      // git remove 失败兜底:rmSync recursive force 强删 dir
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* 已尽力 */ }
      process.stderr.write(`[warn] git worktree remove 失败 (已 rmSync 兜底): ${rm.stderr.trim()}\n`);
    }
  };
  return { dir, ref: opts.ref, cleanup };
}

/** 删 baseline 内的所有 symlink/junction 入口(node_modules 与子目录里的也算),
 *  避免 git worktree remove 在 Windows 上 recurse junction 报「Directory not empty」。 */
function cleanupJunctionsIn(dir: string): void {
  const candidates = [path.join(dir, "node_modules")];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      const lst = lstatSync(p);
      if (lst.isSymbolicLink()) {
        unlinkSync(p);                       // 解开 symlink/junction
      } else if (lst.isDirectory()) {
        // 真目录(罕见 —— baseline 自己装过了),走 rmSync 强删。
        // 这里不动 —— 让 git worktree remove 自己处理。
      }
    } catch (e) {
      process.stderr.write(`[warn] cleanupJunctionsIn 删 ${p} 失败: ${(e as Error).message}\n`);
    }
  }
}

/** 若两侧 package.json + pnpm-lock.yaml hash 一致,把 current 的 node_modules 以 junction 方式挂到 baseline,省去 install。
 *  返回 true 表示成功 junction;false 表示 hash 不一致或 junction 失败,调用方应跑 `pnpm install`。 */
export function tryJunctionNodeModules(currentDir: string, baselineDir: string): boolean {
  const currentLock = path.join(currentDir, "pnpm-lock.yaml");
  const baselineLock = path.join(baselineDir, "pnpm-lock.yaml");
  const currentPkg = path.join(currentDir, "package.json");
  const baselinePkg = path.join(baselineDir, "package.json");
  if (!existsSync(currentLock) || !existsSync(baselineLock)) return false;
  const lockSame = sha(readFileSync(currentLock)) === sha(readFileSync(baselineLock));
  const pkgSame = sha(readFileSync(currentPkg)) === sha(readFileSync(baselinePkg));
  if (!(lockSame && pkgSame)) return false;
  const currentNm = path.join(currentDir, "node_modules");
  const baselineNm = path.join(baselineDir, "node_modules");
  if (!existsSync(currentNm) || !statSync(currentNm).isDirectory()) return false;
  if (existsSync(baselineNm)) return false;       // 已存在 → 不覆盖
  try {
    // Windows: junction;其它平台: dir symlink
    const type = process.platform === "win32" ? "junction" : "dir";
    symlinkSync(currentNm, baselineNm, type);
    return true;
  } catch {
    return false;
  }
}

function sha(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** 测试钩子:让 unit/smoke 能注入临时 mkdtemp 路径 */
export function _internalMkdtemp(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}
