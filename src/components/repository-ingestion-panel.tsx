"use client";

import { BarChart3, CheckCircle2, ExternalLink, FolderGit2, LoaderCircle, LockKeyhole, Map, MessageSquare, Send, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type Access = "public" | "private" | "restricted";
type IngestionRun = {
  id: string;
  status: "queued" | "fetching" | "analyzing" | "persisting" | "completed" | "failed" | "cancelled";
  phase: string;
  progress: number;
  errorMessage?: string | null;
  commitSha?: string | null;
  manifest?: {
    projectId?: string;
    analysisRunId?: string;
    entities?: number;
    relations?: number;
    unresolved?: number;
    files?: unknown[];
  } | null;
};

export function RepositoryIngestionPanel() {
  const [access, setAccess] = useState<Access>("public");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<IngestionRun | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(null); setError(null);
    try {
      const response = await fetch("/api/ingest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, access }) });
      const result = (await response.json()) as { message?: string; error?: string; projectId?: string; ingestionRunId?: string; status?: string; reusedFromRunId?: string };
      if (!response.ok) throw new Error(result.error ?? "Repository validation failed");
      setMessage(result.message ?? "Request accepted.");
      if (result.projectId) setProjectId(result.projectId);
      if (result.ingestionRunId && result.status === "completed") {
        const statusResponse = await fetch(`/api/ingest/status?runId=${encodeURIComponent(result.ingestionRunId)}`, { cache: "no-store" });
        const statusPayload = (await statusResponse.json()) as IngestionRun & { error?: string };
        if (statusResponse.ok) setRun(statusPayload);
        return;
      }
      if (result.ingestionRunId && result.status === "queued") {
        await pollRun(result.ingestionRunId, result.projectId ?? null);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Repository validation failed");
    } finally { setBusy(false); }
  }

  async function pollRun(runId: string, nextProjectId: string | null) {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const response = await fetch(`/api/ingest/status?runId=${encodeURIComponent(runId)}`, { cache: "no-store" });
      const payload = (await response.json()) as IngestionRun & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Ingestion status could not be read");
      setRun(payload);
      if (payload.status === "completed") {
        setProjectId(payload.manifest?.projectId ?? nextProjectId);
        setMessage("Analysis completed. Choose the next action below.");
        return;
      }
      if (payload.status === "failed") throw new Error(payload.errorMessage ?? "Repository ingestion failed");
      if (payload.status === "cancelled") {
        setMessage("Analysis cancelled.");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error("Repository ingestion timed out while waiting for completion.");
  }

  async function cancelRun() {
    if (!run || run.status === "completed" || run.status === "failed" || run.status === "cancelled") return;
    const response = await fetch(`/api/ingest/status?runId=${encodeURIComponent(run.id)}`, { method: "DELETE" });
    const payload = (await response.json()) as IngestionRun & { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Cancellation failed");
      return;
    }
    setRun(payload);
    setMessage("Analysis cancelled.");
  }

  return (
    <section id="repository-ingestion" className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2"><FolderGit2 className="size-4 text-zinc-600" /><div><h2 className="text-sm font-semibold">Analyze a repository</h2><p className="mt-1 text-xs text-zinc-500">Start with a public GitHub URL. Source boundaries are explicit.</p></div></div>
        <ShieldAlert className="size-4 text-zinc-500" />
      </div>
      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <AccessOption value="public" selected={access} onSelect={setAccess} icon={<CheckCircle2 className="size-4" />} title="Public repo" detail="Free" />
        <AccessOption value="private" selected={access} onSelect={setAccess} icon={<LockKeyhole className="size-4" />} title="Private repo" detail="Contact us" />
        <AccessOption value="restricted" selected={access} onSelect={setAccess} icon={<ShieldAlert className="size-4" />} title="Source stays in company" detail="Contact us" />
      </div>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <input value={url} onChange={(event) => setUrl(event.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500" placeholder="https://github.com/org/repository" />
        <Button type="submit" disabled={busy || !url.trim()}>{access === "public" ? <Send className="size-4" /> : <ExternalLink className="size-4" />} {access === "public" ? "Validate repository" : "Contact us"}</Button>
      </form>
      <p className="mt-3 text-xs text-zinc-500">Public repository source is used only for analysis. We never execute code from the repository.</p>
      {run ? <IngestionProgress run={run} projectId={projectId} onCancel={() => void cancelRun()} /> : null}
      {message ? <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message} {access !== "public" ? <a className="font-semibold underline" href="mailto:hcjeong@empas.com">hcjeong@empas.com으로 문의</a> : null}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}

function IngestionProgress({ run, projectId, onCancel }: { run: IngestionRun; projectId: string | null; onCancel: () => void }) {
  const completed = run.status === "completed";
  const running = run.status === "queued" || run.status === "fetching" || run.status === "analyzing" || run.status === "persisting";
  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-zinc-700">{run.phase}</span>
        <span className="text-zinc-500">{run.progress}%</span>
      </div>
      <div className="h-2 rounded-full bg-white">
        <div className="h-2 rounded-full bg-zinc-900 transition-all" style={{ width: `${run.progress}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-600">
        <span className="rounded-md bg-white px-2 py-1">{run.status}</span>
        {run.commitSha ? <span className="rounded-md bg-white px-2 py-1">{run.commitSha.slice(0, 12)}</span> : null}
        {running ? <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1"><LoaderCircle className="size-3 animate-spin" /> Running</span> : null}
        {run.status === "cancelled" ? <span className="rounded-md bg-white px-2 py-1">Cancelled</span> : null}
      </div>
      {running ? <Button type="button" size="sm" variant="outline" className="mt-3" onClick={onCancel}>Cancel</Button> : null}
      {completed ? (
        <>
          <div className="mt-3 grid gap-2 text-center sm:grid-cols-3">
            <MiniStat label="Entities" value={run.manifest?.entities} />
            <MiniStat label="Relations" value={run.manifest?.relations} />
            <MiniStat label="Unresolved" value={run.manifest?.unresolved} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={projectId ? `/?project=${encodeURIComponent(projectId)}#ask-ai` : "#ask-ai"} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"><MessageSquare className="size-3.5" /> Ask AI</a>
            <a href={projectId ? `/?project=${encodeURIComponent(projectId)}#system-map` : "#system-map"} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"><Map className="size-3.5" /> Open System Map</a>
            <a href={projectId ? `/?project=${encodeURIComponent(projectId)}#analysis-quality` : "#analysis-quality"} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"><BarChart3 className="size-3.5" /> View Analysis Quality</a>
          </div>
        </>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-md bg-white px-2 py-2">
      <p className="text-sm font-semibold text-zinc-950">{(value ?? 0).toLocaleString()}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function AccessOption({ value, selected, onSelect, icon, title, detail }: { value: Access; selected: Access; onSelect: (value: Access) => void; icon: React.ReactNode; title: string; detail: string }) {
  return <button type="button" onClick={() => onSelect(value)} className={["flex items-center gap-2 rounded-md border px-3 py-2 text-left", selected === value ? "border-zinc-950 bg-zinc-50" : "border-zinc-200 bg-white"].join(" ")}><span className="text-zinc-600">{icon}</span><span><span className="block text-xs font-semibold text-zinc-900">{title}</span><span className="block text-xs text-zinc-500">{detail}</span></span></button>;
}
