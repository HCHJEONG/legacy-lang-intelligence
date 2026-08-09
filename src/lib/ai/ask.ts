import { getSystemMapViewModel, type NeighborhoodGraph } from "@/lib/db/analysis-queries";
import { GoogleAuth } from "google-auth-library";

export type AskResult = {
  answer: string;
  mode: "verified-fallback" | "gemini-verified";
  intent: AskIntent | null;
  entity: { id: string; name: string; type: string } | null;
  relations: VerifiedRelationContext[];
  evidence: Array<{ relationId: string; filePath: string; startLine: number; endLine: number; snippet: string }>;
};

export type AskIntent = "system-overview" | "transaction-flow" | "batch-jobs";

export type VerifiedRelationContext = {
  type: string;
  direction: "outgoing" | "incoming";
  sourceId: string;
  targetId: string;
  source: string;
  target: string;
  otherEntityId: string;
  otherEntity: string;
  status: string;
  confidence: string;
};

export async function answerQuestion(question: string, projectId?: string, rawIntent?: string): Promise<AskResult> {
  const intent = parseIntent(rawIntent);
  const query = getIntentQuery(intent) ?? extractEntityQuery(question);
  const view = getSystemMapViewModel({ query, projectId, hopLimit: 1 });
  const entity = view.graph?.selectedEntity ?? null;
  const relations = buildRelationContext(view.graph);
  const evidence = (view.graph?.evidence ?? []).map(({ relationId, filePath, startLine, endLine, snippet }) => ({ relationId, filePath, startLine, endLine, snippet }));
  const context = { question, intent, entity, relations, evidence, quality: view.quality };

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_CLOUD_PROJECT) {
    const answer = await askGemini(context);
    if (answer) {
      return { answer, mode: "gemini-verified", intent, entity, relations, evidence };
    }
  }

  return { answer: buildVerifiedFallback(context), mode: "verified-fallback", intent, entity, relations, evidence };
}

function parseIntent(value?: string): AskIntent | null {
  return value === "system-overview" || value === "transaction-flow" || value === "batch-jobs" ? value : null;
}

function getIntentQuery(intent: AskIntent | null) {
  if (intent === "transaction-flow") return "CBTRN02C";
  if (intent === "batch-jobs") return "J";
  if (intent === "system-overview") return "CB";
  return null;
}

function extractEntityQuery(question: string) {
  const token = question.match(/[A-Z][A-Z0-9_-]{3,}/)?.[0];
  return token ?? question.trim().slice(0, 80);
}

export function buildRelationContext(graph: NeighborhoodGraph | null | undefined): VerifiedRelationContext[] {
  if (!graph?.selectedEntity) return [];
  const selectedEntityId = graph.selectedEntity.id;
  const nodeNames = new Map(graph.nodes.map((node) => [node.id, node.label]));
  return graph.edges.map((edge) => {
    const source = nodeNames.get(edge.source) ?? edge.source;
    const target = nodeNames.get(edge.target) ?? "Unresolved target";
    const direction = edge.source === selectedEntityId ? "outgoing" : "incoming";
    return {
      type: edge.label,
      direction,
      sourceId: edge.source,
      targetId: edge.target,
      source,
      target,
      otherEntityId: direction === "outgoing" ? edge.target : edge.source,
      otherEntity: direction === "outgoing" ? target : source,
      status: edge.status,
      confidence: edge.confidenceBand,
    };
  });
}

async function askGemini(context: Record<string, unknown>) {
  const model = process.env.VERTEX_AI_MODEL_ID ?? "gemini-3.6-flash";
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? "global";
  if (!project) return null;

  const auth = new GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) return null;

  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  const response = await fetch(`https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token.token}` },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `You explain legacy code. Use only the VERIFIED_CONTEXT below. Never invent entities, relations, source lines, or behavior. If evidence is missing, say it is unresolved. Keep the answer concise and mention evidence locations. VERIFIED_CONTEXT:\n${JSON.stringify(context)}` }] }],
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

function buildVerifiedFallback(context: { intent: AskIntent | null; entity: { name: string; type: string } | null; relations: VerifiedRelationContext[]; evidence: Array<{ filePath: string; startLine: number; endLine: number }> }) {
  if (!context.entity) return "No matching entity was found in the verified analysis. Try a program, copybook, job, or dataset name from the analyzed repository.";
  const outgoing = context.relations.filter((relation) => relation.direction === "outgoing");
  const incoming = context.relations.filter((relation) => relation.direction === "incoming");
  const outgoingText = outgoing.length
    ? outgoing.slice(0, 6).map((relation) => `${relation.type} ${relation.target} (${relation.confidence})`).join(", ")
    : "none";
  const incomingText = incoming.length
    ? incoming.slice(0, 6).map((relation) => `${relation.source} -> ${relation.type} (${relation.confidence})`).join(", ")
    : "none";
  const evidenceText = context.evidence.length
    ? context.evidence.slice(0, 4).map((item) => `${item.filePath}:${item.startLine}-${item.endLine}`).join(", ")
    : "no source evidence is available for the visible relations";
  const prefix = context.intent ? `${formatIntent(context.intent)}: ` : "";
  return `${prefix}For ${context.entity.type} ${context.entity.name}, static analysis verifies outgoing relations: ${outgoingText}. Incoming relations: ${incomingText}. Evidence: ${evidenceText}. This answer is limited to persisted static-analysis results; dynamic calls and unresolved targets may be missing.`;
}

function formatIntent(intent: AskIntent) {
  if (intent === "system-overview") return "System overview";
  if (intent === "transaction-flow") return "Transaction flow";
  return "Major batch jobs";
}
