import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sourceRoot: text("source_root").notNull(),
  createdAt: text("created_at").notNull(),
});

export const analysisEngines = sqliteTable("analysis_engines", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  kind: text("kind").notNull(),
});

export const analysisRuns = sqliteTable(
  "analysis_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    schemaVersion: text("schema_version").notNull(),
    generatedAt: text("generated_at").notNull(),
    coverageJson: text("coverage_json").notNull(),
  },
  (table) => [index("analysis_runs_project_idx").on(table.projectId)],
);

export const sourceFiles = sqliteTable(
  "source_files",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    kind: text("kind"),
    metadataJson: text("metadata_json").notNull().default("{}"),
  },
  (table) => [
    uniqueIndex("source_files_project_path_idx").on(table.projectId, table.path),
    index("source_files_kind_idx").on(table.kind),
  ],
);

export const entities = sqliteTable(
  "entities",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    name: text("name").notNull(),
    qualifiedName: text("qualified_name").notNull(),
    sourceFilePath: text("source_file_path"),
    metadataJson: text("metadata_json").notNull().default("{}"),
  },
  (table) => [
    index("entities_run_type_idx").on(table.runId, table.type),
    index("entities_name_idx").on(table.name),
    index("entities_source_file_idx").on(table.sourceFilePath),
  ],
);

export const relations = sqliteTable(
  "relations",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    sourceEntityId: text("source_entity_id").notNull(),
    targetEntityId: text("target_entity_id"),
    targetName: text("target_name").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
  },
  (table) => [
    index("relations_run_type_idx").on(table.runId, table.type),
    index("relations_source_idx").on(table.sourceEntityId),
    index("relations_target_idx").on(table.targetEntityId),
    index("relations_target_name_idx").on(table.targetName),
  ],
);

export const evidence = sqliteTable(
  "evidence",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    filePath: text("file_path").notNull(),
    startLine: integer("start_line").notNull(),
    endLine: integer("end_line").notNull(),
    snippet: text("snippet").notNull(),
    analyzerId: text("analyzer_id").notNull(),
    extractionRule: text("extraction_rule").notNull(),
  },
  (table) => [
    index("evidence_run_file_idx").on(table.runId, table.filePath),
    index("evidence_location_idx").on(table.filePath, table.startLine),
  ],
);

export const provenance = sqliteTable(
  "provenance",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    analyzerId: text("analyzer_id").notNull(),
    analyzerVersion: text("analyzer_version").notNull(),
    extractionRule: text("extraction_rule").notNull(),
    confidence: real("confidence").notNull(),
    confidenceBand: text("confidence_band").notNull(),
    confidenceReason: text("confidence_reason").notNull(),
    status: text("status").notNull(),
    evidenceIdsJson: text("evidence_ids_json").notNull(),
  },
  (table) => [
    index("provenance_subject_idx").on(table.subjectType, table.subjectId),
    index("provenance_run_status_idx").on(table.runId, table.status),
  ],
);

export const analyzerFindings = sqliteTable(
  "analyzer_findings",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    analyzerId: text("analyzer_id").notNull(),
    status: text("status").notNull(),
    severity: text("severity").notNull(),
    category: text("category").notNull(),
    message: text("message").notNull(),
    filePath: text("file_path"),
    startLine: integer("start_line"),
    endLine: integer("end_line"),
    metadataJson: text("metadata_json").notNull().default("{}"),
  },
  (table) => [
    index("findings_run_category_idx").on(table.runId, table.category),
    index("findings_file_idx").on(table.filePath),
  ],
);

export const coverageReports = sqliteTable("coverage_reports", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => analysisRuns.id, { onDelete: "cascade" }),
  reportJson: text("report_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const aiExplanations = sqliteTable(
  "ai_explanations",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => analysisRuns.id, { onDelete: "cascade" }),
    subjectEntityId: text("subject_entity_id"),
    question: text("question").notNull(),
    answerJson: text("answer_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("ai_explanations_subject_idx").on(table.subjectEntityId)],
);

