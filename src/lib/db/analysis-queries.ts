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
  analyzer: string;
  analyzerVersion: string;
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
    sourceLines: string[];
    sourceEntityId: string;
    sourceEntityName: string;
    targetEntityId: string | null;
    targetEntityName: string;
  }>;
  truncated: boolean;
};

export type SystemMapViewModel = {
  databaseReady: boolean;
  projects: AnalysisProjectSummary[];
  selectedProject: AnalysisProjectSummary | null;
  quality: AnalysisQualitySummary | null;
  searchResults: EntitySearchResult[];
  graph: NeighborhoodGraph | null;
};

export type AnalysisProjectSummary = {
  id: string;
  name: string;
  generatedAt: string;
  entityCount: number;
};

export type SystemMapFilters = {
  entityType?: string;
  relationType?: string;
  confidence?: "all" | "high" | "medium" | "low";
};

export function getLatestAnalysisRun(databasePath = defaultDatabasePath) {
  const { sqlite } = openAnalysisDatabase(databasePath);
  try {
    return selectLatestValidRun(sqlite);
  } finally {
    sqlite.close();
  }
}

export function getSystemMapViewModel(options: {
  query?: string;
  entityId?: string;
  projectId?: string;
  databasePath?: string;
  hopLimit?: 1 | 2 | 3;
  filters?: SystemMapFilters;
}): SystemMapViewModel {
  const databasePath = options.databasePath ?? defaultDatabasePath;
  if (!fs.existsSync(/* turbopackIgnore: true */ databasePath)) {
    return {
      databaseReady: false,
      projects: [],
      selectedProject: null,
      quality: null,
      searchResults: [],
      graph: null,
    };
  }

  const { sqlite } = openAnalysisDatabase(databasePath);
  try {
    const projects = listProjects(sqlite);
    const selectedProject = projects.find((project) => project.id === options.projectId)
      ?? projects.find((project) => project.id === "carddemo")
      ?? projects[0]
      ?? null;
    const run = selectedProject ? selectLatestValidRun(sqlite, selectedProject.id) : undefined;

    if (!run) {
      return {
        databaseReady: true,
        projects,
        selectedProject,
        quality: null,
        searchResults: [],
        graph: null,
      };
    }

    const searchResults = searchEntities(sqlite, run.id, options.query);
    const selectedEntityId = options.entityId ?? searchResults[0]?.id;

    return {
      databaseReady: true,
      projects,
      selectedProject,
      quality: getQualitySummary(sqlite, run),
      searchResults,
      graph: selectedEntityId
        ? getNeighborhoodGraph(sqlite, run.id, selectedEntityId, options.hopLimit ?? 1, options.filters)
        : null,
    };
  } finally {
    sqlite.close();
  }
}

function selectLatestValidRun(
  sqlite: ReturnType<typeof openAnalysisDatabase>["sqlite"],
  projectId?: string,
) {
  const projectClause = projectId ? "AND r.project_id = ?" : "";
  return sqlite
    .prepare(
      `SELECT r.id, r.generated_at AS generatedAt, r.coverage_json AS coverageJson
       FROM analysis_runs r
       WHERE EXISTS (SELECT 1 FROM entities e WHERE e.run_id = r.id)
         ${projectClause}
       ORDER BY r.generated_at DESC
       LIMIT 1`,
    )
    .get(...(projectId ? [projectId] : [])) as { id: string; generatedAt: string; coverageJson: string } | undefined;
}

