import "server-only";
import { sql } from "drizzle-orm";
import { bigint, boolean, check, integer, jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { getColumns } from "drizzle-orm/utils";
import { recordCategoryEnum, recordTypeEnum } from "~/server/db/schema/record-configs.ts";
import { rrSchema } from "~/server/db/schema/schema.ts";
import { tableTimestamps } from "../dbUtils.ts";
import { usersTable } from "./auth-schema.ts";
import type { SelectContest } from "./contests.ts";
import type { SelectEvent } from "./events.ts";
import type { SelectPerson } from "./persons.ts";
import { roundsTable } from "./rounds.ts";

export type Attempt = {
  /**
   * Number of centiseconds; 0 is a skipped attempt (e.g. when cutoff was not met) -1 is DNF, -2 is DNS,
   * C.maxTime is unknown time. For FMC it's the number of moves. For MBLD it works completely differently:
   * https://www.worldcubeassociation.org/export/results
   *
   * The difference is that CC omits the leading 0/1 character, allows multi results up to 9999 cubes instead of 99,
   * time is stored as centiseconds, and it stores DNFs with all of the same information (e.g. DNF (5/12 52:13))
   * (they're just stored as negative numbers).
   */
  result: number;
  memo?: number;
};

export const resultsTable = rrSchema.table(
  "results",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    eventId: text().notNull(),
    date: timestamp().notNull(),
    approved: boolean().default(false).notNull(),
    personIds: integer().array().notNull(),
    regionCode: text(), // only set if participants are from the same region (e.g. country)
    superRegionCode: text(), // only set if participants are from the same super-region (e.g. continent)
    attempts: jsonb().$type<Attempt>().array().notNull(),
    best: bigint({ mode: "number" }).notNull(),
    average: bigint({ mode: "number" }).notNull(),
    recordCategory: recordCategoryEnum().notNull(),
    regionalSingleRecord: recordTypeEnum(),
    regionalAverageRecord: recordTypeEnum(),
    competitionId: text(), // only used for contest results
    roundId: integer().references(() => roundsTable.id), // only used for contest results
    ranking: integer(), // only used for contest results
    proceeds: boolean(), // only used for contest results from non-final rounds
    videoLink: text(), // only used for video-based results
    discussionLink: text(), // only used for video-based results (also optional for those)
    // Before v0.13, createdExternally wasn't a column, and createdBy was only set for video-based results
    createdBy: text().references(() => usersTable.id, { onDelete: "set null" }),
    createdExternally: boolean().default(false).notNull(),
    ...tableTimestamps,
  },
  (table) => [
    check(
      "results_check",
      sql`(${table.competitionId} IS NOT NULL
          AND ${table.recordCategory} <> 'video-based-results'
          AND ${table.roundId} IS NOT NULL
          AND ${table.ranking} IS NOT NULL
          AND ${table.videoLink} IS NULL
          AND ${table.discussionLink} IS NULL)
        OR (${table.competitionId} IS NULL
          AND ${table.recordCategory} = 'video-based-results'
          AND ${table.roundId} IS NULL
          AND ${table.ranking} IS NULL
          AND ${table.proceeds} IS NULL
          AND ${table.videoLink} IS NOT NULL)`,
    ),
  ],
);

export type InsertResult = typeof resultsTable.$inferInsert;
export type SelectResult = typeof resultsTable.$inferSelect;

export type FullResult = SelectResult & {
  event: SelectEvent;
  contest?: SelectContest;
  persons: SelectPerson[];
};

const {
  createdBy: _,
  createdExternally: _1,
  createdAt: _2,
  updatedAt: _3,
  ...resultsPublicCols
} = getColumns(resultsTable);
export { resultsPublicCols };

export type ResultResponse = Pick<SelectResult, keyof typeof resultsPublicCols>;
