import path from "node:path";

import type Database from "better-sqlite3";

import {
  type NormalizedAnalysisRun,
  NormalizedAnalysisRunSchema,
} from "@/lib/analysis/normalized-ir";
import { bootstrapAnalysisDatabase } from "@/lib/db/bootstrap";
import { openAnalysisDatabase } from "@/lib/db/client";

export type PersistenceCounts = {
  projects: number;
  analysisEngines: number;
  analysisRuns: number;
  sourceFiles: number;
  entities: number;
  relations: number;
  evidence: number;
  provenance: number;
  analyzerFindings: number;
  coverageReports: number;
};

export type PersistNormalizedAnalysisResult = {
  databasePath: string;
  runId: string;
  counts: PersistenceCounts;
};

export function persistNormalizedAnalysis(
  input: unknown,
  databasePath: string,
): PersistNormalizedAnalysisResult {
  const analysis = NormalizedAnalysisRunSchema.parse(input);
  const { sqlite } = openAnalysisDatabase(databasePath);

  try {
    bootstrapAnalysisDatabase(sqlite);
    const runId = analysisRunId(analysis);
    const counts = writeAnalysisRun(sqlite, analysis, runId);

    return {
      databasePath,
      runId,
      counts,
    };
  } finally {
    sqlite.close();
  }
}