function listProjects(sqlite: ReturnType<typeof openAnalysisDatabase>["sqlite"]): AnalysisProjectSummary[] {
  return sqlite
    .prepare(
      `SELECT p.id, p.name, r.generated_at AS generatedAt,
              (SELECT COUNT(*) FROM entities e WHERE e.run_id = r.id) AS entityCount
       FROM projects p
       JOIN analysis_runs r ON r.id = (
         SELECT candidate.id
         FROM analysis_runs candidate
         WHERE candidate.project_id = p.id
           AND EXISTS (SELECT 1 FROM entities e WHERE e.run_id = candidate.id)
         ORDER BY candidate.generated_at DESC
         LIMIT 1
       )
       ORDER BY CASE WHEN p.id = 'carddemo' THEN 0 ELSE 1 END, r.generated_at DESC`,
    )
    .all() as AnalysisProjectSummary[];
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

  const engine = sqlite.prepare(`SELECT name, version FROM analysis_engines ORDER BY id LIMIT 1`).get() as { name: string; version: string } | undefined;
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
    analyzer: engine?.name ?? "Unknown analyzer",
    analyzerVersion: engine?.version ?? "unknown",
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
  filters: SystemMapFilters = {},
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
  const visited = new Set([entityId]);
  let truncated = false;

  for (let hop = 0; hop < hopLimit; hop += 1) {
    const nextFrontier = new Set<string>();
    for (const currentId of frontier) {
      const relationRows = getRelationsForEntity(sqlite, runId, currentId, filters);
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
        const nextId = relation.sourceEntityId === currentId ? relation.targetEntityId : relation.sourceEntityId;
        if (nextId && !visited.has(nextId)) {
          nextFrontier.add(nextId);
        }
      }
    }
    for (const nextId of nextFrontier) {
      visited.add(nextId);
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

  const visibleNodeIds = new Set(nodes.filter((node) => !filters.entityType || filters.entityType === "all" || node.type === filters.entityType || node.isSelected).map((node) => node.id));
  const visibleNodes = nodes.filter((node) => visibleNodeIds.has(node.id));
  const visibleEdges = [...edges.values()].filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));

  return {
    selectedEntity,
    nodes: visibleNodes,
    edges: visibleEdges,
    evidence: getEvidenceForRelations(sqlite, runId, visibleEdges.map((edge) => edge.id).slice(0, 12)),
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
  filters: SystemMapFilters,
) {
  const clauses = ["r.run_id = ?", "(r.source_entity_id = ? OR r.target_entity_id = ?)"];
  const params: Array<string> = [runId, entityId, entityId];
  if (filters.relationType && filters.relationType !== "all") {
    clauses.push("r.type = ?");
    params.push(filters.relationType);
  }
  if (filters.confidence && filters.confidence !== "all") {
    clauses.push("p.confidence_band = ?");
    params.push(filters.confidence);
  }
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
       WHERE ${clauses.join(" AND ")}
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
    .all(...params) as Array<{
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
  const rows = sqlite
    .prepare(
      `SELECT
         p.subject_id AS relationId,
         r.type AS relationType,
         ev.file_path AS filePath,
         ev.start_line AS startLine,
         ev.end_line AS endLine,
         ev.snippet AS snippet,
         r.source_entity_id AS sourceEntityId,
         source.name AS sourceEntityName,
         r.target_entity_id AS targetEntityId,
         COALESCE(target.name, r.target_name) AS targetEntityName
       FROM provenance p
       JOIN relations r
         ON r.run_id = p.run_id
        AND r.id = p.subject_id
       JOIN entities source
         ON source.run_id = r.run_id
        AND source.id = r.source_entity_id
       LEFT JOIN entities target
         ON target.run_id = r.run_id
        AND target.id = r.target_entity_id
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
  return rows.map((row) => {
    const sourceRoot = sqlite.prepare(`SELECT source_root AS sourceRoot FROM projects p JOIN analysis_runs r ON r.project_id = p.id WHERE r.id = ?`).get(runId) as { sourceRoot: string } | undefined;
    const absolutePath = sourceRoot ? path.resolve(sourceRoot.sourceRoot, row.filePath) : null;
    let sourceLines = row.snippet.split("\n");
    if (absolutePath && fs.existsSync(absolutePath)) {
      const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);
      sourceLines = lines.slice(Math.max(0, row.startLine - 1), row.endLine);
    }
    return { ...row, sourceLines };
  });
}
