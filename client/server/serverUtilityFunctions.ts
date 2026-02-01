import "server-only";
import { and, desc, eq, gt, inArray, lt, lte, ne, or, sql } from "drizzle-orm";
import { camelCase } from "lodash";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import z from "zod";
import { Continents, Countries } from "~/helpers/Countries.ts";
import { C } from "~/helpers/constants.ts";
import type { Ranking, RecordsData } from "~/helpers/types/Rankings.ts";
import { type RecordCategory, RecordCategoryValues, type RecordType, RecordTypeValues } from "~/helpers/types.ts";
import { getIsAdmin } from "~/helpers/utilityFunctions.ts";
import { type DbTransactionType, db } from "~/server/db/provider.ts";
import { type ContestResponse, contestsTable } from "~/server/db/schema/contests.ts";
import { type EventResponse, eventsPublicCols, eventsTable, type SelectEvent } from "~/server/db/schema/events.ts";
import { type PersonResponse, personsTable, type SelectPerson } from "~/server/db/schema/persons.ts";
import { recordConfigsPublicCols, recordConfigsTable } from "~/server/db/schema/record-configs.ts";
import { resultsTable, type SelectResult } from "~/server/db/schema/results.ts";
import { type LogCode, logger } from "~/server/logger.ts";
import { RrActionError } from "~/server/safeAction.ts";
import { getDateOnly, getDefaultAverageAttempts, getNameAndLocalizedName } from "../helpers/utilityFunctions.ts";
import { auth } from "./auth.ts";
import type { RrPermissions } from "./permissions.ts";

export function logMessage(code: LogCode, message: string, { metadata }: { metadata?: object } = {}) {
  const messageWithCode = `[${code}] ${message}`;

  // Log to terminal/Docker container (except page visit logs)
  if (code !== "RR0001") console.log(messageWithCode);

  if (!process.env.VITEST) {
    try {
      // The metadata is then handled in loggerUtils.js
      const childObject: any = { rrCode: code };
      if (metadata) childObject.rrMetadata = metadata;

      logger.child(childObject).info(messageWithCode);
    } catch (err) {
      console.error("Error while sending log to Supabase Analytics:", err);
    }
  }
}

export async function checkUserPermissions(userId: string, permissions: RrPermissions): Promise<boolean> {
  const { success } = await auth.api.userHasPermission({ body: { userId, permissions } });
  return success;
}

export async function authorizeUser({
  permissions,
}: {
  permissions?: RrPermissions;
} = {}): Promise<typeof auth.$Infer.Session> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");

  if (permissions) {
    const isAuthorized = await checkUserPermissions(session.user.id, permissions);
    if (!isAuthorized) redirect("/login");

    // The user must have an assigned person to be able to do any operation except creating video-based results
    if (
      !session.user.personId &&
      (Object.keys(permissions).some((key) => key !== ("videoBasedResults" satisfies keyof typeof permissions)) ||
        permissions.videoBasedResults?.some((perm) => perm !== "create"))
    )
      redirect("/login");
  }

  return session;
}

export function getUserHasAccessToContest(
  user: typeof auth.$Infer.Session.user,
  contest: Pick<ContestResponse, "state" | "organizerIds">,
) {
  if (!user.personId) return false;
  if (contest.state === "removed") return false;
  if (getIsAdmin(user.role)) return true;

  const modHasAccess =
    ["created", "approved", "ongoing"].includes(contest.state) && contest.organizerIds.includes(user.personId);
  return modHasAccess;
}

export async function getContestParticipantIds(tx: DbTransactionType, competitionId: string): Promise<number[]> {
  const results = await tx.query.results.findMany({ columns: { personIds: true }, where: { competitionId } });

  const participantIds = new Set<number>();
  for (const result of results) {
    for (const personId of result.personIds) {
      participantIds.add(personId);
    }
  }

  return Array.from(participantIds);
}

export async function getRecordConfigs(recordFor: RecordCategory) {
  const recordConfigs = await db
    .select(recordConfigsPublicCols)
    .from(recordConfigsTable)
    .where(eq(recordConfigsTable.category, recordFor));

  if (recordConfigs.length !== RecordTypeValues.length) {
    throw new Error(
      `The records are configured incorrectly. Expected ${RecordTypeValues.length} record configs for the category, but found ${recordConfigs.length}.`,
    );
  }

  return recordConfigs;
}

export async function getVideoBasedEvents() {
  const events = await db
    .select(eventsPublicCols)
    .from(eventsTable)
    .where(eq(eventsTable.submissionsAllowed, true))
    .orderBy(eventsTable.rank);

  return events;
}