function writeAnalysisRun(
  sqlite: Database.Database,
  analysis: NormalizedAnalysisRun,
  runId: string,
): PersistenceCounts {
  const counts: PersistenceCounts = {
    projects: 1,
    analysisEngines: analysis.engines.length,
    analysisRuns: 1,
    sourceFiles: collectSourceFiles(analysis).length,
    entities: analysis.entities.length,
    relations: analysis.relations.length,
    evidence: analysis.evidence.length,
    provenance: 0,
    analyzerFindings: analysis.findings.length,
    coverageReports: 1,
  };

  const transaction = sqlite.transaction(() => {
    sqlite
      .prepare(
        `INSERT INTO projects (id, name, source_root, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           source_root = excluded.source_root`,
      )
      .run(analysis.project.id, analysis.project.name, analysis.project.sourceRoot, analysis.generatedAt);

    const insertEngine = sqlite.prepare(
      `INSERT INTO analysis_engines (id, name, version, kind)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         version = excluded.version,
         kind = excluded.kind`,
    );
    for (const engine of analysis.engines) {
      insertEngine.run(engine.id, engine.name, engine.version, engine.kind);
    }

    sqlite.prepare("DELETE FROM analysis_runs WHERE id = ?").run(runId);
    sqlite
      .prepare(
        `INSERT INTO analysis_runs (id, project_id, schema_version, generated_at, coverage_json)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        runId,
        analysis.project.id,
        analysis.schemaVersion,
        analysis.generatedAt,
        JSON.stringify(analysis.coverage),
      );

    const insertSourceFile = sqlite.prepare(
      `INSERT INTO source_files (id, project_id, path, kind, metadata_json)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(project_id, path) DO UPDATE SET
         kind = excluded.kind,
         metadata_json = excluded.metadata_json`,
    );
    for (const sourceFile of collectSourceFiles(analysis)) {
      insertSourceFile.run(
        sourceFile.id,
        analysis.project.id,
        sourceFile.filePath,
        sourceFile.kind,
        JSON.stringify({ inferred: true }),
      );
    }

    const insertEntity = sqlite.prepare(
      `INSERT INTO entities (id, run_id, type, name, qualified_name, source_file_path, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertProvenance = sqlite.prepare(
      `INSERT INTO provenance (
         id, run_id, subject_type, subject_id, analyzer_id, analyzer_version,
         extraction_rule, confidence, confidence_band, confidence_reason, status, evidence_ids_json
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const entity of analysis.entities) {
      insertEntity.run(
        entity.id,
        runId,
        entity.type,
        entity.name,
        entity.qualifiedName,
        entity.sourceFilePath ?? null,
        JSON.stringify(entity.metadata),
      );
      entity.provenance.forEach((provenance, index) => {
        counts.provenance += 1;
        insertProvenance.run(
          `entity:${entity.id}:${index}`,
          runId,
          "entity",
          entity.id,
          provenance.analyzerId,
          provenance.analyzerVersion,
          provenance.extractionRule,
          provenance.confidence,
          provenance.confidenceBand,
          provenance.confidenceReason,
          provenance.status,
          JSON.stringify(provenance.evidenceIds),
        );
      });
    }

    const insertRelation = sqlite.prepare(
      `INSERT INTO relations (id, run_id, type, source_entity_id, target_entity_id, target_name, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const relation of analysis.relations) {
      insertRelation.run(
        relation.id,
        runId,
        relation.type,
        relation.sourceEntityId,
        relation.targetEntityId ?? null,
        relation.targetName,
        JSON.stringify(relation.metadata),
      );
      relation.provenance.forEach((provenance, index) => {
        counts.provenance += 1;
        insertProvenance.run(
          `relation:${relation.id}:${index}`,
          runId,
          "relation",
          relation.id,
          provenance.analyzerId,
          provenance.analyzerVersion,
          provenance.extractionRule,
          provenance.confidence,
          provenance.confidenceBand,
          provenance.confidenceReason,
          provenance.status,
          JSON.stringify(provenance.evidenceIds),
        );
      });
    }

    const insertEvidence = sqlite.prepare(
      `INSERT INTO evidence (
         id, run_id, file_path, start_line, end_line, snippet, analyzer_id, extraction_rule
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const evidence of analysis.evidence) {
      insertEvidence.run(
        evidence.id,
        runId,
        evidence.location.filePath,
        evidence.location.startLine,
        evidence.location.endLine,
        evidence.snippet,
        evidence.analyzerId,
        evidence.extractionRule,
      );
    }

    const insertFinding = sqlite.prepare(
      `INSERT INTO analyzer_findings (
         id, run_id, analyzer_id, status, severity, category, message,
         file_path, start_line, end_line, metadata_json
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const finding of analysis.findings) {
      insertFinding.run(
        finding.id,
        runId,
        finding.analyzerId,
        finding.status,
        finding.severity,
        finding.category,
        finding.message,
        finding.location?.filePath ?? null,
        finding.location?.startLine ?? null,
        finding.location?.endLine ?? null,
        JSON.stringify(finding.metadata),
      );
    }

    sqlite
      .prepare(
        `INSERT INTO coverage_reports (id, run_id, report_json, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(`coverage:${runId}`, runId, JSON.stringify(analysis.coverage), analysis.generatedAt);
  });

  transaction();
  return counts;
}

function analysisRunId(analysis: NormalizedAnalysisRun) {
  return `${analysis.project.id}:${analysis.generatedAt}`.replace(/[^a-zA-Z0-9:._-]/g, "_");
}

function collectSourceFiles(analysis: NormalizedAnalysisRun) {
  const paths = new Set<string>();
  for (const entity of analysis.entities) {
    if (entity.sourceFilePath) {
      paths.add(entity.sourceFilePath);
    }
  }
  for (const evidence of analysis.evidence) {
    paths.add(evidence.location.filePath);
  }
  for (const finding of analysis.findings) {
    if (finding.location?.filePath) {
      paths.add(finding.location.filePath);
    }
  }

  return [...paths].sort().map((filePath) => ({
    id: `source-file:${filePath}`,
    filePath,
    kind: inferSourceKind(filePath),
  }));
}

function inferSourceKind(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if ([".cbl", ".cob", ".cobol"].includes(extension)) {
    return "cobol";
  }
  if ([".cpy", ".copybook"].includes(extension)) {
    return "copybook";
  }
  if ([".jcl", ".job"].includes(extension)) {
    return "jcl";
  }
  return "unknown";
}
