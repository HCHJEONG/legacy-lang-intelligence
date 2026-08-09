"use client";

import { Bot, FileCode2, LoaderCircle, Network, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type AskResponse = {
  answer: string;
  mode: "verified-fallback" | "gemini-verified";
  intent: AskIntent | null;
  entity: { name: string; type: string } | null;
  relations: Array<{
    type: string;
    direction: "outgoing" | "incoming";
    source: string;
    target: string;
    otherEntity: string;
    status: string;
    confidence: string;
  }>;
  evidence: Array<{ filePath: string; startLine: number; endLine: number }>;
};

type AskIntent = "system-overview" | "transaction-flow" | "batch-jobs";

const suggestedQuestions: Array<{ intent: AskIntent; label: string; question: string }> = [
  { intent: "system-overview", label: "System overview", question: "What does the CardDemo system do?" },
  { intent: "transaction-flow", label: "Transaction flow", question: "How does a credit card transaction flow through this system?" },
  { intent: "batch-jobs", label: "Major batch jobs", question: "What are the major batch jobs in CardDemo?" },
];

export function AskAiPanel({ projectId }: { projectId?: string }) {
  const [question, setQuestion] = useState("What does CBTRN02C call?");
  const [intent, setIntent] = useState<AskIntent | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(nextQuestion: string, nextIntent: AskIntent | null) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: nextQuestion, projectId, intent: nextIntent }) });
      const payload = (await response.json()) as AskResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Ask AI failed");
      setResult(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ask AI failed");
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await ask(question, intent);
  }

  async function askSuggested(nextIntent: AskIntent, nextQuestion: string) {
    setQuestion(nextQuestion);
    setIntent(nextIntent);
    await ask(nextQuestion, nextIntent);
  }

  return (
    <section id="ask-ai" className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Bot className="size-4 text-zinc-600" /><h2 className="text-sm font-semibold">Ask AI</h2></div>
        <span className="inline-flex items-center gap-1 text-xs text-zinc-500"><ShieldCheck className="size-3.5" /> Verified context only</span>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input value={question} onChange={(event) => { setQuestion(event.target.value); setIntent(null); }} className="h-9 min-w-0 flex-1 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500" placeholder="Ask about a program, call, copybook, or dataset" />
        <Button type="submit" disabled={loading || !question.trim()}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Ask</Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestedQuestions.map((item) => (
          <button
            key={item.intent}
            type="button"
            onClick={() => void askSuggested(item.intent, item.question)}
            disabled={loading}
            className={[
              "inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium",
              intent === item.intent ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {result ? <div className="mt-4 border-t border-zinc-200 pt-4">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500"><span className="font-semibold text-zinc-950">{result.entity ? `${result.entity.type} ${result.entity.name}` : "No matching entity"}</span><span>{result.mode === "gemini-verified" ? "Gemini explained verified context" : "Deterministic verified summary"}</span></div>
        <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">{result.answer}</p>
        {result.relations.length ? <VerifiedFlow relations={result.relations} /> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="#system-map" className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"><Network className="size-3.5" /> Open System Map</a>
          <a href="#source-evidence" className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"><FileCode2 className="size-3.5" /> Source Evidence</a>
        </div>
        {result.evidence.length ? <div className="mt-3 flex flex-wrap gap-2">{result.evidence.slice(0, 6).map((item) => <a href="#source-evidence" key={`${item.filePath}:${item.startLine}`} className="rounded-md bg-zinc-50 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100">{item.filePath}:{item.startLine}-{item.endLine}</a>)}</div> : null}
      </div> : null}
    </section>
  );
}

function VerifiedFlow({ relations }: { relations: AskResponse["relations"] }) {
  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-zinc-500">
        <Network className="size-3.5" />
        Verified Relationships
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {relations.slice(0, 8).map((relation, index) => (
          <div key={`${relation.source}:${relation.type}:${relation.target}:${index}`} className="min-w-0 rounded-md border border-zinc-200 bg-white p-2 text-xs">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-semibold text-zinc-700">{relation.type}</span>
              <span className="text-zinc-500">{relation.direction}</span>
            </div>
            <div className="flex min-w-0 items-center gap-1 text-zinc-700">
              <span className="truncate">{relation.source}</span>
              <span className="shrink-0 text-zinc-400">-&gt;</span>
              <span className="truncate">{relation.target}</span>
            </div>
            <div className="mt-1 text-zinc-500">{relation.status} / {relation.confidence}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
