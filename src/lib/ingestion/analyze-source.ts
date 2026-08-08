import path from "node:path";

import { analyzeDiscoveredFiles } from "@/lib/analysis/static-analysis";
import { normalizeBaselineAnalysis } from "@/lib/analysis/baseline-adapter";
import { discoverSourceFiles } from "@/lib/analysis/discovery";
import { persistNormalizedAnalysis, type PersistNormalizedAnalysisResult } from "@/lib/db/persist-normalized-analysis";

type SourceProject = {
  id: string;
  name: string;
};

export async function analyzeAndPersistSource(
  sourceRoot: string,
  project: SourceProject,
  databasePath = path.resolve("analysis-output", "carddemo.sqlite"),
): Promise<{ normalized: ReturnType<typeof normalizeBaselineAnalysis>; persistence: PersistNormalizedAnalysisResult }> {
  const files = await discoverSourceFiles(sourceRoot);
  const analysis = await analyzeDiscoveredFiles(sourceRoot, files);
  const normalized = normalizeBaselineAnalysis(analysis, project);
  if (normalized.entities.length === 0) {
    throw new Error("No analyzable COBOL, Copybook, or JCL entities were found. The current analysis was not replaced.");
  }
  const persistence = persistNormalizedAnalysis(normalized, databasePath);
  return { normalized, persistence };
}
