import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  AnalysisDependency,
  AnalysisEntity,
  DiscoveredFile,
  Evidence,
  StaticAnalysisResult,
} from "./types";

type MutableResult = {
  entities: AnalysisEntity[];
  dependencies: AnalysisDependency[];
};

export async function analyzeDiscoveredFiles(
  sourceRoot: string,
  files: DiscoveredFile[],
): Promise<StaticAnalysisResult> {
  const result: MutableResult = { entities: [], dependencies: [] };

  for (const file of files) {
    if (!["cobol", "copybook", "jcl"].includes(file.kind)) {
      continue;
    }

    const text = await fs.readFile(file.absolutePath, "utf8");
    const lines = text.split(/\r?\n/);

    if (file.kind === "cobol") {
      analyzeCobolFile(file, lines, result);
    } else if (file.kind === "copybook") {
      analyzeCopybookFile(file, lines, result);
    } else if (file.kind === "jcl") {
      analyzeJclFile(file, lines, result);
    }
  }

  return {
    sourceRoot: path.resolve(sourceRoot),
    generatedAt: new Date().toISOString(),
    files,
    entities: result.entities,
    dependencies: result.dependencies,
    summary: {
      filesByKind: countBy(files, (file) => file.kind, [
        "cobol",
        "copybook",
        "jcl",
        "documentation",
        "data",
        "config",
        "unknown",
      ]),
      entitiesByType: countBy(result.entities, (entity) => entity.type),
      dependenciesByType: countBy(result.dependencies, (dependency) => dependency.type),
    },
  };
}

