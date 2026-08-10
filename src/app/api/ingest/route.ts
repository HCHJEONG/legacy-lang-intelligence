import { fetchPublicGithubRepository, resolvePublicGithubHead } from "@/lib/ingestion/github-fetcher";
import { parseGithubRepository } from "@/lib/ingestion/github-url";
import { analyzeAndPersistSource } from "@/lib/ingestion/analyze-source";
import { createIngestionRun, findCompletedIngestionRun, getIngestionRun, hasActiveIngestionRun, updateIngestionRun } from "@/lib/ingestion/ingestion-state";

export async function POST(request: Request) {
  const body = (await request.json()) as { url?: string; access?: "public" | "private" | "restricted" };
  const url = body.url?.trim() ?? "";
  const repository = parseGithubRepository(url);
  if (!repository) return Response.json({ error: "Enter a public GitHub repository URL, for example https://github.com/org/repository." }, { status: 400 });
  if (body.access === "private") return Response.json({ status: "contact", message: "Private repository analysis is available by arrangement. Please contact hcjeong@empas.com." });
  if (body.access === "restricted") return Response.json({ status: "contact", message: "If source code cannot leave your company, contact hcjeong@empas.com for a private deployment or in-company analysis option." });
  if (hasActiveIngestionRun()) return Response.json({ error: "Another repository analysis is already running. Please wait for it to finish or cancel it before starting a new one." }, { status: 409 });
  const sourceUrl = `https://github.com/${repository.owner}/${repository.name}`;
  const commitSha = await resolvePublicGithubHead(repository);
  const reusableRun = findCompletedIngestionRun(sourceUrl, commitSha);
  const runId = createIngestionRun(sourceUrl, body.access ?? "public");
  const projectId = `github:${repository.owner.toLowerCase()}/${repository.name.toLowerCase()}`;

  if (reusableRun) {
    const reusableManifest = reusableRun.manifest && typeof reusableRun.manifest === "object" ? reusableRun.manifest : {};
    updateIngestionRun(runId, "completed", "Reusing existing analysis for unchanged commit", 100, {
      commitSha,
      manifest: {
        ...reusableManifest,
        reusedFromRunId: reusableRun.id,
        sourceUrl,
        commitSha,
        projectId,
      },
    });
    return Response.json({
      status: "completed",
      ingestionRunId: runId,
      projectId,
      reusedFromRunId: reusableRun.id,
      message: "This repository commit was already analyzed. Reusing the existing persisted result.",
      policy: "The repository is treated as source input only; repository code is never executed.",
    });
  }

  void runPublicRepositoryIngestion({ runId, url: sourceUrl, projectId, projectName: `${repository.owner}/${repository.name}` });
  return Response.json({
    status: "queued",
    ingestionRunId: runId,
    projectId,
    message: "Repository analysis queued. Poll the ingestion status endpoint for progress.",
    policy: "The repository is treated as source input only; repository code is never executed.",
  }, { status: 202 });
}

async function runPublicRepositoryIngestion({
  runId,
  url,
  projectId,
  projectName,
}: {
  runId: string;
  url: string;
  projectId: string;
  projectName: string;
}) {
  try {
    updateIngestionRun(runId, "fetching", "Cloning public repository", 15);
    const manifest = await fetchPublicGithubRepository(url);
    if (isCancelled(runId)) return;
    updateIngestionRun(runId, "analyzing", "File discovery and static analysis", 45, { commitSha: manifest.commitSha, manifest });
    updateIngestionRun(runId, "analyzing", "COBOL, copybook, and JCL extraction", 65, { commitSha: manifest.commitSha, manifest });
    const result = await analyzeAndPersistSource(manifest.sourceRoot, {
      id: projectId,
      name: projectName,
    });
    if (isCancelled(runId)) return;
    updateIngestionRun(runId, "persisting", "Dependency graph and coverage persisted", 90, { commitSha: manifest.commitSha, manifest });
    updateIngestionRun(runId, "completed", "Ready", 100, {
      commitSha: manifest.commitSha,
      manifest: {
        ...manifest,
        analysisRunId: result.persistence.runId,
        projectId,
        entities: result.normalized.entities.length,
        relations: result.normalized.relations.length,
        unresolved: result.normalized.coverage.unresolvedCount,
      },
    });
  } catch (error) {
    updateIngestionRun(runId, "failed", "Ingestion failed", 100, { errorMessage: error instanceof Error ? error.message : "Repository fetch failed." });
  }
}

function isCancelled(runId: string) {
  return getIngestionRun(runId)?.status === "cancelled";
}