export async function getRecordResult(
  event: Pick<SelectEvent, "eventId" | "defaultRoundFormat">,
  bestOrAverage: "best" | "average",
  recordType: RecordType,
  recordCategory: RecordCategory,
  {
    tx,
    recordsUpTo = getDateOnly(new Date())!,
    excludeResultId,
    regionCode,
  }: {
    tx?: DbTransactionType; // this can optionally be run inside of a transaction
    recordsUpTo?: Date;
    excludeResultId?: number;
    regionCode?: string;
  } = {
    recordsUpTo: getDateOnly(new Date())!,
  },
): Promise<SelectResult | undefined> {
  const superRegion = Continents.find((c) => c.recordTypeId === recordType);

  const [recordResult] = await (tx ?? db)
    .select()
    .from(resultsTable)
    .where(
      and(
        eq(resultsTable.eventId, event.eventId),
        excludeResultId ? ne(resultsTable.id, excludeResultId) : undefined,
        lte(resultsTable.date, recordsUpTo),
        eq(resultsTable.recordCategory, recordCategory),
        gt(resultsTable[bestOrAverage], 0),
        bestOrAverage === "average"
          ? or(
              lt(resultsTable.date, new Date(C.cutoffDateForFlexibleAverageRecords)),
              sql`CARDINALITY(${resultsTable.attempts}) = ${getDefaultAverageAttempts(event.defaultRoundFormat)}`,
            )
          : undefined,
        superRegion ? eq(resultsTable.superRegionCode, superRegion.code) : undefined,
        regionCode ? eq(resultsTable.regionCode, regionCode) : undefined,
      ),
    )
    .orderBy(resultsTable[bestOrAverage])
    .limit(1);
  return recordResult;
}

const personsArrayJsonSql = sql`
  JSON_AGG(
    JSON_BUILD_OBJECT(
      'id', ${personsTable.id},
      'name', ${personsTable.name},
      'localizedName', ${personsTable.localizedName},
      'regionCode', ${personsTable.regionCode},
      'wcaId', ${personsTable.wcaId}
    )
  )`;

export async function getRecords(
  eventCategory: string,
  recordCategory: RecordCategory,
  region?: string,
): Promise<RecordsData> {
  z.strictObject({
    eventCategory: z.string().nonempty(),
    recordCategory: z.enum(RecordCategoryValues),
    region: z.string().optional(),
  }).parse({ eventCategory, recordCategory, region });

  const events = await db.query.events.findMany({
    columns: { eventId: true, name: true, category: true, format: true, removedWca: true, description: true },
    where: { hidden: false, category: eventCategory },
    orderBy: { rank: "asc" },
  });

  let recordTypes: RecordType[] = ["WR"];
  if (region) {
    const continent = Continents.find((c) => c.code === region);
    if (continent) {
      recordTypes.push(continent.recordTypeId);
    } else {
      const country = Countries.find((c) => c.code === region)!;
      recordTypes = ["WR", Continents.find((con) => con.code === country.superRegionCode)!.recordTypeId, "NR"];
    }
  }

  const records = await db
    .select({
      eventId: eventsTable.eventId,
      result: resultsTable,
      persons: sql`(SELECT ${personsArrayJsonSql} FROM ${personsTable} WHERE ${personsTable.id} = ANY(${resultsTable.personIds}))`,
      contest: {
        competitionId: contestsTable.competitionId,
        shortName: contestsTable.shortName,
        regionCode: contestsTable.regionCode,
        type: contestsTable.type,
      },
    })
    .from(eventsTable)
    .innerJoin(resultsTable, eq(eventsTable.eventId, resultsTable.eventId))
    .leftJoin(contestsTable, eq(resultsTable.competitionId, contestsTable.competitionId))
    .where(
      and(
        inArray(
          eventsTable.eventId,
          events.map((e) => e.eventId),
        ),
        eq(resultsTable.recordCategory, recordCategory),
        or(
          inArray(resultsTable.regionalSingleRecord, recordTypes),
          inArray(resultsTable.regionalAverageRecord, recordTypes),
        ),
        region && recordTypes.includes("NR") ? eq(resultsTable.regionCode, region) : undefined,
      ),
    )
    .orderBy(desc(resultsTable.date));

  return {
    events: events.filter((e) => records.some((r) => r.eventId === e.eventId)),
    records: records.map((r) => {
      const type = recordTypes.includes(r.result.regionalSingleRecord as any)
        ? recordTypes.includes(r.result.regionalAverageRecord as any)
          ? "single-and-avg"
          : "single"
        : "average";

      return {
        rankingId: `${r.result.id}_${type}`,
        type,
        eventId: r.eventId,
        date: r.result.date,
        persons: r.persons as Pick<PersonResponse, "id" | "name" | "localizedName" | "regionCode" | "wcaId">[],
        best: r.result.best,
        average: r.result.average,
        attempts: r.result.attempts,
        contest: r.contest,
        videoLink: r.result.videoLink,
        discussionLink: r.result.discussionLink,
      };
    }),
  };
}

