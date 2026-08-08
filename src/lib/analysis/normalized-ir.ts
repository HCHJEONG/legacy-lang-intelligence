import { z } from "zod";

export const NormalizedEntityTypeSchema = z.enum([
  "Program",
  "Paragraph",
  "Copybook",
  "Field",
  "Job",
  "Step",
  "Dataset",
  "Transaction",
  "Table",
  "File",
  "Unknown",
]);

export const NormalizedRelationTypeSchema = z.enum([
  "CALLS",
  "COPIES",
  "CONTAINS",
  "EXECUTES",
  "READS",
  "WRITES",
  "USES",
  "INVOKES",
  "REFERENCES",
]);

export const FindingStatusSchema = z.enum([
  "verified",
  "partial",
  "unresolved",
  "unsupported",
  "conflicting",
]);

export const ConfidenceBandSchema = z.enum(["high", "medium", "low", "unknown"]);

export const AnalysisEngineSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  kind: z.enum(["typescript-baseline", "cobol-intel", "future-parser", "manual"]),
});

export const SourceLocationSchema = z.object({
  filePath: z.string().min(1),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
});

export const EvidenceSchema = z.object({
  id: z.string().min(1),
  location: SourceLocationSchema,
  snippet: z.string(),
  analyzerId: z.string().min(1),
  extractionRule: z.string().min(1),
});

export const ProvenanceSchema = z.object({
  analyzerId: z.string().min(1),
  analyzerVersion: z.string().min(1),
  extractionRule: z.string().min(1),
  confidence: z.number().min(0).max(1),
  confidenceBand: ConfidenceBandSchema,
  confidenceReason: z.string().min(1),
  status: FindingStatusSchema,
  evidenceIds: z.array(z.string().min(1)),
});

export const NormalizedEntitySchema = z.object({
  id: z.string().min(1),
  type: NormalizedEntityTypeSchema,
  name: z.string().min(1),
  qualifiedName: z.string().min(1),
  sourceFilePath: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  provenance: z.array(ProvenanceSchema).min(1),
});

export const NormalizedRelationSchema = z.object({
  id: z.string().min(1),
  type: NormalizedRelationTypeSchema,
  sourceEntityId: z.string().min(1),
  targetEntityId: z.string().min(1).optional(),
  targetName: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
  provenance: z.array(ProvenanceSchema).min(1),
});

export const AnalyzerFindingSchema = z.object({
  id: z.string().min(1),
  analyzerId: z.string().min(1),
  status: FindingStatusSchema,
  severity: z.enum(["info", "warning", "error"]),
  category: z.enum(["unresolved", "unsupported", "conflict", "coverage", "parse", "io"]),
  message: z.string().min(1),
  location: SourceLocationSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const CoverageReportSchema = z.object({
  filesTotal: z.number().int().nonnegative(),
  filesByKind: z.record(z.string(), z.number().int().nonnegative()),
  filesWithEntities: z.number().int().nonnegative(),
  filesWithRelations: z.number().int().nonnegative(),
  entityCount: z.number().int().nonnegative(),
  relationCount: z.number().int().nonnegative(),
  evidenceCount: z.number().int().nonnegative(),
  evidenceCoverage: z.number().min(0).max(1),
  entityCoverage: z.number().min(0).max(1),
  relationCoverage: z.number().min(0).max(1),
  unresolvedCount: z.number().int().nonnegative(),
  unsupportedCount: z.number().int().nonnegative(),
  confidenceDistribution: z.record(z.string(), z.number().int().nonnegative()),
  entityTypes: z.record(z.string(), z.number().int().nonnegative()),
  relationTypes: z.record(z.string(), z.number().int().nonnegative()),
  normalization: z
    .object({
      filesNormalized: z.number().int().nonnegative(),
      originalLineCount: z.number().int().nonnegative(),
      normalizedLineCount: z.number().int().nonnegative(),
      commentLinesRemoved: z.number().int().nonnegative(),
      blankLinesRemoved: z.number().int().nonnegative(),
      headerLinesRemoved: z.number().int().nonnegative(),
      continuationLinesJoined: z.number().int().nonnegative(),
      fixedFormatLikelyFiles: z.number().int().nonnegative(),
    })
    .optional(),
});

export const NormalizedAnalysisRunSchema = z.object({
  schemaVersion: z.literal("0.1.0"),
  project: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    sourceRoot: z.string().min(1),
  }),
  generatedAt: z.string().datetime(),
  engines: z.array(AnalysisEngineSchema).min(1),
  entities: z.array(NormalizedEntitySchema),
  relations: z.array(NormalizedRelationSchema),
  evidence: z.array(EvidenceSchema),
  findings: z.array(AnalyzerFindingSchema),
  coverage: CoverageReportSchema,
});

export type NormalizedEntityType = z.infer<typeof NormalizedEntityTypeSchema>;
export type NormalizedRelationType = z.infer<typeof NormalizedRelationTypeSchema>;
export type FindingStatus = z.infer<typeof FindingStatusSchema>;
export type ConfidenceBand = z.infer<typeof ConfidenceBandSchema>;
export type AnalysisEngine = z.infer<typeof AnalysisEngineSchema>;
export type SourceLocation = z.infer<typeof SourceLocationSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
export type NormalizedEntity = z.infer<typeof NormalizedEntitySchema>;
export type NormalizedRelation = z.infer<typeof NormalizedRelationSchema>;
export type AnalyzerFinding = z.infer<typeof AnalyzerFindingSchema>;
export type CoverageReport = z.infer<typeof CoverageReportSchema>;
export type NormalizedAnalysisRun = z.infer<typeof NormalizedAnalysisRunSchema>;

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.85) {
    return "high";
  }
  if (confidence >= 0.65) {
    return "medium";
  }
  if (confidence > 0) {
    return "low";
  }
  return "unknown";
}
