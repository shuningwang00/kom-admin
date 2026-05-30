import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add a Postgres connection string to .env.local (Neon or Vercel Postgres).",
    );
  }
  return url;
}

let client: ReturnType<typeof postgres> | null = null;

function getClient() {
  if (!client) {
    client = postgres(getDatabaseUrl(), { max: 10 });
  }
  return client;
}

export function getDb() {
  return drizzle(getClient(), { schema });
}

export type Db = ReturnType<typeof getDb>;
