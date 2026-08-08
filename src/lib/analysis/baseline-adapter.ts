import type { AnalysisDependency, AnalysisEntity, StaticAnalysisResult } from "./types";
import {
  confidenceBand,
  NormalizedAnalysisRunSchema,
  type AnalyzerFinding,
  type Evidence,
  type NormalizedAnalysisRun,
  type NormalizedEntity,
  type NormalizedEntityType,
  type NormalizedRelation,
  type NormalizedRelationType,
  type Provenance,
} from "./normalized-ir";

const BASELINE_ENGINE = {
  id: "typescript-baseline@0.1.0",
  name: "TypeScript Baseline Analyzer",
  version: "0.1.0",
  kind: "typescript-baseline" as const,
};

const ENTITY_TYPE_MAP: Record<AnalysisEntity["type"], NormalizedEntityType> = {
  COBOL_PROGRAM: "Program",
  COPYBOOK: "Copybook",
  FIELD: "Field",
  JCL_JOB: "Job",
  JCL_STEP: "Step",
  DATASET: "Dataset",
  CICS_TRANSACTION: "Transaction",
  DB2_TABLE: "Table",
};

const RELATION_TYPE_MAP: Record<AnalysisDependency["type"], NormalizedRelationType> = {
  CALLS: "CALLS",
  INCLUDES_COPYBOOK: "COPIES",
  CONTAINS_FIELD: "CONTAINS",
  EXECUTES: "EXECUTES",
  USES_TABLE: "USES",
  USES_FILE: "USES",
  INVOKES_TRANSACTION: "INVOKES",
};

export type AnalysisProject = {
  id: string;
  name: string;
};

const CARDDEMO_PROJECT: AnalysisProject = {
  id: "carddemo",
  name: "AWS CardDemo",
};

export function normalizeBaselineAnalysis(
  analysis: StaticAnalysisResult,
  project: AnalysisProject = CARDDEMO_PROJECT,
): NormalizedAnalysisRun {
  const evidence: Evidence[] = [];
  const findings: AnalyzerFinding[] = [];
  const entityIdsByLegacyId = new Map<string, string>();
  const entityIdsByTypeAndName = new Map<string, string>();

  const entities = analysis.entities.map((entity) => {
    const normalized = normalizeEntity(entity, evidence);
    entityIdsByLegacyId.set(entity.id, normalized.id);
    entityIdsByTypeAndName.set(entityLookupKey(normalized.type, normalized.name), normalized.id);
    return normalized;
  });

  const relations = analysis.dependencies.map((dependency) =>
    normalizeRelation(dependency, entityIdsByLegacyId, entityIdsByTypeAndName, evidence, findings),
  );

  const normalized: NormalizedAnalysisRun = {
    schemaVersion: "0.1.0",
    project: {
      id: project.id,
      name: project.name,
      sourceRoot: analysis.sourceRoot,
    },
    generatedAt: analysis.generatedAt,
    engines: [BASELINE_ENGINE],
    entities,
    relations,
    evidence,
    findings,
    coverage: buildCoverageReport(analysis, entities, relations, evidence, findings),
  };

  return NormalizedAnalysisRunSchema.parse(normalized);
}

function normalizeEntity(entity: AnalysisEntity, evidence: Evidence[]): NormalizedEntity {
  const evidenceItem = pushEvidence(evidence, `evidence:${entity.id}`, entity.evidence, entity.type.toLowerCase());
  const type = ENTITY_TYPE_MAP[entity.type];

  return {
    id: `entity:${type}:${entity.qualifiedName}`,
    type,
    name: entity.name,
    qualifiedName: entity.qualifiedName,
    sourceFilePath: entity.filePath,
    metadata: {
      legacyType: entity.type,
      ...entity.metadata,
    },
    provenance: [
      provenance({
        confidence: entity.metadata?.fallbackName ? 0.55 : 0.9,
        evidenceIds: [evidenceItem.id],
        extractionRule: entity.type.toLowerCase(),
        confidenceReason: entity.metadata?.fallbackName
          ? "Entity name was inferred from the file name."
          : "Entity was extracted from a direct source pattern.",
      }),
    ],
  };
}

