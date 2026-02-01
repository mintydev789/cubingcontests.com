import "server-only";
import { getColumns } from "drizzle-orm";
import { boolean, integer, text, varchar } from "drizzle-orm/pg-core";
import { RecordCategoryValues, RecordTypeValues } from "~/helpers/types.ts";
import { rrSchema } from "~/server/db/schema/schema.ts";
import { tableTimestamps } from "../dbUtils.ts";

export const recordCategoryEnum = rrSchema.enum("record_category", RecordCategoryValues);
export const recordTypeEnum = rrSchema.enum("record_type", RecordTypeValues);

export const recordConfigsTable = rrSchema.table("record_configs", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  recordTypeId: recordTypeEnum().notNull(),
  category: recordCategoryEnum().notNull(),
  label: text().notNull().unique(),
  active: boolean().default(true).notNull(),
  rank: integer().notNull(),
  color: varchar({ length: 7 }).notNull(),
  ...tableTimestamps,
});

export type InsertRecordConfig = typeof recordConfigsTable.$inferInsert;
export type SelectRecordConfig = typeof recordConfigsTable.$inferSelect;

const { createdAt: _, updatedAt: _1, ...recordConfigsPublicCols } = getColumns(recordConfigsTable);
export { recordConfigsPublicCols };

export type RecordConfigResponse = Pick<SelectRecordConfig, keyof typeof recordConfigsPublicCols>;
