import "server-only";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// This file is only used by Drizzle Kit (not Drizzle ORM)

loadEnvConfig(resolve(".."));

if (
  !process.env.RR_DB_SCHEMA ||
  !process.env.RR_DB_USERNAME ||
  !process.env.RR_DB_PASSWORD ||
  !process.env.POOLER_TENANT_ID ||
  !process.env.POSTGRES_PORT ||
  !process.env.POSTGRES_DB
) {
  throw new Error(
    "One of these environment variables is not set: RR_DB_SCHEMA, RR_DB_USERNAME, RR_DB_PASSWORD, POOLER_TENANT_ID, POSTGRES_PORT, POSTGRES_DB!",
  );
}

// This has to be different from DATABASE_URL, because it needs a direct DB connection (i.e. not through the connection pooler)
const url = `postgresql://${process.env.RR_DB_USERNAME}.${process.env.POOLER_TENANT_ID}:${process.env.RR_DB_PASSWORD}@localhost:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;

export default defineConfig({
  out: "./server/db/drizzle",
  schema: "./server/db/schema",
  schemaFilter: [process.env.RR_DB_SCHEMA],
  migrations: { schema: process.env.RR_DB_SCHEMA },
  dialect: "postgresql",
  dbCredentials: { url },
  casing: "snake_case",
  strict: true,
  // verbose: true,
});
