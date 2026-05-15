// scripts/verify/report-core.test.ts
//
// 见 docs/plans/2026-05-14-verification-tooling.md Phase 2 Task 4。

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
  before: {
    tag: "之前 · 知识库是空的",
    still: "assets/still-before.png",
    text: "命令被放行。",
    evidence: "▸ 决策: 通过 (无规则命中)",
  },
  after: {
    tag: "之后 · 经验已进知识库",
    still: "assets/still-after.png",
    text: "同样的命令被拦下。",
    evidence: "▸ 决策: deny\n▸ 应改用: dayjs",
  },
  criteria: [{ ok: true, title: "同输入单变量结果相反", body: "两次命令一样,唯一变量是知识库;结果一放一拦。" }],
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

test("validateManifest 拒绝空 criteria 与空 reproSteps", () => {
  const bad1 = { ...sample, criteria: [] };
  const bad2 = { ...sample, reproSteps: [] };
  assert.equal(validateManifest(bad1).ok, false);
  assert.equal(validateManifest(bad2).ok, false);
});

test("validateManifest 拒绝缺 verdict.status / 非法 status", () => {
  const bad = { ...sample, verdict: { status: "ok" as never, line: "fake" } };
  const r = validateManifest(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("verdict.status")));
});

test("renderReport 产出自包含 HTML,含结论横幅与 before/after 资产", () => {
  const html = renderReport(sample);
  assert.ok(html.startsWith("<!DOCTYPE html>"), "应以 doctype 开头");
  assert.ok(html.includes("已实现,并通过验证"), "应含 verdict.line");
  assert.ok(html.includes("src=\"demo.gif\""), "应含 GIF img");
  assert.ok(html.includes("src=\"assets/still-before.png\""), "应含 before still");
  assert.ok(html.includes("src=\"assets/still-after.png\""), "应含 after still");
  assert.ok(!html.includes("http://"), "自包含 —— 不应含外部 URL");
  assert.ok(!html.includes("https://"), "自包含 —— 不应含外部 URL");
  // SPEC 推荐的 9 个非 footer section 标题(每个章节标题包含的关键字),全部出现
  for (const keyword of [
    "这个功能是什么", "真实屏幕录像", "之前 vs 之后", "凭什么说",
    "原始证据", "怎么复现", "严谨说明",
  ]) {
    assert.ok(html.includes(keyword), `应含 section 关键字:${keyword}`);
  }
});

test("renderReport 渲染 warn/fail status 时切换徽章颜色与图标", () => {
  const warn = renderReport({ ...sample, verdict: { status: "warn", line: "部分实现" } });
  assert.ok(warn.includes('class="verdict warn"'));
  assert.ok(warn.includes("⚠️"));

  const fail = renderReport({ ...sample, verdict: { status: "fail", line: "未实现" } });
  assert.ok(fail.includes('class="verdict fail"'));
  assert.ok(fail.includes("❌"));
});

test("renderReport 转义用户字段(防 XSS / 防 HTML 注入)", () => {
  const sneaky = {
    ...sample,
    whatItIs: "<script>alert('x')</script>",
    before: { ...sample.before, text: "<b>注入</b>" },
  };
  const html = renderReport(sneaky);
  assert.ok(!html.includes("<script>alert"), "不应含原始 script 标签");
  assert.ok(html.includes("&lt;script&gt;"), "应转义为 entities");
  assert.ok(html.includes("&lt;b&gt;注入&lt;/b&gt;"));
});

test("renderReport 含 footer extras 与 note 时正确渲染", () => {
  const html = renderReport({
    ...sample,
    footer: {
      ...sample.footer,
      extras: { 规则编号: "seed-pack-universal-moment" },
      note: "本报告由 gen-report 自动生成。",
    },
  });
  assert.ok(html.includes("规则编号"));
  assert.ok(html.includes("seed-pack-universal-moment"));
  assert.ok(html.includes("本报告由 gen-report 自动生成。"));
});

test("renderReport 抛错若 manifest 非法", () => {
  const bad = { ...sample, after: undefined } as unknown as ReportManifest;
  assert.throws(() => renderReport(bad), /manifest 不合法/);
});
