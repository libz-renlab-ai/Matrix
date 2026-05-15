// scripts/verify/report-core.ts
//
// 纯逻辑:把 ReportManifest 渲染成 docs/acceptance/SPEC.md 合规的自包含 HTML。
// 模板与 CSS 来自 report-template.ts(从人工样板提炼)。
// 见 docs/plans/2026-05-14-verification-tooling.md Phase 2 Task 4。

import { htmlShell, esc } from "./report-template.ts";

/** 验收报告的结构化输入(SPEC.md 的 8 条硬性要求与 10 条推荐章节都源自这份骨架)。 */
export interface ReportManifest {
  /** feature 名(报告头大字标题)。 */
  feature: string;
  /** 报告日期 / 验证日期(ISO,如 "2026-05-14")。 */
  date: string;
  /** 顶部结论横幅。pass=✅, warn=⚠️, fail=❌;line 是一句话定性。 */
  verdict: { status: "pass" | "warn" | "fail"; line: string; detail?: string };
  /** 「这个功能是什么」section 的 lead 段落,1–2 句非技术语言。 */
  whatItIs: string;
  /** 「这个功能是什么」section 可选副段落(背景/案例),纯文本,放在 lead 后。 */
  whatItIsDetail?: string;
  /** GIF 路径(相对 report.html 所在目录)。 */
  gifPath: string;
  /** GIF 下方说明文字。 */
  gifCaption?: string;
  /** 「之前」对比块。tag=徽章文字,still=静态图相对路径,text=解读,evidence=同节(原始证据)里展示的逐字输出。 */
  before: { tag: string; still: string; text: string; evidence: string };
  after: { tag: string; still: string; text: string; evidence: string };
  /** 验收标准列表。ok=true 渲染 ✅ 行,ok=false 渲染 ▫️ 灰行(=「未覆盖说明」)。 */
  criteria: Array<{ ok: boolean; title: string; body: string }>;
  /** 复现步骤,有序。每项纯文本(允许包含 <code>/<strong> 行内标签前请先 esc,本字段不再二次转义)。 */
  reproSteps: string[];
  /** 严谨说明:覆盖 / 未覆盖 两栏。 */
  coverage: { covered: string[]; notCovered: string[] };
  /** 页脚元信息。 */
  footer: {
    env: string;
    recordMethod: string;
    /** 可选附加元信息(显示为 footer 表格的额外行,key 作为左列)。 */
    extras?: Record<string, string>;
    /** footer 末尾一段说明文字(纯文本)。 */
    note?: string;
  };
}

export function validateManifest(m: ReportManifest): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const k of ["feature", "date", "whatItIs", "gifPath"] as const) {
    if (!m?.[k]) errors.push(`缺字段: ${k}`);
  }
  if (!m?.verdict?.line) errors.push("缺字段: verdict.line");
  if (!m?.verdict?.status || !["pass", "warn", "fail"].includes(m.verdict.status)) {
    errors.push("verdict.status 必须为 pass/warn/fail");
  }
  if (!m?.before?.still || !m?.before?.evidence) errors.push("缺字段: before(still/evidence)");
  if (!m?.after?.still || !m?.after?.evidence) errors.push("缺字段: after(still/evidence)");
  if (!m?.criteria?.length) errors.push("criteria 不能为空 —— 验收标准是报告核心");
  if (!m?.reproSteps?.length) errors.push("reproSteps 不能为空 —— 任何人都要能照着重跑");
  if (!m?.coverage?.notCovered?.length) {
    errors.push("coverage.notCovered 不能为空 —— SPEC 要求写明未覆盖项");
  }
  if (!m?.footer?.env || !m?.footer?.recordMethod) errors.push("缺字段: footer(env/recordMethod)");
  return { ok: errors.length === 0, errors };
}

