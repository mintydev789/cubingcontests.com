import "server-only";
import { boolean, integer, text } from "drizzle-orm/pg-core";
import { getColumns } from "drizzle-orm/utils";
import { EventCategoryValues, EventFormatValues, RoundFormatValues } from "~/helpers/types.ts";
import { rrSchema } from "~/server/db/schema/schema.ts";
import { tableTimestamps } from "../dbUtils.ts";

export const eventFormatEnum = rrSchema.enum("event_format", EventFormatValues);
export const roundFormatEnum = rrSchema.enum("round_format", RoundFormatValues);
export const eventCategoryEnum = rrSchema.enum("event_category", EventCategoryValues);

export const eventsTable = rrSchema.table("events", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  eventId: text().notNull().unique(),
  name: text().notNull(),
  category: text().notNull(),
  rank: integer().notNull(),
  format: eventFormatEnum().notNull(),
  defaultRoundFormat: roundFormatEnum().notNull(),
  participants: integer().notNull(),
  submissionsAllowed: boolean().notNull(),
  removedWca: boolean().notNull(),
  hasMemo: boolean().notNull(),
  hidden: boolean().notNull(),
  description: text(),
  rule: text(),
  ...tableTimestamps,
});

export type InsertEvent = typeof eventsTable.$inferInsert;
export type SelectEvent = typeof eventsTable.$inferSelect;

const {
  rule: _, // technically not a private column, but it's not needed most of the time
  createdAt: _1,
  updatedAt: _2,
  ...eventsPublicCols
} = getColumns(eventsTable);
export { eventsPublicCols };

export type EventResponse = Pick<SelectEvent, keyof typeof eventsPublicCols>;
