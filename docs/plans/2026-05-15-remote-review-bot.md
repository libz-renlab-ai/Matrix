# 远程评审 Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `docs/WORKFLOW.md` 第 5 步「PR 由**远程 CC 自动评审**(同 2 条标准)」落地成一条 GitHub Actions workflow:每次 PR 打开/推新 commit,自动跑 `2026-05-15-local-review-loop.md` 的 review-cli + 把 verdict 贴成 PR 评论 + 设 commit status 卡合并。

**Architecture:** Workflow 跑在 ubuntu-latest;复用 `scripts/review/review-cli.ts`(本地版)同一段代码 —— 因为 review-cli 本身就是确定性脚本,「本地」与「远程」的差异只在执行环境与结果发布。每个 ReproSpec 起一个 matrix job 跑 repro-cli `--no-gif`(GIF 录制是 Win32 only,CI 上不能跑);所有 spec 全过 + `pnpm test` 全过 + 无冲突 → review verdict=pass → 评论 ✅ + status `success`;否则 verdict=fail → 评论 ❌ + status `failure`,branch protection 自动卡合并。

**Tech Stack:** GitHub Actions (`ubuntu-latest` + `actions/checkout@v5` + `pnpm/action-setup@v5` + `actions/setup-node@v5`) + `gh` CLI + `GITHUB_TOKEN`(`pull-requests: write` + `statuses: write`)。

---

## 安全/正确性前提(写之前必读)

- **本计划只支持仓库内 PR**(`pull_request` 触发器)。**不支持外部 fork 的 PR** —— 用 `pull_request` 而非 `pull_request_target`,避免外部 PR 拿到 secrets / write token。外部贡献的 PR 由 maintainer 手动 cherry-pick 到内部分支后再走本流程。
- POSTPR.md 已记录:旧的 `claude-code-review.yml` 在 PR #274 被删 —— 因为 `anthropics/claude-code-action@v1` 一直 fail on tsconfig.json fd 4。**本计划不依赖 anthropics 官方 action**,只用 review-cli 这种纯逻辑脚本,可控性更高。
- workflow 启用前必须在仓库 Settings → Branches → main → Branch protection 里勾上「Require status checks: review/verdict」,否则 verdict=fail 不会真卡合并。

### 「无 ReproSpec」与「docs-only PR」的处理(bootstrap 与日常)

WORKFLOW.md 的 review 标准 1 是「套件 1 verdict=pass」,但有两类 PR 不该被这条卡:

1. **Bootstrap PR**:本计划与套件 1 都还没合并,`fixtures/repro-specs/` 还是空 —— 第一份 PR 自己也跑不出 verdict。
2. **Docs-only / 工具脚本 / CI 配置 PR**:WORKFLOW.md 没写"每个 PR 必须有 ReproSpec",所以「不需要复现验证的 PR」是合法存在。

**策略(本 plan 显式定义)**:repro 标准在以下两种情况自动通过(workflow log 出 warning,但 verdict=pass):

- (A) 仓库里 `fixtures/repro-specs/*.ts` 完全为空(具体实现见 Task 3 的 `list-specs` job 输出 `[]`,verdict job 把 `repro_ok=true` + summary 写明「no specs to run」)
- (B) PR 带 `skip-repro` label (适用于 docs-only / CI / 工具脚本 PR;贴 label 的人显式声明「这个 PR 不需要 repro 证明」)

**反例**:有 ReproSpec 但 verdict=fail/ambiguous,**不能** skip,必须卡合并。`skip-repro` 也无效(显式拒绝绕过)。

这条豁免不破坏 WORKFLOW.md 立场:WORKFLOW.md 是「需要 repro 证明的 feature 必须有 ReproSpec 且 pass」;本豁免是「显式说不需要 repro 的 PR」的处理 —— 责任在贴 label 的人(可在 PR review 时被人工挑战)。

## File Structure

