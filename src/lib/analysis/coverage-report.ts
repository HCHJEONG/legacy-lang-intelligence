import { NormalizedAnalysisRunSchema, type AnalyzerFinding, type NormalizedAnalysisRun } from "./normalized-ir";

export type CoverageHotspot = {
  key: string;
  count: number;
  category: string;
  targetName?: string;
  dependencyType?: string;
};

export type CoverageFileSummary = {
  filePath: string;
  entityCount: number;
  relationCount: number;
  findingCount: number;
};

export type BaselineCoverageReport = {
  generatedAt: string;
  projectName: string;
  sourceRoot: string;
  coverage: NormalizedAnalysisRun["coverage"];
  topUnresolved: CoverageHotspot[];
  relationResolution: Record<string, { total: number; resolved: number; unresolved: number; resolvedRatio: number }>;
  filesWithNoEntities: number;
  filesWithNoRelations: number;
  topFilesByFindings: CoverageFileSummary[];
  recommendedNextImprovements: string[];
};

export function buildBaselineCoverageReport(input: unknown): BaselineCoverageReport {
  const run = NormalizedAnalysisRunSchema.parse(input);
  const filePaths = new Set<string>();
  const fileEntityCounts = new Map<string, number>();
  const fileRelationCounts = new Map<string, number>();
  const fileFindingCounts = new Map<string, number>();

  for (const evidence of run.evidence) {
    filePaths.add(evidence.location.filePath);
  }

  for (const entity of run.entities) {
    if (!entity.sourceFilePath) {
      continue;
    }
    filePaths.add(entity.sourceFilePath);
    fileEntityCounts.set(entity.sourceFilePath, (fileEntityCounts.get(entity.sourceFilePath) ?? 0) + 1);
  }

  const evidenceById = new Map(run.evidence.map((evidence) => [evidence.id, evidence]));
  for (const relation of run.relations) {
    const relationFiles = new Set(
      relation.provenance
        .flatMap((provenance) => provenance.evidenceIds)
        .map((id) => evidenceById.get(id)?.location.filePath)
        .filter((filePath): filePath is string => Boolean(filePath)),
    );

    for (const filePath of relationFiles) {
      filePaths.add(filePath);
      fileRelationCounts.set(filePath, (fileRelationCounts.get(filePath) ?? 0) + 1);
    }
  }

  for (const finding of run.findings) {
    const filePath = finding.location?.filePath;
    if (!filePath) {
      continue;
    }
    filePaths.add(filePath);
    fileFindingCounts.set(filePath, (fileFindingCounts.get(filePath) ?? 0) + 1);
  }

  const fileSummaries = [...filePaths].map((filePath) => ({
    filePath,
    entityCount: fileEntityCounts.get(filePath) ?? 0,
    relationCount: fileRelationCounts.get(filePath) ?? 0,
    findingCount: fileFindingCounts.get(filePath) ?? 0,
  }));

  return {
    generatedAt: new Date().toISOString(),
    projectName: run.project.name,
    sourceRoot: run.project.sourceRoot,
    coverage: run.coverage,
    topUnresolved: topFindings(run.findings, 25),
    relationResolution: relationResolution(run),
    filesWithNoEntities: fileSummaries.filter((file) => file.entityCount === 0).length,
    filesWithNoRelations: fileSummaries.filter((file) => file.relationCount === 0).length,
    topFilesByFindings: fileSummaries
      .filter((file) => file.findingCount > 0)
      .sort((left, right) => right.findingCount - left.findingCount || left.filePath.localeCompare(right.filePath))
      .slice(0, 20),
    recommendedNextImprovements: recommendedNextImprovements(run.findings),
  };
}

