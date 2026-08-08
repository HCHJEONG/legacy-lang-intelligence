"use client";

import "@xyflow/react/dist/style.css";

import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node } from "@xyflow/react";

import type { NeighborhoodGraph } from "@/lib/db/analysis-queries";

type SystemMapFlowProps = {
  graph: NeighborhoodGraph;
};

const nodeTypes = {
  entity: EntityNode,
};

export function SystemMapFlow({ graph }: SystemMapFlowProps) {
  const nodes = graph.nodes.map((node, index): Node => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    return {
      id: node.id,
      type: "entity",
      position: {
        x: column * 210,
        y: row * 112,
      },
      data: {
        label: node.label,
        type: node.type,
        selected: node.isSelected,
      },
    };
  });

  const edges = graph.edges.map((edge): Edge => {
    const color = edge.status === "unresolved" ? "#dc2626" : edge.confidenceBand === "high" ? "#15803d" : "#71717a";
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: "smoothstep",
      style: { stroke: color, strokeWidth: 1.5 },
      labelStyle: { fill: "#3f3f46", fontSize: 11, fontWeight: 600 },
    };
  });

  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.35} maxZoom={1.8}>
      <Background gap={18} color="#e4e4e7" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

function EntityNode({ data }: { data: { label: string; type: string; selected?: boolean } }) {
  return (
    <div
      className={[
        "w-44 rounded-md border bg-white px-3 py-2 text-left shadow-sm",
        data.selected ? "border-zinc-950 ring-2 ring-zinc-950/10" : "border-zinc-300",
      ].join(" ")}
    >
      <Handle type="target" position={Position.Left} className="size-2 bg-zinc-500" />
      <p className="truncate text-xs font-medium text-zinc-500">{data.type}</p>
      <p className="truncate text-sm font-semibold text-zinc-950">{data.label}</p>
      <Handle type="source" position={Position.Right} className="size-2 bg-zinc-500" />
    </div>
  );
}