function normalizeRelation(
  dependency: AnalysisDependency,
  entityIdsByLegacyId: Map<string, string>,
  entityIdsByTypeAndName: Map<string, string>,
  evidence: Evidence[],
  findings: AnalyzerFinding[],
): NormalizedRelation {
  const relationType = RELATION_TYPE_MAP[dependency.type];
  const sourceEntityId = entityIdsByLegacyId.get(dependency.sourceId) ?? `unresolved-source:${dependency.sourceId}`;
  const inferredTargetId = dependency.targetId
    ? entityIdsByLegacyId.get(dependency.targetId)
    : inferTargetEntityId(dependency, entityIdsByTypeAndName);
  const evidenceItem = pushEvidence(evidence, `evidence:${dependency.id}`, dependency.evidence, dependency.type.toLowerCase());
  const status = inferredTargetId ? "verified" : "unresolved";

  if (!inferredTargetId) {
    findings.push({
      id: `finding:unresolved:${dependency.id}`,
      analyzerId: BASELINE_ENGINE.id,
      status: "unresolved",
      severity: "warning",
      category: "unresolved",
      message: `Could not resolve ${dependency.type} target "${dependency.targetName}" to a normalized entity.`,
      location: evidenceItem.location,
      metadata: {
        dependencyType: dependency.type,
        sourceId: dependency.sourceId,
        targetName: dependency.targetName,
      },
    });
  }

  return {
    id: `relation:${relationType}:${dependency.id}`,
    type: relationType,
    sourceEntityId,
    targetEntityId: inferredTargetId,
    targetName: dependency.targetName,
    metadata: {
      legacyType: dependency.type,
      ...dependency.metadata,
    },
    provenance: [
      provenance({
        confidence: inferredTargetId ? dependency.confidence : Math.min(dependency.confidence, 0.45),
        evidenceIds: [evidenceItem.id],
        extractionRule: dependency.type.toLowerCase(),
        confidenceReason: inferredTargetId
          ? "Relation target was resolved or explicitly linked by the baseline analyzer."
          : "Relation was extracted but the target entity was not resolved.",
        status,
      }),
    ],
  };
}

function inferTargetEntityId(
  dependency: AnalysisDependency,
  entityIdsByTypeAndName: Map<string, string>,
): string | undefined {
  const targetName = dependency.targetName;
  const candidateTypes: NormalizedEntityType[] = (() => {
    switch (dependency.type) {
      case "CALLS":
        return ["Program"];
      case "INCLUDES_COPYBOOK":
        return ["Copybook"];
      case "USES_TABLE":
        return ["Table"];
      case "USES_FILE":
        return ["Dataset", "File"];
      case "INVOKES_TRANSACTION":
        return ["Transaction"];
      case "CONTAINS_FIELD":
        return ["Field"];
      case "EXECUTES":
        return ["Step", "Program"];
    }
  })();

  for (const type of candidateTypes) {
    const match = entityIdsByTypeAndName.get(entityLookupKey(type, targetName));
    if (match) {
      return match;
    }
  }

  return undefined;
}