function analyzeCobolFile(file: DiscoveredFile, lines: string[], result: MutableResult) {
  const programMatch = findLine(lines, /\bPROGRAM-ID\s*\.\s*([A-Z0-9_-]+)/i);
  const programName =
    programMatch?.match[1] ?? path.basename(file.relativePath, path.extname(file.relativePath)).toUpperCase();
  const programEntity = pushEntity(result, {
    type: "COBOL_PROGRAM",
    name: programName,
    qualifiedName: `program:${programName}`,
    filePath: file.relativePath,
    evidence: programMatch ? evidence(file, lines, programMatch.lineNumber) : evidence(file, lines, 1),
    metadata: {
      fallbackName: !programMatch,
    },
  });

  forEachCobolLineMatch(lines, /\bCALL\s+['"]?([A-Z0-9_-]+)['"]?/gi, (match, lineNumber) => {
    pushDependency(result, {
      type: "CALLS",
      sourceId: programEntity.id,
      targetName: match[1],
      evidence: evidence(file, lines, lineNumber),
      confidence: 0.9,
    });
  });

  forEachCobolLineMatch(lines, /\bCOPY\s+([A-Z0-9_-]+)/gi, (match, lineNumber) => {
    pushDependency(result, {
      type: "INCLUDES_COPYBOOK",
      sourceId: programEntity.id,
      targetName: match[1],
      evidence: evidence(file, lines, lineNumber),
      confidence: 0.9,
    });
  });

  forEachBlockMatch(lines, /\bEXEC\s+SQL\b([\s\S]*?)\bEND-EXEC\b/gi, (match, lineNumber) => {
    for (const table of extractSqlTableNames(match[0])) {
      pushDependency(result, {
        type: "USES_TABLE",
        sourceId: programEntity.id,
        targetName: table,
        evidence: evidence(file, lines, lineNumber),
        confidence: 0.72,
      });
    }
  });

  forEachBlockMatch(lines, /\bEXEC\s+CICS\b([\s\S]*?)\bEND-EXEC\b/gi, (match, lineNumber) => {
    const transactionId = match[0].match(/\bTRANSID\s*\(?\s*['"]?([A-Z0-9_-]+)/i)?.[1];
    if (transactionId) {
      pushDependency(result, {
        type: "INVOKES_TRANSACTION",
        sourceId: programEntity.id,
        targetName: transactionId,
        evidence: evidence(file, lines, lineNumber),
        confidence: 0.7,
      });
    }
  });

  forEachCobolLineMatch(lines, /\b(?:SELECT|FD)\s+([A-Z0-9_-]+)/gi, (match, lineNumber) => {
    pushDependency(result, {
      type: "USES_FILE",
      sourceId: programEntity.id,
      targetName: match[1],
      evidence: evidence(file, lines, lineNumber),
      confidence: 0.62,
    });
  });
}

function analyzeCopybookFile(file: DiscoveredFile, lines: string[], result: MutableResult) {
  const copybookName = path.basename(file.relativePath, path.extname(file.relativePath)).toUpperCase();
  const copybookEntity = pushEntity(result, {
    type: "COPYBOOK",
    name: copybookName,
    qualifiedName: `copybook:${copybookName}`,
    filePath: file.relativePath,
    evidence: evidence(file, lines, 1),
  });

  forEachLineMatch(lines, /^\s*\d{2}\s+([A-Z0-9_-]+)\b(.*)$/gim, (match, lineNumber) => {
    const level = Number.parseInt(match[0].trim().slice(0, 2), 10);
    if ([66, 77, 88].includes(level)) {
      return;
    }

    const fieldEntity = pushEntity(result, {
      type: "FIELD",
      name: match[1],
      qualifiedName: `copybook:${copybookName}:field:${match[1]}`,
      filePath: file.relativePath,
      evidence: evidence(file, lines, lineNumber),
      metadata: {
        level,
        redefines: match[2].match(/\bREDEFINES\s+([A-Z0-9_-]+)/i)?.[1],
        occurs: match[2].match(/\bOCCURS\s+(\d+)/i)?.[1],
      },
    });

    pushDependency(result, {
      type: "CONTAINS_FIELD",
      sourceId: copybookEntity.id,
      targetName: fieldEntity.name,
      targetId: fieldEntity.id,
      evidence: evidence(file, lines, lineNumber),
      confidence: 0.82,
    });
  });
}

function analyzeJclFile(file: DiscoveredFile, lines: string[], result: MutableResult) {
  const jobMatch = findLine(lines, /^\/\/([A-Z0-9_$#@-]+)\s+JOB\b/i);
  const jobName = jobMatch?.match[1] ?? path.basename(file.relativePath, path.extname(file.relativePath)).toUpperCase();
  const jobEntity = pushEntity(result, {
    type: "JCL_JOB",
    name: jobName,
    qualifiedName: `jcl-job:${jobName}`,
    filePath: file.relativePath,
    evidence: jobMatch ? evidence(file, lines, jobMatch.lineNumber) : evidence(file, lines, 1),
    metadata: {
      fallbackName: !jobMatch,
    },
  });

  forEachLineMatch(lines, /^\/\/([A-Z0-9_$#@-]+)\s+EXEC\s+(?:PGM=)?([A-Z0-9_$#@-]+)/gim, (match, lineNumber) => {
    const stepEntity = pushEntity(result, {
      type: "JCL_STEP",
      name: match[1],
      qualifiedName: `jcl-job:${jobName}:step:${match[1]}`,
      filePath: file.relativePath,
      evidence: evidence(file, lines, lineNumber),
      metadata: {
        execTarget: match[2],
      },
    });

    pushDependency(result, {
      type: "EXECUTES",
      sourceId: jobEntity.id,
      targetName: stepEntity.name,
      targetId: stepEntity.id,
      evidence: evidence(file, lines, lineNumber),
      confidence: 0.88,
    });

    pushDependency(result, {
      type: "EXECUTES",
      sourceId: stepEntity.id,
      targetName: match[2],
      evidence: evidence(file, lines, lineNumber),
      confidence: 0.78,
    });
  });

  forEachLineMatch(lines, /^\/\/([A-Z0-9_$#@-]+)\s+DD\s+.*\bDSN=([^,\s]+)/gim, (match, lineNumber) => {
    pushDependency(result, {
      type: "USES_FILE",
      sourceId: jobEntity.id,
      targetName: normalizeDatasetName(match[2]),
      evidence: evidence(file, lines, lineNumber),
      confidence: 0.76,
      metadata: {
        ddName: match[1],
      },
    });
  });
}

function pushEntity(result: MutableResult, entity: Omit<AnalysisEntity, "id">): AnalysisEntity {
  const id = `${entity.type}:${entity.qualifiedName}`;
  const existing = result.entities.find((item) => item.id === id);
  if (existing) {
    return existing;
  }

  const withId = { id, ...entity };
  result.entities.push(withId);
  return withId;
}

function pushDependency(result: MutableResult, dependency: Omit<AnalysisDependency, "id">) {
  const id = [
    dependency.type,
    dependency.sourceId,
    dependency.targetId ?? dependency.targetName,
    dependency.evidence.filePath,
    dependency.evidence.startLine,
  ].join(":");

  if (!result.dependencies.some((item) => item.id === id)) {
    result.dependencies.push({ id, ...dependency });
  }
}

function evidence(file: DiscoveredFile, lines: string[], lineNumber: number): Evidence {
  const index = Math.max(0, lineNumber - 1);
  return {
    filePath: file.relativePath,
    startLine: lineNumber,
    endLine: lineNumber,
    snippet: lines[index]?.trim() ?? "",
  };
}

function findLine(lines: string[], pattern: RegExp) {
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(pattern);
    if (match) {
      return { lineNumber: index + 1, match };
    }
  }

  return undefined;
}

function forEachLineMatch(
  lines: string[],
  pattern: RegExp,
  callback: (match: RegExpExecArray, lineNumber: number) => void,
) {
  for (let index = 0; index < lines.length; index += 1) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(lines[index])) !== null) {
      callback(match, index + 1);
    }
  }
}

function forEachCobolLineMatch(
  lines: string[],
  pattern: RegExp,
  callback: (match: RegExpExecArray, lineNumber: number) => void,
) {
  forEachLineMatch(lines, pattern, (match, lineNumber) => {
    if (!isCobolCommentLine(lines[lineNumber - 1])) {
      callback(match, lineNumber);
    }
  });
}

function isCobolCommentLine(line: string): boolean {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("*") || trimmed.startsWith("*>")) {
    return true;
  }

  return line.length >= 7 && ["*", "/", "D"].includes(line.charAt(6).toUpperCase());
}

function forEachBlockMatch(
  lines: string[],
  pattern: RegExp,
  callback: (match: RegExpExecArray, lineNumber: number) => void,
) {
  const text = lines.join("\n");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const lineNumber = text.slice(0, match.index).split("\n").length;
    callback(match, lineNumber);
  }
}

function extractSqlTableNames(sql: string): string[] {
  const tables = new Set<string>();
  const patterns = [
    /\bFROM\s+([A-Z0-9_.-]+)/gi,
    /\bJOIN\s+([A-Z0-9_.-]+)/gi,
    /\bINTO\s+([A-Z0-9_.-]+)/gi,
    /\bUPDATE\s+([A-Z0-9_.-]+)/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(sql)) !== null) {
      tables.add(match[1]);
    }
  }

  return [...tables];
}

function normalizeDatasetName(raw: string): string {
  return raw.replace(/^['"]|['"]$/g, "").replaceAll("&", "");
}

function countBy<T, K extends string>(
  items: T[],
  keyOf: (item: T) => K,
  initialKeys: readonly K[] = [],
): Record<K, number> {
  const counts = Object.fromEntries(initialKeys.map((key) => [key, 0])) as Record<K, number>;
  for (const item of items) {
    const key = keyOf(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}
