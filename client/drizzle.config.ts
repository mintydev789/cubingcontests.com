import "server-only";
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// This file is only used by Drizzle Kit (not Drizzle ORM)

loadEnvConfig(process.cwd(), true);

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL environment variable not set!");
if (!process.env.CC_DB_SCHEMA) throw new Error("CC_DB_SCHEMA environment variable not set!");

export default defineConfig({
  out: "./server/db/drizzle",
  schema: "./server/db/schema",
  schemaFilter: [process.env.CC_DB_SCHEMA!],
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
  casing: "snake_case",
  strict: true,
  // verbose: true,
});
