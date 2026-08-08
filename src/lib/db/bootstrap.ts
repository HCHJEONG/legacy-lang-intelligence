import type Database from "better-sqlite3";

export function bootstrapAnalysisDatabase(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_root TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analysis_engines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      kind TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analysis_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      schema_version TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      coverage_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS analysis_runs_project_idx ON analysis_runs(project_id);

    CREATE TABLE IF NOT EXISTS source_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      kind TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      UNIQUE(project_id, path)
    );
    CREATE INDEX IF NOT EXISTS source_files_kind_idx ON source_files(kind);

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      qualified_name TEXT NOT NULL,
      source_file_path TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS entities_run_type_idx ON entities(run_id, type);
    CREATE INDEX IF NOT EXISTS entities_name_idx ON entities(name);
    CREATE INDEX IF NOT EXISTS entities_source_file_idx ON entities(source_file_path);

    CREATE TABLE IF NOT EXISTS relations (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      source_entity_id TEXT NOT NULL,
      target_entity_id TEXT,
      target_name TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS relations_run_type_idx ON relations(run_id, type);
    CREATE INDEX IF NOT EXISTS relations_source_idx ON relations(source_entity_id);
    CREATE INDEX IF NOT EXISTS relations_target_idx ON relations(target_entity_id);
    CREATE INDEX IF NOT EXISTS relations_target_name_idx ON relations(target_name);

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      snippet TEXT NOT NULL,
      analyzer_id TEXT NOT NULL,
      extraction_rule TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS evidence_run_file_idx ON evidence(run_id, file_path);
    CREATE INDEX IF NOT EXISTS evidence_location_idx ON evidence(file_path, start_line);

    CREATE TABLE IF NOT EXISTS provenance (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
      subject_type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      analyzer_id TEXT NOT NULL,
      analyzer_version TEXT NOT NULL,
      extraction_rule TEXT NOT NULL,
      confidence REAL NOT NULL,
      confidence_band TEXT NOT NULL,
      confidence_reason TEXT NOT NULL,
      status TEXT NOT NULL,
      evidence_ids_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS provenance_subject_idx ON provenance(subject_type, subject_id);
    CREATE INDEX IF NOT EXISTS provenance_run_status_idx ON provenance(run_id, status);

    CREATE TABLE IF NOT EXISTS analyzer_findings (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
      analyzer_id TEXT NOT NULL,
      status TEXT NOT NULL,
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      file_path TEXT,
      start_line INTEGER,
      end_line INTEGER,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS findings_run_category_idx ON analyzer_findings(run_id, category);
    CREATE INDEX IF NOT EXISTS findings_file_idx ON analyzer_findings(file_path);

    CREATE TABLE IF NOT EXISTS coverage_reports (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
      report_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_explanations (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
      subject_entity_id TEXT,
      question TEXT NOT NULL,
      answer_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ai_explanations_subject_idx ON ai_explanations(subject_entity_id);
  `);
}
