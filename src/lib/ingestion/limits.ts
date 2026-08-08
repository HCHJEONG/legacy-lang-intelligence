export const INGESTION_LIMITS = {
  maxRepositoryBytes: 500 * 1024 * 1024,
  maxFileCount: 20_000,
  maxFileBytes: 5 * 1024 * 1024,
  commandTimeoutMs: 30_000,
  allowedExtensions: new Set([".cbl", ".cob", ".cobol", ".cpy", ".copy", ".jcl", ".proc", ".txt"]),
};
