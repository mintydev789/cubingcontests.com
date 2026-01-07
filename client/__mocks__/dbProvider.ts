import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { vi } from "vitest";
import { relations } from "~/server/db/relations.ts";
import * as schema from "./dbSchema.ts";

// Source: https://github.com/drizzle-team/drizzle-orm/discussions/4216

// Use require to defeat dynamic require error
// (https://github.com/drizzle-team/drizzle-orm/issues/2853#issuecomment-2668459509)
const { createRequire } = await vi.importActual<typeof import("node:module")>("node:module");
const require = createRequire(import.meta.url);
const { pushSchema } = require("drizzle-kit/api-postgres") as typeof import("drizzle-kit/api-postgres");

const client = new PGlite();
// This uses some of the same options from drizzle.config.ts
// pushSchema doesn't respect the casing parameter yet. See https://github.com/drizzle-team/drizzle-orm/pull/5018
// const db = drizzle({ client, schema, relations, casing: "snake_case" });
export const db = drizzle({ client, schema, relations });

// Apply schema to db
export const { apply } = await pushSchema(schema, db as any);
