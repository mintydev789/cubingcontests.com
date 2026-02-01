import { pgSchema } from "drizzle-orm/pg-core";

if (!process.env.RR_DB_SCHEMA) console.error("RR_DB_SCHEMA environment variable not set!");

export const rrSchema = pgSchema(process.env.RR_DB_SCHEMA ?? "");