function buildCoverageReport(
  analysis: StaticAnalysisResult,
  entities: NormalizedEntity[],
  relations: NormalizedRelation[],
  evidence: Evidence[],
  findings: AnalyzerFinding[],
): NormalizedAnalysisRun["coverage"] {
  const filesWithEntities = new Set(entities.map((entity) => entity.sourceFilePath).filter(Boolean)).size;
  const relationFiles = relations
    .flatMap((relation) => relation.provenance.flatMap((item) => item.evidenceIds))
    .map((evidenceId) => evidence.find((item) => item.id === evidenceId)?.location.filePath)
    .filter(Boolean);
  const filesWithRelations = new Set(relationFiles).size;
  const relationsWithEvidence = relations.filter((relation) =>
    relation.provenance.some((item) => item.evidenceIds.length > 0),
  ).length;

  return {
    filesTotal: analysis.files.length,
    filesByKind: analysis.summary.filesByKind,
    filesWithEntities,
    filesWithRelations,
    entityCount: entities.length,
    relationCount: relations.length,
    evidenceCount: evidence.length,
    evidenceCoverage: ratio(relationsWithEvidence, relations.length),
    entityCoverage: ratio(filesWithEntities, analysis.files.length),
    relationCoverage: ratio(filesWithRelations, analysis.files.length),
    unresolvedCount: findings.filter((finding) => finding.category === "unresolved").length,
    unsupportedCount: findings.filter((finding) => finding.category === "coverage").length,
    confidenceDistribution: countBy(
      relations.flatMap((relation) => relation.provenance.map((item) => item.confidenceBand)),
      (band) => band,
    ),
    entityTypes: countBy(entities, (entity) => entity.type),
    relationTypes: countBy(relations, (relation) => relation.type),
    normalization: buildNormalizationCoverage(analysis),
  };
}

function buildNormalizationCoverage(analysis: StaticAnalysisResult): NormalizedAnalysisRun["coverage"]["normalization"] {
  const normalizerRuns = analysis.fileAnalysis.filter((item) => item.analyzer === "cobol-normalizer");

  return {
    filesNormalized: normalizerRuns.length,
    originalLineCount: sumMetric(normalizerRuns, "originalLineCount"),
    normalizedLineCount: sumMetric(normalizerRuns, "normalizedLineCount"),
    commentLinesRemoved: sumMetric(normalizerRuns, "commentLinesRemoved"),
    blankLinesRemoved: sumMetric(normalizerRuns, "blankLinesRemoved"),
    headerLinesRemoved: sumMetric(normalizerRuns, "headerLinesRemoved"),
    continuationLinesJoined: sumMetric(normalizerRuns, "continuationLinesJoined"),
    fixedFormatLikelyFiles: normalizerRuns.filter((item) => item.metrics.fixedFormatLikely === true).length,
  };
}

function sumMetric(items: Array<{ metrics: Record<string, unknown> }>, key: string): number {
  return items.reduce((total, item) => {
    const value = item.metrics[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

function pushEvidence(
  evidence: Evidence[],
  id: string,
  source: { filePath: string; startLine: number; endLine: number; snippet: string },
  extractionRule: string,
): Evidence {
  const existing = evidence.find((item) => item.id === id);
  if (existing) {
    return existing;
  }

  const item: Evidence = {
    id,
    location: {
      filePath: source.filePath,
      startLine: source.startLine,
      endLine: source.endLine,
    },
    snippet: source.snippet,
    analyzerId: BASELINE_ENGINE.id,
    extractionRule,
  };
  evidence.push(item);
  return item;
}

function provenance(input: {
  confidence: number;
  evidenceIds: string[];
  extractionRule: string;
  confidenceReason: string;
  status?: Provenance["status"];
}): Provenance {
  return {
    analyzerId: BASELINE_ENGINE.id,
    analyzerVersion: BASELINE_ENGINE.version,
    extractionRule: input.extractionRule,
    confidence: input.confidence,
    confidenceBand: confidenceBand(input.confidence),
    confidenceReason: input.confidenceReason,
    status: input.status ?? "verified",
    evidenceIds: input.evidenceIds,
  };
}

function entityLookupKey(type: NormalizedEntityType, name: string): string {
  return `${type}:${name.toUpperCase()}`;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }
  return Number((numerator / denominator).toFixed(4));
}

function countBy<T, K extends string>(items: T[], keyOf: (item: T) => K): Record<K, number> {
  return items.reduce(
    (counts, item) => {
      const key = keyOf(item);
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    {} as Record<K, number>,
  );
}
