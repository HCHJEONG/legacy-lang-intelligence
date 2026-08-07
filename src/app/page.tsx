import {
  Bot,
  Braces,
  Database,
  FileCode2,
  GitBranch,
  Network,
  ServerCog,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const pipelineItems = [
  { label: "CardDemo source", icon: GitBranch },
  { label: "Discovery", icon: FileCode2 },
  { label: "Static analysis", icon: Braces },
  { label: "SQLite graph", icon: Database },
  { label: "Ask AI", icon: Bot },
];

const workspaces = [
  {
    title: "System Map",
    status: "Planned after schema",
    icon: Network,
    body: "Interactive dependency neighborhoods will render verified entities and edges from static analysis.",
  },
  {
    title: "Ask AI",
    status: "Graph-aware route planned",
    icon: Bot,
    body: "Answers will be grounded in deterministic queries before Gemini explains the evidence.",
  },
  {
    title: "Source Viewer",
    status: "Evidence target",
    icon: FileCode2,
    body: "Entity and dependency evidence will link back to read-only source line ranges.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div>
            <p className="text-sm font-medium text-zinc-500">COBOL Intelligence PoC</p>
            <h1 className="text-xl font-semibold">Legacy Language Intelligence</h1>
          </div>
          <Button variant="outline" size="sm">
            <ServerCog className="size-4" />
            AWS private deploy
          </Button>
        </header>

        <section className="grid flex-1 gap-6 py-6 lg:grid-cols-[320px_1fr]">
          <aside className="border-r border-zinc-200 pr-0 lg:pr-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-600">Verified Pipeline</h2>
              <div className="space-y-2">
                {pipelineItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex h-11 items-center gap-3 rounded-md border border-zinc-200 bg-white px-3 text-sm"
                  >
                    <item.icon className="size-4 text-zinc-500" />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-3">
              {workspaces.map((workspace) => (
                <article key={workspace.title} className="rounded-md border border-zinc-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <workspace.icon className="size-5 text-zinc-600" />
                    <span className="rounded-sm bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                      {workspace.status}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold">{workspace.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{workspace.body}</p>
                </article>
              ))}
            </section>

            <section className="rounded-md border border-zinc-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-3">
                <Braces className="size-5 text-zinc-600" />
                <h2 className="text-base font-semibold">Current Implementation Target</h2>
              </div>
              <div className="grid gap-3 text-sm text-zinc-700 md:grid-cols-2">
                <p className="rounded-md bg-zinc-50 p-3">
                  `npm run ingest` clones or reads CardDemo from a configured source path, classifies files,
                  and emits analysis JSON without committing upstream source into this repo.
                </p>
                <p className="rounded-md bg-zinc-50 p-3">
                  The first analyzer extracts program, copybook, field, JCL job, step, call, copy, SQL,
                  CICS, file, and dataset evidence before database schema is finalized.
                </p>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
