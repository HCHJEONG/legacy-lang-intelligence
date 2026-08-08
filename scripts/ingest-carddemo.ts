import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { discoverSourceFiles } from "../src/lib/analysis/discovery";
import { analyzeDiscoveredFiles } from "../src/lib/analysis/static-analysis";
import { normalizeBaselineAnalysis } from "../src/lib/analysis/baseline-adapter";

const CARDDEMO_REPO_URL = "https://github.com/aws-samples/aws-mainframe-modernization-carddemo.git";

async function main() {
  const sourceRoot = await resolveSourceRoot();
  const files = await discoverSourceFiles(sourceRoot);
  const analysis = await analyzeDiscoveredFiles(sourceRoot, files);
  const normalized = normalizeBaselineAnalysis(analysis);
  const outputPath = path.resolve("analysis-output", "carddemo-analysis.json");
  const normalizedOutputPath = path.resolve("analysis-output", "carddemo-normalized-ir.json");

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  await writeFile(normalizedOutputPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

  console.log(`Analyzed ${analysis.files.length} files from ${analysis.sourceRoot}`);
  console.log(`Entities: ${analysis.entities.length}`);
  console.log(`Dependencies: ${analysis.dependencies.length}`);
  console.log(`Normalized entities: ${normalized.entities.length}`);
  console.log(`Normalized relations: ${normalized.relations.length}`);
  console.log(`Unresolved findings: ${normalized.coverage.unresolvedCount}`);
  console.log(`Evidence coverage: ${(normalized.coverage.evidenceCoverage * 100).toFixed(1)}%`);
  console.log(`Wrote ${outputPath}`);
  console.log(`Wrote ${normalizedOutputPath}`);
}

async function resolveSourceRoot(): Promise<string> {
  const explicitSource = process.env.CARDDEMO_SOURCE_DIR;
  if (explicitSource) {
    const resolved = path.resolve(explicitSource);
    if (!existsSync(resolved)) {
      throw new Error(`CARDDEMO_SOURCE_DIR does not exist: ${resolved}`);
    }
    return resolved;
  }

  const cacheRoot = path.resolve(".cache", "carddemo");
  if (existsSync(path.join(cacheRoot, ".git"))) {
    return cacheRoot;
  }

  await mkdir(path.dirname(cacheRoot), { recursive: true });
  console.log(`Cloning CardDemo into ${cacheRoot}`);
  execFileSync("git", ["clone", "--depth", "1", CARDDEMO_REPO_URL, cacheRoot], {
    stdio: "inherit",
  });

  return cacheRoot;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
