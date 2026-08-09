import { getSystemMapViewModel, type NeighborhoodGraph } from "@/lib/db/analysis-queries";
import { GoogleAuth } from "google-auth-library";

export type AskResult = {
  answer: string;
  mode: "verified-fallback" | "gemini-verified";
  entity: { id: string; name: string; type: string } | null;
  relations: VerifiedRelationContext[];
  evidence: Array<{ filePath: string; startLine: number; endLine: number; snippet: string }>;
};

export type VerifiedRelationContext = {
  type: string;
  direction: "outgoing" | "incoming";
  source: string;
  target: string;
  otherEntity: string;
  status: string;
  confidence: string;
};

export async function answerQuestion(question: string, projectId?: string): Promise<AskResult> {
  const query = extractEntityQuery(question);
  const view = getSystemMapViewModel({ query, projectId, hopLimit: 1 });
  const entity = view.graph?.selectedEntity ?? null;
  const relations = buildRelationContext(view.graph);
  const evidence = (view.graph?.evidence ?? []).map(({ filePath, startLine, endLine, snippet }) => ({ filePath, startLine, endLine, snippet }));
  const context = { question, entity, relations, evidence, quality: view.quality };

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_CLOUD_PROJECT) {
    const answer = await askGemini(context);
    if (answer) {
      return { answer, mode: "gemini-verified", entity, relations, evidence };
    }
  }

  return { answer: buildVerifiedFallback(context), mode: "verified-fallback", entity, relations, evidence };
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
      source,
      target,
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

function buildVerifiedFallback(context: { entity: { name: string; type: string } | null; relations: VerifiedRelationContext[]; evidence: Array<{ filePath: string; startLine: number; endLine: number }> }) {
  if (!context.entity) return "검증된 분석 결과에서 질문과 일치하는 entity를 찾지 못했습니다. 다른 프로그램명, copybook명 또는 dataset명을 검색해 주세요.";
  const outgoing = context.relations.filter((relation) => relation.direction === "outgoing");
  const incoming = context.relations.filter((relation) => relation.direction === "incoming");
  const outgoingText = outgoing.length
    ? outgoing.slice(0, 6).map((relation) => `${relation.type} ${relation.target} (${relation.confidence})`).join(", ")
    : "없음";
  const incomingText = incoming.length
    ? incoming.slice(0, 6).map((relation) => `${relation.source} -> ${relation.type} (${relation.confidence})`).join(", ")
    : "없음";
  const evidenceText = context.evidence.length
    ? context.evidence.slice(0, 4).map((item) => `${item.filePath}:${item.startLine}-${item.endLine}`).join(", ")
    : "확인된 source evidence가 없습니다";
  return `${context.entity.type} ${context.entity.name} 기준으로 정적 분석이 확인한 outgoing 관계는 ${outgoingText}입니다. incoming 관계는 ${incomingText}입니다. 근거: ${evidenceText}. 이는 정적 분석으로 확인된 범위이며, 동적 호출이나 unresolved target은 포함되지 않을 수 있습니다.`;
}
