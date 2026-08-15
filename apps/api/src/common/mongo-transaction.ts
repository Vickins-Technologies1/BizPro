import type { ClientSession, Connection } from "mongoose";

export async function runInTransaction<T>(connection: Connection, work: (session: ClientSession) => Promise<T>) {
  const session = await connection.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
