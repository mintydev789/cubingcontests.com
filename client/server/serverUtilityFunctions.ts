import "server-only";
import { and, desc, eq, inArray, lte, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Continents, Countries } from "~/helpers/Countries.ts";
import { C } from "~/helpers/constants.ts";
import { type RecordCategory, type RecordType, RecordTypeValues } from "~/helpers/types.ts";
import { getIsAdmin } from "~/helpers/utilityFunctions.ts";
import { type DbTransactionType, db } from "~/server/db/provider.ts";
import type { ContestResponse } from "~/server/db/schema/contests.ts";
import { eventsPublicCols, eventsTable } from "~/server/db/schema/events.ts";
import type { SelectPerson } from "~/server/db/schema/persons.ts";
import { recordConfigsPublicCols, recordConfigsTable } from "~/server/db/schema/record-configs.ts";
import { resultsTable, type SelectResult } from "~/server/db/schema/results.ts";
import { type LogCode, logger } from "~/server/logger.ts";
import { CcActionError } from "~/server/safeAction.ts";
import { getDateOnly, getNameAndLocalizedName } from "../helpers/sharedFunctions.ts";
import { auth } from "./auth.ts";
import type { CcPermissions } from "./permissions.ts";

export async function checkUserPermissions(userId: string, permissions: CcPermissions): Promise<boolean> {
  const { success } = await auth.api.userHasPermission({ body: { userId, permissions } });
  return success;
}

export async function authorizeUser({
  permissions,
}: {
  permissions?: CcPermissions;
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

export function logMessage(code: LogCode, message: string) {
  const messageWithCode = `[${code}] ${message}`;

  console.log(messageWithCode);

  if (!process.env.VITEST) {
    try {
      // The metadata is then handled in loggerUtils.js
      logger.child({ ccCode: code }).info(messageWithCode);
    } catch (err) {
      console.error("Error while sending log to Supabase Analytics:", err);
    }
  }
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
  eventId: string,
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
  const recordField = bestOrAverage === "best" ? "regionalSingleRecord" : "regionalAverageRecord";
  const superRegion = Continents.find((c) => c.recordTypeId === recordType);
  const region = regionCode ? Countries.find((c) => c.code === regionCode) : undefined;
  const recordTypes: RecordType[] = [];

  if (recordType === "WR") {
    recordTypes.push("WR");
  } else if (superRegion) {
    recordTypes.push(recordType, "WR");
  } else if (region) {
    const crType = Continents.find((c) => c.code === region.superRegionCode)!.recordTypeId;
    recordTypes.push("NR", crType, "WR");
  } else {
    throw new Error(`Unknown region code: ${regionCode}`);
  }

  const [recordResult] = await (tx ?? db)
    .select()
    .from(resultsTable)
    .where(
      and(
        eq(resultsTable.eventId, eventId),
        excludeResultId ? ne(resultsTable.id, excludeResultId) : undefined,
        lte(resultsTable.date, recordsUpTo),
        eq(resultsTable.recordCategory, recordCategory),
        inArray(resultsTable[recordField], recordTypes),
        superRegion ? eq(resultsTable.superRegionCode, superRegion.code) : undefined,
        regionCode ? eq(resultsTable.regionCode, regionCode) : undefined,
      ),
    )
    .orderBy(desc(resultsTable.date))
    .limit(1);
  return recordResult;
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
    throw new CcActionError("Error while fetching person matches from the WCA");
  }
}
