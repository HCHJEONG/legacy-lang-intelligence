import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { DiscoveredFile, SourceKind } from "./types";

const IGNORED_DIRS = new Set([
  ".git",
  ".github",
  "node_modules",
  ".next",
  "build",
  "dist",
  "target",
]);

const TEXT_EXTENSIONS = new Set([
  ".cbl",
  ".cob",
  ".cobol",
  ".cpy",
  ".copy",
  ".jcl",
  ".proc",
  ".txt",
  ".md",
  ".yml",
  ".yaml",
  ".json",
  ".xml",
  ".csv",
  ".dat",
  ".ctl",
  ".properties",
  "",
]);

export async function discoverSourceFiles(sourceRoot: string): Promise<DiscoveredFile[]> {
  const root = path.resolve(sourceRoot);
  const files: DiscoveredFile[] = [];

  async function walk(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          await walk(absolutePath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXTENSIONS.has(extension)) {
        continue;
      }

      const content = await fs.readFile(absolutePath);
      const text = content.toString("utf8");
      const relativePath = path.relative(root, absolutePath).replaceAll(path.sep, "/");
      const classification = classifyFile(relativePath, text);

      files.push({
        absolutePath,
        relativePath,
        kind: classification.kind,
        sizeBytes: content.byteLength,
        sha256: createHash("sha256").update(content).digest("hex"),
        signals: classification.signals,
      });
    }
  }

  await walk(root);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function classifyFile(relativePath: string, content: string): { kind: SourceKind; signals: string[] } {
  const lowerPath = relativePath.toLowerCase();
  const extension = path.extname(lowerPath);
  const sample = content.slice(0, 20000).toUpperCase();
  const signals: string[] = [];

  if (/^\s*\/\//m.test(content) && /\bJOB\b|\bEXEC\s+PGM=|\bDD\s+/i.test(content)) {
    signals.push("jcl-control-statements");
    return { kind: "jcl", signals };
  }

  if (/\bPROGRAM-ID\s*\./.test(sample)) {
    signals.push("program-id");
    return { kind: "cobol", signals };
  }

  if (/\bIDENTIFICATION\s+DIVISION\b/.test(sample) || /\bPROCEDURE\s+DIVISION\b/.test(sample)) {
    signals.push("cobol-divisions");
    return { kind: "cobol", signals };
  }

  if (extension === ".cpy" || extension === ".copy" || lowerPath.includes("copybook")) {
    signals.push("copybook-path-or-extension");
    return { kind: "copybook", signals };
  }

  if (extension === ".jcl" || extension === ".proc" || lowerPath.includes("/jcl/")) {
    signals.push("jcl-path-or-extension");
    return { kind: "jcl", signals };
  }

  if (extension === ".md" || extension === ".txt") {
    signals.push("documentation-extension");
    return { kind: "documentation", signals };
  }

  if ([".json", ".yml", ".yaml", ".xml", ".properties"].includes(extension)) {
    signals.push("config-extension");
    return { kind: "config", signals };
  }

  if ([".csv", ".dat", ".ctl"].includes(extension)) {
    signals.push("data-extension");
    return { kind: "data", signals };
  }

  signals.push("no-confident-match");
  return { kind: "unknown", signals };
}
