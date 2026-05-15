// scripts/verify/list-specs-core.ts
//
// Issue #3 Gap 1 纯逻辑核心:把已发现的 ReproSpec 列表按 ci.skip 分桶。
//
// 严禁 import fs / child_process —— functional core,IO 在 list-ci-specs.ts。

/** ReproSpec 的 CI 行为配置子集(完整定义在 repro-types.ts 的 SpecCi)。 */
export interface SpecCi {
  /** true 时:CI 上跑 list-specs 时把这条 spec 过滤掉,verdict 把它当豁免。 */
  skip?: boolean;
  /** 给人看的跳过原因。pr-review.yml 的 verdict comment 会展示。 */
  reason?: string;
}

/** list-specs job 从磁盘读到的 spec 概要 —— 只关心 ci 字段,不关心 spec 全部内容。 */
export interface DiscoveredSpec {
  /** spec 文件相对路径,例如 "fixtures/repro-specs/hook-moment-block.ts" */
  file: string;
  ci?: SpecCi;
}

/** filterCiSpecs 的产出:included 喂 repro matrix,excluded 喂 verdict 的豁免列表。 */
export interface FilterResult {
  included: string[];
  excluded: Array<{ file: string; reason: string }>;
}

/**
 * 按 ci.skip 分桶。语义:
 *   - ci 缺省 / ci.skip = false / ci.skip 缺省 → included
 *   - ci.skip === true → excluded;reason = ci.reason ?? "ci.skip = true"
 *
 * 保序:输入顺序在 included 与 excluded 内部都保留。
 */
export function filterCiSpecs(specs: DiscoveredSpec[]): FilterResult {
  const included: string[] = [];
  const excluded: Array<{ file: string; reason: string }> = [];
  for (const s of specs) {
    if (s.ci?.skip === true) {
      excluded.push({ file: s.file, reason: s.ci.reason ?? "ci.skip = true" });
    } else {
      included.push(s.file);
    }
  }
  return { included, excluded };
}
