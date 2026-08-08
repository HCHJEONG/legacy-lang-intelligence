import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

export function openAnalysisDatabase(databasePath: string) {
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  };
}

export type AnalysisDatabase = ReturnType<typeof openAnalysisDatabase>["db"];
