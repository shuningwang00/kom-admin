import { getDb } from "@/lib/db/index";
import { students } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export type DbHealth = {
  configured: boolean;
  connected: boolean;
  studentCount: number;
  error: string | null;
};

export async function checkDbHealth(): Promise<DbHealth> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      configured: false,
      connected: false,
      studentCount: 0,
      error:
        "DATABASE_URL is not set. Add your Postgres URL to .env.local, then run npm run db:push.",
    };
  }

  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    const result = await db.execute(sql`select count(*)::int as count from students`);
    const rows = result as unknown as { count: number }[];
    return {
      configured: true,
      connected: true,
      studentCount: Number(rows[0]?.count ?? 0),
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database connection failed";
    return {
      configured: true,
      connected: false,
      studentCount: 0,
      error: message,
    };
  }
}
