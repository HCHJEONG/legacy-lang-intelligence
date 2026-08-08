import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { buildBaselineCoverageReport, renderCoverageMarkdown } from "../src/lib/analysis/coverage-report";

async function main() {
  const inputPath = path.resolve("analysis-output", "carddemo-normalized-ir.json");
  const jsonOutputPath = path.resolve("analysis-output", "carddemo-coverage-report.json");
  const markdownOutputPath = path.resolve("analysis-output", "carddemo-coverage-report.md");
  const input = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
  const report = buildBaselineCoverageReport(input);

  await mkdir(path.dirname(jsonOutputPath), { recursive: true });
  await writeFile(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownOutputPath, renderCoverageMarkdown(report), "utf8");

  console.log(`Coverage report for ${report.projectName}`);
  console.log(`Entity coverage: ${(report.coverage.entityCoverage * 100).toFixed(1)}%`);
  console.log(`Relation coverage: ${(report.coverage.relationCoverage * 100).toFixed(1)}%`);
  console.log(`Evidence coverage: ${(report.coverage.evidenceCoverage * 100).toFixed(1)}%`);
  console.log(`Unresolved findings: ${report.coverage.unresolvedCount}`);
  console.log(`Wrote ${jsonOutputPath}`);
  console.log(`Wrote ${markdownOutputPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
