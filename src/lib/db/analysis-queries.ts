import fs from "node:fs";
import path from "node:path";

import { openAnalysisDatabase } from "@/lib/db/client";

const defaultDatabasePath = path.resolve("analysis-output", "carddemo.sqlite");

export type AnalysisQualitySummary = {
  runId: string;
  generatedAt: string;
  filesAnalyzed: number;
  filesTotal: number;
  entityCoverage: number;
  relationCoverage: number;
  evidenceCoverage: number;
  entityCount: number;
  relationCount: number;
  evidenceCount: number;
  unresolvedCount: number;
  unsupportedCount: number;
  confidenceDistribution: Record<string, number>;
  unresolvedByCategory: Array<{ label: string; count: number }>;
};

export type EntitySearchResult = {
  id: string;
  type: string;
  name: string;
  qualifiedName: string;
  sourceFilePath: string | null;
  relationCount: number;
};

export type NeighborhoodGraph = {
  selectedEntity: EntitySearchResult | null;
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    sourceFilePath: string | null;
    isSelected: boolean;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label: string;
    status: string;
    confidenceBand: string;
  }>;
  evidence: Array<{
    relationId: string;
    relationType: string;
    filePath: string;
    startLine: number;
    endLine: number;
    snippet: string;
  }>;
  truncated: boolean;
};

export type SystemMapViewModel = {
  databaseReady: boolean;
  quality: AnalysisQualitySummary | null;
  searchResults: EntitySearchResult[];
  graph: NeighborhoodGraph | null;
};

export function getSystemMapViewModel(options: {
  query?: string;
  entityId?: string;
  databasePath?: string;
  hopLimit?: 1 | 2 | 3;
}): SystemMapViewModel {
  const databasePath = options.databasePath ?? defaultDatabasePath;
  if (!fs.existsSync(/* turbopackIgnore: true */ databasePath)) {
    return {
      databaseReady: false,
      quality: null,
      searchResults: [],
      graph: null,
    };
  }

  const { sqlite } = openAnalysisDatabase(databasePath);
  try {
    const run = sqlite
      .prepare(
        `SELECT id, generated_at AS generatedAt, coverage_json AS coverageJson
         FROM analysis_runs
         ORDER BY generated_at DESC
         LIMIT 1`,
      )
      .get() as { id: string; generatedAt: string; coverageJson: string } | undefined;

    if (!run) {
      return {
        databaseReady: true,
        quality: null,
        searchResults: [],
        graph: null,
      };
    }

    const searchResults = searchEntities(sqlite, run.id, options.query);
    const selectedEntityId = options.entityId ?? searchResults[0]?.id;

    return {
      databaseReady: true,
      quality: getQualitySummary(sqlite, run),
      searchResults,
      graph: selectedEntityId
        ? getNeighborhoodGraph(sqlite, run.id, selectedEntityId, options.hopLimit ?? 1)
        : null,
    };
  } finally {
    sqlite.close();
  }
}

function getQualitySummary(
  sqlite: ReturnType<typeof openAnalysisDatabase>["sqlite"],
  run: { id: string; generatedAt: string; coverageJson: string },
): AnalysisQualitySummary {
  const coverage = JSON.parse(run.coverageJson) as {
    filesTotal?: number;
    filesWithEntities?: number;
    entityCoverage?: number;
    relationCoverage?: number;
    evidenceCoverage?: number;
    entityCount?: number;
    relationCount?: number;
    evidenceCount?: number;
    unresolvedCount?: number;
    unsupportedCount?: number;
    confidenceDistribution?: Record<string, number>;
  };

  const unresolvedRows = sqlite
    .prepare(
      `SELECT category AS label, COUNT(*) AS count
       FROM analyzer_findings
       WHERE run_id = ?
       GROUP BY category
       ORDER BY count DESC, category ASC`,
    )
    .all(run.id) as Array<{ label: string; count: number }>;

  return {
    runId: run.id,
    generatedAt: run.generatedAt,
    filesAnalyzed: coverage.filesWithEntities ?? 0,
    filesTotal: coverage.filesTotal ?? 0,
    entityCoverage: coverage.entityCoverage ?? 0,
    relationCoverage: coverage.relationCoverage ?? 0,
    evidenceCoverage: coverage.evidenceCoverage ?? 0,
    entityCount: coverage.entityCount ?? 0,
    relationCount: coverage.relationCount ?? 0,
    evidenceCount: coverage.evidenceCount ?? 0,
    unresolvedCount: coverage.unresolvedCount ?? 0,
    unsupportedCount: coverage.unsupportedCount ?? 0,
    confidenceDistribution: coverage.confidenceDistribution ?? {},
    unresolvedByCategory: unresolvedRows,
  };
}

function searchEntities(
  sqlite: ReturnType<typeof openAnalysisDatabase>["sqlite"],
  runId: string,
  query?: string,
) {
  const term = query?.trim();
  const params = term ? [runId, `%${term}%`, `%${term}%`] : [runId];
  const where = term ? "AND (e.name LIKE ? OR e.qualified_name LIKE ?)" : "AND e.type = 'Program'";

  return sqlite
    .prepare(
      `SELECT
         e.id,
         e.type,
         e.name,
         e.qualified_name AS qualifiedName,
         e.source_file_path AS sourceFilePath,
         (
           SELECT COUNT(*)
           FROM relations r
           WHERE r.run_id = e.run_id
             AND (r.source_entity_id = e.id OR r.target_entity_id = e.id)
         ) AS relationCount
       FROM entities e
       WHERE e.run_id = ?
         ${where}
       ORDER BY relationCount DESC, e.type ASC, e.name ASC
       LIMIT 25`,
    )
    .all(...params) as EntitySearchResult[];
}

