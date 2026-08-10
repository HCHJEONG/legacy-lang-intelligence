import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { INGESTION_LIMITS } from "./limits";
import { parseGithubRepository, type GithubRepository } from "./github-url";

const execFileAsync = promisify(execFile);

export type RepositoryManifest = {
  sourceUrl: string;
  commitSha: string;
  sourceRoot: string;
  fileCount: number;
  analysisCandidateCount: number;
  ignoredFileCount: number;
  totalBytes: number;
};

export async function fetchPublicGithubRepository(inputUrl: string): Promise<RepositoryManifest> {
  const repository = parseGithubRepository(inputUrl);
  if (!repository) throw new Error("Only public HTTPS GitHub repository URLs are supported.");
  const commitSha = await resolvePublicGithubHead(repository);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sourceRoot = path.resolve(".cache", "ingestion", runId, "source");
  await fs.mkdir(path.dirname(sourceRoot), { recursive: true });
  try {
    await runGit(["clone", "--depth", "1", "--no-tags", repository.url, sourceRoot]);
    await runGit(["-C", sourceRoot, "checkout", "--detach", commitSha]);
    return await buildManifest(repository, commitSha, sourceRoot);
  } catch (error) {
    await fs.rm(path.dirname(sourceRoot), { recursive: true, force: true });
    throw error;
  }
}

export async function resolvePublicGithubHead(repository: GithubRepository) {
  try {
    const result = await runGit(["ls-remote", repository.url, "HEAD"]);
    const sha = result.stdout.trim().split(/\s+/)[0];
    if (!/^[a-f0-9]{40}$/i.test(sha)) throw new Error("GitHub did not return a valid commit SHA.");
    return sha;
  } catch {
    throw new Error("The repository is not publicly reachable or does not exist.");
  }
}

async function runGit(args: string[]) {
  return execFileAsync("git", args, { timeout: INGESTION_LIMITS.commandTimeoutMs, maxBuffer: 1024 * 1024 });
}

async function buildManifest(repository: GithubRepository, commitSha: string, sourceRoot: string): Promise<RepositoryManifest> {
  const entries = await listFiles(sourceRoot);
  if (entries.length > INGESTION_LIMITS.maxFileCount) throw new Error(`Repository exceeds the ${INGESTION_LIMITS.maxFileCount.toLocaleString()} file limit.`);
  let totalBytes = 0;
  let analysisCandidateCount = 0;
  for (const entry of entries) {
    const stats = await fs.stat(entry);
    if (stats.size > INGESTION_LIMITS.maxFileBytes) continue;
    totalBytes += stats.size;
    if (INGESTION_LIMITS.allowedExtensions.has(path.extname(entry).toLowerCase())) analysisCandidateCount += 1;
    if (totalBytes > INGESTION_LIMITS.maxRepositoryBytes) throw new Error("Repository exceeds the 500 MB size limit.");
  }
  return { sourceUrl: `https://github.com/${repository.owner}/${repository.name}`, commitSha, sourceRoot, fileCount: entries.length, analysisCandidateCount, ignoredFileCount: entries.length - analysisCandidateCount, totalBytes };
}

async function listFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(directory: string) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile()) result.push(fullPath);
    }
  }
  await walk(root);
  return result;
}
