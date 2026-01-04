import { eq, sql } from "drizzle-orm";
import pino from "pino";
import { beforeAll, beforeEach, vi } from "vitest";
import { apply as applyDbSchema, db } from "~/__mocks__/dbProvider.ts";
import { contestsStub } from "~/__mocks__/stubs/contestsStub.ts";
import { eventsStub } from "~/__mocks__/stubs/eventsStub.ts";
import { personsStub } from "~/__mocks__/stubs/personsStub.ts";
import { recordConfigsStub } from "~/__mocks__/stubs/recordConfigsStub.ts";
import { resultsStub } from "~/__mocks__/stubs/resultsStub.ts";
import { testUsers } from "~/instrumentation.ts";
import { auth } from "~/server/auth.ts";
import { accountsTable, sessionsTable, usersTable, verificationsTable } from "~/server/db/schema/auth-schema.ts";
import { contestsTable } from "~/server/db/schema/contests.ts";
import { eventsTable } from "~/server/db/schema/events.ts";
import { personsTable } from "~/server/db/schema/persons.ts";
import { recordConfigsTable } from "~/server/db/schema/record-configs.ts";
import { resultsTable } from "~/server/db/schema/results.ts";
import { roundsStub } from "./__mocks__/stubs/roundsStub.ts";
import { roundsTable } from "./server/db/schema/rounds.ts";

vi.mock("server-only", () => ({}));

vi.mock("~/server/logger.ts", () => ({ logger: pino() }));

vi.mock("~/server/db/provider.ts", async () => ({ db }));

beforeAll(async () => {
  await applyDbSchema();
});

// Re-seed test data
beforeEach(async () => {
  // Deletion has to be in reverse order due to relations between tables
  await db.delete(recordConfigsTable);
  await db.execute(sql.raw("ALTER SEQUENCE record_configs_id_seq RESTART WITH 1;"));
  await db.delete(resultsTable);
  await db.execute(sql.raw("ALTER SEQUENCE results_id_seq RESTART WITH 1;"));
  await db.delete(roundsTable);
  await db.execute(sql.raw("ALTER SEQUENCE rounds_id_seq RESTART WITH 1;"));
  await db.delete(contestsTable);
  await db.execute(sql.raw("ALTER SEQUENCE contests_id_seq RESTART WITH 1;"));
  await db.delete(eventsTable);
  await db.execute(sql.raw("ALTER SEQUENCE events_id_seq RESTART WITH 1;"));
  await db.delete(personsTable);
  await db.execute(sql.raw("ALTER SEQUENCE persons_id_seq RESTART WITH 1;"));
  await db.delete(accountsTable);
  await db.delete(sessionsTable);
  await db.delete(usersTable);
  await db.delete(verificationsTable);

  // Mostly copied from instrumentation.ts
  for (const testUser of testUsers) {
    const { role, ...body } = testUser;
    await auth.api.signUpEmail({ body });

    // Verify email and set person ID
    const [user] = await db
      .update(usersTable)
      .set({ emailVerified: true, personId: testUser.personId })
      .where(eq(usersTable.email, testUser.email))
      .returning();

    // Set role
    if (role) await db.update(usersTable).set({ role }).where(eq(usersTable.id, user.id));
  }

  await db.insert(personsTable).values(personsStub);
  await db.insert(eventsTable).values(eventsStub);
  await db.insert(contestsTable).values(contestsStub);
  await db.insert(roundsTable).values(roundsStub);
  await db.insert(resultsTable).values(resultsStub);
  await db.insert(recordConfigsTable).values(recordConfigsStub);
});