export function renderCoverageMarkdown(report: BaselineCoverageReport): string {
  const lines = [
    "# CardDemo Baseline Coverage Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Project: ${report.projectName}`,
    `- Files total: ${report.coverage.filesTotal}`,
    `- Entity coverage: ${pct(report.coverage.entityCoverage)}`,
    `- Relation coverage: ${pct(report.coverage.relationCoverage)}`,
    `- Evidence coverage: ${pct(report.coverage.evidenceCoverage)}`,
    `- Entities: ${report.coverage.entityCount}`,
    `- Relations: ${report.coverage.relationCount}`,
    `- Evidence records: ${report.coverage.evidenceCount}`,
    `- Unresolved findings: ${report.coverage.unresolvedCount}`,
    "",
    "## Files By Kind",
    "",
    ...table(["Kind", "Count"], Object.entries(report.coverage.filesByKind)),
    "",
    "## Entity Types",
    "",
    ...table(["Entity Type", "Count"], Object.entries(report.coverage.entityTypes)),
    "",
    "## Relation Types",
    "",
    ...table(["Relation Type", "Count"], Object.entries(report.coverage.relationTypes)),
    "",
    "## Relation Resolution",
    "",
    ...table(
      ["Legacy Relation", "Total", "Resolved", "Unresolved", "Resolved %"],
      Object.entries(report.relationResolution).map(([type, stats]) => [
        type,
        stats.total,
        stats.resolved,
        stats.unresolved,
        pct(stats.resolvedRatio),
      ]),
    ),
    "",
    "## Confidence Distribution",
    "",
    ...table(["Band", "Count"], Object.entries(report.coverage.confidenceDistribution)),
    "",
    "## COBOL Normalization",
    "",
    ...normalizationLines(report),
    "",
    "## Top Unresolved Findings",
    "",
    ...table(
      ["Finding", "Count", "Dependency Type", "Target"],
      report.topUnresolved.map((finding) => [
        finding.key,
        finding.count,
        finding.dependencyType ?? "",
        finding.targetName ?? "",
      ]),
    ),
    "",
    "## Files With Most Findings",
    "",
    ...table(
      ["File", "Findings", "Entities", "Relations"],
      report.topFilesByFindings.map((file) => [
        file.filePath,
        file.findingCount,
        file.entityCount,
        file.relationCount,
      ]),
    ),
    "",
    "## Recommended Next Improvements",
    "",
    ...report.recommendedNextImprovements.map((item) => `- ${item}`),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

function normalizationLines(report: BaselineCoverageReport): string[] {
  const normalization = report.coverage.normalization;
  if (!normalization) {
    return ["No normalization metrics available."];
  }

  return [
    `- Files normalized: ${normalization.filesNormalized}`,
    `- Original lines: ${normalization.originalLineCount}`,
    `- Normalized lines: ${normalization.normalizedLineCount}`,
    `- Comment lines removed: ${normalization.commentLinesRemoved}`,
    `- Blank/empty lines removed: ${normalization.blankLinesRemoved}`,
    `- Header lines stripped: ${normalization.headerLinesRemoved}`,
    `- Continuation lines joined: ${normalization.continuationLinesJoined}`,
    `- Fixed-format likely files: ${normalization.fixedFormatLikelyFiles}`,
  ];
}

function topFindings(findings: AnalyzerFinding[], limit: number): CoverageHotspot[] {
  const counts = new Map<string, CoverageHotspot>();

  for (const finding of findings) {
    const dependencyType = stringMetadata(finding.metadata.dependencyType);
    const targetName = stringMetadata(finding.metadata.targetName);
    const key = [dependencyType ?? finding.category, targetName].filter(Boolean).join(":");
    const current = counts.get(key) ?? {
      key,
      count: 0,
      category: finding.category,
      dependencyType,
      targetName,
    };
    current.count += 1;
    counts.set(key, current);
  }

  return [...counts.values()].sort((left, right) => right.count - left.count || left.key.localeCompare(right.key)).slice(0, limit);
}

function relationResolution(run: NormalizedAnalysisRun) {
  const stats: Record<string, { total: number; resolved: number; unresolved: number; resolvedRatio: number }> = {};

  for (const relation of run.relations) {
    const key = stringMetadata(relation.metadata.legacyType) ?? relation.type;
    stats[key] ??= { total: 0, resolved: 0, unresolved: 0, resolvedRatio: 0 };
    stats[key].total += 1;

    const unresolved = relation.provenance.some((item) => item.status === "unresolved");
    if (unresolved) {
      stats[key].unresolved += 1;
    } else {
      stats[key].resolved += 1;
    }
  }

  for (const value of Object.values(stats)) {
    value.resolvedRatio = value.total === 0 ? 0 : Number((value.resolved / value.total).toFixed(4));
  }

  return stats;
}

function recommendedNextImprovements(findings: AnalyzerFinding[]): string[] {
  const top = topFindings(findings, 10);
  const recommendations = new Set<string>();

  for (const finding of top) {
    if (finding.dependencyType === "INCLUDES_COPYBOOK") {
      recommendations.add("Add external/system copybook handling for high-frequency CICS, MQ, and vendor copybooks.");
    } else if (finding.dependencyType === "USES_TABLE") {
      recommendations.add("Create DB2 table entities from EXEC SQL table references so table usage resolves.");
    } else if (finding.dependencyType === "EXECUTES") {
      recommendations.add("Classify common JCL utility programs as external executable entities.");
    } else if (finding.dependencyType === "CALLS") {
      recommendations.add("Classify runtime/library calls such as MQ and LE routines as external program entities.");
    } else if (finding.dependencyType === "USES_FILE") {
      recommendations.add("Create dataset/file entities from COBOL FD/SELECT and JCL DD evidence.");
    } else if (finding.dependencyType === "INVOKES_TRANSACTION") {
      recommendations.add("Mark dynamic CICS transaction IDs separately from statically resolved transaction entities.");
    }
  }

  if (recommendations.size === 0) {
    recommendations.add("Review unresolved findings by frequency and add the smallest tolerant extractor improvement first.");
  }

  return [...recommendations];
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function table(headers: string[], rows: Array<Array<string | number>>): string[] {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ];
}
