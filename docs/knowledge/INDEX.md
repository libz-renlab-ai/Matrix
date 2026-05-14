# Project Knowledge Index

This index records how TeamAgent project knowledge is stored and propagated.
Root `CLAUDE.md` should stay small and human-maintained; learned behavior should
flow through this docs index and project Skills instead of a generated managed
block.

## New Rule Ingestion

- New rules are saved to the knowledge database with structured fields as soon
  as they are accepted.
- Ingestion also best-effort syncs BM25/FTS and semantic vector indexes so the
  runtime matcher can retrieve the new rule without a separate manual migration.
- Interactive entry points such as `teamagent pitfall` synchronously write
  trigger/pattern vectors when possible.
- Tool-context descriptions and tool vectors may be filled in asynchronously in
  the background; this must not block the user command.

## Docs And Skills Propagation

- Stop hook propagation completes missing vector/index data and refreshes the
  project-facing knowledge surfaces.
- Human-readable project knowledge belongs in `docs/knowledge/INDEX.md` or a
  more specific document linked from this index.
- Agent-facing executable guidance belongs in project Skills under
  `.codex/skills/<name>/SKILL.md`.
- Root `CLAUDE.md` should link to the knowledge index and keep only stable,
  short, human-maintained agreements.
- Generated rule dumps must not be written back into root `CLAUDE.md`.

## Migrations

- `migrate-v6` and `migrate-v7` are backfill commands for old rules or rules
  missing newer structured fields.
- Normal new rule ingestion should not require the user to run `migrate-v6` or
  `migrate-v7` manually.

## 工作流(Workflow)

本项目从 issue 到 release 的唯一权威工作流:

- **完整工作流**(issue → 挖方案 → 执行 → 本地 review → PR → 远程 review →
  合并 → 每 6h release):[`../WORKFLOW.md`](../WORKFLOW.md)。
- **认领锁**(grill 锁 / 执行锁:上锁 / 释放 / 查状态 / 24h 自动撤):
  [`../CLAIM-LOCK.md`](../CLAIM-LOCK.md)。

`WORKFLOW.md` 取代了旧的 FIXEDFLOW / Symphony / 双 driver 整套机制
(见 `WORKFLOW.md` 文末「本文档取代了什么」)。

## Product Features

When asked about product features:

- **All verified features** (full inventory, including for CEO/VC deck use):
  [`../PRODUCT-FEATURES.md`](../PRODUCT-FEATURES.md).
