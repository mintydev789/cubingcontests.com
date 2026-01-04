import { pgSchema } from "drizzle-orm/pg-core";

export const ccSchema = pgSchema("cubing_contests");

// THIS IS ONLY USED FOR THE VITEST DRIZZLE SETUP!
// export * from "./auth-schema.ts";
// export * from "./collective-solutions.ts";
// export * from "./contests.ts";
// export * from "./events.ts";
// export * from "./persons.ts";
// export * from "./record-configs.ts";
// export * from "./results.ts";
// export * from "./rounds.ts";
