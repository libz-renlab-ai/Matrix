```
 ____  ____  ___  ____  _  _  ___  ____    ____  ____  __   ____  _  _  ____  ____  ____
(  _ \(  _ \/ _ \(  _ \/ )( \/ __)(_  _)  (  __)(  __)(  ) (  __)/ )( \(  _ \(  __)/ ___)
 ) __/ )   /( (_) )) __/) \/ (( (__  )(    ) _)  ) _)  )(   ) _) ) \/ ( )   / ) _) \___ \
(__)  (__\_) \___/(__)  \____/ \___)  (__)  (__)  (____)(__) (____)\____/(__\_)(____)(____/
```

# TeamAgent Product Feature Inventory

Complete feature list — what TeamAgent ships. When asked "list all product
features", use this document.

---

## Features (64)

### Core learning loop
1. Product menu opens; system is not an empty shell
2. Minimum learning loop: record → compile → attribute, demoable end-to-end
3. AI warned before repeating known mistake; wrong moves blocked pre-execution
4. Correct AI once; system remembers and reuses that lesson automatically
5. Useful knowledge grows more trusted; stale knowledge auto-demoted
6. Visible stats: count of learnings, layers, recent additions
7. User can proactively record a pitfall without waiting for AI to fail
8. Safe sandbox: test changes in isolation before touching main workspace
9. Stable canned-answer rules: POSTPR/DOGFOOD/BUGREPORT/FASTPROBE/PRESHIP/etc.

### Auto-capture & extraction
10. Auto-capture corrections from every session (Stop hook)
11. Real-session extraction judge: recall ≥ 100% on labeled fixtures
12. Correction-detector handles real JSONL session shapes

### Calibrator v2
13. Calibrator emits `calibrator.adjustment` events on user-reject signals
14. Calibrator v2: Wilson LB + 5-tier confidence bands
15. Validator emits `validator.failure` events on bad rule patterns

### Rule quality & matching
16. Rule-quality validator: identical_patterns, confidence_range, missing_fields
17. Rule-quality validator: embedding_conflict detection
18. Rule-quality canned-answer verified
19. Matcher B-055: word-boundary guard prevents wrong_pattern over-fire
20. Matcher scope: file_types / paths glob filtering correct

### Team knowledge sharing & sync
21. Three-layer knowledge scope: personal / team / global
22. Team-scope knowledge export/import between projects
23. Cross-machine sync via `teamagent sync push|pull`
24. `sync push` writes rules to remote git branch
25. `sync pull` merges remote rules into local store

### PII redaction
26. PII redactor covers API keys, JWT, phone, credit card, AWS key
27. PII redactor scrubs data before team-share export

### Multi-tool & IDE integration
28. PreToolUse hook intercepts tool calls pre-execution
29. Stop hook scans AI narrative for avoidance patterns
30. AttributionBus emits structured attribution events
31. MCP server `check_pitfall` handshake (initialize/tools-list/tools-call)
32. `check_pitfall` calls into core matcher and returns matched rules
33. Cursor `.cursorrules` compiler: exports top-N rules as Cursor-compatible file

### Doctor / install diagnostics
34. `teamagent doctor` reports hook-registered status
35. `teamagent doctor` reports plugin-sync status
36. `teamagent doctor` reports mcp-reachable status
37. hook-registered PreToolUse hook detected correctly after install

### A/B benchmark
38. A/B benchmark harness: arm-A (bare Claude) vs arm-B (TeamAgent rules)
39. Benchmark produces per-arm avoidance-rate metrics
40. Benchmark judge.json written with exit_code + metrics + evidence_dir

### CLI commands
41. `teamagent skeleton-demo` (M0 walking skeleton)
42. `teamagent pitfall` interactive + non-interactive
43. `teamagent stats` knowledge statistics
44. `teamagent verify` feature verification runner
45. `teamagent calibrate` calibrator trigger
46. `teamagent analyze` session analysis
47. `teamagent review` PR-cycle review
48. `teamagent install-hook` / `uninstall-hook`
49. `teamagent mcp-server` stdio MCP server entrypoint

### Viral spread & auto-sync (M5)
50. SessionStart hook auto-infects projects with `.teamagent/manifest.json` contract
51. Manifest contract propagates via git to teammates (zero-config team enrollment)
52. Auto-bootstrap fills missing plugins / hooks on `git clone` per project manifest
53. Secret scanner gate seals API keys / JWT / phone / CC / paths in personal layer (uncloseable)
54. Scope classifier categorizes new rules into personal / shareable / uncertain (uncertain → personal by default)
55. LWW + tombstone conflict resolution merges concurrent edits and deletes deterministically
56. `pitfall` auto-share: clean rules promote to `.teamagent/team/<author>/` via gates 1+2 (default on)
57. `m5-publish` auto-commits team-rule changes with `[teamagent-sync]` prefix
58. post-merge hook auto-pulls team rules into local KB after every `git pull`

### First-run & install
59. 首次运行向导：装完立刻提示 3 件可以做的事 + 记住进度
60. One-line `curl|sh` installer at `release/install.sh`: gates `node ≥ 22`, picks `npm`/`pnpm`, runs release-tarball install with deterministic exit codes
61. Universal seed pack: 12 substring-friendly cross-language avoidance rules ship out-of-box, hit legacy keyword matcher within 30s of `teamagent init`
62. `teamagent pack list/add/remove` + `init` agent-driven markdown prompt (v1 contract per ADR 0002)
63. `teamagent demo` three modes: default (poll `events.db`) / `--inline` (spawn real hook bin, render ANSI deny box) / `--record` (emit vhs tape) — landing GIF source + first-experience stage
64. Two-stage `teamagent init`: detached background warmup + `~/.teamagent/.warmup-state.json` driving auto-fallback to legacy substring matcher until the vector model is `ready`; `teamagent doctor` reports the live state

---

## Biggest known limitations (residual, not blockers)

1. **Cross-machine sync requires a shared git remote** — not fully zero-config.
2. **Cursor compiler writes a static file** — live sync on rule changes requires IDE reload.
3. **MCP server starts with an empty rule store** — caller must seed rules via `setRules()` or load from SQLite.
