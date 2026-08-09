"use client";

import { CheckCircle2, ExternalLink, FolderGit2, LockKeyhole, Send, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type Access = "public" | "private" | "restricted";

export function RepositoryIngestionPanel() {
  const router = useRouter();
  const [access, setAccess] = useState<Access>("public");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(null); setError(null);
    try {
      const response = await fetch("/api/ingest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, access }) });
      const result = (await response.json()) as { message?: string; error?: string; projectId?: string };
      if (!response.ok) throw new Error(result.error ?? "Repository validation failed");
      setMessage(result.message ?? "Request accepted.");
      if (result.projectId) router.push(`/?project=${encodeURIComponent(result.projectId)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Repository validation failed");
    } finally { setBusy(false); }
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
      {message ? <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message} {access !== "public" ? <a className="font-semibold underline" href="mailto:hcjeong@empas.com">hcjeong@empas.com으로 문의</a> : null}</p> : null}
      {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}

function AccessOption({ value, selected, onSelect, icon, title, detail }: { value: Access; selected: Access; onSelect: (value: Access) => void; icon: React.ReactNode; title: string; detail: string }) {
  return <button type="button" onClick={() => onSelect(value)} className={["flex items-center gap-2 rounded-md border px-3 py-2 text-left", selected === value ? "border-zinc-950 bg-zinc-50" : "border-zinc-200 bg-white"].join(" ")}><span className="text-zinc-600">{icon}</span><span><span className="block text-xs font-semibold text-zinc-900">{title}</span><span className="block text-xs text-zinc-500">{detail}</span></span></button>;
}
