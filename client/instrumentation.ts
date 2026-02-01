import type fsType from "node:fs";
import type { writeFile as writeFileType } from "node:fs/promises";
import { eq, inArray, sql } from "drizzle-orm";
import { eventsStub } from "~/__mocks__/stubs/eventsStub.ts";
import { getDefaultAverageAttempts, getFormattedTime, getNameAndLocalizedName } from "~/helpers/utilityFunctions.ts";
import { WcaCompetitionValidator } from "~/helpers/validators/wca/WcaCompetition.ts";
import type { auth as authType } from "~/server/auth.ts";
import type { db as dbType } from "~/server/db/provider.ts";
import { accountsTable, usersTable } from "~/server/db/schema/auth-schema.ts";
import { Continents, Countries } from "./helpers/Countries.ts";
import { C } from "./helpers/constants.ts";
import { RecordTypeValues } from "./helpers/types.ts";
import type { InsertContest } from "./server/db/schema/contests.ts";
import { eventsTable, type SelectEvent } from "./server/db/schema/events.ts";
import { type PersonResponse, personsTable } from "./server/db/schema/persons.ts";
import { recordConfigsTable } from "./server/db/schema/record-configs.ts";
import { resultsTable, type SelectResult } from "./server/db/schema/results.ts";

// Used in tests too
export const testUsers = [
  {
    email: "admin@example.com",
    username: "admin",
    name: "admin",
    password: "Temporary_good_password123",
    personId: 1,
    role: "admin",
    emailVerified: true,
  },
  {
    email: "mod@example.com",
    username: "mod",
    name: "mod",
    password: "Temporary_good_password123",
    personId: 2,
    role: "mod",
    emailVerified: true,
  },
  {
    email: "user@example.com",
    username: "user",
    name: "user",
    password: "Temporary_good_password123",
    personId: 3,
    emailVerified: true,
  },
  {
    email: "new_user@example.com",
    username: "new_user",
    name: "new_user",
    password: "Temporary_good_password123",
    personId: 4,
    emailVerified: false,
  },
];

