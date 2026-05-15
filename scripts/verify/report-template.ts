// scripts/verify/report-template.ts
//
// HTML 模板与内联 CSS 常量(从人工样板 docs/acceptance/2026-05-14-hook-moment-block/report.html
// 的 <style> 块原样提炼)。htmlShell 包外壳,esc 转义。
// 见 docs/plans/2026-05-14-verification-tooling.md Phase 2 Task 4。

export const INLINE_CSS = `
  :root {
    --green: #1a7f37;
    --green-bg: #eaf6ec;
    --amber: #9a6700;
    --amber-bg: #fff6e0;
    --red: #b3261e;
    --ink: #1f2328;
    --muted: #656d76;
    --line: #d8dee4;
    --term-bg: #0c0c14;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "Source Han Sans SC", sans-serif;
    color: var(--ink);
    background: #f6f8fa;
    line-height: 1.75;
  }
  .wrap { max-width: 920px; margin: 0 auto; padding: 0 20px 80px; }
  header {
    background: linear-gradient(135deg, #1a7f37 0%, #2da44e 100%);
    color: #fff;
    padding: 44px 20px 38px;
    text-align: center;
  }
  header .kicker { font-size: 14px; opacity: .85; letter-spacing: 2px; }
  header h1 { margin: 8px 0 4px; font-size: 30px; }
  header .sub { font-size: 16px; opacity: .92; }
  .verdict {
    max-width: 920px; margin: -26px auto 0; background: #fff;
    border: 1px solid var(--line); border-radius: 14px;
    box-shadow: 0 6px 24px rgba(0,0,0,.08);
    padding: 26px 30px; display: flex; align-items: center; gap: 22px;
  }
  .verdict .badge {
    flex: none; width: 92px; height: 92px; border-radius: 50%;
    background: var(--green-bg); color: var(--green);
    display: flex; align-items: center; justify-content: center;
    font-size: 50px;
  }
  .verdict.warn .badge { background: var(--amber-bg); color: var(--amber); }
  .verdict.fail .badge { background: #fbe9e7; color: var(--red); }
  .verdict .vtext h2 { margin: 0 0 4px; font-size: 22px; color: var(--green); }
  .verdict.warn .vtext h2 { color: var(--amber); }
  .verdict.fail .vtext h2 { color: var(--red); }
  .verdict .vtext p { margin: 0; color: var(--muted); font-size: 15px; }
  section { margin-top: 38px; }
  section h3 {
    font-size: 19px; margin: 0 0 14px; padding-left: 12px;
    border-left: 4px solid var(--green);
  }
  .card {
    background: #fff; border: 1px solid var(--line);
    border-radius: 12px; padding: 22px 26px;
  }
  p.lead { font-size: 17px; }
  .gif-wrap { text-align: center; }
  .gif-wrap img { max-width: 100%; border-radius: 10px; border: 1px solid var(--line); }
  .caption { color: var(--muted); font-size: 14px; margin-top: 10px; }
  .ba { display: flex; gap: 20px; flex-wrap: wrap; }
  .ba .col { flex: 1; min-width: 280px; }
  .ba .col img { width: 100%; border-radius: 8px; border: 1px solid var(--line); }
  .tag {
    display: inline-block; font-size: 13px; font-weight: 700;
    padding: 3px 12px; border-radius: 20px; margin-bottom: 8px;
  }
  .tag.before { background: var(--amber-bg); color: var(--amber); }
  .tag.after  { background: var(--green-bg); color: var(--green); }
  .ba .col p { font-size: 14px; color: var(--muted); margin: 8px 2px 0; }
  table.crit { width: 100%; border-collapse: collapse; font-size: 15px; }
  table.crit td { padding: 12px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  table.crit tr:last-child td { border-bottom: none; }
  table.crit .ck { width: 30px; color: var(--green); font-size: 18px; }
  table.crit .ck.no { color: var(--muted); }
  .term {
    background: var(--term-bg); color: #e6e6e6; border-radius: 10px;
    padding: 16px 18px; font-family: "Cascadia Code", "Consolas", "Courier New", monospace;
    font-size: 13px; line-height: 1.65; white-space: pre-wrap; overflow-x: auto;
    margin: 0;
  }
  .two { display: flex; gap: 20px; flex-wrap: wrap; }
  .two > div { flex: 1; min-width: 300px; }
  .two h4 { margin: 0 0 8px; font-size: 14px; }
  ol.repro { padding-left: 22px; }
  ol.repro li { margin-bottom: 6px; }
  code.inline {
    background: #eef1f4; padding: 1px 6px; border-radius: 4px;
    font-family: "Cascadia Code", "Consolas", monospace; font-size: 13px;
  }
  .scope { display: flex; gap: 20px; flex-wrap: wrap; }
  .scope > div { flex: 1; min-width: 280px; }
  .scope ul { margin: 6px 0 0; padding-left: 20px; font-size: 14px; }
  .scope .yes h4 { color: var(--green); }
  .scope .no h4 { color: var(--muted); }
  footer {
    margin-top: 46px; padding-top: 20px; border-top: 1px solid var(--line);
    color: var(--muted); font-size: 13px;
  }
  footer table td { padding: 2px 14px 2px 0; }
`;

export function htmlShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>${INLINE_CSS}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

export function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
