export type GithubRepository = { owner: string; name: string; url: string };

const GITHUB_REPOSITORY = /^https:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?\/?$/i;

export function parseGithubRepository(input: string): GithubRepository | null {
  const match = input.trim().match(GITHUB_REPOSITORY);
  if (!match) return null;
  return { owner: match[1], name: match[2], url: `https://github.com/${match[1]}/${match[2]}.git` };
}
