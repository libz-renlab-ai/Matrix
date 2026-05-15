// scripts/verify/list-ci-specs.ts
//
// IO 壳:发现 fixtures/repro-specs/*.ts → 动态 import → 抽 ci 字段 →
// 调 list-specs-core.filterCiSpecs → 把 { included, excluded } JSON 打到 stdout。
//
// 给 pr-review.yml 的 list-specs job 读。issue #3 Gap 1 替换原来 inline bash 的
// find ... -name '*.ts' 逻辑(那条没法读 spec.ci 字段)。

import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { filterCiSpecs, type DiscoveredSpec } from "./list-specs-core.ts";
import type { ReproSpec } from "./repro-types.ts";

const SPEC_DIR = "fixtures/repro-specs";

async function main(): Promise<void> {
  // 目录不存在 → 等价 empty(让 verdict 走「bootstrap 期豁免」路径)
  if (!existsSync(SPEC_DIR)) {
    process.stdout.write(JSON.stringify({ included: [], excluded: [], note: "no-repro-specs-dir" }) + "\n");
    return;
  }

  // 列 *.ts(排除 README/index/共享文件)。windows 上 path.sep = '\\',统一成 '/'。
  const files = readdirSync(SPEC_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts")
    .map((f) => path.posix.join(SPEC_DIR, f))
    .sort();

  if (files.length === 0) {
    process.stdout.write(JSON.stringify({ included: [], excluded: [], note: "empty-repro-specs-dir" }) + "\n");
    return;
  }

  // 动态 import 每个 spec —— Windows 下 import 路径必须是 file:// URL
  const specs: DiscoveredSpec[] = [];
  for (const file of files) {
    const url = pathToFileURL(path.resolve(file)).href;
    const mod = await import(url);
    const spec: ReproSpec | undefined = mod.default ?? mod.spec;
    if (!spec || typeof spec.id !== "string") {
      // 异常 spec 不静默吞掉 —— 把它当作 included 让 repro job 自己 fail 出来,而不是 list-specs 帮忙掩盖
      specs.push({ file });
      continue;
    }
    specs.push({ file, ci: spec.ci });
  }

  const r = filterCiSpecs(specs);
  process.stdout.write(JSON.stringify(r) + "\n");
}

main().catch((e: Error) => {
  console.error(e);
  process.exit(1);
});
