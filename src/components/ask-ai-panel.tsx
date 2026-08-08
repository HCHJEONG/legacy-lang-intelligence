"use client";

import { Bot, LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type AskResponse = {
  answer: string;
  mode: "verified-fallback" | "gemini-verified";
  entity: { name: string; type: string } | null;
  evidence: Array<{ filePath: string; startLine: number; endLine: number }>;
};

export function AskAiPanel({ projectId }: { projectId?: string }) {
  const [question, setQuestion] = useState("What does CBTRN02C call?");
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, projectId }) });
      const payload = (await response.json()) as AskResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Ask AI failed");
      setResult(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ask AI failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Bot className="size-4 text-zinc-600" /><h2 className="text-sm font-semibold">Ask AI</h2></div>
        <span className="inline-flex items-center gap-1 text-xs text-zinc-500"><ShieldCheck className="size-3.5" /> Verified context only</span>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input value={question} onChange={(event) => setQuestion(event.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500" placeholder="Ask about a program, call, copybook, or dataset" />
        <Button type="submit" disabled={loading || !question.trim()}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Ask</Button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {result ? <div className="mt-4 border-t border-zinc-200 pt-4">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500"><span className="font-semibold text-zinc-950">{result.entity ? `${result.entity.type} ${result.entity.name}` : "No matching entity"}</span><span>{result.mode === "gemini-verified" ? "Gemini explained verified context" : "Deterministic verified summary"}</span></div>
        <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">{result.answer}</p>
        {result.evidence.length ? <div className="mt-3 flex flex-wrap gap-2">{result.evidence.slice(0, 6).map((item) => <span key={`${item.filePath}:${item.startLine}`} className="rounded-md bg-zinc-50 px-2 py-1 text-xs text-zinc-600">{item.filePath}:{item.startLine}-{item.endLine}</span>)}</div> : null}
      </div> : null}
    </section>
  );
}
