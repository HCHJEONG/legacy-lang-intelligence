import path from "node:path";

import { bootstrapAnalysisDatabase } from "@/lib/db/bootstrap";
import { openAnalysisDatabase } from "@/lib/db/client";

const databasePath = path.resolve("analysis-output", "carddemo.sqlite");

export type IngestionStatus = "queued" | "fetching" | "analyzing" | "persisting" | "completed" | "failed" | "cancelled";
export type IngestionRunRecord = {
  id: string;
  sourceUrl: string;
  accessType: string;
  status: IngestionStatus;
  phase: string;
  progress: number;
  commitSha: string | null;
  manifest: unknown;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export function createIngestionRun(sourceUrl: string, accessType: string) {
  const id = `ingest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  withDatabase((sqlite) => sqlite.prepare(`INSERT INTO ingestion_runs (id, source_url, access_type, status, phase, progress, created_at, updated_at) VALUES (?, ?, ?, 'queued', 'queued', 0, ?, ?)`).run(id, sourceUrl, accessType, now, now));
  return id;
}

export function updateIngestionRun(id: string, status: IngestionStatus, phase: string, progress: number, data: { commitSha?: string; manifest?: unknown; errorMessage?: string } = {}) {
  withDatabase((sqlite) => sqlite.prepare(`UPDATE ingestion_runs SET status = ?, phase = ?, progress = ?, commit_sha = COALESCE(?, commit_sha), manifest_json = COALESCE(?, manifest_json), error_message = ?, updated_at = ? WHERE id = ?`).run(status, phase, progress, data.commitSha ?? null, data.manifest ? JSON.stringify(data.manifest) : null, data.errorMessage ?? null, new Date().toISOString(), id));
}

export function cancelIngestionRun(id: string) {
  updateIngestionRun(id, "cancelled", "Cancelled by user", 100, { errorMessage: "The ingestion run was cancelled before completion." });
}

export function hasActiveIngestionRun() {
  return withDatabase((sqlite) => {
    const row = sqlite.prepare(`SELECT COUNT(*) AS count FROM ingestion_runs WHERE status IN ('queued', 'fetching', 'analyzing', 'persisting')`).get() as { count: number };
    return row.count > 0;
  });
}

export function getIngestionRun(id: string): IngestionRunRecord | undefined {
  const row = withDatabase((sqlite) => sqlite.prepare(`SELECT id, source_url AS sourceUrl, access_type AS accessType, status, phase, progress, commit_sha AS commitSha, manifest_json AS manifestJson, error_message AS errorMessage, created_at AS createdAt, updated_at AS updatedAt FROM ingestion_runs WHERE id = ?`).get(id)) as Omit<IngestionRunRecord, "manifest"> & { manifestJson?: string | null } | undefined;
  if (!row) return undefined;
  return {
    ...row,
    manifest: row.manifestJson ? JSON.parse(row.manifestJson) : null,
  };
}

function withDatabase<T>(callback: (sqlite: ReturnType<typeof openAnalysisDatabase>["sqlite"]) => T): T {
  const { sqlite } = openAnalysisDatabase(databasePath);
  try { bootstrapAnalysisDatabase(sqlite); return callback(sqlite); } finally { sqlite.close(); }
}
