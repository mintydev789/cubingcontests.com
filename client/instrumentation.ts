import type { randomUUID as randomUUIDType } from "node:crypto";
import type fsType from "node:fs";
import { eq, sql } from "drizzle-orm";
import type { auth as authType } from "~/server/auth.ts";
import type { db as dbType } from "~/server/db/provider.ts";
import { accountsTable, usersTable } from "~/server/db/schema/auth-schema.ts";
import { collectiveSolutionsTable } from "~/server/db/schema/collective-solutions.ts";
import { getSuperRegion } from "./helpers/Countries.ts";
import { C } from "./helpers/constants.ts";
import type { Schedule, Venue } from "./helpers/types/Schedule.ts";
import { type ContestState, type ContestType, RecordTypeValues } from "./helpers/types.ts";
import { contestsTable } from "./server/db/schema/contests.ts";
import { eventsTable } from "./server/db/schema/events.ts";
import { personsTable } from "./server/db/schema/persons.ts";
import { recordConfigsTable } from "./server/db/schema/record-configs.ts";
import { type InsertResult, resultsTable } from "./server/db/schema/results.ts";
import { roundsTable } from "./server/db/schema/rounds.ts";

// Used in tests too
export const testUsers = [
  {
    email: "admin@cc.com",
    username: "admin",
    name: "admin",
    password: "Temporary_good_password123",
    role: "admin",
    personId: 1,
  },
  {
    email: "mod@cc.com",
    username: "mod",
    name: "mod",
    password: "Temporary_good_password123",
    role: "mod",
    personId: 2,
  },
  {
    email: "user@cc.com",
    username: "user",
    name: "user",
    password: "Temporary_good_password123",
    personId: 3,
  },
];

// This is the scrypt password hash for the password "cc" (only used for testing in development)
const hashForCc =
  "a73adfb4df83466851a5c337a6bc738b:a580ce8e36188f210f2342998c46789d69ab69ebf35a6382d80ad11e8542ec62074b31789b09dc653daaf8e1ec69fb5c97c6f6244f7de80d03169e7572c0e514";
