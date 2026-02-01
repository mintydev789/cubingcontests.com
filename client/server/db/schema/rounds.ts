import "server-only";
import { getColumns, sql } from "drizzle-orm";
import { boolean, check, integer, smallint, text } from "drizzle-orm/pg-core";
import { RoundProceedValues, RoundTypeValues } from "~/helpers/types.ts";
import { rrSchema } from "~/server/db/schema/schema.ts";
import { tableTimestamps } from "../dbUtils.ts";
import { roundFormatEnum } from "./events.ts";

export const roundTypeEnum = rrSchema.enum("round_type", RoundTypeValues);
export const roundProceedEnum = rrSchema.enum("round_proceed", RoundProceedValues);

export const roundsTable = rrSchema.table(
  "rounds",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    competitionId: text().notNull(),
    eventId: text().notNull(),
    roundNumber: smallint().notNull(),
    roundTypeId: roundTypeEnum().notNull(),
    format: roundFormatEnum().notNull(),
    timeLimitCentiseconds: integer(),
    // If this is not null, it's implied that the round itself is included in the cumulative limit rounds
    timeLimitCumulativeRoundIds: integer().array(),
    cutoffAttemptResult: integer(),
    cutoffNumberOfAttempts: integer(),
    proceedType: roundProceedEnum(),
    proceedValue: integer(),
    open: boolean().default(false).notNull(),
    ...tableTimestamps,
  },
  (table) => [
    // Cumulative round IDs can only be set when the round has a time limit
    check(
      "rounds_timelimit_check",
      sql`${table.timeLimitCumulativeRoundIds} IS NULL OR ${table.timeLimitCentiseconds} IS NOT NULL`,
    ),
    check(
      "rounds_cutoff_check",
      sql`(${table.cutoffAttemptResult} IS NOT NULL AND ${table.cutoffNumberOfAttempts} IS NOT NULL)
        OR (${table.cutoffAttemptResult} IS NULL AND ${table.cutoffNumberOfAttempts} IS NULL)`,
    ),
    check(
      "rounds_proceed_check",
      sql`(${table.proceedType} IS NOT NULL AND ${table.proceedValue} IS NOT NULL)
        OR (${table.proceedType} IS NULL AND ${table.proceedValue} IS NULL)`,
    ),
    check("rounds_finals_check", sql`${table.roundTypeId} <> 'f' OR ${table.proceedType} IS NULL`),
  ],
);

export type InsertRound = typeof roundsTable.$inferInsert;
export type SelectRound = typeof roundsTable.$inferSelect;

const { createdAt: _, updatedAt: _1, ...roundsPublicCols } = getColumns(roundsTable);
export { roundsPublicCols };

export type RoundResponse = Pick<SelectRound, keyof typeof roundsPublicCols>;