```
.github/workflows/
  pr-review.yml                 ← 主 workflow
.github/actions/setup-repo/
  action.yml                    ← 复用的 composite action(checkout+node+pnpm+install)
scripts/review/
  post-pr-comment.ts            ← 把 review-verdict.json 渲染成 PR 评论 + 设 commit status
  post-pr-comment.test.ts       ← node:test 单测,只测渲染纯逻辑
```

---

## Task 1: 复用的 composite action

**Files:**
- Create: `.github/actions/setup-repo/action.yml`

> 抽出来是因为后面的 plan(auto-merge / 6h release)会复用同一段 setup,DRY。

- [ ] **Step 1: 写 action.yml**

```yaml
# .github/actions/setup-repo/action.yml
name: Setup repo (checkout + pnpm + install)
description: 标准化的 repo 准备 —— checkout PR head sha + 装 pnpm/node + frozen install
inputs:
  ref:
    description: 要 checkout 的 ref(默认 = github.event.pull_request.head.sha)
    required: false
    default: ${{ github.event.pull_request.head.sha }}
  node-version:
    description: Node 版本
    required: false
    default: '22'
runs:
  using: composite
  steps:
    - uses: actions/checkout@v5
      with:
        ref: ${{ inputs.ref }}
        fetch-depth: 0          # review 标准 2 需要 git merge-base / merge-tree,要全历史
    - uses: pnpm/action-setup@v5
    - uses: actions/setup-node@v5
      with:
        node-version: ${{ inputs.node-version }}
        cache: pnpm
    - run: pnpm install --frozen-lockfile
      shell: bash
```

- [ ] **Step 2: commit**

```bash
git add .github/actions/setup-repo/action.yml
git commit -m "feat(ci): add setup-repo composite action — DRY checkout+pnpm+install"
```

---

## Task 2: `post-pr-comment.ts` —— 把 review-verdict.json 渲染成评论

**Files:**
- Create: `scripts/review/post-pr-comment.ts`
- Test: `scripts/review/post-pr-comment.test.ts`

- [ ] **Step 1: 写失败测试(纯渲染部分)**

```ts
// scripts/review/post-pr-comment.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderComment, COMMENT_MARKER } from "./post-pr-comment.ts";
import type { ReviewResult } from "./review-types.ts";

const passResult: ReviewResult = {
  generatedAt: "2026-05-15T10:00:00.000Z", verdict: "pass",
  criteria: [
    { id: "repro-pass", ok: true, summary: "verdict=pass", details: "" },
    { id: "tests-and-merge-clean", ok: true, summary: "tests pass + tree clean", details: "" },
  ],
};
const failResult: ReviewResult = {
  generatedAt: "2026-05-15T10:00:00.000Z", verdict: "fail",
  criteria: [
    { id: "repro-pass", ok: false, summary: "verdict=fail", details: "before 期望未达: stdout 缺关键字 deny" },
    { id: "tests-and-merge-clean", ok: true, summary: "tests pass + tree clean", details: "" },
  ],
  fixDirective: { failureKind: "repro-fail", prompt: "..." },
};

test("renderComment: pass 评论开头有 ✅", () => {
  const c = renderComment(passResult, { commitSha: "abc1234", workflowRunUrl: "https://x" });
  assert.match(c, /✅/);
  assert.match(c, /verdict.*pass/i);
  assert.ok(c.startsWith(COMMENT_MARKER));   // 必须以 marker 开头,便于覆盖更新
});

test("renderComment: fail 评论含 ❌ + 失败原因 + 链接", () => {
  const c = renderComment(failResult, { commitSha: "abc1234", workflowRunUrl: "https://x" });
  assert.match(c, /❌/);
  assert.match(c, /repro-fail|verdict=fail/);
  assert.match(c, /缺关键字 deny/);
  assert.match(c, /https:\/\/x/);
});

test("COMMENT_MARKER 是 hidden HTML comment,grep 唯一", () => {
  assert.match(COMMENT_MARKER, /^<!-- /);
  assert.match(COMMENT_MARKER, /pr-review-bot/);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx tsx --test scripts/review/post-pr-comment.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// scripts/review/post-pr-comment.ts
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { ReviewResult } from "./review-types.ts";

export const COMMENT_MARKER = "<!-- pr-review-bot:verdict-comment -->";

export function renderComment(r: ReviewResult, ctx: { commitSha: string; workflowRunUrl: string }): string {
  const emoji = r.verdict === "pass" ? "✅" : "❌";
  const head = `${COMMENT_MARKER}\n## ${emoji} 远程评审 verdict: **${r.verdict}**`;
  const meta = `\n\n_commit \`${ctx.commitSha.slice(0, 7)}\` · [workflow run](${ctx.workflowRunUrl}) · ${r.generatedAt}_`;
  const criteriaTable = [
    "",
    "| 标准 | 结果 | 简述 |",
    "|---|---|---|",
    ...r.criteria.map((c) => `| \`${c.id}\` | ${c.ok ? "✅" : "❌"} | ${escapeMd(c.summary)} |`),
  ].join("\n");
  const details = r.criteria.filter((c) => !c.ok && c.details).map((c) => [
    "", `### ❌ ${c.id} 详情`, "```", c.details.slice(0, 4000), "```",
  ].join("\n")).join("\n");
  const guide = r.verdict === "fail"
    ? `\n\n---\n_要修这个失败,请在本地按 \`docs/plans/2026-05-15-local-review-loop.md\` 跑 \`loop-driver.ts\`,push 修复 commit 即可触发本评论刷新。_`
    : "";
  return head + meta + criteriaTable + details + guide;
}

