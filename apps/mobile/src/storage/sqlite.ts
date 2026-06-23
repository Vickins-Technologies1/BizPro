import * as SQLite from "expo-sqlite";
import { schemaIndexes, schemaStatements } from "./schema";

export type DbRow = Record<string, unknown>;
export type SqliteDb = SQLite.SQLiteDatabase;

let databasePromise: Promise<SqliteDb> | null = null;

export async function getDb() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync("vickins-business-os.db");
  }
  return databasePromise;
}

export async function initializeDatabase() {
  const db = await getDb();
  for (const statement of schemaStatements) {
    await db.execAsync(statement);
  }
  for (const index of schemaIndexes) {
    await db.execAsync(index);
  }
  await ensureColumn(db, "payments", "customerId", "TEXT");
  await ensureColumn(db, "payments", "note", "TEXT");
  return db;
}

async function ensureColumn(db: SqliteDb, table: string, column: string, definition: string) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (columns.some((item) => item.name === column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export async function runSql(sql: string, params: any[] = []) {
  const db = await getDb();
  return db.runAsync(sql, params);
}

export async function allSql<T = DbRow>(sql: string, params: any[] = []) {
  const db = await getDb();
  return db.getAllAsync<T>(sql, params);
}

export async function oneSql<T = DbRow>(sql: string, params: any[] = []) {
  const db = await getDb();
  return db.getFirstAsync<T>(sql, params);
}
