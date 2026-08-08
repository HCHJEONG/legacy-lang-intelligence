import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import Database from "better-sqlite3";

import { getSystemMapViewModel } from "../src/lib/db/analysis-queries";
import { bootstrapAnalysisDatabase } from "../src/lib/db/bootstrap";

const coverage = (entities: number) => JSON.stringify({
  filesTotal: 1,
  filesWithEntities: entities ? 1 : 0,
  entityCoverage: entities ? 1 : 0,
  relationCoverage: 0,
  evidenceCoverage: 0,
  entityCount: entities,
  relationCount: 0,
  evidenceCount: 0,
  unresolvedCount: 0,
  unsupportedCount: 0,
  confidenceDistribution: {},
});

test("uses the latest non-empty run for the selected project", () => {
  const fixture = createFixture();
  try {
    fixture.db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?)").run("carddemo", "AWS CardDemo", "/carddemo", "2026-01-01T00:00:00Z");
    insertRun(fixture.db, "good", "carddemo", "2026-01-01T00:00:00Z", 1);
    insertEntity(fixture.db, "program", "good", "CBTRN02C");
    insertRun(fixture.db, "empty", "carddemo", "2026-01-02T00:00:00Z", 0);

    const view = getSystemMapViewModel({ databasePath: fixture.path, projectId: "carddemo", query: "CBTRN02C" });
    assert.equal(view.quality?.runId, "good");
    assert.equal(view.quality?.entityCount, 1);
    assert.equal(view.graph?.selectedEntity?.name, "CBTRN02C");
  } finally {
    fixture.close();
  }
});

test("keeps project analysis runs isolated", () => {
  const fixture = createFixture();
  try {
    fixture.db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?)").run("carddemo", "AWS CardDemo", "/carddemo", "2026-01-01T00:00:00Z");
    fixture.db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?)").run("github:example/repo", "example/repo", "/repo", "2026-01-02T00:00:00Z");
    insertRun(fixture.db, "carddemo-run", "carddemo", "2026-01-01T00:00:00Z", 1);
    insertRun(fixture.db, "repo-run", "github:example/repo", "2026-01-02T00:00:00Z", 1);
    insertEntity(fixture.db, "card-program", "carddemo-run", "CBTRN02C");
    insertEntity(fixture.db, "repo-program", "repo-run", "HELLO");

    const carddemo = getSystemMapViewModel({ databasePath: fixture.path, query: "CBTRN02C" });
    const repository = getSystemMapViewModel({ databasePath: fixture.path, projectId: "github:example/repo", query: "HELLO" });
    assert.equal(carddemo.selectedProject?.id, "carddemo");
    assert.equal(carddemo.graph?.selectedEntity?.name, "CBTRN02C");
    assert.equal(repository.selectedProject?.id, "github:example/repo");
    assert.equal(repository.graph?.selectedEntity?.name, "HELLO");
  } finally {
    fixture.close();
  }
});

function createFixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "legacy-analysis-"));
  const databasePath = path.join(directory, "analysis.sqlite");
  const db = new Database(databasePath);
  bootstrapAnalysisDatabase(db);
  db.prepare("INSERT INTO analysis_engines VALUES (?, ?, ?, ?)").run("test", "Test Analyzer", "1", "test");
  return {
    db,
    path: databasePath,
    close() {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function insertRun(db: Database.Database, id: string, projectId: string, generatedAt: string, entityCount: number) {
  db.prepare("INSERT INTO analysis_runs VALUES (?, ?, ?, ?, ?)").run(id, projectId, "test", generatedAt, coverage(entityCount));
}

function insertEntity(db: Database.Database, id: string, runId: string, name: string) {
  db.prepare("INSERT INTO entities VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, runId, "Program", name, name, `${name}.cbl`, "{}");
}
