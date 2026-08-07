export type SourceKind =
  | "cobol"
  | "copybook"
  | "jcl"
  | "documentation"
  | "data"
  | "config"
  | "unknown";

export type Evidence = {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
};

export type DiscoveredFile = {
  absolutePath: string;
  relativePath: string;
  kind: SourceKind;
  sizeBytes: number;
  sha256: string;
  signals: string[];
};

export type AnalysisEntity = {
  id: string;
  type:
    | "COBOL_PROGRAM"
    | "COPYBOOK"
    | "FIELD"
    | "JCL_JOB"
    | "JCL_STEP"
    | "DATASET"
    | "CICS_TRANSACTION"
    | "DB2_TABLE";
  name: string;
  qualifiedName: string;
  filePath: string;
  evidence: Evidence;
  metadata?: Record<string, unknown>;
};

export type AnalysisDependency = {
  id: string;
  type:
    | "CALLS"
    | "INCLUDES_COPYBOOK"
    | "CONTAINS_FIELD"
    | "EXECUTES"
    | "USES_TABLE"
    | "USES_FILE"
    | "INVOKES_TRANSACTION";
  sourceId: string;
  targetName: string;
  targetId?: string;
  evidence: Evidence;
  confidence: number;
  metadata?: Record<string, unknown>;
};

export type StaticAnalysisResult = {
  sourceRoot: string;
  generatedAt: string;
  files: DiscoveredFile[];
  entities: AnalysisEntity[];
  dependencies: AnalysisDependency[];
  summary: {
    filesByKind: Record<SourceKind, number>;
    entitiesByType: Record<string, number>;
    dependenciesByType: Record<string, number>;
  };
};
