import { allSql, oneSql, runSql } from "@/storage/sqlite";

export abstract class BaseRepository<T extends Record<string, any>> {
  constructor(protected readonly table: string) {}

  async findAll(where = "1=1", params: unknown[] = []) {
    return allSql<T>(`SELECT * FROM ${this.table} WHERE ${where} ORDER BY updatedAt DESC`, params);
  }

  async findById(id: string) {
    return oneSql<T>(`SELECT * FROM ${this.table} WHERE id = ? LIMIT 1`, [id]);
  }

  async insert(entity: T) {
    const keys = Object.keys(entity);
    const placeholders = keys.map(() => "?").join(", ");
    const values = keys.map((key) => entity[key]);
    await runSql(
      `INSERT INTO ${this.table} (${keys.join(", ")}) VALUES (${placeholders})`,
      values
    );
    return entity;
  }

  async update(id: string, patch: Partial<T>) {
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
    if (!entries.length) return this.findById(id);
    const setClause = entries.map(([key]) => `${key} = ?`).join(", ");
    const values = entries.map(([, value]) => value);
    await runSql(`UPDATE ${this.table} SET ${setClause} WHERE id = ?`, [...values, id]);
    return this.findById(id);
  }

  async softDelete(id: string, deletedAt: string) {
    await runSql(`UPDATE ${this.table} SET deletedAt = ?, updatedAt = ? WHERE id = ?`, [deletedAt, deletedAt, id]);
  }
}