// This is the scrypt password hash for the password "cc" (only used for testing in development)
const hashForCc =
  "a73adfb4df83466851a5c337a6bc738b:a580ce8e36188f210f2342998c46789d69ab69ebf35a6382d80ad11e8542ec62074b31789b09dc653daaf8e1ec69fb5c97c6f6244f7de80d03169e7572c0e514";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { db }: { db: typeof dbType } = await import("~/server/db/provider.ts");

    // Migrate DB data, if env var is set
    if (process.env.MIGRATE_DB !== "true") return;

    const fs: typeof fsType = await import("node:fs");
    // const { writeFile }: { writeFile: typeof writeFileType } = await import("node:fs/promises");
    const { auth }: { auth: typeof authType } = await import("~/server/auth.ts");

    if (process.env.NODE_ENV !== "production") {
      const _unoffEventIdConverter = {
        "666": "666",
        "777": "777",
        rainb: "rainbow_cube",
        skewb: "skewb",
        "333si": "333_siamese",
        snake: "snake",
        mirbl: "333_mirror_blocks",
        "360": "360_puzzle",
        mstmo: "mmorphix",
        illus: "777_illusion",
        "333ni": "333_inspectionless",
        "333r3": "333_x3_relay",
        "333sbf": "333_speed_bld",
        "3sc": "333mts_old",
        "222oh": "222oh",
        magico: "magic_oh",
        "222bf": "222bf",
        sq1bf: "sq1_bld",
        mirbbf: "333_mirror_blocks_bld",
        "234": "234relay",
        magicc: "magic_chess",
        magicb: "magic_balls",
        magccc: "magic_create_cube",
      };

      const _eeEventIdConverter = {
        "113sia": "333_siamese",
        "1mguild": "miniguild",
        "222oh": "222oh",
        "222pyra": "pyramorphix",
        "223": "223_cuboid",
        "2mguild": "miniguild_2_person",
        "2to4relay": "234relay",
        "2to7relay": "234567relay",
        "332": "233_cuboid",
        "333bets": "333_bets",
        "333bfoh": "333bf_oh",
        "333ft": "333ft",
        "333omt": "333_oven_mitts",
        "333rescr": "333mts",
        "333scr": "333_scrambling",
        "333ten": "333_x10_relay",
        "3mguild": "miniguild_3_person",
        "444ft": "444ft",
        "444pyra": "mpyram",
        "888": "888",
        "999": "999",
        clockscr: "clock_scrambling",
        curvycopter: "curvycopter",
        dino: "dino",
        fifteen: "15puzzle",
        fto: "fto",
        ivy: "ivy_cube",
        kilo: "kilominx",
        mirror: "333_mirror_blocks",
        mirrorbld: "333_mirror_blocks_bld",
        redi: "redi",
        teambld: "333_team_bld_old",
      };

      const doArchiveMigration = false;
      if (doArchiveMigration) {
        console.log("Doing archive migration...");

        const eeCompetitionsDump = JSON.parse(fs.readFileSync("./dump/ee_competitions.json") as any) as any[];
        const eeCountriesDump = JSON.parse(fs.readFileSync("./dump/ee_countries.json") as any) as any[];
        const eeOrganizersDump = JSON.parse(fs.readFileSync("./dump/ee_organizers.json") as any) as any[];

        let reachedCheckpoint = false;
        for (const eeComp of eeCompetitionsDump) {
          if (!reachedCheckpoint) {
            if (eeComp.id === "x") reachedCheckpoint = true;
            else continue;
          }
          if (eeComp.status !== "completed") {
            console.log(`EE competition ${eeComp.id} has status ${eeComp.status}, skipping...`);
            continue;
          }

          const sameCompInCc = await db.query.contests.findFirst({ where: { competitionId: eeComp.id } });
          if (sameCompInCc) console.log(`EE competition with ID ${eeComp.id} is already in the CC DB, checking...`);
          else console.log(`New competition from EE DB: ${eeComp.id}`);
          const eeCountry = eeCountriesDump.find((c) => c.id === eeComp.country_id);
          if (!eeCountry || !Countries.some((c) => c.code === eeCountry.iso2))
            throw new Error(`Unrecognized country code: ${eeComp.country_id}`);
          const eeOrganizers = eeOrganizersDump.filter((o) => o.competition_id === eeComp.id);

          await new Promise((res) => setTimeout(res, 1000));
          const wcaCompData = await fetch(`${C.wcaApiBaseUrl}/competitions/${eeComp.id}`).then(async (res) => {
            const notFoundMsg = `Competition with ID ${eeComp.id} not found`;
            if (res.status === 404) throw new Error(notFoundMsg);
            if (!res.ok) throw new Error(C.unknownErrorMsg);
            const data = await res.json();
            return WcaCompetitionValidator.parse(data);
          });

          const organizers: PersonResponse[] = [];
          const organizersWcaInternalIds = new Set<number>();
          const notFoundPersonNames = new Set();

          // Set organizer objects
          for (const org of [
            ...wcaCompData.organizers,
            ...wcaCompData.delegates,
            ...eeOrganizers.map((o) => ({
              id: o.person,
              wca_id: o.person,
              name: "EE person",
              country_iso2: "EE person",
            })),
          ]) {
            // It's possible that the same person is both a delegate and organizer
            if (organizersWcaInternalIds.has(org.id)) continue;
            organizersWcaInternalIds.add(org.id);
            const { name } = getNameAndLocalizedName(org.name);

            const person = org.wca_id
              ? await db.query.persons.findFirst({ where: { wcaId: org.wca_id } })
              : await db.query.persons.findFirst({ where: { name: { ilike: name }, regionCode: org.country_iso2 } });

            if (!org.wca_id && person && person.name !== name)
              console.log(`Assuming ${org.name} (no WCA ID) is ${name} from the CC DB`);

            if (!person)
              notFoundPersonNames.add(
                `${org.name}${org.wca_id ? ` (WCA ID: ${org.wca_id})` : ` (country: ${org.country_iso2})`}`,
              );
            else if (!organizers.some((o) => o.id === person.id)) organizers.push(person);
          }

          if (notFoundPersonNames.size > 0) {
            const notFoundNames = Array.from(notFoundPersonNames).join(", ");
            console.error(`Organizers with these names were not found: ${notFoundNames}`);
          }

          const insertContestObject: InsertContest = {
            competitionId: eeComp.id,
            state: "published",
            name: wcaCompData.name,
            shortName: wcaCompData.short_name,
            type: "wca-comp",
            city: wcaCompData.city,
            regionCode: wcaCompData.country_iso2,
            venue: wcaCompData.venue.split("]")[0].replace("[", ""),
            address: wcaCompData.venue_address,
            latitudeMicrodegrees: wcaCompData.latitude_degrees,
            longitudeMicrodegrees: wcaCompData.longitude_degrees,
            startDate: new Date(wcaCompData.start_date),
            endDate: new Date(wcaCompData.end_date),
            organizerIds: organizers.map((o) => o.id),
            contact: eeComp.contact,
            description: "",
            competitorLimit: wcaCompData.competitor_limit,
            // schedule: ,
            createdAt: new Date(eeComp.create_timestamp),
            updatedAt: new Date(eeComp.update_timestamp),
          };

          if (eeCountry.iso2 !== insertContestObject.regionCode)
            console.error(`Country field from ${eeComp.id} is wrong`);
          if (eeComp.name !== insertContestObject.name) console.error(`Name field from ${eeComp.id} is wrong`);
          if (eeComp.city !== insertContestObject.city) console.error(`City field from ${eeComp.id} is wrong`);
          if (new Date(eeComp.start_date).getTime() !== insertContestObject.startDate.getTime())
            console.error(`Start date field from ${eeComp.id} is wrong`);
          if (new Date(eeComp.end_date).getTime() !== insertContestObject.endDate.getTime())
            console.error(`End date field from ${eeComp.id} is wrong`);
          const missingEeOrganizer = eeOrganizers.find((o) => !organizers.some((o2) => o2.wcaId === o.person));
          if (missingEeOrganizer)
            console.error(`EE organizer from ${eeComp.id} is missing: ${missingEeOrganizer.person}`);

          if (sameCompInCc) {
            if (sameCompInCc.state !== insertContestObject.state)
              console.error(`State field from ${eeComp.id} is wrong in CC DB`);
            if (sameCompInCc.name !== insertContestObject.name)
              console.error(`Name field from ${eeComp.id} is wrong in CC DB`);
            if (sameCompInCc.shortName !== insertContestObject.shortName)
              console.error(`Short name field from ${eeComp.id} is wrong in CC DB`);
            if (sameCompInCc.city !== insertContestObject.city)
              console.error(`City field from ${eeComp.id} is wrong in CC DB`);
            if (sameCompInCc.regionCode !== insertContestObject.regionCode)
              console.error(`Country field from ${eeComp.id} is wrong in CC DB`);
            if (sameCompInCc.venue !== insertContestObject.venue)
              console.error(`Venue field from ${eeComp.id} is wrong in CC DB`);
            if (sameCompInCc.address !== insertContestObject.address)
              console.error(`Address field from ${eeComp.id} is wrong in CC DB`);
            if (sameCompInCc.latitudeMicrodegrees !== insertContestObject.latitudeMicrodegrees)
              console.error(`Latitude microdegrees field from ${eeComp.id} is wrong in CC DB`);
            if (sameCompInCc.longitudeMicrodegrees !== insertContestObject.longitudeMicrodegrees)
              console.error(`Longitude microdegrees field from ${eeComp.id} is wrong in CC DB`);
            if (sameCompInCc.startDate.getTime() !== insertContestObject.startDate.getTime())
              console.error(`Start date field from ${eeComp.id} is wrong in CC DB`);
            if (sameCompInCc.endDate.getTime() !== insertContestObject.endDate.getTime())
              console.error(`End date field from ${eeComp.id} is wrong in CC DB`);
            if (sameCompInCc.organizerIds.join(",") !== insertContestObject.organizerIds.join(","))
              console.error(`Organizer IDs field from ${eeComp.id} is wrong in CC DB`);
            if (sameCompInCc.competitorLimit !== insertContestObject.competitorLimit)
              console.error(`Competitor limit field from ${eeComp.id} is wrong in CC DB`);
          }
        }

        console.log("Archive migration done");
      }

      if ((await db.select().from(personsTable)).length === 0) {
        console.log("Seeding test persons...");

        await db.insert(personsTable).values([
          { name: "Test Admin", regionCode: "CH", approved: true },
          { name: "Test Moderator", localizedName: "Localized Name", regionCode: "NR", approved: true },
          { name: "Test User", regionCode: "SG", approved: true },
          { name: "Test New User", regionCode: "UY", approved: true },
          { name: "Test Person 5", regionCode: "SE" },
          { name: "Test Person 6", regionCode: "GB" },
          { name: "Test Person 7", regionCode: "US" },
          { name: "Test Person 8", regionCode: "CA" },
          { name: "Test Person 9", regionCode: "CN" },
          { name: "Test Person 10", regionCode: "GB" },
        ]);
      }

      for (const testUser of testUsers) {
        const userExists =
          (await db.select().from(usersTable).where(eq(usersTable.email, testUser.email)).limit(1)).length > 0;

        if (!userExists) {
          if (process.env.EMAIL_API_KEY) {
            throw new Error(
              "The EMAIL_API_KEY environment variable must be empty while seeding the DB to avoid sending lots of verification emails for the users being seeded. Remove it and comment out the sendVerificationEmail function in auth.ts, and then add them back after the DB has been seeded.",
            );
          }

          const { role, emailVerified, ...body } = testUser;
          await auth.api.signUpEmail({ body });

          // Set emailVerified and personId
          const [user] = await db
            .update(usersTable)
            .set({ emailVerified, personId: testUser.personId })
            .where(eq(usersTable.email, testUser.email))
            .returning();

          await db.update(accountsTable).set({ password: hashForCc }).where(eq(accountsTable.userId, user.id));

          // Set role
          if (role) await db.update(usersTable).set({ role }).where(eq(usersTable.id, user.id));

          console.log(`Seeded test user: ${testUser.username}`);
        }
      }

      if ((await db.select().from(eventsTable)).length === 0) {
        console.log("Seeding test events...");

        await db.insert(eventsTable).values(eventsStub);
      }
    } // END OF if (process.env.NODE_ENV !== "production")

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

    // const doSetResultRecords = false
    // if (doSetResultRecords) {
    //   console.log("Setting result records...");

    //   const recordMapper = (result: SelectResult, event: Pick<SelectEvent, "format" | "category">) => {
    //     const country = Countries.find((c) => c.code === result.regionCode);
    //     const continent = Continents.find((c) => c.code === result.superRegionCode);
    //     const getRecordLabel = (key: "regionalSingleRecord" | "regionalAverageRecord") =>
    //       result.recordCategory === "competitions"
    //         ? `X${result[key]}`
    //         : result.recordCategory === "meetups"
    //           ? `M${result[key]}`
    //           : `${result[key]?.slice(0, -1)}B`;

    //     const temp = {
    //       persons: result.personIds!.map((pid) => personsDump.find((p) => p.personId === pid)!.name),
    //       date: result.date.toDateString(),
    //     };

    //     if (country) (temp as any).regionCode = country.name;
    //     if (continent) (temp as any).superRegionCode = continent.name;

    //     if (result.regionalSingleRecord) {
    //       (temp as any).regionalSingleRecord = getRecordLabel("regionalSingleRecord");
    //       (temp as any).best = getFormattedTime(result.best, { event: event as any });
    //     } else {
    //       (temp as any).regionalAverageRecord = getRecordLabel("regionalAverageRecord");
    //       (temp as any).average = getFormattedTime(result.average, { event: event as any });
    //     }

    //     return temp;
    //   };

    //   await db.transaction(async (tx) => {
    //     for (const category of ["meetups", "video-based-results", "competitions"]) {
    //       for (const event of eventsDump) {
    //         if (!(await tx.query.results.findFirst({ columns: { id: true }, where: { eventId: event.eventId } }))) {
    //           console.log(`No results found for event ${event.eventId}, skipping`);
    //           continue;
    //         }

    //         const newWrResults = [];

    //         for (const bestOrAverage of ["best", "average"] as ("best" | "average")[]) {
    //           const recordField = bestOrAverage === "best" ? "regionalSingleRecord" : "regionalAverageRecord";
    //           const defaultNumberOfAttempts = getDefaultAverageAttempts(event.defaultRoundFormat);
    //           const numberOfAttemptsCondition =
    //             bestOrAverage === "best"
    //               ? sql``
    //               : sql`AND (${resultsTable.date} < ${C.cutoffDateForFlexibleAverageRecords}
    //                       OR CARDINALITY(${resultsTable.attempts}) = ${defaultNumberOfAttempts})`;

    //           const newWrIds = await tx
    //             .execute(sql`
    //             WITH day_min_times AS (
    //               SELECT ${resultsTable.id}, ${resultsTable.date}, ${resultsTable[bestOrAverage]},
    //                 MIN(${resultsTable[bestOrAverage]}) OVER(PARTITION BY ${resultsTable.date}
    //                   ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS day_min_time
    //               FROM ${resultsTable}
    //               WHERE ${resultsTable[bestOrAverage]} > 0
    //                 AND ${resultsTable.eventId} = ${event.eventId}
    //                 AND ${resultsTable.recordCategory} = ${category}
    //                 ${numberOfAttemptsCondition}
    //               ORDER BY ${resultsTable.date}
    //             ), results_with_record_times AS (
    //               SELECT id, MIN(day_min_time) OVER(ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS curr_record
    //               FROM day_min_times
    //               ORDER BY date
    //             )
    //             SELECT ${resultsTable.id}
    //             FROM ${resultsTable} RIGHT JOIN results_with_record_times
    //             ON ${resultsTable.id} = results_with_record_times.id
    //             WHERE (${resultsTable[recordField]} IS NULL OR ${resultsTable[recordField]} <> 'WR')
    //               AND ${resultsTable[bestOrAverage]} = results_with_record_times.curr_record`)
    //             .then((val: any) => val.map(({ id }: any) => id));

    //           newWrResults.push(
    //             ...(await tx
    //               .update(resultsTable)
    //               .set({ [recordField]: "WR" })
    //               .where(inArray(resultsTable.id, newWrIds))
    //               .returning()),
    //           );

    //           for (const crType of ["ER", "NAR", "SAR", "AsR", "AfR", "OcR"]) {
    //             const superRegionCode = Continents.find((c) => c.recordTypeId === crType)!.code;

    //             const newCrIds = await tx
    //               .execute(sql`
    //               WITH day_min_times AS (
    //                 SELECT ${resultsTable.id}, ${resultsTable.date}, ${resultsTable[bestOrAverage]},
    //                   MIN(${resultsTable[bestOrAverage]}) OVER(PARTITION BY ${resultsTable.date}
    //                     ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS day_min_time
    //                 FROM ${resultsTable}
    //                 WHERE ${resultsTable[bestOrAverage]} > 0
    //                   AND ${resultsTable.eventId} = ${event.eventId}
    //                   AND ${resultsTable.superRegionCode} = ${superRegionCode}
    //                   AND ${resultsTable.recordCategory} = ${category}
    //                   ${numberOfAttemptsCondition}
    //                 ORDER BY ${resultsTable.date}
    //               ), results_with_record_times AS (
    //                 SELECT id, MIN(day_min_time) OVER(ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS curr_record
    //                 FROM day_min_times
    //                 ORDER BY date
    //               )
    //               SELECT ${resultsTable.id}
    //               FROM ${resultsTable} RIGHT JOIN results_with_record_times
    //               ON ${resultsTable.id} = results_with_record_times.id
    //               WHERE (${resultsTable[recordField]} IS NULL OR ${resultsTable[recordField]} = 'NR')
    //                 AND ${resultsTable[bestOrAverage]} = results_with_record_times.curr_record`)
    //               .then((val: any) => val.map(({ id }: any) => id));

    //             if (newCrIds.length > 0) {
    //               await tx
    //                 .update(resultsTable)
    //                 .set({ [recordField]: crType })
    //                 .where(inArray(resultsTable.id, newCrIds))
    //                 .returning();
    //             }
    //           }

    //           const newNrIds = [];

    //           for (const code of Countries.map((c) => c.code)) {
    //             const nrIdsForCountry = await tx.execute(sql`
    //               WITH day_min_times AS (
    //                 SELECT ${resultsTable.id}, ${resultsTable.date}, ${resultsTable[bestOrAverage]},
    //                   MIN(${resultsTable[bestOrAverage]}) OVER(PARTITION BY ${resultsTable.date}
    //                     ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS day_min_time
    //                 FROM ${resultsTable}
    //                 WHERE ${resultsTable[bestOrAverage]} > 0
    //                   AND ${resultsTable.eventId} = ${event.eventId}
    //                   AND ${resultsTable.regionCode} = ${code}
    //                   AND ${resultsTable.recordCategory} = ${category}
    //                   ${numberOfAttemptsCondition}
    //                 ORDER BY ${resultsTable.date}
    //               ), results_with_record_times AS (
    //                 SELECT id, MIN(day_min_time) OVER(ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS curr_record
    //                 FROM day_min_times
    //                 ORDER BY date
    //               )
    //               SELECT ${resultsTable.id}
    //               FROM ${resultsTable} RIGHT JOIN results_with_record_times
    //               ON ${resultsTable.id} = results_with_record_times.id
    //               WHERE ${resultsTable[recordField]} IS NULL
    //                 AND ${resultsTable[bestOrAverage]} = results_with_record_times.curr_record`);

    //             if (nrIdsForCountry.length > 0) newNrIds.push(...nrIdsForCountry.map(({ id }: any) => id));
    //           }

    //           if (newNrIds.length > 0) {
    //             await tx
    //               .update(resultsTable)
    //               .set({ [recordField]: "NR" })
    //               .where(inArray(resultsTable.id, newNrIds))
    //               .returning();
    //           }
    //         }

    //         // Save WRs, if there were any (could be that the event doesn't have any non-DNF results in the category)
    //         if (newWrResults.length > 0) {
    //           await writeFile(
    //             `./new_records/${event.eventId}_${newWrResults[0].regionalSingleRecord}s`,
    //             JSON.stringify(newWrResults.map(recordMapper as any), null, 2),
    //           );
    //         }
    //       }
    //     }
    //   });
    // }

    console.log("DB seeded successfully");
  }
}
