import assert from "node:assert/strict";
import test from "node:test";

import { buildRelationContext } from "../src/lib/ai/ask";
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
