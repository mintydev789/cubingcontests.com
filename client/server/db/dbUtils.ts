import { timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./schema/auth-schema.ts";

export const tableTimestamps = {
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

// This has to stay consistent with the Creator type in types.ts
export const creatorCols = {
  id: usersTable.id,
  username: usersTable.username,
  email: usersTable.email,
  personId: usersTable.personId,
};