function getNeighborhoodGraph(
  sqlite: ReturnType<typeof openAnalysisDatabase>["sqlite"],
  runId: string,
  entityId: string,
  hopLimit: 1 | 2 | 3,
): NeighborhoodGraph {
  const selectedEntity = getEntity(sqlite, runId, entityId);
  if (!selectedEntity) {
    return {
      selectedEntity: null,
      nodes: [],
      edges: [],
      evidence: [],
      truncated: false,
    };
  }

  const nodeIds = new Set([entityId]);
  const edges = new Map<string, NeighborhoodGraph["edges"][number]>();
  let frontier = new Set([entityId]);
  let truncated = false;

  for (let hop = 0; hop < hopLimit; hop += 1) {
    const nextFrontier = new Set<string>();
    for (const currentId of frontier) {
      const relationRows = getRelationsForEntity(sqlite, runId, currentId);
      for (const relation of relationRows) {
        if (edges.size >= 80 || nodeIds.size >= 60) {
          truncated = true;
          continue;
        }
        const targetId = relation.targetEntityId ?? `unresolved:${relation.id}`;
        nodeIds.add(relation.sourceEntityId);
        nodeIds.add(targetId);
        edges.set(relation.id, {
          id: relation.id,
          source: relation.sourceEntityId,
          target: targetId,
          label: relation.type,
          status: relation.status ?? "unknown",
          confidenceBand: relation.confidenceBand ?? "unknown",
        });
        if (relation.targetEntityId && !frontier.has(relation.targetEntityId)) {
          nextFrontier.add(relation.targetEntityId);
        }
      }
    }
    frontier = nextFrontier;
  }

  const nodes = [...nodeIds].map((id) => {
    if (id.startsWith("unresolved:")) {
      const edge = edges.get(id.replace("unresolved:", ""));
      return {
        id,
        label: edge?.label ? "Unresolved target" : "Unresolved",
        type: "Unresolved",
        sourceFilePath: null,
        isSelected: false,
      };
    }
    const entity = getEntity(sqlite, runId, id);
    return {
      id,
      label: entity?.name ?? id,
      type: entity?.type ?? "Unknown",
      sourceFilePath: entity?.sourceFilePath ?? null,
      isSelected: id === entityId,
    };
  });

  return {
    selectedEntity,
    nodes,
    edges: [...edges.values()],
    evidence: getEvidenceForRelations(sqlite, runId, [...edges.keys()].slice(0, 12)),
    truncated,
  };
}

function getEntity(
  sqlite: ReturnType<typeof openAnalysisDatabase>["sqlite"],
  runId: string,
  entityId: string,
) {
  return sqlite
    .prepare(
      `SELECT
         id,
         type,
         name,
         qualified_name AS qualifiedName,
         source_file_path AS sourceFilePath,
         0 AS relationCount
       FROM entities
       WHERE run_id = ? AND id = ?`,
    )
    .get(runId, entityId) as EntitySearchResult | undefined;
}

function getRelationsForEntity(
  sqlite: ReturnType<typeof openAnalysisDatabase>["sqlite"],
  runId: string,
  entityId: string,
) {
  return sqlite
    .prepare(
      `SELECT
         r.id,
         r.type,
         r.source_entity_id AS sourceEntityId,
         r.target_entity_id AS targetEntityId,
         p.status,
         p.confidence_band AS confidenceBand
       FROM relations r
       LEFT JOIN provenance p
         ON p.run_id = r.run_id
        AND p.subject_type = 'relation'
        AND p.subject_id = r.id
       WHERE r.run_id = ?
         AND (r.source_entity_id = ? OR r.target_entity_id = ?)
       ORDER BY
         CASE r.type
           WHEN 'CALLS' THEN 1
           WHEN 'COPIES' THEN 2
           WHEN 'EXECUTES' THEN 3
           WHEN 'READS' THEN 4
           WHEN 'WRITES' THEN 5
           ELSE 9
         END,
         r.target_name ASC
       LIMIT 40`,
    )
    .all(runId, entityId, entityId) as Array<{
    id: string;
    type: string;
    sourceEntityId: string;
    targetEntityId: string | null;
    status: string | null;
    confidenceBand: string | null;
  }>;
}

function getEvidenceForRelations(
  sqlite: ReturnType<typeof openAnalysisDatabase>["sqlite"],
  runId: string,
  relationIds: string[],
) {
  if (relationIds.length === 0) {
    return [];
  }
  const placeholders = relationIds.map(() => "?").join(",");
  return sqlite
    .prepare(
      `SELECT
         p.subject_id AS relationId,
         r.type AS relationType,
         ev.file_path AS filePath,
         ev.start_line AS startLine,
         ev.end_line AS endLine,
         ev.snippet AS snippet
       FROM provenance p
       JOIN relations r
         ON r.run_id = p.run_id
        AND r.id = p.subject_id
       JOIN evidence ev
         ON ev.run_id = p.run_id
        AND instr(p.evidence_ids_json, '"' || ev.id || '"') > 0
       WHERE p.run_id = ?
         AND p.subject_type = 'relation'
         AND p.subject_id IN (${placeholders})
       ORDER BY ev.file_path ASC, ev.start_line ASC
       LIMIT 12`,
    )
    .all(runId, ...relationIds) as NeighborhoodGraph["evidence"];
}
