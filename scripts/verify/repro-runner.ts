// scripts/verify/repro-runner.ts
//
// Imperative shell:在 baseline + current 两侧依次跑 ReproSpec.steps,合并结果走 evalMatcher,
// 最后调 computeVerdict 出 ReproResult。
// 实现见 docs/plans/2026-05-15-suite-1-repro-framework.md Task 4。

import { spawn } from "node:child_process";
import { evalMatcher, mergeStepOutputs, computeVerdict } from "./repro-core.ts";
import type {
  ReproSpec, ReproResult, ReproStep, ResultMatcher, SideResult, StepResult,
} from "./repro-types.ts";

interface RunSideOpts {
  side: "before" | "after";
  cwd: string;                                 // 该侧的 worktree 根目录
  baselineEnv: Record<string, string>;         // ReproSpec.baseline.env / current.env
  steps: ReproStep[];
}

async function runStep(step: ReproStep, defaultCwd: string, sideEnv: Record<string, string>): Promise<StepResult> {
  const start = Date.now();
  const env = { ...process.env, ...sideEnv, ...(step.env ?? {}) };
  const timeoutMs = step.timeoutMs ?? 30_000;
  return new Promise<StepResult>((resolve) => {
    const child = spawn(step.command, step.args, {
      cwd: step.cwd ?? defaultCwd, env, windowsHide: true, shell: false,
    });
    let stdout = ""; let stderr = ""; let timedOut = false;
    child.stdout.on("data", (b: Buffer) => { stdout += b.toString(); });
    child.stderr.on("data", (b: Buffer) => { stderr += b.toString(); });
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolve({
        stepName: step.name,
        exitCode: timedOut ? null : code,
        stdout, stderr,
        durationMs: Date.now() - start,
        timedOut,
      });
    });
    child.on("error", (e: Error) => {
      clearTimeout(timer);
      resolve({
        stepName: step.name, exitCode: null, stdout, stderr: stderr + `\n[spawn error] ${e.message}`,
        durationMs: Date.now() - start, timedOut: false,
      });
    });
  });
}

async function runSide(opts: RunSideOpts, matcher: ResultMatcher): Promise<{ side: SideResult; merged: StepResult }> {
  const stepResults: StepResult[] = [];
  for (const step of opts.steps) {
    stepResults.push(await runStep(step, opts.cwd, opts.baselineEnv));
  }
  const merged = mergeStepOutputs(stepResults);
  const m = evalMatcher(merged, matcher);
  const side: SideResult = { side: opts.side, steps: stepResults, matcherOk: m.ok, matcherReasons: m.reasons };
  return { side, merged };
}

export interface RunReproOpts {
  spec: ReproSpec;
  currentDir: string;          // 一般 = process.cwd()
  baselineDir: string;         // 由 worktree-shell.prepareBaselineWorktree 提供
}

export async function runRepro(opts: RunReproOpts): Promise<ReproResult> {
  const { spec, currentDir, baselineDir } = opts;
  const before = await runSide({
    side: "before", cwd: baselineDir,
    baselineEnv: spec.baseline.env ?? {}, steps: spec.steps,
  }, spec.expect.before);
  const after = await runSide({
    side: "after", cwd: currentDir,
    baselineEnv: spec.current.env ?? {}, steps: spec.steps,
  }, spec.expect.after);
  const v = computeVerdict(
    before.side, after.side,
    before.merged, after.merged,
    spec.expect.before, spec.expect.after,
  );
  return {
    specId: spec.id,
    generatedAt: new Date().toISOString(),
    before: before.side,
    after: after.side,
    verdict: v.verdict,
    verdictReason: v.verdictReason,
  };
}
