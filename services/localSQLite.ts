import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;
let currentDbName = "devmobile_local";

async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(currentDbName);
  }
  return db;
}

export function getCurrentDbName(): string {
  return currentDbName;
}

export async function switchDatabase(name: string): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
  currentDbName = name.endsWith(".db") ? name : `${name}.db`;
  db = await SQLite.openDatabaseAsync(currentDbName);
}

export async function listTables(): Promise<string[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  return rows.map((r) => r.name);
}

export async function runSQL(query: string): Promise<{ rows: Record<string, unknown>[]; changes?: number; lastInsertRowId?: number; isSelect: boolean }> {
  const database = await getDB();
  const trimmed = query.trim();
  const upperCmd = trimmed.toUpperCase().replace(/\s+/g, " ");

  const isSelect =
    upperCmd.startsWith("SELECT") ||
    upperCmd.startsWith("PRAGMA") ||
    upperCmd.startsWith("EXPLAIN") ||
    upperCmd.startsWith("WITH");

  if (isSelect) {
    const rows = await database.getAllAsync<Record<string, unknown>>(trimmed);
    return { rows, isSelect: true };
  } else {
    const result = await database.runAsync(trimmed);
    return {
      rows: [],
      changes: result.changes,
      lastInsertRowId: result.lastInsertRowId ?? undefined,
      isSelect: false,
    };
  }
}

export async function formatSQLResult(
  query: string
): Promise<string> {
  try {
    const result = await runSQL(query);
    if (result.isSelect) {
      if (result.rows.length === 0) return "(0 linhas)";
      const cols = Object.keys(result.rows[0]);
      const widths = cols.map((c) => Math.max(c.length, ...result.rows.map((r) => String(r[c] ?? "").length)));
      const header = cols.map((c, i) => c.padEnd(widths[i])).join(" │ ");
      const sep = widths.map((w) => "─".repeat(w)).join("─┼─");
      const rowLines = result.rows.map((r) =>
        cols.map((c, i) => String(r[c] ?? "NULL").padEnd(widths[i])).join(" │ ")
      );
      return [header, sep, ...rowLines, `\n(${result.rows.length} linha${result.rows.length !== 1 ? "s" : ""})`].join("\n");
    } else {
      return `✅ OK — ${result.changes ?? 0} linha(s) afetada(s)${result.lastInsertRowId ? ` · ROWID=${result.lastInsertRowId}` : ""}`;
    }
  } catch (e: unknown) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}
