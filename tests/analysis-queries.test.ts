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

test("expands multi-hop neighborhoods in the direction away from the selected entity", () => {
  const fixture = createFixture();
  try {
    fixture.db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?)").run("carddemo", "AWS CardDemo", "/carddemo", "2026-01-01T00:00:00Z");
    insertRun(fixture.db, "run", "carddemo", "2026-01-01T00:00:00Z", 5);
    for (const id of ["A", "B", "C", "D", "E"]) {
      insertEntity(fixture.db, id, "run", id);
    }
    insertRelation(fixture.db, "c-to-a", "run", "CALLS", "C", "A");
    insertRelation(fixture.db, "d-to-c", "run", "CALLS", "D", "C");
    insertRelation(fixture.db, "a-to-b", "run", "CALLS", "A", "B");
    insertRelation(fixture.db, "b-to-e", "run", "CALLS", "B", "E");

    const view = getSystemMapViewModel({ databasePath: fixture.path, projectId: "carddemo", query: "A", entityId: "A", hopLimit: 2 });
    const nodeIds = new Set(view.graph?.nodes.map((node) => node.id));
    assert.deepEqual(nodeIds, new Set(["A", "B", "C", "D", "E"]));
  } finally {
    fixture.close();
  }
});

test("applies relation and confidence filters to neighborhood relations", () => {
  const fixture = createFixture();
  try {
    fixture.db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?)").run("carddemo", "AWS CardDemo", "/carddemo", "2026-01-01T00:00:00Z");
    insertRun(fixture.db, "run", "carddemo", "2026-01-01T00:00:00Z", 3);
    for (const id of ["A", "B", "C"]) {
      insertEntity(fixture.db, id, "run", id);
    }
    insertRelation(fixture.db, "a-to-b", "run", "CALLS", "A", "B", "high");
    insertRelation(fixture.db, "a-to-c", "run", "COPIES", "A", "C", "low");

    const view = getSystemMapViewModel({
      databasePath: fixture.path,
      projectId: "carddemo",
      query: "A",
      entityId: "A",
      filters: { relationType: "CALLS", confidence: "high" },
    });
    assert.deepEqual(view.graph?.edges.map((edge) => edge.id), ["a-to-b"]);
  } finally {
    fixture.close();
  }
});

test("returns relation endpoints with source evidence", () => {
  const fixture = createFixture();
  try {
    fixture.db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?)").run("carddemo", "AWS CardDemo", "/carddemo", "2026-01-01T00:00:00Z");
    insertRun(fixture.db, "run", "carddemo", "2026-01-01T00:00:00Z", 2);
    insertEntity(fixture.db, "A", "run", "PROGA");
    insertEntity(fixture.db, "B", "run", "PROGB");
    insertRelation(fixture.db, "a-to-b", "run", "CALLS", "A", "B", "high", ["ev-a-to-b"]);
    fixture.db.prepare("INSERT INTO evidence VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("ev-a-to-b", "run", "PROGA.cbl", 10, 10, "CALL 'PROGB'", "test", "fixture");

    const view = getSystemMapViewModel({ databasePath: fixture.path, projectId: "carddemo", query: "PROGA", entityId: "A" });
    assert.equal(view.graph?.evidence[0]?.sourceEntityName, "PROGA");
    assert.equal(view.graph?.evidence[0]?.targetEntityName, "PROGB");
    assert.equal(view.graph?.evidence[0]?.targetEntityId, "B");
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

function insertRelation(
  db: Database.Database,
  id: string,
  runId: string,
  type: string,
  sourceEntityId: string,
  targetEntityId: string,
  confidenceBand = "high",
  evidenceIds: string[] = [],
) {
  db.prepare("INSERT INTO relations VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, runId, type, sourceEntityId, targetEntityId, targetEntityId, "{}");
  db.prepare("INSERT INTO provenance VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    `${id}-provenance`,
    runId,
    "relation",
    id,
    "test",
    "1",
    "fixture",
    confidenceBand === "high" ? 0.95 : 0.35,
    confidenceBand,
    "fixture",
    "Verified",
    JSON.stringify(evidenceIds),
  );
}
