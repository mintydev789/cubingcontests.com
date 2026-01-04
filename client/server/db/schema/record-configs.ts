import "server-only";
import { getTableColumns } from "drizzle-orm";
import { boolean, integer, text, varchar } from "drizzle-orm/pg-core";
import { RecordCategoryValues, RecordTypeValues } from "~/helpers/types.ts";
import { ccSchema } from "~/server/db/schema/schema.ts";
import { tableTimestamps } from "../dbUtils.ts";

export const recordCategoryEnum = ccSchema.enum("record_category", RecordCategoryValues);
export const recordTypeEnum = ccSchema.enum("record_type", RecordTypeValues);

export const recordConfigsTable = ccSchema.table("record_configs", {
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

const { createdAt: _, updatedAt: _1, ...recordConfigsPublicCols } = getTableColumns(recordConfigsTable);
export { recordConfigsPublicCols };

export type RecordConfigResponse = Pick<SelectRecordConfig, keyof typeof recordConfigsPublicCols>;