export async function getRankings(
  event: EventResponse,
  bestOrAverage: "best" | "average",
  recordCategory: RecordCategory | "all",
  {
    show = "persons",
    region,
    topN = 100,
  }: {
    show?: "persons" | "results";
    region?: string;
    topN?: number;
  },
): Promise<Ranking[]> {
  z.strictObject({
    bestOrAverage: z.enum(["best", "average"]),
    recordCategory: z.enum([...RecordCategoryValues, "all"]),
    show: z.enum(["persons", "results"]).optional(),
    region: z.string().optional(),
    topN: z.int().min(1).max(C.maxRankings),
  }).parse({ bestOrAverage, recordCategory, show, region, topN });

  const defaultNumberOfAttempts = getDefaultAverageAttempts(event.defaultRoundFormat);
  const recordCategoryCondition =
    recordCategory === "all" ? sql`` : sql`AND ${resultsTable.recordCategory} = ${recordCategory}`;
  const regionCondition = region
    ? Continents.some((c) => c.code === region)
      ? sql`AND ${resultsTable.superRegionCode} = ${region}`
      : sql`AND ${resultsTable.regionCode} = ${region}`
    : sql``;
  let rankings: Ranking[];

  const mapRankingsData = (val: any[]) =>
    val.map((item: any) => {
      const objectWithCamelCase: any = {};
      for (const [key, value] of Object.entries(item)) {
        if (key === "date") objectWithCamelCase[camelCase(key)] = new Date(value as string);
        // RANK() returns a BIGINT and result is BIGINT in the DB, which Drizzle returns as a string, so both need to be converted
        else if (["ranking", "result"].includes(key)) objectWithCamelCase[camelCase(key)] = Number(value);
        else objectWithCamelCase[camelCase(key)] = value;
      }
      return objectWithCamelCase;
    });

  // Top persons
  if (show === "persons") {
    rankings = await db
      .execute(sql`
        WITH personal_records AS (
          SELECT DISTINCT ON (person_id)
            CONCAT(${resultsTable.id}, '_', person_id) AS ranking_id,
            ${resultsTable.date},
            person_id,
            ${resultsTable.personIds} AS persons,
            ${resultsTable[bestOrAverage]} AS result,
            ${resultsTable.attempts},
            CASE WHEN ${resultsTable.competitionId} IS NOT NULL THEN
              JSON_BUILD_OBJECT(
                'competitionId', ${contestsTable.competitionId},
                'shortName', ${contestsTable.shortName},
                'type', ${contestsTable.type},
                'regionCode', ${contestsTable.regionCode}
              )
            ELSE NULL END AS contest,
            ${resultsTable.videoLink},
            ${resultsTable.discussionLink}
          FROM ${resultsTable}
            LEFT JOIN ${contestsTable}
              ON ${resultsTable.competitionId} = ${contestsTable.competitionId},
            UNNEST(${resultsTable.personIds}) AS person_id
          WHERE ${resultsTable.approved} IS TRUE
            AND ${resultsTable.eventId} = ${event.eventId}
            ${recordCategoryCondition}
            AND ${resultsTable[bestOrAverage]} > 0
            ${
              bestOrAverage === "best"
                ? sql``
                : sql`AND (${resultsTable.date} < ${C.cutoffDateForFlexibleAverageRecords}
                        OR  CARDINALITY(${resultsTable.attempts}) = ${defaultNumberOfAttempts})`
            }
            ${regionCondition}
          ORDER BY person_id, ${resultsTable[bestOrAverage]}, ${resultsTable.date}
        ), rankings AS (
          SELECT
            personal_records.*,
            RANK() OVER (ORDER BY personal_records.result ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS ranking,
            (SELECT ${personsArrayJsonSql} FROM ${personsTable} WHERE ${personsTable.id} = ANY(personal_records.persons)) AS persons
          FROM personal_records
          ORDER BY ranking, personal_records.date
        )
        SELECT * FROM rankings
        WHERE rankings.ranking <= ${topN}
      `)
      .then(mapRankingsData);

    // If getting single rankings for an event that has memo, set the memo time from the attempts array for each entry
    if (bestOrAverage === "best" && event.hasMemo) {
      rankings = rankings.map((ranking) => {
        let memo: number | null = null;
        const numberOfAttemptsEqualToBest = ranking.attempts.filter((a) => a.result === ranking.result).length;
        if (numberOfAttemptsEqualToBest === 1)
          memo = ranking.attempts.find((a) => a.result === ranking.result)!.memo ?? null;
        return { ...ranking, memo };
      });
    }
  }
  // Top singles
  else if (bestOrAverage === "best") {
    rankings = await db
      .execute(sql`
        WITH rankings AS (
          SELECT
            CONCAT(${resultsTable.id}, '_', attempts_data.attempt_number) AS ranking_id,
            RANK() OVER (ORDER BY CAST(attempts_data.attempt->>'result' AS BIGINT) ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS ranking,
            ${resultsTable.date},
            (SELECT ${personsArrayJsonSql} FROM ${personsTable} WHERE ${personsTable.id} = ANY(${resultsTable.personIds})) AS persons,
            attempts_data.attempt->>'result' AS result,
            CAST(attempts_data.attempt->>'memo' AS INTEGER) AS memo,
            ${resultsTable.attempts},
            CASE WHEN ${resultsTable.competitionId} IS NOT NULL THEN
              JSON_BUILD_OBJECT(
                'competitionId', ${contestsTable.competitionId},
                'shortName', ${contestsTable.shortName},
                'type', ${contestsTable.type},
                'regionCode', ${contestsTable.regionCode}
              )
            ELSE NULL END AS contest,
            ${resultsTable.videoLink},
            ${resultsTable.discussionLink}
          FROM ${resultsTable}
            LEFT JOIN ${contestsTable}
              ON ${resultsTable.competitionId} = ${contestsTable.competitionId},
            UNNEST(${resultsTable.attempts}) WITH ORDINALITY AS attempts_data(attempt, attempt_number)
          WHERE ${resultsTable.approved} IS TRUE
            AND ${resultsTable.eventId} = ${event.eventId}
            ${recordCategoryCondition}
            AND CAST(attempts_data.attempt->>'result' AS BIGINT) > 0
            ${regionCondition}
          ORDER BY ranking, ${resultsTable.date}
        )
        SELECT * FROM rankings
        WHERE rankings.ranking <= ${topN}
      `)
      .then(mapRankingsData);
  }
  // Top averages
  else {
    rankings = await db
      .execute(sql`
        WITH rankings AS (
          SELECT
            CAST(${resultsTable.id} AS TEXT) AS ranking_id,
            RANK() OVER (ORDER BY ${resultsTable.average} ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS ranking,
            ${resultsTable.date},
            (SELECT ${personsArrayJsonSql} FROM ${personsTable} WHERE ${personsTable.id} = ANY(${resultsTable.personIds})) AS persons,
            ${resultsTable.average} AS result,
            ${resultsTable.attempts},
            CASE WHEN ${resultsTable.competitionId} IS NOT NULL THEN
              JSON_BUILD_OBJECT(
                'competitionId', ${contestsTable.competitionId},
                'shortName', ${contestsTable.shortName},
                'type', ${contestsTable.type},
                'regionCode', ${contestsTable.regionCode}
              )
            ELSE NULL END AS contest,
            ${resultsTable.videoLink},
            ${resultsTable.discussionLink}
          FROM ${resultsTable}
            LEFT JOIN ${contestsTable}
              ON ${resultsTable.competitionId} = ${contestsTable.competitionId}
          WHERE ${resultsTable.approved} IS TRUE
            AND ${resultsTable.eventId} = ${event.eventId}
            ${recordCategoryCondition}
            AND ${resultsTable.average} > 0
            AND (${resultsTable.date} < ${C.cutoffDateForFlexibleAverageRecords}
              OR CARDINALITY(${resultsTable.attempts}) = ${defaultNumberOfAttempts})
            ${regionCondition}
          ORDER BY ${resultsTable.average}, ${resultsTable.date}
        )
        SELECT * FROM rankings
        WHERE rankings.ranking <= ${topN}
      `)
      .then(mapRankingsData);
  }

  return rankings!;
}

export async function getPersonExactMatchWcaId(
  person: SelectPerson,
  ignoredWcaMatches: string[] = [],
): Promise<string | null> {
  const res = await fetch(`${C.wcaV0ApiBaseUrl}/search/users?persons_table=true&q=${person.name}`);
  if (res.ok) {
    const { result: wcaPersons } = await res.json();

    for (const wcaPerson of wcaPersons) {
      const { name } = getNameAndLocalizedName(wcaPerson.name);

      if (
        !ignoredWcaMatches.includes(wcaPerson.wca_id) &&
        name === person.name &&
        wcaPerson.country_iso2 === person.regionCode
      ) {
        return wcaPerson.wca_id;
      }
    }

    return null;
  } else {
    throw new RrActionError("Error while fetching person matches from the WCA");
  }
}