const message =
  "The EMAIL_API_KEY environment variable must be empty while seeding the DB to avoid sending lots of verification emails for the users being seeded. Remove it and comment out the sendVerificationEmail function in auth.ts, and then add them back after the DB has been seeded.";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { db }: { db: typeof dbType } = await import("~/server/db/provider.ts");

    // Migrate DB data, if env var is set
    if (process.env.MIGRATE_DB !== "true") return;

    const fs: typeof fsType = await import("node:fs");
    const { randomUUID }: { randomUUID: typeof randomUUIDType } = await import("node:crypto");
    const { auth }: { auth: typeof authType } = await import("~/server/auth.ts");
    const usersDump = JSON.parse(fs.readFileSync("./dump/users.json") as any) as any[];
    const personsDump = JSON.parse(fs.readFileSync("./dump/people.json") as any) as any[];
    const contestsDump = JSON.parse(fs.readFileSync("./dump/competitions.json") as any) as any[];
    const roundsDump = JSON.parse(fs.readFileSync("./dump/rounds.json") as any) as any[];

    for (const testUser of testUsers) {
      const userExists =
        (await db.select().from(usersTable).where(eq(usersTable.email, testUser.email)).limit(1)).length > 0;

      if (!userExists) {
        if (process.env.EMAIL_API_KEY) throw new Error(message);

        const { role, ...body } = testUser;
        await auth.api.signUpEmail({ body });

        // Verify email and set person ID
        const [user] = await db
          .update(usersTable)
          .set({ emailVerified: true, personId: testUser.personId })
          .where(eq(usersTable.email, testUser.email))
          .returning();

        await db.update(accountsTable).set({ password: hashForCc }).where(eq(accountsTable.userId, user.id));

        // Set role
        if (role) await db.update(usersTable).set({ role }).where(eq(usersTable.id, user.id));

        console.log(`Seeded test user: ${testUser.username}`);
      }
    }

    // Seed database with old Mongo DB data.
    // This assumes the local dev environment can't normally have 100 users.
    if ((await db.select({ id: usersTable.id }).from(usersTable).limit(100)).length < 100) {
      if (process.env.EMAIL_API_KEY) throw new Error(message);
      console.log("Seeding users...");

      try {
        await db.transaction(async (tx) => {
          for (const user of usersDump.filter((u: any) => !u.confirmationCodeHash)) {
            const username = user.username.slice(0, 30);
            if (username !== user.username)
              console.warn(`Username ${user.username} is too long, truncating to ${username}`);

            const res = await auth.api.signUpEmail({
              body: {
                email: user.email,
                username,
                displayUsername: user.username,
                // Resetting all passwords due to hashing algorithm change (further encrypted by scrypt)
                password: randomUUID(),
                personId: user.personId,
                name: user.username,
              },
            });

            await tx
              .update(usersTable)
              .set({
                emailVerified: true,
                role: user.roles.includes("admin") ? "admin" : user.roles.includes("mod") ? "mod" : "user",
                createdAt: new Date(user.createdAt.$date),
                updatedAt: new Date(user.updatedAt.$date),
              })
              .where(eq(usersTable.id, res.user.id));

            await tx
              .update(accountsTable)
              .set({ createdAt: new Date(user.createdAt.$date), updatedAt: new Date(user.updatedAt.$date) })
              .where(eq(accountsTable.userId, res.user.id));
          }
        });
      } catch (e) {
        console.error("Unable to load users dump:", e);
      }
    }

    const users = await db.select().from(usersTable);

    const getUserId = ($oid: string): string | null => {
      const dumpUserObject = usersDump.find((u: any) => u._id.$oid === $oid);
      if (!dumpUserObject) return null;

      const user = users.find((u) => u.username === dumpUserObject.username.slice(0, 30));
      if (!user) throw new Error(`User with username ${dumpUserObject.username.slice(0, 30)} not found in DB`);

      return user.id;
    };

    if ((await db.select({ id: personsTable.id }).from(personsTable).limit(1)).length === 0) {
      if (process.env.EMAIL_API_KEY) throw new Error(message);
      console.log("Seeding persons...");

      try {
        await db.transaction(async (tx) => {
          let tempPersons = [];

          for (const p of personsDump) {
            const createdBy = p.createdBy ? getUserId(p.createdBy.$oid) : null;
            tempPersons.push(
              `(${p.personId}, '${p.name.replaceAll("'", "''")}', ${p.localizedName ? `'${p.localizedName.replaceAll("'", "''")}'` : "NULL"}, '${p.countryIso2}', ${p.wcaId ? `'${p.wcaId}'` : "NULL"}, ${!p.unapproved}, ${createdBy ? `'${createdBy}'` : "NULL"}, ${!p.createdBy}, '${p.createdAt.$date}', '${p.updatedAt.$date}')`,
            );

            // Drizzle can't handle too many entries being inserted at once
            if (tempPersons.length === 100) {
              await tx.execute(
                sql.raw(
                  `INSERT INTO ${process.env.CC_DB_SCHEMA}.persons (id, name, localized_name, region_code, wca_id, approved, created_by, created_externally, created_at, updated_at) 
                 OVERRIDING SYSTEM VALUE VALUES ${tempPersons.join(", ")}`,
                ),
              );
              tempPersons = [];
            }
          }

          await tx.execute(
            sql.raw(
              `INSERT INTO ${process.env.CC_DB_SCHEMA}.persons (id, name, localized_name, region_code, wca_id, approved, created_by, created_externally, created_at, updated_at) 
             OVERRIDING SYSTEM VALUE VALUES ${tempPersons.join(", ")}`,
            ),
          );

          await tx.execute(
            sql.raw(
              `ALTER SEQUENCE ${process.env.CC_DB_SCHEMA}.persons_id_seq RESTART WITH ${personsDump.at(-1)!.personId + 1};`,
            ),
          );
        });
      } catch (e) {
        console.error("Unable to load persons dump:", e);
      }
    }

    const persons = await db.select().from(personsTable).orderBy(personsTable.id);

    if ((await db.select({ id: eventsTable.id }).from(eventsTable).limit(1)).length === 0) {
      console.log("Seeding events...");

      try {
        const eventsDump = JSON.parse(fs.readFileSync("./dump/events.json") as any);
        const eventRulesDump = JSON.parse(fs.readFileSync("./dump/eventrules.json") as any);

        await db.insert(eventsTable).values(
          eventsDump.map((e: any) => {
            const eventRule = eventRulesDump.find((er: any) => er.eventId === e.eventId);

            return {
              eventId: e.eventId,
              name: e.name,
              category: e.groups.includes(1)
                ? "wca"
                : e.groups.includes(2)
                  ? "unofficial"
                  : e.groups.includes(3)
                    ? "extreme-bld"
                    : e.groups.includes(4)
                      ? "removed"
                      : "miscellaneous",
              rank: e.rank,
              format: e.format,
              defaultRoundFormat: e.defaultRoundFormat,
              participants: e.participants,
              submissionsAllowed: e.groups.includes(6) || e.groups.includes(3),
              removedWca: e.groups.includes(8),
              hasMemo: e.groups.includes(10),
              hidden: e.groups.includes(9),
              description: e.description || null,
              rule: eventRule?.rule || null,
              createdAt: new Date(e.createdAt.$date),
              updatedAt: new Date(e.updatedAt.$date),
            };
          }),
        );
      } catch (e) {
        console.error("Unable to load events dump or event rules dump:", e);
      }
    }

    if ((await db.select({ id: roundsTable.id }).from(roundsTable).limit(1)).length === 0) {
      console.log("Seeding rounds...");

      let tempRounds: any[] = [];

      try {
        await db.transaction(async (tx) => {
          for (const r of roundsDump) {
            const [eventId, roundNumberStr] = r.roundId.split("-r");

            if (
              r.timeLimit &&
              r.timeLimit.cumulativeRoundIds.length > 0 &&
              (r.timeLimit.cumulativeRoundIds.length > 1 || r.timeLimit.cumulativeRoundIds[0] !== r.roundId)
            )
              console.error(
                `Round time limit cumulative round IDs contain error: ${JSON.stringify({ ...r, results: [] }, null, 2)}`,
              );

            tempRounds.push({
              competitionId: r.competitionId,
              eventId,
              roundNumber: parseInt(roundNumberStr, 10),
              roundTypeId: r.roundTypeId,
              format: r.format,
              timeLimitCentiseconds: r.timeLimit?.centiseconds ?? null,
              timeLimitCumulativeRoundIds:
                r.timeLimit?.cumulativeRoundIds && r.timeLimit.cumulativeRoundIds.length > 0 ? [] : null,
              cutoffAttemptResult: r.cutoff?.attemptResult ?? null,
              cutoffNumberOfAttempts: r.cutoff?.numberOfAttempts ?? null,
              proceedType: r.proceed?.type === 1 ? "percentage" : r.proceed?.type === 2 ? "number" : null,
              proceedValue: r.proceed?.value ?? null,
              open: !!r.open,
              createdAt: new Date(r.createdAt.$date),
              updatedAt: new Date(r.updatedAt.$date),
            });

            // Drizzle can't handle too many entries being inserted at once
            if (tempRounds.length === 1000) {
              await tx.insert(roundsTable).values(tempRounds);
              tempRounds = [];
            }
          }

          await tx.insert(roundsTable).values(tempRounds);
        });
      } catch (e) {
        console.error("Unable to load rounds dump:", e);
      }
    }

    const rounds = await db.select().from(roundsTable);

    const getRoundId = ($oid: string): number => {
      const dumpRoundObject = roundsDump.find((r: any) => r.results.some((res: any) => res.$oid === $oid));
      if (!dumpRoundObject) throw new Error(`Round containing result with ID ${$oid} not found in rounds dump!`);

      const [eventId, roundNumberStr] = dumpRoundObject.roundId.split("-r");
      const round = rounds.find(
        (r) =>
          r.competitionId === dumpRoundObject.competitionId &&
          r.eventId === eventId &&
          r.roundNumber === Number(roundNumberStr),
      );
      if (!round)
        throw new Error(
          `Round ${dumpRoundObject.roundId} from contest ${dumpRoundObject.competitionId} not found in DB`,
        );

      return round.id;
    };

    if ((await db.select({ id: resultsTable.id }).from(resultsTable).limit(1)).length === 0) {
      console.log("Seeding results...");

      const resultsDump = JSON.parse(fs.readFileSync("./dump/results.json") as any);
      let tempResults: InsertResult[] = [];

      try {
        await db.transaction(async (tx) => {
          for (const r of resultsDump) {
            // Copied from results server functions
            const participants = persons.filter((p) => r.personIds.includes(p.id));
            const isSameRegionParticipants = participants.every((p) => p.regionCode === participants[0].regionCode);
            const firstParticipantSuperRegion = getSuperRegion(participants[0].regionCode);
            const isSameSuperRegionParticipants =
              isSameRegionParticipants ||
              participants.slice(1).every((p) => getSuperRegion(p.regionCode) === firstParticipantSuperRegion);
            const contest = r.competitionId ? contestsDump.find((c) => c.competitionId === r.competitionId) : undefined;

            tempResults.push({
              eventId: r.eventId,
              date: new Date(r.date.$date),
              approved: !r.unapproved,
              personIds: r.personIds,
              regionCode: isSameRegionParticipants ? participants[0].regionCode : null,
              superRegionCode: isSameSuperRegionParticipants ? firstParticipantSuperRegion : null,
              attempts: r.attempts,
              best: r.best,
              average: r.average,
              recordCategory: contest ? (contest.type === 1 ? "meetups" : "competitions") : "video-based-results",
              regionalSingleRecord: r.regionalSingleRecord ?? null,
              regionalAverageRecord: r.regionalAverageRecord ?? null,
              competitionId: r.competitionId ?? null,
              roundId: r.competitionId ? getRoundId(r._id.$oid) : null,
              ranking: r.ranking ?? null,
              proceeds: r.proceeds ?? null,
              videoLink: r.competitionId ? null : r.videoLink || "",
              discussionLink: r.competitionId ? null : r.discussionLink || null,
              createdBy: r.createdBy ? getUserId(r.createdBy.$oid) : null,
              createdExternally: false,
              createdAt: new Date(r.createdAt.$date),
              updatedAt: new Date(r.updatedAt.$date),
            });

            // Drizzle can't handle too many entries being inserted at once
            if (tempResults.length === 1000) {
              await tx.insert(resultsTable).values(tempResults);
              tempResults = [];
            }
          }

          await tx.insert(resultsTable).values(tempResults);
        });
      } catch (e) {
        console.error("Unable to load results dump:", e);
      }
    }

    if ((await db.select({ id: contestsTable.id }).from(contestsTable).limit(1)).length === 0) {
      console.log("Seeding contests...");

      const schedulesDump = JSON.parse(fs.readFileSync("./dump/schedules.json") as any) as any[];
      let tempContests: any[] = [];

      const getPersonId = ($oid: string): number => {
        const dumpPersonObject = personsDump.find((u: any) => u._id.$oid === $oid);
        if (!dumpPersonObject) throw new Error(`Person with ID ${$oid} not found in persons dump!`);

        const person = persons.find((p) => p.id === dumpPersonObject.personId);
        if (!person) throw new Error(`Person with person ID ${dumpPersonObject.personId} not found in DB`);

        return person.id;
      };

      try {
        await db.transaction(async (tx) => {
          for (const c of contestsDump) {
            const dumpScheduleObject = schedulesDump.find((s: any) => s.competitionId === c.competitionId);
            let schedule: Schedule | null = null;

            if (dumpScheduleObject) {
              schedule = {
                venues: dumpScheduleObject.venues.map((v: Venue) => ({
                  ...v,
                  rooms: v.rooms.map((r) => ({
                    ...r,
                    color: `#${r.color[0]}${r.color[0]}${r.color[1]}${r.color[1]}${r.color[2]}${r.color[2]}`,
                    activities: r.activities.map((a: any) => ({
                      ...a,
                      startTime: new Date(a.startTime.$date),
                      endTime: new Date(a.endTime.$date),
                    })),
                  })),
                })),
              };
            } else if (c.type !== 1) {
              console.error("COMPETITION WITHOUT SCHEDULE FOUND (skipping insertion): ", c.competitionId);
              continue;
            }

            tempContests.push({
              competitionId: c.competitionId,
              state: (c.state === 10
                ? "created"
                : c.state === 20
                  ? "approved"
                  : c.state === 30
                    ? "ongoing"
                    : c.state === 40
                      ? "finished"
                      : c.state === 50
                        ? "published"
                        : "removed") as ContestState,
              name: c.name,
              shortName: c.shortName,
              type: (c.type === 1 ? "meetup" : c.type === 2 ? "wca-comp" : "comp") satisfies ContestType,
              city: c.city,
              regionCode: c.countryIso2,
              venue: c.venue,
              address: c.address,
              latitudeMicrodegrees: c.latitudeMicrodegrees,
              longitudeMicrodegrees: c.longitudeMicrodegrees,
              startDate: new Date(c.startDate.$date),
              endDate: c.endDate ? new Date(c.endDate.$date) : new Date(c.startDate.$date),
              startTime: c.meetupDetails ? new Date(c.meetupDetails.startTime.$date) : null,
              timezone: c.meetupDetails?.timeZone ?? null,
              organizerIds: c.organizers.map((o: any) => getPersonId(o.$oid)),
              contact: c.contact ?? null,
              description: c.description,
              competitorLimit: c.competitorLimit ?? null,
              participants: c.participants,
              queuePosition: c.queuePosition ?? null,
              schedule,
              createdBy: getUserId(c.createdBy.$oid),
              createdAt: new Date(c.createdAt.$date),
              updatedAt: new Date(c.updatedAt.$date),
            });

            // Drizzle can't handle too many entries being inserted at once
            if (tempContests.length === 500) {
              await tx.insert(contestsTable).values(tempContests);
              tempContests = [];
            }
          }

          await tx.insert(contestsTable).values(tempContests);
        });
      } catch (e) {
        console.error("Unable to load contests dump:", e);
      }
    }

    if ((await db.select({ id: collectiveSolutionsTable.id }).from(collectiveSolutionsTable).limit(1)).length === 0) {
      console.log("Seeding collective solutions...");

      try {
        const collectiveSolutionsDump = JSON.parse(fs.readFileSync("./dump/collectivesolutions.json") as any);

        await db.insert(collectiveSolutionsTable).values(
          collectiveSolutionsDump.map((cs: any) => ({
            eventId: cs.eventId,
            attemptNumber: cs.attemptNumber,
            state: cs.state === 10 ? "ongoing" : cs.state === 20 ? "solved" : "archived",
            scramble: cs.scramble,
            solution: cs.solution,
            lastUserWhoInteracted: getUserId(cs.lastUserWhoInteracted.$oid),
            usersWhoMadeMoves: cs.usersWhoMadeMoves.map((u: any) => getUserId(u.$oid)),
          })),
        );
      } catch (e) {
        console.error("Unable to load collective solutions dump:", e);
      }
    }

    if ((await db.select({ id: recordConfigsTable.id }).from(recordConfigsTable).limit(1)).length === 0) {
      console.log("Seeding record configs...");

      for (let i = 0; i < RecordTypeValues.length; i++) {
        const recordTypeId = RecordTypeValues[i];

        await db.insert(recordConfigsTable).values([
          {
            recordTypeId,
            category: "competitions",
            label: `X${recordTypeId}`,
            rank: (i + 1) * 10,
            color: recordTypeId === "WR" ? C.color.danger : recordTypeId === "NR" ? C.color.success : C.color.warning,
          },
          {
            recordTypeId,
            category: "meetups",
            label: `M${recordTypeId}`,
            rank: 100 + (i + 1) * 10,
            color: recordTypeId === "WR" ? C.color.danger : recordTypeId === "NR" ? C.color.success : C.color.warning,
          },
          {
            recordTypeId,
            category: "video-based-results",
            label: `${recordTypeId.slice(0, -1)}B`,
            rank: 200 + (i + 1) * 10,
            color: recordTypeId === "WR" ? C.color.danger : recordTypeId === "NR" ? C.color.success : C.color.warning,
          },
        ]);
      }
    }

    console.log("DB seeded successfully");
  }
}
