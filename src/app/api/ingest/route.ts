const GITHUB_REPOSITORY = /^https:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?\/?$/i;

export async function POST(request: Request) {
  const body = (await request.json()) as { url?: string; access?: "public" | "private" | "restricted" };
  const url = body.url?.trim() ?? "";
  const match = url.match(GITHUB_REPOSITORY);
  if (!match) return Response.json({ error: "Enter a public GitHub repository URL, for example https://github.com/org/repository." }, { status: 400 });
  if (body.access === "private") return Response.json({ status: "contact", message: "Private repository analysis is available by arrangement. Please contact hcjeong@empas.com." });
  if (body.access === "restricted") return Response.json({ status: "contact", message: "If source code cannot leave your company, contact hcjeong@empas.com for a private deployment or in-company analysis option." });

  return Response.json({
    status: "ready",
    repository: `${match[1]}/${match[2]}`,
    message: "Public repository accepted. Analysis can run in the isolated ingestion worker.",
    policy: "The repository is treated as source input only; repository code is never executed.",
  });
}
