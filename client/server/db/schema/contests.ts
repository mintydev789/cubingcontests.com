import "server-only";
import { getColumns, sql } from "drizzle-orm";
import { check, integer, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import type { Schedule } from "~/helpers/types/Schedule.ts";
import { ContestStateValues, ContestTypeValues } from "~/helpers/types.ts";
import { rrSchema } from "~/server/db/schema/schema.ts";
import { tableTimestamps } from "../dbUtils.ts";
import { usersTable } from "./auth-schema.ts";

export const contestStateEnum = rrSchema.enum("contest_state", ContestStateValues);
export const contestTypeEnum = rrSchema.enum("contest_type", ContestTypeValues);

export const contestsTable = rrSchema.table(
  "contests",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    competitionId: text().notNull().unique(),
    state: contestStateEnum().default("created").notNull(),
    name: text().notNull(),
    // FIX THIS!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // shortName: varchar({ length: 32 }).notNull(),
    shortName: varchar({ length: 60 }).notNull(),
    type: contestTypeEnum().notNull(),
    city: text().notNull(),
    regionCode: text().notNull(),
    venue: text().notNull(),
    address: text().notNull(),
    latitudeMicrodegrees: integer().notNull(),
    longitudeMicrodegrees: integer().notNull(),
    startDate: timestamp().notNull(),
    endDate: timestamp().notNull(),
    startTime: timestamp(), // only used for meetups
    timezone: text(), // only used for meetups
    organizerIds: integer().array().notNull(),
    contact: text(),
    description: text().notNull(),
    competitorLimit: integer(),
    participants: integer().default(0).notNull(),
    queuePosition: integer(),
    schedule: jsonb().$type<Schedule>(), // not used for meetups
    createdBy: text().references(() => usersTable.id, { onDelete: "set null" }), // this can be null if the user has been deleted
    ...tableTimestamps,
  },
  (table) => [
    check(
      "contests_meetup_check",
      sql`(${table.type} <> 'meetup'
          AND ${table.startTime} IS NULL
          AND ${table.timezone} IS NULL
          AND ${table.competitorLimit} IS NOT NULL
          AND ${table.schedule} IS NOT NULL)
        OR (${table.type} = 'meetup'
          AND ${table.startTime} IS NOT NULL
          AND ${table.timezone} IS NOT NULL
          AND ${table.schedule} IS NULL)`,
    ),
  ],
);

export type InsertContest = typeof contestsTable.$inferInsert;
export type SelectContest = typeof contestsTable.$inferSelect;

const {
  schedule: _, // technically not a private column, but it's not needed most of the time
  createdBy: _1,
  createdAt: _2,
  updatedAt: _3,
  ...contestsPublicCols
} = getColumns(contestsTable);
export { contestsPublicCols };

export type ContestResponse = Pick<SelectContest, keyof typeof contestsPublicCols>;
