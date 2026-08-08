import fs from "node:fs";
import path from "node:path";

import { persistNormalizedAnalysis } from "@/lib/db/persist-normalized-analysis";

const inputPath = path.resolve("analysis-output", "carddemo-normalized-ir.json");
const databasePath = process.env.ANALYSIS_DB_PATH ?? path.resolve("analysis-output", "carddemo.sqlite");

if (!fs.existsSync(inputPath)) {
  throw new Error(`Normalized analysis file not found: ${inputPath}. Run npm run ingest first.`);
}

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const normalizedAnalysis = JSON.parse(fs.readFileSync(inputPath, "utf8")) as unknown;
const result = persistNormalizedAnalysis(normalizedAnalysis, databasePath);

console.log(`Persisted CardDemo analysis run: ${result.runId}`);
console.log(`SQLite database: ${result.databasePath}`);
console.table(result.counts);
