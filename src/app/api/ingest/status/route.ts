import { cancelIngestionRun, getIngestionRun } from "@/lib/ingestion/ingestion-state";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("runId");
  if (!id) return Response.json({ error: "runId is required" }, { status: 400 });
  const run = getIngestionRun(id);
  return run ? Response.json(run) : Response.json({ error: "ingestion run not found" }, { status: 404 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("runId");
  if (!id) return Response.json({ error: "runId is required" }, { status: 400 });
  const run = getIngestionRun(id);
  if (!run) return Response.json({ error: "ingestion run not found" }, { status: 404 });
  if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") return Response.json(run);
  cancelIngestionRun(id);
  return Response.json(getIngestionRun(id));
}
