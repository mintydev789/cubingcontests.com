import { pgSchema } from "drizzle-orm/pg-core";

if (!process.env.CC_DB_SCHEMA) throw new Error("CC_DB_SCHEMA environment variable not set!");

export const ccSchema = pgSchema(process.env.CC_DB_SCHEMA);
