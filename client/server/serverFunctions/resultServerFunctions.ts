"use server";

import { addDays, differenceInDays, format } from "date-fns";
import { and, eq, gt, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import z from "zod";
import { ContinentRecordType, Countries, getSuperRegion } from "~/helpers/Countries.ts";
import { C } from "~/helpers/constants.ts";
import { roundFormats } from "~/helpers/roundFormats.ts";
import {
  ContinentalRecordTypes,
  type ContinentCode,
  type EventWrPair,
  RecordCategoryValues,
  type RecordType,
} from "~/helpers/types.ts";
import {
  compareAvgs,
  compareSingles,
  getBestAndAverage,
  getDefaultAverageAttempts,
  getFormattedTime,
  getMakesCutoff,
  getResultProceeds,
  getRoundDate,
} from "~/helpers/utilityFunctions.ts";
import {
  AttemptsValidator,
  ResultValidator,
  type VideoBasedResultDto,
  VideoBasedResultValidator,
} from "~/helpers/validators/Result.ts";
import { contestsTable, type SelectContest } from "~/server/db/schema/contests.ts";
import type { RoundResponse, SelectRound } from "~/server/db/schema/rounds.ts";
import { type DbTransactionType, db } from "../db/provider.ts";
import type { EventResponse, SelectEvent } from "../db/schema/events.ts";
import type { SelectPerson } from "../db/schema/persons.ts";
import type { RecordConfigResponse } from "../db/schema/record-configs.ts";
import {
  type Attempt,
  type InsertResult,
  type ResultResponse,
  resultsPublicCols,
  type SelectResult,
  resultsTable as table,
} from "../db/schema/results.ts";
import { sendVideoBasedResultApprovedEmail, sendVideoBasedResultSubmittedEmail } from "../email/mailer.ts";
import { actionClient, RrActionError } from "../safeAction.ts";
import {
  approvePersons,
  checkUserPermissions,
  getContestParticipantIds,
  getRecordConfigs,
  getRecordResult,
  getUserHasAccessToContest,
  logMessage,
} from "../serverUtilityFunctions.ts";

const OLD_RESULT_WITH_RECORD_VALIDATION_ERROR_MSG =
  "The result is more than 30 days old and contains a record, which could affect other records. Please contact the development team.";

export const getWrPairUpToDateSF = actionClient
  .metadata({ permissions: { videoBasedResults: ["create"] } })
  .inputSchema(
    z.strictObject({
      recordCategory: z.enum(RecordCategoryValues),
      eventId: z.string(),
      recordsUpTo: z.date().optional(),
      excludeResultId: z.int().optional(),
    }),
  )
  .action<EventWrPair>(async ({ parsedInput: { recordCategory, eventId, recordsUpTo, excludeResultId } }) => {
    const event = await db.query.events.findFirst({ where: { eventId } });
    if (!event) throw new RrActionError(`Event with ID ${eventId} not found`);

    const singleWrResult = await getRecordResult(event, "best", "WR", recordCategory, {
      recordsUpTo,
      excludeResultId,
    });
    const averageWrResult = await getRecordResult(event, "average", "WR", recordCategory, {
      recordsUpTo,
      excludeResultId,
    });

    return { eventId, best: singleWrResult?.best, average: averageWrResult?.average };
  });

export const createContestResultSF = actionClient
  .metadata({ permissions: { competitions: ["create"], meetups: ["create"] } })
  .inputSchema(
    z.strictObject({
      newResultDto: ResultValidator,
    }),
  )
  .action<ResultResponse[]>(
    async ({
      parsedInput: { newResultDto },
      ctx: {
        session: { user },
      },
    }) => {
      const { eventId, personIds, competitionId, roundId } = newResultDto;
      logMessage(
        "RR0013",
        `Creating contest result for contest ${competitionId}, event ${eventId}, round ${roundId} and persons ${personIds.join(", ")}: ${JSON.stringify(newResultDto.attempts)}`,
      );

      const contestPromise = db.query.contests.findFirst({ where: { competitionId } });
      const eventPromise = db.query.events.findFirst({ where: { eventId } });
      const roundsPromise = db.query.rounds.findMany({ where: { competitionId, eventId } });
      const roundResultsPromise = db.query.results.findMany({ where: { roundId }, orderBy: { ranking: "asc" } });
      const personsPromise = db.query.persons.findMany({ where: { id: { in: personIds } } });

      const [contest, event, rounds, roundResults, participants] = await Promise.all([
        contestPromise,
        eventPromise,
        roundsPromise,
        roundResultsPromise,
        personsPromise,
      ]);
      const round = rounds.find((r) => r.id === roundId);

      if (!contest) throw new RrActionError(`Contest with ID ${competitionId} not found`);
      if (!getUserHasAccessToContest(user, contest))
        throw new RrActionError("You do not have access rights for this contest");
      if (!event) throw new RrActionError(`Event with ID ${newResultDto.eventId} not found`);
      if (!round) throw new RrActionError(`Round with ID ${newResultDto.roundId} not found`);
      if (!round.open) throw new RrActionError("The round is not open");
      // Same check as in createVideoBasedResultSF
      const notFoundPersonId = personIds.find((pid) => !participants.some((p) => p.id === pid));
      if (notFoundPersonId) throw new RrActionError(`Person with ID ${notFoundPersonId} not found`);
      // Same check as in createVideoBasedResultSF
      if (newResultDto.personIds.length !== event.participants) {
        throw new RrActionError(
          `This event must have ${event.participants} participant${event.participants > 1 ? "s" : ""}`,
        );
      }
      if (roundResults.some((r) => r.personIds.some((pid) => newResultDto.personIds.includes(pid))))
        throw new RrActionError("The competitor(s) already has a result in this round");
      // Check that all of the participants have proceeded to this round
      if (round.roundNumber > 1) {
        const prevRound = rounds.find((r) => r.roundNumber === round.roundNumber - 1)!;
        const prevRoundResults = await db.query.results.findMany({ where: { roundId: prevRound.id } });
        const notProceededCompetitorIndex = newResultDto.personIds.findIndex(
          (pid) => !prevRoundResults.some((r) => r.proceeds && r.personIds.includes(pid)),
        );

        if (notProceededCompetitorIndex >= 0) {
          throw new RrActionError(
            `Competitor${event.participants > 1 ? ` ${notProceededCompetitorIndex + 1}` : ""} has not proceeded to this round`,
          );
        }
      }

      const roundFormat = roundFormats.find((rf) => rf.value === round.format)!;

      newResultDto.attempts = await validateTimeLimitAndCutoff(
        newResultDto.attempts,
        newResultDto.personIds,
        round,
        roundFormat.attempts,
      );

      const recordConfigs = await getRecordConfigs(contest.type === "meetup" ? "meetups" : "competitions");
      const { best, average } = getBestAndAverage(newResultDto.attempts, event.format, roundFormat.value);
      const newResult: InsertResult = {
        eventId,
        date: getRoundDate(round, contest),
        personIds,
        attempts: newResultDto.attempts,
        best,
        average,
        recordCategory: contest.type === "meetup" ? "meetups" : "competitions",
        competitionId,
        roundId,
        ranking: 1, // gets set to the correct value below
        createdBy: user.id,
      };

      await setResultRecordsAndRegions(newResult, event, recordConfigs, participants);

      if (
        !process.env.VITEST &&
        (newResult.regionalSingleRecord || newResult.regionalAverageRecord) &&
        differenceInDays(new Date(), newResult.date) > 30
      ) {
        throw new RrActionError(OLD_RESULT_WITH_RECORD_VALIDATION_ERROR_MSG);
      }

      await db.transaction(async (tx) => {
        const [createdResult] = await tx.insert(table).values(newResult).returning();

        await setRankingAndProceedsValues(tx, [...roundResults, createdResult], round);
        if (createdResult.regionalSingleRecord) await cancelFutureRecords(tx, createdResult, "best", recordConfigs);
        if (createdResult.regionalAverageRecord) await cancelFutureRecords(tx, createdResult, "average", recordConfigs);

        // Update contest state and participants
        const updateContestObject: Partial<SelectContest> = {};
        if (contest.state === "approved") updateContestObject.state = "ongoing";
        const participantIds = await getContestParticipantIds(tx, competitionId);
        if (participantIds.length !== contest.participants) updateContestObject.participants = participantIds.length;
        // Do update, if some value actually changed
        if (Object.keys(updateContestObject).length > 0)
          await tx.update(contestsTable).set(updateContestObject).where(eq(contestsTable.competitionId, competitionId));
      });

      return await db.select(resultsPublicCols).from(table).where(eq(table.roundId, roundId)).orderBy(table.ranking);
    },
  );

export const updateContestResultSF = actionClient
  .metadata({ permissions: { competitions: ["create"], meetups: ["create"] } })
  .inputSchema(
    z.strictObject({
      id: z.int(),
      newAttempts: AttemptsValidator,
    }),
  )
  .action<ResultResponse[]>(
    async ({
      parsedInput: { id, newAttempts },
      ctx: {
        session: { user },
      },
    }) => {
      const result = await db.query.results.findFirst({ where: { id, competitionId: { isNotNull: true } } });
      if (!result) throw new RrActionError(`Result with ID ${id} not found`);

      logMessage("RR0014", `Updating result with ID ${id} (new attempts: ${JSON.stringify(newAttempts)})`);

      const contestPromise = db.query.contests.findFirst({ where: { competitionId: result.competitionId! } });
      const eventPromise = db.query.events.findFirst({ where: { eventId: result.eventId } });
      const roundPromise = db.query.rounds.findFirst({ where: { id: result.roundId! } });
      const roundResultsPromise = db.query.results.findMany({
        where: { roundId: result.roundId! },
        orderBy: { ranking: "asc" },
      });

      const [contest, event, round, roundResults] = await Promise.all([
        contestPromise,
        eventPromise,
        roundPromise,
        roundResultsPromise,
      ]);

      if (!contest) throw new RrActionError(`Contest with ID ${result.competitionId} not found`);
      if (!getUserHasAccessToContest(user, contest))
        throw new RrActionError("You do not have access rights for this contest");
      if (!event) throw new RrActionError(`Event with ID ${result.eventId} not found`);
      if (!round) throw new RrActionError(`Round with ID ${result.roundId} not found`);

      const recordConfigs = await getRecordConfigs(contest.type === "meetup" ? "meetups" : "competitions");
      const roundFormat = roundFormats.find((rf) => rf.value === round.format)!;

      newAttempts = await validateTimeLimitAndCutoff(newAttempts, result.personIds, round, roundFormat.attempts);

      const { best, average } = getBestAndAverage(newAttempts, event.format, roundFormat.value);
      const newResult: SelectResult = {
        ...result,
        attempts: newAttempts,
        best,
        average,
        regionalSingleRecord: null,
        regionalAverageRecord: null,
      };

      await setResultRecords(newResult, event, recordConfigs, { excludeResultId: id });

      if (
        !process.env.VITEST &&
        (result.regionalSingleRecord ||
          result.regionalAverageRecord ||
          newResult.regionalSingleRecord ||
          newResult.regionalAverageRecord) &&
        differenceInDays(new Date(), result.date) > 30
      ) {
        throw new RrActionError(OLD_RESULT_WITH_RECORD_VALIDATION_ERROR_MSG);
      }

      await db.transaction(async (tx) => {
        const [updatedResult] = await tx
          .update(table)
          .set({
            attempts: newResult.attempts,
            best: newResult.best,
            average: newResult.average,
            regionalSingleRecord: newResult.regionalSingleRecord,
            regionalAverageRecord: newResult.regionalAverageRecord,
          })
          .where(eq(table.id, id))
          .returning();

        await setRankingAndProceedsValues(
          tx,
          roundResults.map((r) => (r.id === id ? updatedResult : r)),
          round,
        );

        // Cancel future records, if the result got better
        if (updatedResult.regionalSingleRecord && updatedResult.best < result.best)
          await cancelFutureRecords(tx, updatedResult, "best", recordConfigs);
        if (updatedResult.regionalAverageRecord && updatedResult.average < result.average)
          await cancelFutureRecords(tx, updatedResult, "average", recordConfigs);

        // Set records that may have been prevented before, if the result got worse
        if (result.regionalSingleRecord && updatedResult.best > result.best)
          await setFutureRecords(tx, result, event, "best", recordConfigs);
        if (result.regionalAverageRecord && updatedResult.average > result.average)
          await setFutureRecords(tx, result, event, "average", recordConfigs);
      });

      return await db
        .select(resultsPublicCols)
        .from(table)
        .where(eq(table.roundId, result.roundId!))
        .orderBy(table.ranking);
    },
  );

export const deleteContestResultSF = actionClient
  .metadata({ permissions: { competitions: ["create"], meetups: ["create"] } })
  .inputSchema(
    z.strictObject({
      id: z.int(),
    }),
  )
  .action<ResultResponse[]>(
    async ({
      parsedInput: { id },
      ctx: {
        session: { user },
      },
    }) => {
      const result = await db.query.results.findFirst({ where: { id, competitionId: { isNotNull: true } } });
      if (!result) throw new RrActionError(`Result with ID ${id} not found`);

      if (
        !process.env.VITEST &&
        (result.regionalSingleRecord || result.regionalAverageRecord) &&
        differenceInDays(new Date(), result.date) > 30
      ) {
        throw new RrActionError(OLD_RESULT_WITH_RECORD_VALIDATION_ERROR_MSG);
      }

      logMessage("RR0015", `Deleting contest result: ${JSON.stringify(result)}`);

      const contestPromise = db.query.contests.findFirst({ where: { competitionId: result.competitionId! } });
      const eventPromise = db.query.events.findFirst({ where: { eventId: result.eventId } });
      const roundPromise = db.query.rounds.findFirst({ where: { id: result.roundId! } });
      const roundResultsPromise = db.query.results.findMany({
        where: { roundId: result.roundId! },
        orderBy: { ranking: "asc" },
      });

      const [contest, event, round, roundResults] = await Promise.all([
        contestPromise,
        eventPromise,
        roundPromise,
        roundResultsPromise,
      ]);

      if (!contest) throw new RrActionError(`Contest with ID ${result.competitionId} not found`);
      if (!getUserHasAccessToContest(user, contest))
        throw new RrActionError("You do not have access rights for this contest");
      if (!event) throw new RrActionError(`Event with ID ${result.eventId} not found`);
      if (!round) throw new RrActionError(`Round with ID ${result.roundId} not found`);

      const recordConfigs = await getRecordConfigs(contest.type === "meetup" ? "meetups" : "competitions");

      await db.transaction(async (tx) => {
        await tx.delete(table).where(eq(table.id, id));

        await setRankingAndProceedsValues(
          tx,
          roundResults.filter((r) => r.id !== id),
          round,
        );

        // Set records that may have been prevented by the deleted result
        if (result.regionalSingleRecord) await setFutureRecords(tx, result, event, "best", recordConfigs);
        if (result.regionalAverageRecord) await setFutureRecords(tx, result, event, "average", recordConfigs);

        const participantIds = await getContestParticipantIds(tx, result.competitionId!);
        if (participantIds.length !== contest.participants) {
          await tx
            .update(contestsTable)
            .set({ participants: participantIds.length })
            .where(eq(contestsTable.competitionId, contest.competitionId));
        }
      });

      return await db
        .select(resultsPublicCols)
        .from(table)
        .where(eq(table.roundId, result.roundId!))
        .orderBy(table.ranking);
    },
  );

export const createVideoBasedResultSF = actionClient
  .metadata({ permissions: { videoBasedResults: ["create"] } })
  .inputSchema(
    z.strictObject({
      newResultDto: VideoBasedResultValidator,
    }),
  )
  .action<ResultResponse>(
    async ({
      parsedInput: { newResultDto },
      ctx: {
        session: { user },
      },
    }) => {
      logMessage("RR0016", `Creating video-based result: ${JSON.stringify(newResultDto)}`);

      const userCanApprove = await checkUserPermissions(user.id, { videoBasedResults: ["approve"] });
      await validateVideoBasedResult(newResultDto, { userCanApprove });

      const eventPromise = db.query.events.findFirst({ where: { eventId: newResultDto.eventId } });
      const personsPromise = db.query.persons.findMany({ where: { id: { in: newResultDto.personIds } } });
      const recordConfigsPromise = getRecordConfigs("video-based-results");

      const [event, participants, recordConfigs] = await Promise.all([
        eventPromise,
        personsPromise,
        recordConfigsPromise,
      ]);

      if (!event) throw new RrActionError(`Event with ID ${newResultDto.eventId} not found`);
      // Same check as in createContestResultSF
      const notFoundPersonId = newResultDto.personIds.find((pid) => !participants.some((p) => p.id === pid));
      if (notFoundPersonId) throw new RrActionError(`Person with ID ${notFoundPersonId} not found`);
      // Same check as in createContestResultSF
      if (newResultDto.personIds.length !== event.participants) {
        throw new RrActionError(
          `This event must have ${event.participants} participant${event.participants > 1 ? "s" : ""}`,
        );
      }

      const roundFormat = roundFormats.find((rf) => rf.attempts === newResultDto.attempts.length && rf.value !== "3")!;
      const { best, average } = getBestAndAverage(newResultDto.attempts, event.format, roundFormat.value);
      const newResult: InsertResult = {
        ...newResultDto,
        approved: userCanApprove, // approve automatically, if user has permission
        best,
        average,
        recordCategory: "video-based-results",
        createdBy: user.id,
      };

      await setResultRecordsAndRegions(newResult, event, recordConfigs, participants);

      const createdResult = await db.transaction(async (tx) => {
        const [createdResult] = await tx.insert(table).values(newResult).returning(resultsPublicCols);

        if (userCanApprove) {
          if (createdResult.regionalSingleRecord) await cancelFutureRecords(tx, createdResult, "best", recordConfigs);
          if (createdResult.regionalAverageRecord)
            await cancelFutureRecords(tx, createdResult, "average", recordConfigs);
        }

        return createdResult;
      });

      if (!userCanApprove) sendVideoBasedResultSubmittedEmail(user.email, event, createdResult, user.username);

      return createdResult;
    },
  );

export const updateVideoBasedResultSF = actionClient
  .metadata({ permissions: { videoBasedResults: ["update", "approve"] } })
  .inputSchema(
    z.strictObject({
      id: z.int(),
      newResultDto: VideoBasedResultValidator.pick({
        date: true,
        attempts: true,
        videoLink: true,
        discussionLink: true,
      }),
      approve: z.boolean(),
    }),
  )
  .action<ResultResponse>(async ({ parsedInput: { id, newResultDto, approve } }) => {
    const result = await db.query.results.findFirst({ where: { id, competitionId: { isNull: true } } });
    if (!result) throw new RrActionError(`Result with ID ${id} not found`);
    if (result.approved) throw new RrActionError("Editing approved results is not allowed. Please contact a sysadmin.");

    logMessage("RR0017", `Updating video-based result with ID ${id}: ${JSON.stringify(newResultDto)}`);

    await validateVideoBasedResult(newResultDto, {
      userCanApprove: true, // already checked in the action client permissions
    });

    const [event, recordConfigs] = await Promise.all([
      db.query.events.findFirst({ where: { eventId: result.eventId } }),
      getRecordConfigs("video-based-results"),
    ]);

    if (!event) throw new RrActionError(`Event with ID ${result.eventId} not found`);
    if (newResultDto.attempts.length !== result.attempts.length)
      throw new RrActionError("The number of attempts cannot be changed");

    const roundFormat = roundFormats.find((rf) => rf.attempts === newResultDto.attempts.length && rf.value !== "3")!;
    const { best, average } = getBestAndAverage(newResultDto.attempts, event.format, roundFormat.value);
    const newResult: SelectResult = {
      ...result,
      date: newResultDto.date,
      approved: approve,
      attempts: newResultDto.attempts,
      best,
      average,
      regionalSingleRecord: null,
      regionalAverageRecord: null,
      videoLink: newResultDto.videoLink,
      discussionLink: newResultDto.discussionLink,
    };

    await setResultRecords(newResult, event, recordConfigs, { excludeResultId: id });

    const updatedResult = await db.transaction(async (tx) => {
      const [updatedResult] = await tx
        .update(table)
        .set({
          date: newResult.date,
          approved: newResult.approved,
          attempts: newResult.attempts,
          best: newResult.best,
          average: newResult.average,
          regionalSingleRecord: newResult.regionalSingleRecord,
          regionalAverageRecord: newResult.regionalAverageRecord,
          videoLink: newResult.videoLink,
          discussionLink: newResult.discussionLink,
        })
        .where(eq(table.id, id))
        .returning();

      if (approve) {
        if (updatedResult.regionalSingleRecord) await cancelFutureRecords(tx, updatedResult, "best", recordConfigs);
        if (updatedResult.regionalAverageRecord) await cancelFutureRecords(tx, updatedResult, "average", recordConfigs);

        const personsToBeApproved = await tx.query.persons.findMany({
          where: { id: { in: result.personIds }, approved: false },
        });
        await approvePersons(tx, personsToBeApproved);

        const creatorUser = result.createdBy
          ? await tx.query.users.findFirst({ columns: { email: true }, where: { id: result.createdBy } })
          : undefined;
        if (creatorUser) sendVideoBasedResultApprovedEmail(creatorUser.email, event);
      }

      return updatedResult;
    });

    return updatedResult;
  });

async function setResultRecordsAndRegions(
  result: InsertResult,
  event: EventResponse,
  recordConfigs: RecordConfigResponse[], // must be of the same category
  participants: SelectPerson[],
) {
  const firstParticipantRegion = participants[0].regionCode;
  const isSameRegionParticipants = participants.every((p) => p.regionCode === firstParticipantRegion);
  const firstParticipantSuperRegion = getSuperRegion(participants[0].regionCode);
  const isSameSuperRegionParticipants =
    isSameRegionParticipants ||
    participants.slice(1).every((p) => getSuperRegion(p.regionCode) === firstParticipantSuperRegion);

  if (isSameRegionParticipants) result.regionCode = firstParticipantRegion;
  if (isSameSuperRegionParticipants) result.superRegionCode = firstParticipantSuperRegion;

  await setResultRecords(result, event, recordConfigs);
}

async function setResultRecords(
  result: InsertResult,
  event: EventResponse,
  recordConfigs: RecordConfigResponse[], // must be of the same category
  { excludeResultId }: { excludeResultId?: number } = {},
) {
  if (result.best > 0) await setResultRecord(result, event, "best", recordConfigs, { excludeResultId });
  if (result.average > 0 && result.attempts.length === getDefaultAverageAttempts(event.defaultRoundFormat))
    await setResultRecord(result, event, "average", recordConfigs, { excludeResultId });
}

async function setResultRecord(
  result: InsertResult,
  event: Pick<SelectEvent, "eventId" | "defaultRoundFormat">,
  bestOrAverage: "best" | "average",
  recordConfigs: RecordConfigResponse[], // must be of the same category
  { excludeResultId }: { excludeResultId?: number } = {},
) {
  const recordField = bestOrAverage === "best" ? "regionalSingleRecord" : "regionalAverageRecord";
  const type = bestOrAverage === "best" ? "single" : "average";
  const { category } = recordConfigs[0];
  const compareFunc = (a: any, b: any) => (bestOrAverage === "best" ? compareSingles(a, b) : compareAvgs(a, b));

  // Set WR
  const wrResult = await getRecordResult(event, bestOrAverage, "WR", category, {
    excludeResultId,
    recordsUpTo: result.date,
  });
  const isWr = !wrResult || compareFunc(result, wrResult) <= 0;

  if (isWr) {
    const wrRecordConfig = recordConfigs.find((rc) => rc.recordTypeId === "WR")!;
    logMessage("RR0024", `New ${result.eventId} ${type} ${wrRecordConfig.label}: ${result[bestOrAverage]}`);
    result[recordField] = "WR";
  } else if (
    result.superRegionCode &&
    (result.superRegionCode !== wrResult?.superRegionCode ||
      (result.regionCode && result.regionCode !== wrResult?.regionCode))
  ) {
    // Set CR
    const crType = ContinentRecordType[result.superRegionCode as ContinentCode];
    const crResult = await getRecordResult(event, bestOrAverage, crType, category, {
      excludeResultId,
      recordsUpTo: result.date,
    });
    const isCr = !crResult || compareFunc(result, crResult) <= 0;

    if (isCr) {
      const crRecordConfig = recordConfigs.find((rc) => rc.recordTypeId === crType)!;
      logMessage("RR0024", `New ${result.eventId} ${type} ${crRecordConfig.label}: ${result[bestOrAverage]}`);
      result[recordField] = crType;
    } else if (result.regionCode && result.regionCode !== crResult?.regionCode) {
      // Set NR
      const nrResult = await getRecordResult(event, bestOrAverage, "NR", category, {
        excludeResultId,
        recordsUpTo: result.date,
        regionCode: result.regionCode,
      });
      const isNr = !nrResult || compareFunc(result, nrResult) <= 0;

      if (isNr) {
        const nrRecordConfig = recordConfigs.find((rc) => rc.recordTypeId === "NR")!;
        logMessage("RR0024", `New ${result.eventId} ${type} ${nrRecordConfig.label}: ${result[bestOrAverage]}`);
        result[recordField] = "NR";
      }
    }
  }
}

async function setFutureRecords(
  tx: DbTransactionType,
  deletedResult: Pick<
    SelectResult,
    | "eventId"
    | "date"
    | "regionCode"
    | "superRegionCode"
    | "best"
    | "average"
    | "regionalSingleRecord"
    | "regionalAverageRecord"
  >,
  event: Pick<SelectEvent, "eventId" | "defaultRoundFormat">,
  bestOrAverage: "best" | "average",
  recordConfigs: RecordConfigResponse[],
) {
  const recordField = bestOrAverage === "best" ? "regionalSingleRecord" : "regionalAverageRecord";
  const type = bestOrAverage === "best" ? "single" : "average";
  const { category } = recordConfigs[0];
  const recordsUpTo = addDays(deletedResult.date, -1);
  const defaultNumberOfAttempts = getDefaultAverageAttempts(event.defaultRoundFormat);
  const numberOfAttemptsCondition =
    bestOrAverage === "best" ? sql`` : sql`AND CARDINALITY(${table.attempts}) = ${defaultNumberOfAttempts}`;

  // Set WRs
  if (deletedResult[recordField] === "WR") {
    const prevWrResult = await getRecordResult(event, bestOrAverage, "WR", category, { tx, recordsUpTo });

    const newWrIds = await tx
      .execute(sql`
        WITH day_min_times AS (
          SELECT ${table.id}, ${table.date}, ${table[bestOrAverage]},
            MIN(${table[bestOrAverage]}) OVER(PARTITION BY ${table.date}
              ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS day_min_time
          FROM ${table}
          WHERE ${table[bestOrAverage]} > 0
            AND ${table[bestOrAverage]} <= ${prevWrResult ? prevWrResult[bestOrAverage] : C.maxResult}
            AND ${table.eventId} = ${deletedResult.eventId}
            AND ${table.date} >= ${deletedResult.date.toISOString()}
            AND ${table.recordCategory} = ${category}
            ${numberOfAttemptsCondition}
          ORDER BY ${table.date}
        ), results_with_record_times AS (
          SELECT id, MIN(day_min_time) OVER(ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS curr_record
          FROM day_min_times
          ORDER BY date
        )
        SELECT ${table.id}
        FROM ${table} RIGHT JOIN results_with_record_times
        ON ${table.id} = results_with_record_times.id
        WHERE (${table[recordField]} IS NULL OR ${table[recordField]} <> 'WR')
          AND ${table[bestOrAverage]} = results_with_record_times.curr_record`)
      .then((val: any) => (process.env.VITEST ? val.rows : val).map(({ id }: any) => id));

    const newWrResults = await tx
      .update(table)
      .set({ [recordField]: "WR" })
      .where(inArray(table.id, newWrIds))
      .returning({ date: table.date, [bestOrAverage]: table[bestOrAverage] });

    for (const wr of newWrResults) {
      const date = format(wr.date, "d MMM yyyy");
      logMessage("RR0025", `New ${type} WR for event ${deletedResult.eventId}: ${wr[bestOrAverage]} (${date})`);
    }
  }

  // Set CRs
  if (deletedResult.superRegionCode && deletedResult[recordField] !== "NR") {
    const crType = ContinentRecordType[deletedResult.superRegionCode as ContinentCode];
    const prevCrResult = await getRecordResult(event, bestOrAverage, crType, category, { tx, recordsUpTo });

    const newCrIds = await tx
      .execute(sql`
        WITH day_min_times AS (
          SELECT ${table.id}, ${table.date}, ${table[bestOrAverage]},
            MIN(${table[bestOrAverage]}) OVER(PARTITION BY ${table.date}
              ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS day_min_time
          FROM ${table}
          WHERE ${table[bestOrAverage]} > 0
            AND ${table[bestOrAverage]} <= ${prevCrResult ? prevCrResult[bestOrAverage] : C.maxResult}
            AND ${table.eventId} = ${deletedResult.eventId}
            AND ${table.date} >= ${deletedResult.date.toISOString()}
            AND ${table.superRegionCode} = ${deletedResult.superRegionCode}
            AND ${table.recordCategory} = ${category}
            ${numberOfAttemptsCondition}
          ORDER BY ${table.date}
        ), results_with_record_times AS (
          SELECT id, MIN(day_min_time) OVER(ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS curr_record
          FROM day_min_times
          ORDER BY date
        )
        SELECT ${table.id}
        FROM ${table} RIGHT JOIN results_with_record_times
        ON ${table.id} = results_with_record_times.id
        WHERE (${table[recordField]} IS NULL OR ${table[recordField]} = 'NR')
          AND ${table[bestOrAverage]} = results_with_record_times.curr_record`)
      .then((val: any) => (process.env.VITEST ? val.rows : val).map(({ id }: any) => id));

    const newCrResults = await tx
      .update(table)
      .set({ [recordField]: crType })
      .where(inArray(table.id, newCrIds))
      .returning({ date: table.date, [bestOrAverage]: table[bestOrAverage] });

    for (const cr of newCrResults) {
      const date = format(cr.date, "d MMM yyyy");
      logMessage("RR0025", `New ${type} ${crType} for event ${deletedResult.eventId}: ${cr[bestOrAverage]} (${date})`);
    }
  }

  // Set NRs
  if (deletedResult.regionCode) {
    const prevNrResult = await getRecordResult(event, bestOrAverage, "NR", category, {
      tx,
      recordsUpTo,
      regionCode: deletedResult.regionCode,
    });

    const newNrIds = await tx
      .execute(sql`
        WITH day_min_times AS (
          SELECT ${table.id}, ${table.date}, ${table[bestOrAverage]},
            MIN(${table[bestOrAverage]}) OVER(PARTITION BY ${table.date}
              ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS day_min_time
          FROM ${table}
          WHERE ${table[bestOrAverage]} > 0
            AND ${table[bestOrAverage]} <= ${prevNrResult ? prevNrResult[bestOrAverage] : C.maxResult}
            AND ${table.eventId} = ${deletedResult.eventId}
            AND ${table.date} >= ${deletedResult.date.toISOString()}
            AND ${table.regionCode} = ${deletedResult.regionCode}
            AND ${table.recordCategory} = ${category}
            ${numberOfAttemptsCondition}
          ORDER BY ${table.date}
        ), results_with_record_times AS (
          SELECT id, MIN(day_min_time) OVER(ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS curr_record
          FROM day_min_times
          ORDER BY date
        )
        SELECT ${table.id}
        FROM ${table} RIGHT JOIN results_with_record_times
        ON ${table.id} = results_with_record_times.id
        WHERE ${table[recordField]} IS NULL
          AND ${table[bestOrAverage]} = results_with_record_times.curr_record`)
      .then((val: any) =>
        // PGLite returns results with { rows: [] }, but Postgres just returns [], hence the different mapping
        (process.env.VITEST ? val.rows : val).map(({ id }: any) => id),
      );

    const newNrResults = await tx
      .update(table)
      .set({ [recordField]: "NR" })
      .where(inArray(table.id, newNrIds))
      .returning({ date: table.date, regionCode: table.regionCode, [bestOrAverage]: table[bestOrAverage] });

    for (const nr of newNrResults) {
      const date = format(nr.date, "d MMM yyyy");
      const country = Countries.find((c) => c.code === nr.regionCode)!.name;
      logMessage(
        "RR0025",
        `New ${type} NR (${country}) for event ${deletedResult.eventId}: ${nr[bestOrAverage]} (${date})`,
      );
    }
  }
}

async function cancelFutureRecords(
  tx: DbTransactionType,
  result: ResultResponse,
  bestOrAverage: "best" | "average",
  recordConfigs: RecordConfigResponse[],
) {
  const recordField = bestOrAverage === "best" ? "regionalSingleRecord" : "regionalAverageRecord";
  const type = bestOrAverage === "best" ? "single" : "average";
  const { category } = recordConfigs[0];
  const crType = result.superRegionCode ? ContinentRecordType[result.superRegionCode as ContinentCode] : undefined;
  const crLabel = recordConfigs.find((rc) => rc.recordTypeId === crType)?.label;
  const nrLabel = recordConfigs.find((rc) => rc.recordTypeId === "NR")!.label;
  const baseConditions = [
    eq(table.eventId, result.eventId),
    gte(table.date, result.date),
    gt(table[bestOrAverage], result[bestOrAverage]),
    eq(table.recordCategory, category),
  ];

  if (result[recordField] === "WR") {
    const wrLabel = recordConfigs.find((rc) => rc.recordTypeId === "WR")!.label;
    const recordTypes = result.regionCode ? ["WR", crType!, "NR"] : result.superRegionCode ? ["WR", crType!] : ["WR"];
    const cancelledWrCrNrResults = await tx
      .update(table)
      .set({ [recordField]: null })
      .where(
        and(
          ...baseConditions,
          inArray(table[recordField], recordTypes as RecordType[]),
          result.superRegionCode
            ? or(eq(table.superRegionCode, result.superRegionCode), isNull(table.superRegionCode))
            : isNull(table.superRegionCode),
          result.regionCode
            ? or(eq(table.regionCode, result.regionCode), isNull(table.regionCode))
            : isNull(table.regionCode),
        ),
      )
      .returning();
    for (const r of cancelledWrCrNrResults) {
      const message = `CANCELLED ${r.eventId} ${type} ${wrLabel}, ${crLabel} or ${nrLabel}: ${r[bestOrAverage]} (country code ${r.regionCode})`;
      logMessage("RR0026", message);
    }

    const wrCrChangedToNrResults = await tx
      .update(table)
      .set({ [recordField]: "NR" })
      .where(
        and(
          ...baseConditions,
          inArray(table[recordField], result.superRegionCode ? ["WR", crType!] : ["WR"]),
          result.superRegionCode
            ? or(eq(table.superRegionCode, result.superRegionCode), isNull(table.superRegionCode))
            : isNull(table.superRegionCode),
          isNotNull(table.regionCode),
        ),
      )
      .returning();
    for (const r of wrCrChangedToNrResults) {
      const message = `CHANGED ${r.eventId} ${type} ${wrLabel} or ${crLabel} to ${nrLabel}: ${r[bestOrAverage]} (country code ${r.regionCode})`;
      logMessage("RR0026", message);
    }

    // Has to be done like this, because we can't dynamically determine the CR type to be set
    const wrResultsToBeChangedToCr = await tx
      .select()
      .from(table)
      .where(and(...baseConditions, eq(table[recordField], "WR"), isNotNull(table.superRegionCode)));
    for (const r of wrResultsToBeChangedToCr) {
      const resultCrType = ContinentRecordType[r.superRegionCode as ContinentCode];
      const resultCrLabel = recordConfigs.find((rc) => rc.recordTypeId === resultCrType)!.label;
      await tx
        .update(table)
        .set({ [recordField]: resultCrType })
        .where(eq(table.id, r.id))
        .returning();

      const message = `CHANGED ${r.eventId} ${type} ${wrLabel} to ${resultCrLabel}: ${r[bestOrAverage]} (country code ${r.regionCode})`;
      logMessage("RR0026", message);
    }
  } else if (ContinentalRecordTypes.includes(result[recordField]!)) {
    const cancelledCrNrResults = await tx
      .update(table)
      .set({ [recordField]: null })
      .where(
        and(
          ...baseConditions,
          inArray(table[recordField], result.regionCode ? [crType!, "NR"] : [crType!]),
          eq(table.superRegionCode, result.superRegionCode!),
          result.regionCode
            ? or(eq(table.regionCode, result.regionCode), isNull(table.regionCode))
            : isNull(table.regionCode),
        ),
      )
      .returning();
    for (const r of cancelledCrNrResults) {
      const message = `CANCELLED ${r.eventId} ${type} ${crLabel} or ${nrLabel}: ${r[bestOrAverage]} (country code ${r.regionCode})`;
      logMessage("RR0026", message);
    }

    const crChangedToNrResults = await tx
      .update(table)
      .set({ [recordField]: "NR" })
      .where(
        and(
          ...baseConditions,
          eq(table[recordField], crType!),
          eq(table.superRegionCode, result.superRegionCode!),
          isNotNull(table.regionCode),
        ),
      )
      .returning();
    for (const r of crChangedToNrResults) {
      const message = `CHANGED ${r.eventId} ${type} ${crLabel} to ${nrLabel}: ${r[bestOrAverage]} (country code ${r.regionCode})`;
      logMessage("RR0026", message);
    }
  } else if (result[recordField] === "NR") {
    const cancelledNrResults = await tx
      .update(table)
      .set({ [recordField]: null })
      .where(and(...baseConditions, eq(table[recordField], "NR"), eq(table.regionCode, result.regionCode!)))
      .returning();
    for (const r of cancelledNrResults) {
      const message = `CANCELLED ${r.eventId} ${type} ${nrLabel}: ${r[bestOrAverage]} (country code ${r.regionCode})`;
      logMessage("RR0026", message);
    }
  }
}

async function setRankingAndProceedsValues(tx: DbTransactionType, results: ResultResponse[], round: RoundResponse) {
  const roundFormat = roundFormats.find((rf) => rf.value === round.format)!;
  const sortedResults = results.sort(roundFormat.isAverage ? (a, b) => compareAvgs(a, b, true) : compareSingles);
  let prevResult = sortedResults[0];
  let ranking = 1;

  for (let i = 0; i < sortedResults.length; i++) {
    // If the previous result was not tied with this one, increase ranking
    if (
      i > 0 &&
      ((roundFormat.isAverage && compareAvgs(prevResult, sortedResults[i]) < 0) ||
        (!roundFormat.isAverage && compareSingles(prevResult, sortedResults[i]) < 0))
    ) {
      ranking = i + 1;
    }

    prevResult = sortedResults[i];
    // Set proceeds if it's a non-final round and the result proceeds to the next round
    const proceeds = round.proceedValue
      ? getResultProceeds({ ...sortedResults[i], ranking }, round, roundFormat, sortedResults)
      : null;

    // Update the result in the DB, if something changed
    if (ranking !== sortedResults[i].ranking || proceeds !== sortedResults[i].proceeds)
      await tx.update(table).set({ ranking, proceeds }).where(eq(table.id, sortedResults[i].id));
  }
}

async function validateTimeLimitAndCutoff(
  attempts: Attempt[],
  personIds: number[],
  round: SelectRound,
  expectedNumberOfAttempts: number,
): Promise<Attempt[]> {
  let outputAttempts = attempts;

  // Time limit validation
  if (round.timeLimitCentiseconds) {
    if (attempts.some((a) => a.result > round.timeLimitCentiseconds!))
      throw new RrActionError(`This round has a time limit of ${getFormattedTime(round.timeLimitCentiseconds)}`);

    if (round.timeLimitCumulativeRoundIds) {
      // Add up all attempt times from the new result and results from other rounds included in the cumulative time limit
      const cumulativeRoundsResults = await db.query.results.findMany({
        where: {
          roundId: { in: round.timeLimitCumulativeRoundIds },
          RAW: (t) => sql`CARDINALITY(${t.personIds}) = ${personIds.length}`,
          personIds: { arrayContains: personIds },
        },
      });
      let total = 0;
      for (const res of [{ attempts } as any, ...cumulativeRoundsResults])
        for (const attempt of res.attempts) total += attempt.result;

      if (total >= round.timeLimitCentiseconds) {
        throw new RrActionError(
          `This round has a cumulative time limit of ${getFormattedTime(round.timeLimitCentiseconds)}${
            round.timeLimitCumulativeRoundIds.length > 0
              ? ` for these rounds: ${round.id}, ${round.timeLimitCumulativeRoundIds.join(", ")}`
              : ""
          }`,
        );
      }
    }

    // Cutoff validation
    if (
      round.cutoffAttemptResult &&
      round.cutoffNumberOfAttempts &&
      !getMakesCutoff(attempts, round.cutoffAttemptResult, round.cutoffNumberOfAttempts)
    ) {
      if (attempts.length > round.cutoffNumberOfAttempts!) {
        const attemptsPastCutoffNumberOfAttempts = attempts.slice(round.cutoffNumberOfAttempts);
        if (attemptsPastCutoffNumberOfAttempts.some((a) => a.result !== 0))
          throw new RrActionError(`This round has a cutoff of ${getFormattedTime(round.cutoffAttemptResult)}`);
        else outputAttempts = attempts.slice(0, round.cutoffNumberOfAttempts);
      }

      expectedNumberOfAttempts = round.cutoffNumberOfAttempts;
    }
  }

  if (outputAttempts.length !== expectedNumberOfAttempts) {
    throw new RrActionError(
      `The number of attempts should be ${expectedNumberOfAttempts}; received: ${attempts.length}`,
    );
  }

  return outputAttempts;
}

async function validateVideoBasedResult(
  newResultDto: Pick<VideoBasedResultDto, "attempts" | "videoLink">,
  { userCanApprove }: { userCanApprove: boolean },
) {
  // Disallow video-based-result-moderator-only features
  if (!userCanApprove) {
    if (newResultDto.videoLink === "") throw new RrActionError("Please enter a video link");
    if (newResultDto.attempts.some((a) => a.result === C.maxTime))
      throw new RrActionError("You are not authorized to set unknown time");
  }
}