function escapeMd(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

interface CliOpts { verdictFile: string; pr: number; sha: string; runUrl: string; }
function parseArgv(argv: string[]): CliOpts {
  const o: CliOpts = { verdictFile: "", pr: 0, sha: "", runUrl: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--verdict") o.verdictFile = argv[++i];
    else if (a === "--pr") o.pr = Number(argv[++i]);
    else if (a === "--sha") o.sha = argv[++i];
    else if (a === "--run-url") o.runUrl = argv[++i];
  }
  if (!o.verdictFile || !o.pr || !o.sha || !o.runUrl) throw new Error("用法: --verdict <path> --pr <n> --sha <sha> --run-url <url>");
  return o;
}

function postOrUpdateComment(pr: number, body: string): void {
  // 找现有的 marker 评论
  const list = spawnSync("gh", ["pr", "view", String(pr), "--json", "comments"], { encoding: "utf-8" });
  if (list.status !== 0) throw new Error(`gh pr view 失败: ${list.stderr}`);
  const comments: Array<{ id?: string; body?: string }> = JSON.parse(list.stdout).comments ?? [];
  const existing = comments.find((c) => (c.body ?? "").startsWith(COMMENT_MARKER));
  if (existing && existing.id) {
    // gh 不直接支持 update comment,用 API
    const r = spawnSync("gh", ["api", `--method`, `PATCH`,
      `repos/${process.env.GITHUB_REPOSITORY}/issues/comments/${existing.id}`,
      "-f", `body=${body}`,
    ], { encoding: "utf-8" });
    if (r.status !== 0) throw new Error(`update comment 失败: ${r.stderr}`);
  } else {
    const r = spawnSync("gh", ["pr", "comment", String(pr), "--body", body], { encoding: "utf-8" });
    if (r.status !== 0) throw new Error(`gh pr comment 失败: ${r.stderr}`);
  }
}

function setCommitStatus(sha: string, state: "success" | "failure", description: string, runUrl: string): void {
  const r = spawnSync("gh", ["api", "--method", "POST",
    `repos/${process.env.GITHUB_REPOSITORY}/statuses/${sha}`,
    "-f", `state=${state}`,
    "-f", `context=review/verdict`,
    "-f", `description=${description}`,
    "-f", `target_url=${runUrl}`,
  ], { encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`set commit status 失败: ${r.stderr}`);
}

function main(): void {
  const o = parseArgv(process.argv.slice(2));
  const verdict: ReviewResult = JSON.parse(readFileSync(o.verdictFile, "utf-8"));
  const body = renderComment(verdict, { commitSha: o.sha, workflowRunUrl: o.runUrl });
  postOrUpdateComment(o.pr, body);
  setCommitStatus(o.sha, verdict.verdict === "pass" ? "success" : "failure",
    `${verdict.verdict === "pass" ? "全部通过" : "verdict=fail"} (${verdict.criteria.filter((c) => !c.ok).length} 项 fail)`,
    o.runUrl);
  console.log(`[post-pr-comment] verdict=${verdict.verdict},评论 + status 已更新`);
}

if (process.argv[1] && process.argv[1].endsWith("post-pr-comment.ts")) main();
```

- [ ] **Step 4: 跑测试通过**

Run: `npx tsx --test scripts/review/post-pr-comment.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: commit**

```bash
git add scripts/review/post-pr-comment.ts scripts/review/post-pr-comment.test.ts
git commit -m "feat(review): add post-pr-comment — render verdict + post/update PR comment + set status"
```

---

## Task 3: `pr-review.yml` —— 主 workflow

**Files:**
- Create: `.github/workflows/pr-review.yml`

- [ ] **Step 1: 写 workflow**

```yaml
# .github/workflows/pr-review.yml
name: PR Review (远程 CC 自动评审)

on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

# 只跑仓库内 PR;外部 fork 自动 skip(下方 if 守门)
permissions:
  contents: read
  pull-requests: write
  statuses: write

# 同 PR 多 commit 只跑最新一次,省 CI 分钟
concurrency:
  group: pr-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  list-specs:
    if: github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    outputs:
      specs: ${{ steps.list.outputs.specs }}
      skipReproReason: ${{ steps.list.outputs.skipReason }}
    steps:
      - uses: actions/checkout@v5
        with: { ref: ${{ github.event.pull_request.head.sha }} }
      - id: list
        shell: bash
        env:
          PR_LABELS: ${{ toJson(github.event.pull_request.labels.*.name) }}
        run: |
          # 显式豁免 (A): PR 带 skip-repro label
          if echo "$PR_LABELS" | jq -e '. | index("skip-repro")' >/dev/null; then
            echo "specs=[]" >> "$GITHUB_OUTPUT"
            echo "skipReason=skip-repro label" >> "$GITHUB_OUTPUT"
            echo "::notice::PR 带 skip-repro label —— 跳过 repro 检查"
            exit 0
          fi
          # 列 fixtures/repro-specs/*.ts(排除 README/index/共享文件)
          if [[ ! -d fixtures/repro-specs ]]; then
            echo "specs=[]" >> "$GITHUB_OUTPUT"
            echo "skipReason=no-repro-specs-dir" >> "$GITHUB_OUTPUT"
            echo "::warning::fixtures/repro-specs 目录不存在 —— bootstrap 期豁免,跳过 repro 检查"
            exit 0
          fi
          mapfile -t files < <(find fixtures/repro-specs -maxdepth 1 -name '*.ts' ! -name 'index.ts' | sort)
          if [[ ${#files[@]} -eq 0 ]]; then
            echo "specs=[]" >> "$GITHUB_OUTPUT"
            echo "skipReason=empty-repro-specs-dir" >> "$GITHUB_OUTPUT"
            echo "::warning::fixtures/repro-specs 为空 —— bootstrap 期豁免,跳过 repro 检查"
            exit 0
          fi
          json=$(printf '%s\n' "${files[@]}" | jq -R . | jq -sc .)
          echo "specs=$json" >> "$GITHUB_OUTPUT"
          echo "skipReason=" >> "$GITHUB_OUTPUT"
          echo "找到 spec: ${files[*]}"

  repro:
    needs: list-specs
    if: needs.list-specs.outputs.specs != '[]'
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        spec: ${{ fromJson(needs.list-specs.outputs.specs) }}
    steps:
      - uses: ./.github/actions/setup-repo
      - name: Build teamagent (有的 spec 跑 dist/bin.js)
        run: pnpm --filter teamagent build
      - name: Run repro
        run: |
          slug=$(basename "${{ matrix.spec }}" .ts)
          mkdir -p "/tmp/repro-out/$slug"
          npx tsx scripts/verify/repro-cli.ts "${{ matrix.spec }}" --no-gif \
            --out "/tmp/repro-out/$slug"
        # ↑ 退出码 0/1 反映 verdict;不要 ||true,要让失败浮出来
      - uses: actions/upload-artifact@v4
        with:
          name: repro-${{ strategy.job-index }}
          path: /tmp/repro-out/

  tests:
    runs-on: ubuntu-latest
    if: github.event.pull_request.head.repo.full_name == github.repository
    steps:
      - uses: ./.github/actions/setup-repo
      - name: pnpm test
        run: pnpm test
      - name: Working tree must be clean
        shell: bash
        run: |
          if [[ -n "$(git status --porcelain)" ]]; then
            echo "::error::tests 跑完后工作树不干净:"
            git status --porcelain
            exit 1
          fi

  verdict:
    needs: [list-specs, repro, tests]
    if: always() && github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/setup-repo
      - name: Download all repro artifacts
        uses: actions/download-artifact@v4
        with:
          path: /tmp/repro-out-all
          pattern: repro-*
          merge-multiple: true
      - name: Aggregate verdict
        shell: bash
        env:
          REPRO_OUTCOME: ${{ needs.repro.result }}                # success / failure / skipped / cancelled
          TESTS_OUTCOME: ${{ needs.tests.result }}
          SKIP_REPRO_REASON: ${{ needs.list-specs.outputs.skipReproReason }}
        run: |
          mkdir -p /tmp/agg
          # repro_ok 计算(三态豁免见安全前提):
          #   - REPRO_OUTCOME = success → ok
          #   - REPRO_OUTCOME = skipped 且 SKIP_REPRO_REASON 非空 → ok(显式豁免:bootstrap / docs-only)
          #   - 其它 → 不 ok
          if [[ "$REPRO_OUTCOME" == "success" ]]; then
            repro_ok=true
            repro_summary="verdict=pass (all specs)"
          elif [[ "$REPRO_OUTCOME" == "skipped" && -n "$SKIP_REPRO_REASON" ]]; then
            repro_ok=true
            repro_summary="豁免 — $SKIP_REPRO_REASON"
          else
            repro_ok=false
            repro_summary="verdict=fail/missing (REPRO_OUTCOME=$REPRO_OUTCOME)"
          fi
          if [[ "$TESTS_OUTCOME" == "success" ]]; then
            tests_ok=true
            tests_summary="tests pass + tree clean"
          else
            tests_ok=false
            tests_summary="tests failed or tree dirty (TESTS_OUTCOME=$TESTS_OUTCOME)"
          fi
          verdict=$([[ "$repro_ok" == "true" && "$tests_ok" == "true" ]] && echo "pass" || echo "fail")
          jq -n \
            --arg generatedAt "$(date -u +%FT%TZ)" \
            --arg verdict "$verdict" \
            --argjson repro_ok "$repro_ok" \
            --argjson tests_ok "$tests_ok" \
            --arg repro_summary "$repro_summary" \
            --arg tests_summary "$tests_summary" \
            '{
              generatedAt: $generatedAt, verdict: $verdict,
              criteria: [
                {id:"repro-pass", ok:$repro_ok, summary:$repro_summary, details:""},
                {id:"tests-and-merge-clean", ok:$tests_ok, summary:$tests_summary, details:""}
              ]
            }' > /tmp/agg/review-verdict.json
          cat /tmp/agg/review-verdict.json
      - name: Post comment + set status
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}
        run: |
          npx tsx scripts/review/post-pr-comment.ts \
            --verdict /tmp/agg/review-verdict.json \
            --pr ${{ github.event.pull_request.number }} \
            --sha ${{ github.event.pull_request.head.sha }} \
            --run-url "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
```

> **设计权衡**:
> - `verdict` job 用 `if: always()` —— 不管 `repro` / `tests` job 怎么挂,都跑一次去发评论。否则 PR 上不显示任何 verdict,体验差。
> - 汇总用 shell + jq,不再调 review-cli —— 因为 review-cli 跑 `pnpm test`,会跟 `tests` job 重复 30 分钟。这里只把已知 outcome 拼成 `review-verdict.json` 走 post-pr-comment 的渲染。
> - `repro` 用 matrix:每个 spec 独立 job → 一个 spec 挂不影响别的 spec,日志清晰。

- [ ] **Step 2: 触发 dry run**

把 workflow 推到一个新分支 + 开个 toy PR 触发:

```bash
git checkout -b feat/remote-review-bot
git add .github/workflows/pr-review.yml
git commit -m "feat(ci): add pr-review.yml — remote CC verdict workflow (dry run)"
git push origin feat/remote-review-bot
gh pr create --base main --head feat/remote-review-bot --title "feat(ci): pr-review.yml dry run" --body "Trigger pr-review workflow once."
# 观察:
gh run watch
# 在 PR 页面看到一条「✅/❌ 远程评审 verdict」评论 + 一个名为 `review/verdict` 的 commit status
```

Expected:
- workflow 跑完 ≤ 15 分钟(具体看 spec 数量)
- PR 出现一条 verdict 评论
- PR 出现一个 `review/verdict` 的 commit status
- 若现有 spec 全过且测试全过 → status=success;否则 status=failure 并卡住合并

- [ ] **Step 3: 在仓库 Settings 开 branch protection**

在 GitHub UI 里,Settings → Branches → main → Edit:
- Require a pull request before merging: ✅
- Require status checks to pass before merging: ✅
  - 添加 `review/verdict` 到必须通过列表

(此步无 git 操作,不需要 commit。补一份 ADR 或在 INDEX 里说明即可。)

- [ ] **Step 4: commit + 合并 dry run PR**

```bash
git add .github/workflows/pr-review.yml
git commit --amend --no-edit
git push --force-with-lease origin feat/remote-review-bot
# 看 PR 跑通,然后:
gh pr merge --squash --delete-branch
```

---

## Self-Review

**1. Spec coverage:** WORKFLOW.md 第 5 步 4 条:① 普通 PR(本计划用 `pull_request` 触发);② 远程独立复核 → 三个 needs job 全独立运行;③ 同 2 条标准 → `repro` job + `tests` job 各对应一条;④ verdict 反馈机制 → PR 评论 + commit status + branch protection。**已知缺口**:外部 fork PR 不支持(显式声明,见安全前提);若需要支持,要走 `pull_request_target` + 严格 secret 审计,属于另一个子系统。

**2. Placeholder scan:** 无 TBD/TODO。`tests` job 的 `pnpm test` 是真命令(对应主仓库已有的 ci.yml 范式)。`renderComment` 实现完整,`postOrUpdateComment`/`setCommitStatus` 用 `gh api` 真调用。

**3. Type consistency:** `ReviewResult` 来自 `review-types.ts`(local-review-loop plan Task 1 定义);本 plan 复用同一类型不重复定义。`COMMENT_MARKER` 在 Task 2 唯一定义、唯一使用;新评论与更新都通过它去重。

## Execution Handoff

Plan complete. 推荐执行路径:

1. **前置**:本地 review 循环 plan(`2026-05-15-local-review-loop.md`)Task 1(types)+ Task 2(review-core)需先完成 —— 本计划复用其类型与 verdict 渲染概念。
2. **执行**:Task 1–3 串行(Task 3 依赖 Task 1 的 composite action)。
3. **验收**:PR 上看到 ✅/❌ 评论 + `review/verdict` status check 出现;branch protection 真卡住失败的 PR。