export function renderReport(m: ReportManifest): string {
  const v = validateManifest(m);
  if (!v.ok) throw new Error(`manifest 不合法: ${v.errors.join("; ")}`);

  const body = [
    renderHeader(m),
    `<div class="wrap">`,
    renderVerdict(m),
    renderWhatItIs(m),
    renderGif(m),
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

function renderHeader(m: ReportManifest): string {
  return `<header><div class="kicker">TEAMAGENT · 验收报告</div><h1>${esc(m.feature)}</h1><div class="sub">${esc(m.date)}</div></header>`;
}

function renderVerdict(m: ReportManifest): string {
  const badge = m.verdict.status === "pass" ? "✅" : m.verdict.status === "warn" ? "⚠️" : "❌";
  const cls = m.verdict.status;
  const detail = m.verdict.detail ? `<p>${esc(m.verdict.detail)}</p>` : "";
  return `<div class="verdict ${cls}"><div class="badge">${badge}</div><div class="vtext"><h2>${esc(m.verdict.line)}</h2>${detail}</div></div>`;
}

function renderWhatItIs(m: ReportManifest): string {
  const detail = m.whatItIsDetail
    ? `<p style="color:var(--muted); font-size:15px; margin-bottom:0;">${esc(m.whatItIsDetail)}</p>`
    : "";
  return `<section><h3>这个功能是什么</h3><div class="card"><p class="lead">${esc(m.whatItIs)}</p>${detail}</div></section>`;
}

function renderGif(m: ReportManifest): string {
  const caption = m.gifCaption ?? "这是一段真实的屏幕录像(不是动画绘制)。";
  return `<section><h3>真实屏幕录像</h3><div class="card gif-wrap"><img src="${esc(m.gifPath)}" alt="真实屏幕录像"><div class="caption">${esc(caption)}</div></div></section>`;
}

function renderBeforeAfter(m: ReportManifest): string {
  return [
    `<section><h3>之前 vs 之后 —— 一眼看懂</h3><div class="card"><div class="ba">`,
    `<div class="col"><span class="tag before">${esc(m.before.tag)}</span><img src="${esc(m.before.still)}" alt="之前"><p>${esc(m.before.text)}</p></div>`,
    `<div class="col"><span class="tag after">${esc(m.after.tag)}</span><img src="${esc(m.after.still)}" alt="之后"><p>${esc(m.after.text)}</p></div>`,
    `</div></div></section>`,
  ].join("\n");
}

function renderCriteria(m: ReportManifest): string {
  const rows = m.criteria.map((c) => {
    const ck = c.ok ? `<td class="ck">✅</td>` : `<td class="ck no">▫️</td>`;
    const td = c.ok
      ? `<td><strong>${esc(c.title)}</strong><br>${esc(c.body)}</td>`
      : `<td style="color:var(--muted)"><strong>${esc(c.title)}</strong> —— ${esc(c.body)}</td>`;
    return `<tr>${ck}${td}</tr>`;
  }).join("\n");
  return `<section><h3>凭什么说"实现了" —— 验收标准</h3><div class="card"><table class="crit">${rows}</table></div></section>`;
}

function renderEvidence(m: ReportManifest): string {
  return [
    `<section><h3>原始证据(机器可核验)</h3><div class="card">`,
    `<p style="margin-top:0; color:var(--muted); font-size:15px;">下面是两次运行<strong>逐字未改</strong>的真实输出。任何人都可以照"怎么复现"一节自己跑一遍,得到一样的结果。</p>`,
    `<div class="two">`,
    `<div><h4 style="color:var(--amber)">之前</h4><pre class="term">${esc(m.before.evidence)}</pre></div>`,
    `<div><h4 style="color:var(--green)">之后</h4><pre class="term">${esc(m.after.evidence)}</pre></div>`,
    `</div></div></section>`,
  ].join("\n");
}

function renderRepro(m: ReportManifest): string {
  const items = m.reproSteps.map((s) => `<li>${esc(s)}</li>`).join("\n");
  return `<section><h3>怎么复现(给想自己核验的人)</h3><div class="card"><ol class="repro">${items}</ol></div></section>`;
}

function renderCoverage(m: ReportManifest): string {
  const yes = m.coverage.covered.map((s) => `<li>${esc(s)}</li>`).join("\n");
  const no = m.coverage.notCovered.map((s) => `<li>${esc(s)}</li>`).join("\n");
  return [
    `<section><h3>严谨说明 —— 这次验证覆盖了什么、没覆盖什么</h3><div class="card scope">`,
    `<div class="yes"><h4>✅ 已覆盖</h4><ul>${yes}</ul></div>`,
    `<div class="no"><h4>▫️ 未覆盖(说明,不是缺陷)</h4><ul>${no}</ul></div>`,
    `</div></section>`,
  ].join("\n");
}

function renderFooter(m: ReportManifest): string {
  const rows: string[] = [
    `<tr><td>报告生成</td><td>${esc(m.date)}</td></tr>`,
    `<tr><td>被验功能</td><td>${esc(m.feature)}</td></tr>`,
    `<tr><td>运行环境</td><td>${esc(m.footer.env)}</td></tr>`,
    `<tr><td>录像方式</td><td>${esc(m.footer.recordMethod)}</td></tr>`,
  ];
  if (m.footer.extras) {
    for (const [k, v] of Object.entries(m.footer.extras)) {
      rows.push(`<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`);
    }
  }
  const note = m.footer.note ? `<p style="margin-top:14px;">${esc(m.footer.note)}</p>` : "";
  return `<footer><table>${rows.join("\n")}</table>${note}</footer>`;
}
