import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import Database from "better-sqlite3";

import { answerQuestion, buildRelationContext } from "../src/lib/ai/ask";
import { bootstrapAnalysisDatabase } from "../src/lib/db/bootstrap";
import type { NeighborhoodGraph } from "../src/lib/db/analysis-queries";

test("builds direction-sensitive Ask AI relation context", () => {
  const graph: NeighborhoodGraph = {
    selectedEntity: {
      id: "A",
      type: "Program",
      name: "A",
      qualifiedName: "A",
      sourceFilePath: "A.cbl",
      relationCount: 2,
    },
    nodes: [
      { id: "A", label: "A", type: "Program", sourceFilePath: "A.cbl", isSelected: true },
      { id: "B", label: "B", type: "Program", sourceFilePath: "B.cbl", isSelected: false },
      { id: "C", label: "C", type: "Program", sourceFilePath: "C.cbl", isSelected: false },
    ],
    edges: [
      { id: "a-to-b", source: "A", target: "B", label: "CALLS", status: "Verified", confidenceBand: "high" },
      { id: "c-to-a", source: "C", target: "A", label: "CALLS", status: "Verified", confidenceBand: "high" },
    ],
    evidence: [],
    truncated: false,
  };

  assert.deepEqual(buildRelationContext(graph), [
    {
      type: "CALLS",
      direction: "outgoing",
      sourceId: "A",
      targetId: "B",
      source: "A",
      target: "B",
      otherEntityId: "B",
      otherEntity: "B",
      status: "Verified",
      confidence: "high",
    },
    {
      type: "CALLS",
      direction: "incoming",
      sourceId: "C",
      targetId: "A",
      source: "C",
      target: "A",
      otherEntityId: "C",
      otherEntity: "C",
      status: "Verified",
      confidence: "high",
    },
  ]);
});

test("uses two-hop verified context for change-impact questions", async () => {
  const fixture = createFixture();
  try {
    fixture.db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?)").run("carddemo", "AWS CardDemo", "/carddemo", "2026-01-01T00:00:00Z");
    fixture.db.prepare("INSERT INTO analysis_runs VALUES (?, ?, ?, ?, ?)").run("run", "carddemo", "test", "2026-01-01T00:00:00Z", coverage(3));
    for (const id of ["PROGA", "PROGB", "PROGC"]) {
      fixture.db.prepare("INSERT INTO entities VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, "run", "Program", id, id, `${id}.cbl`, "{}");
    }
    insertRelation(fixture.db, "a-to-b", "run", "CALLS", "PROGA", "PROGB");
    insertRelation(fixture.db, "b-to-c", "run", "CALLS", "PROGB", "PROGC");

    const result = await answerQuestion("What happens if PROGA changes?", "carddemo", undefined, fixture.path);
    assert.equal(result.intent, "change-impact");
    assert.deepEqual(result.relations.map((relation) => `${relation.source}->${relation.target}`), ["PROGA->PROGB", "PROGB->PROGC"]);
  } finally {
    fixture.close();
  }
});

function createFixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "legacy-ask-"));
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

function coverage(entities: number) {
  return JSON.stringify({
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
}

function insertRelation(db: Database.Database, id: string, runId: string, type: string, sourceEntityId: string, targetEntityId: string) {
  db.prepare("INSERT INTO relations VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, runId, type, sourceEntityId, targetEntityId, targetEntityId, "{}");
  db.prepare("INSERT INTO provenance VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    `${id}-provenance`,
    runId,
    "relation",
    id,
    "test",
    "1",
    "fixture",
    0.95,
    "high",
    "fixture",
    "Verified",
    "[]",
  );
}
