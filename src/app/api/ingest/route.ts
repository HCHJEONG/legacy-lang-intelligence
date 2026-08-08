import { fetchPublicGithubRepository } from "@/lib/ingestion/github-fetcher";
import { parseGithubRepository } from "@/lib/ingestion/github-url";

export async function POST(request: Request) {
  const body = (await request.json()) as { url?: string; access?: "public" | "private" | "restricted" };
  const url = body.url?.trim() ?? "";
  const repository = parseGithubRepository(url);
  if (!repository) return Response.json({ error: "Enter a public GitHub repository URL, for example https://github.com/org/repository." }, { status: 400 });
  if (body.access === "private") return Response.json({ status: "contact", message: "Private repository analysis is available by arrangement. Please contact hcjeong@empas.com." });
  if (body.access === "restricted") return Response.json({ status: "contact", message: "If source code cannot leave your company, contact hcjeong@empas.com for a private deployment or in-company analysis option." });

  try {
    const manifest = await fetchPublicGithubRepository(url);
    return Response.json({ status: "fetched", message: "Public repository fetched into an isolated analysis workspace.", policy: "The repository is treated as source input only; repository code is never executed.", manifest });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Repository fetch failed." }, { status: 422 });
  }
}
