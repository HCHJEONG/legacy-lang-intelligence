import { answerQuestion } from "@/lib/ai/ask";

export async function POST(request: Request) {
  const body = (await request.json()) as { question?: string };
  const question = body.question?.trim();
  if (!question) return Response.json({ error: "question is required" }, { status: 400 });
  if (question.length > 1000) return Response.json({ error: "question is too long" }, { status: 400 });
  try {
    return Response.json(await answerQuestion(question));
  } catch {
    return Response.json({ error: "The analysis query could not be completed." }, { status: 500 });
  }
}
