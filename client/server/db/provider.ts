import "server-only";
import type { PgAsyncTransaction } from "drizzle-orm/pg-core";
import { drizzle, type PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { relations } from "./relations.ts";

export const db = drizzle({
  connection: {
    url: process.env.DATABASE_URL!,
    // ssl: "verify-full",
    // Uncomment this if using Supabase "Transaction" pool mode (see https://orm.drizzle.team/docs/connect-supabase)
    // prepare: false,
  },
  casing: "snake_case",
  relations,
});

export type DbTransactionType = PgAsyncTransaction<PostgresJsQueryResultHKT, Record<string, never>, typeof relations>;
