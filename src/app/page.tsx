import {
  AlertTriangle,
  BarChart3,
  Database,
  FileCode2,
  Network,
  Search,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SystemMapFlow } from "@/components/system-map-flow";
import { AskAiPanel } from "@/components/ask-ai-panel";
import { getSystemMapViewModel } from "@/lib/db/analysis-queries";

type HomeProps = {
  searchParams?: Promise<{
  q?: string;
  entity?: string;
  hops?: string;
  entityType?: string;
  relationType?: string;
  confidence?: "all" | "high" | "medium" | "low";
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = params?.q ?? "CBTRN02C";
  const entityId = params?.entity;
  const hopLimit = parseHopLimit(params?.hops);
  const filters = { entityType: params?.entityType, relationType: params?.relationType, confidence: params?.confidence ?? "all" } as const;
  const viewModel = getSystemMapViewModel({ query, entityId, hopLimit, filters });

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 lg:px-7">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">COBOL Intelligence PoC</p>
            <h1 className="text-xl font-semibold">Legacy Language Intelligence</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-600">
              <Database className="size-3.5" />
              SQLite backed
            </span>
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-600">
              <ShieldCheck className="size-3.5" />
              Evidence first
            </span>
          </div>
        </header>

        {!viewModel.databaseReady ? (
          <EmptyDatabaseState />
        ) : (
          <div className="grid flex-1 gap-5 py-5 xl:grid-cols-[360px_1fr]">
            <aside className="space-y-5">
              {viewModel.quality ? <AnalysisQuality quality={viewModel.quality} /> : null}
              <EntitySearch query={query} results={viewModel.searchResults} selectedId={viewModel.graph?.selectedEntity?.id} filters={filters} />
            </aside>

            <section className="space-y-5">
              <SystemMapPanel graph={viewModel.graph} query={query} hopLimit={hopLimit} filters={filters} />
              <AskAiPanel />
              <EvidencePanel graph={viewModel.graph} />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyDatabaseState() {
  return (
    <section className="grid flex-1 place-items-center py-12">
      <div className="max-w-xl rounded-md border border-zinc-200 bg-white p-6 text-center">
        <Database className="mx-auto mb-4 size-8 text-zinc-500" />
        <h2 className="text-lg font-semibold">No persisted analysis yet</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Run `npm run ingest` and `npm run persist` to generate the local CardDemo SQLite database.
        </p>
      </div>
    </section>
  );
}

function AnalysisQuality({ quality }: { quality: NonNullable<ReturnType<typeof getSystemMapViewModel>["quality"]> }) {
  const confidenceTotal = Object.values(quality.confidenceDistribution).reduce((sum, count) => sum + count, 0);
  const highConfidence = quality.confidenceDistribution.high ?? 0;
  const confidenceScore = confidenceTotal === 0 ? 0 : highConfidence / confidenceTotal;

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-zinc-600" />
          <h2 className="text-sm font-semibold">Analysis Quality</h2>
        </div>
        <span className="text-xs text-zinc-500">{formatTimestamp(quality.generatedAt)}</span>
      </div>
      <p className="mt-3 text-xs text-zinc-500">{quality.analyzer} {quality.analyzerVersion}</p>

      <div className="space-y-3">
        <MetricRow label="Files with entities" value={`${quality.filesAnalyzed} / ${quality.filesTotal}`} />
        <MetricRow label="Entity coverage" value={formatPercent(quality.entityCoverage)} />
        <MetricRow label="Relation coverage" value={formatPercent(quality.relationCoverage)} />
        <MetricRow label="Evidence coverage" value={formatPercent(quality.evidenceCoverage)} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Entities" value={quality.entityCount} />
        <MiniStat label="Relations" value={quality.relationCount} />
        <MiniStat label="Evidence" value={quality.evidenceCount} />
      </div>

      <div className="mt-4 border-t border-zinc-200 pt-4">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="size-4 text-zinc-500" />
          <h3 className="text-xs font-semibold uppercase text-zinc-500">Known Unknowns</h3>
        </div>
        <div className="space-y-2">
          <MetricRow label="Unresolved findings" value={quality.unresolvedCount.toLocaleString()} />
          <MetricRow label="Unsupported findings" value={quality.unsupportedCount.toLocaleString()} />
          {quality.unresolvedByCategory.map((item) => (
            <MetricRow key={item.label} label={titleCase(item.label)} value={item.count.toLocaleString()} />
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-zinc-200 pt-4">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-zinc-500">
          <span>Overall confidence</span>
          <span>{confidenceScore >= 0.65 ? "GOOD" : "PARTIAL"}</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-100">
          <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.round(confidenceScore * 100)}%` }} />
        </div>
      </div>
    </section>
  );
}

function EntitySearch({
  query,
  results,
  selectedId,
  filters,
}: {
  query: string;
  results: ReturnType<typeof getSystemMapViewModel>["searchResults"];
  selectedId?: string;
  filters: { entityType?: string; relationType?: string; confidence?: string };
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Search className="size-4 text-zinc-600" />
        <h2 className="text-sm font-semibold">Search Entities</h2>
      </div>
      <form className="mb-3 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          className="h-8 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2.5 text-sm outline-none focus:border-zinc-500"
          placeholder="Program, copybook, dataset..."
        />
        <Button size="sm" variant="outline" type="submit">
          <Search className="size-3.5" />
          Search
        </Button>
      </form>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <select name="entityType" defaultValue={filters.entityType ?? "all"} className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs">
          <option value="all">All node types</option>
          {['Program', 'Paragraph', 'Copybook', 'Field', 'Job', 'Step', 'Dataset', 'Transaction', 'Table'].map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <select name="confidence" defaultValue={filters.confidence ?? "all"} className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs">
          <option value="all">All confidence</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
      </div>
      <div className="space-y-2">
        {results.map((entity) => (
          <a
            key={entity.id}
            href={`/?q=${encodeURIComponent(query)}&entity=${encodeURIComponent(entity.id)}`}
            className={[
              "block rounded-md border px-3 py-2 text-sm transition-colors hover:bg-zinc-50",
              entity.id === selectedId ? "border-zinc-950 bg-zinc-50" : "border-zinc-200 bg-white",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{entity.name}</span>
              <span className="shrink-0 text-xs text-zinc-500">{entity.relationCount}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
              <span>{entity.type}</span>
              {entity.sourceFilePath ? <span className="truncate">{entity.sourceFilePath}</span> : null}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function SystemMapPanel({
  graph,
  query,
  hopLimit,
  filters,
}: {
  graph: ReturnType<typeof getSystemMapViewModel>["graph"];
  query: string;
  hopLimit: 1 | 2 | 3;
  filters: { entityType?: string; relationType?: string; confidence?: string };
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Network className="size-4 text-zinc-600" />
          <div>
            <h2 className="text-sm font-semibold">System Map</h2>
            <p className="text-xs text-zinc-500">Search &rarr; Entity &rarr; Neighborhood &rarr; Relation &rarr; Source</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {[1, 2, 3].map((hop) => (
            <a
              key={hop}
              href={`/?q=${encodeURIComponent(query)}${graph?.selectedEntity ? `&entity=${encodeURIComponent(graph.selectedEntity.id)}` : ""}&hops=${hop}`}
              className={[
                "inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium",
                hopLimit === hop ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-600",
              ].join(" ")}
            >
              {hop}-hop
            </a>
          ))}
          <form className="flex gap-1" method="get">
            <input type="hidden" name="q" value={query} />
            {graph?.selectedEntity ? <input type="hidden" name="entity" value={graph.selectedEntity.id} /> : null}
            <input type="hidden" name="hops" value={hopLimit} />
            <select name="relationType" defaultValue={filters.relationType ?? "all"} className="h-7 rounded-md border border-zinc-200 bg-white px-2 text-xs">
              <option value="all">All relations</option><option value="CALLS">CALLS</option><option value="COPIES">COPIES</option><option value="EXECUTES">EXECUTES</option><option value="READS">READS</option><option value="WRITES">WRITES</option>
            </select>
            <Button size="sm" variant="outline" type="submit">Filter</Button>
          </form>
        </div>
      </div>
      {graph?.selectedEntity ? (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-3 text-xs text-zinc-600">
            <span className="font-semibold text-zinc-950">{graph.selectedEntity.name}</span>
            <span>{graph.nodes.length} nodes</span>
            <span>{graph.edges.length} relations</span>
            {graph.truncated ? <span className="text-red-600">truncated for readability</span> : null}
          </div>
          <div className="h-[520px]">
            <SystemMapFlow graph={graph} />
          </div>
          <div className="border-t border-zinc-200 p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Follow relation</p>
            <div className="flex flex-wrap gap-2">
              {graph.edges.slice(0, 12).map((edge) => {
                const target = graph.nodes.find((node) => node.id === edge.target);
                return target && !target.id.startsWith("unresolved:") ? <a key={edge.id} href={`/?q=${encodeURIComponent(target.label)}&entity=${encodeURIComponent(target.id)}&hops=${hopLimit}`} className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50">{edge.label} → {target.label}</a> : null;
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="grid h-[520px] place-items-center text-sm text-zinc-500">Search and select an entity.</div>
      )}
    </section>
  );
}

function EvidencePanel({ graph }: { graph: ReturnType<typeof getSystemMapViewModel>["graph"] }) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileCode2 className="size-4 text-zinc-600" />
        <h2 className="text-sm font-semibold">Source Evidence</h2>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {graph?.evidence.length ? (
          graph.evidence.map((item) => (
            <article key={`${item.relationId}:${item.filePath}:${item.startLine}`} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-zinc-700">{item.relationType}</span>
                <span className="text-zinc-500">
                  {item.startLine}-{item.endLine}
                </span>
              </div>
              <p className="mb-2 truncate text-xs text-zinc-500">{item.filePath}</p>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs leading-5 text-zinc-700">
                {item.sourceLines.map((line, index) => `${item.startLine + index}  ${line}`).join("\n")}
              </pre>
            </article>
          ))
        ) : (
          <p className="text-sm text-zinc-500">Select an entity with verified relations to see source evidence.</p>
        )}
      </div>
    </section>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-zinc-600">{label}</span>
      <span className="font-medium text-zinc-950">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-zinc-50 px-2 py-2">
      <p className="text-sm font-semibold">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function parseHopLimit(value?: string): 1 | 2 | 3 {
  if (value === "2") {
    return 2;
  }
  if (value === "3") {
    return 3;
  }
  return 1;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
