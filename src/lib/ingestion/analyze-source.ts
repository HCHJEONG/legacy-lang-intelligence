import path from "node:path";

import { analyzeDiscoveredFiles } from "@/lib/analysis/static-analysis";
import { normalizeBaselineAnalysis } from "@/lib/analysis/baseline-adapter";
import { discoverSourceFiles } from "@/lib/analysis/discovery";
import { persistNormalizedAnalysis, type PersistNormalizedAnalysisResult } from "@/lib/db/persist-normalized-analysis";

export async function analyzeAndPersistSource(sourceRoot: string, databasePath = path.resolve("analysis-output", "carddemo.sqlite")): Promise<{ normalized: ReturnType<typeof normalizeBaselineAnalysis>; persistence: PersistNormalizedAnalysisResult }> {
  const files = await discoverSourceFiles(sourceRoot);
  const analysis = await analyzeDiscoveredFiles(sourceRoot, files);
  const normalized = normalizeBaselineAnalysis(analysis);
  const persistence = persistNormalizedAnalysis(normalized, databasePath);
  return { normalized, persistence };
}
