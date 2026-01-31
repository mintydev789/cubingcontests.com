"use server";

import { endOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { and, arrayContains, desc, eq, inArray } from "drizzle-orm";
import { find as findTimezone } from "geo-tz";
import z from "zod";
import { C } from "~/helpers/constants.ts";
import { roundFormats } from "~/helpers/roundFormats.ts";
import type { Schedule } from "~/helpers/types/Schedule.ts";
import {
  getIsAdmin,
  getMaxAllowedRounds,
  getNameAndLocalizedName,
  getResultProceeds,
} from "~/helpers/utilityFunctions.ts";
import { type ContestDto, ContestValidator } from "~/helpers/validators/Contest.ts";
import { CoordinatesValidator } from "~/helpers/validators/Coordinates.ts";
import { type RoundDto, RoundValidator } from "~/helpers/validators/Round.ts";
import type { auth } from "~/server/auth.ts";
import { type EventResponse, eventsPublicCols, eventsTable } from "~/server/db/schema/events.ts";
import { type PersonResponse, personsPublicCols, personsTable, type SelectPerson } from "~/server/db/schema/persons.ts";
import type { RecordConfigResponse } from "~/server/db/schema/record-configs.ts";
import { type ResultResponse, resultsPublicCols, resultsTable, type SelectResult } from "~/server/db/schema/results.ts";
import { type RoundResponse, roundsPublicCols, roundsTable, type SelectRound } from "~/server/db/schema/rounds.ts";
import {
  sendContestApprovedNotification,
  sendContestFinishedNotification,
  sendContestPublishedNotification,
  sendContestSubmittedNotification,
  sendEmail,
} from "~/server/email/mailer.ts";
import {
  getContestParticipantIds,
  getPersonExactMatchWcaId,
  getRecordConfigs,
  getUserHasAccessToContest,
  logMessage,
} from "~/server/serverUtilityFunctions.ts";
import { type DbTransactionType, db } from "../db/provider.ts";
import {
  type ContestResponse,
  contestsPublicCols,
  type SelectContest,
  contestsTable as table,
} from "../db/schema/contests.ts";
import { actionClient, CcActionError } from "../safeAction.ts";

const RoundsListValidator = z
  .array(RoundValidator)
  .nonempty({ error: "Please select at least one event" })
  .max(C.maxTotalRounds, { error: "You may not hold more than 30 rounds in total" });

export const getContestSF = actionClient
  .metadata({})
  .inputSchema(
    z.strictObject({
      competitionId: z.string().nonempty(),
      eventId: z.string().optional(),
    }),
  )
  .action<{
    contest: Pick<
      SelectContest,
      | "competitionId"
      | "state"
      | "name"
      | "shortName"
      | "type"
      | "startDate"
      | "organizerIds"
      | "queuePosition"
      | "schedule"
    >;
    events: EventResponse[];
    rounds: RoundResponse[];
    results: ResultResponse[];
    persons: PersonResponse[];
    recordConfigs: RecordConfigResponse[];
  } | null>(async ({ parsedInput: { competitionId, eventId } }) => {
    const contestPromise = db.query.contests.findFirst({
      columns: {
        competitionId: true,
        state: true,
        name: true,
        shortName: true,
        type: true,
        startDate: true,
        organizerIds: true,
        queuePosition: true,
        schedule: true,
      },
      where: { competitionId },
    });
    const roundsPromise = db
      .select(roundsPublicCols)
      .from(roundsTable)
      .where(eq(roundsTable.competitionId, competitionId));
    const [contest, rounds] = await Promise.all([contestPromise, roundsPromise]);

    if (!contest || !rounds) return null;

    const eventIds = Array.from(new Set(rounds.map((r) => r.eventId)));
    const eventsPromise = db
      .select(eventsPublicCols)
      .from(eventsTable)
      .where(inArray(eventsTable.eventId, eventIds))
      .orderBy(eventsTable.rank);
    const recordConfigsPromise = getRecordConfigs(contest.type === "meetup" ? "meetups" : "competitions");
    const [events, recordConfigs] = await Promise.all([eventsPromise, recordConfigsPromise]);

    if (!events || !recordConfigs) return null;
    const eventIdOrFirst = eventId ?? events[0].eventId;

    const results = await db
      .select(resultsPublicCols)
      .from(resultsTable)
      .where(and(eq(resultsTable.competitionId, competitionId), eq(resultsTable.eventId, eventIdOrFirst)));
    const personIds = Array.from(
      new Set(results.map((r) => r.personIds).reduce((prev, curr) => [...(prev as []), ...curr], [])),
    );
    const persons = await db.select(personsPublicCols).from(personsTable).where(inArray(personsTable.id, personIds));

    return {
      contest,
      events,
      rounds: rounds.filter((r) => r.eventId === eventIdOrFirst),
      results,
      persons,
      recordConfigs,
    };
  });

export const getModContestsSF = actionClient
  .metadata({ permissions: { modDashboard: ["view"] } })
  .inputSchema(
    z.strictObject({
      organizerPersonId: z.int().optional(),
    }),
  )
  .action<ContestResponse[]>(async ({ parsedInput: { organizerPersonId }, ctx: { session } }) => {
    const queryFilters = [];

    // If it's a moderator, only get their own contests
    if (!getIsAdmin(session.user.role)) {
      const msg = "Your competitor profile must be tied to your account before you can use moderator features";
      if (!session.user.personId) throw new CcActionError(msg);

      const [userPerson] = await db
        .select({ id: personsTable.id })
        .from(personsTable)
        .where(eq(personsTable.id, session.user.personId));

      if (!userPerson) throw new CcActionError(msg);
      queryFilters.push(arrayContains(table.organizerIds, [userPerson.id]));
    }

    if (organizerPersonId) {
      const [organizerPerson] = await db
        .select({ id: personsTable.id })
        .from(personsTable)
        .where(eq(personsTable.id, organizerPersonId));

      if (!organizerPerson) throw new CcActionError(`Person with ID ${organizerPersonId} not found`);
      queryFilters.push(arrayContains(table.organizerIds, [organizerPerson.id]));
    }

    const contests = await db
      .select(contestsPublicCols)
      .from(table)
      .where(and(...queryFilters))
      .orderBy(desc(table.startDate));

    return contests;
  });

export const getTimeZoneFromCoordsSF = actionClient
  .metadata({ permissions: { competitions: ["create"], meetups: ["create"] } })
  .inputSchema(CoordinatesValidator)
  .action<string>(async ({ parsedInput: { latitude, longitude } }) => {
    const timezone = findTimezone(latitude, longitude).at(0);

    if (!timezone) throw new CcActionError(`Time zone for coordinates ${latitude}, ${longitude} not found`);

    return timezone;
  });

export const createContestSF = actionClient
  .metadata({ permissions: { competitions: ["create"], meetups: ["create"] } })
  .inputSchema(
    z.strictObject({
      newContestDto: ContestValidator,
      rounds: RoundsListValidator,
    }),
  )
  .action(
    async ({
      parsedInput: { newContestDto, rounds },
      ctx: {
        session: { user },
      },
    }) => {
      logMessage("CC0005", `Creating contest ${newContestDto.competitionId}`);

      // No need to check that the state is not removed, because removed contests have _REMOVED at the end of the competitionId anyways
      const sameIdContest = await db.query.contests.findFirst({
        where: { competitionId: newContestDto.competitionId },
      });
      if (sameIdContest) throw new CcActionError(`A contest with the ID ${newContestDto.competitionId} already exists`);
      const sameNameContest = await db.query.contests.findFirst({
        where: { name: newContestDto.name, state: { NOT: "removed" } },
      });
      if (sameNameContest) throw new CcActionError(`A contest with the name ${newContestDto.name} already exists`);
      const sameShortContest = await db.query.contests.findFirst({
        where: { shortName: newContestDto.shortName, state: { NOT: "removed" } },
      });
      if (sameShortContest)
        throw new CcActionError(`A contest with the short name ${newContestDto.shortName} already exists`);

      await validateAndCleanUpContest(newContestDto, rounds, user);

      const creatorPerson = await db.query.persons.findFirst({
        columns: { name: true },
        where: { id: user.personId! },
      });
      if (!creatorPerson) throw new CcActionError("Contest creator's competitor profile not found");

      const organizerUsers = await db.query.users.findMany({
        columns: { email: true },
        where: { personId: { in: newContestDto.organizerIds } },
      });

      await db.transaction(async (tx) => {
        await createRounds(tx, rounds);

        const [createdContest] = await tx
          .insert(table)
          .values({ ...newContestDto, createdBy: user.id })
          .returning();

        // Notify the organizers and admins
        sendContestSubmittedNotification(
          organizerUsers.map((u) => u.email),
          createdContest,
          creatorPerson.name,
        );
      });
    },
  );

export const approveContestSF = actionClient
  .metadata({ permissions: { competitions: ["approve"], meetups: ["approve"] } })
  .inputSchema(
    z.strictObject({
      competitionId: z.string().nonempty(),
    }),
  )
  .action(async ({ parsedInput: { competitionId } }) => {
    logMessage("CC0006", `Approving contest ${competitionId}`);

    const contest = await db.query.contests.findFirst({
      columns: { competitionId: true, name: true, shortName: true, state: true, organizerIds: true, createdBy: true },
      where: { competitionId },
    });
    if (!contest) throw new CcActionError(`Contest with ID ${competitionId} not found`);
    if (contest.state !== "created") throw new CcActionError("Contest has already been approved");

    const creatorUser = await db.query.users.findFirst({ columns: { email: true }, where: { id: contest.createdBy! } });
    if (!creatorUser) throw new CcActionError("Contest creator's user profile not found");

    await db.transaction(async (tx) => {
      await tx.update(table).set({ state: "approved" }).where(eq(table.competitionId, competitionId));

      // Approve organizer persons
      await tx.update(personsTable).set({ approved: true }).where(inArray(personsTable.id, contest.organizerIds));
    });

    sendContestApprovedNotification(creatorUser.email, contest);
  });

export const finishContestSF = actionClient
  .metadata({ permissions: { competitions: ["create"], meetups: ["create"] } })
  .inputSchema(
    z.strictObject({
      competitionId: z.string().nonempty(),
    }),
  )
  .action(
    async ({
      parsedInput: { competitionId },
      ctx: {
        session: { user },
      },
    }) => {
      logMessage("CC0007", `Finishing contest ${competitionId}`);

      const contest = await db.query.contests.findFirst({
        columns: {
          competitionId: true,
          name: true,
          shortName: true,
          type: true,
          state: true,
          organizerIds: true,
          participants: true,
          createdBy: true,
        },
        where: { competitionId },
      });
      if (!contest) throw new CcActionError(`Contest with ID ${competitionId} not found`);

      if (!getUserHasAccessToContest(user, contest))
        throw new CcActionError("You do not have access rights for this contest");
      if (contest.state !== "ongoing") throw new CcActionError("Contest cannot be finished");
      if (["meetup", "comp"].includes(contest.type) && contest.participants < C.minCompetitorsForNonWca)
        throw new CcActionError(
          `A meetup or unofficial competition may not have fewer than ${C.minCompetitorsForNonWca} competitors`,
        );

      // Check there are no rounds with no results or subsequent rounds with fewer results than the minimum proceed number
      const roundsPromise = db.query.rounds.findMany({ where: { competitionId } });
      const resultsPromise = db.query.results.findMany({ where: { competitionId } });
      const creatorPersonPromise = db.query.persons.findFirst({
        columns: { name: true },
        where: { id: user.personId! },
      });
      const organizerUsersPromise = db.query.users.findMany({
        columns: { email: true },
        where: { personId: { in: contest.organizerIds } },
      });

      const [rounds, results, creatorPerson, organizerUsers] = await Promise.all([
        roundsPromise,
        resultsPromise,
        creatorPersonPromise,
        organizerUsersPromise,
      ]);

      // Check there are no rounds with too few results
      for (const { id, eventId, roundNumber } of rounds) {
        const roundResults = results.filter((r) => r.roundId === id);

        if (roundResults.length === 0 || (roundNumber > 1 && roundResults.length < C.minProceedNumber)) {
          const event = (await db.query.events.findFirst({ columns: { name: true }, where: { eventId } }))!;

          if (roundResults.length === 0) throw new CcActionError(`${event.name} round ${roundNumber} has no results`);
          else
            throw new CcActionError(
              `${event.name} round ${roundNumber} has fewer than ${C.minProceedNumber} results (see WCA regulation 9q+)`,
            );
        }
      }

      // Check there are no incomplete results
      const incompleteResult = results.find((r) => r.attempts.some((a) => a.result === 0));
      if (incompleteResult) {
        const event = (await db.query.events.findFirst({
          columns: { name: true },
          where: { eventId: incompleteResult.eventId },
        }))!;
        const round = rounds.find((r) => r.id === incompleteResult.roundId)!;
        throw new CcActionError(`This contest has an unentered attempt in ${event.name} round ${round.roundNumber}`);
      }

      // If there are no issues, finish the contest and close all rounds
      await db.transaction(async (tx) => {
        await tx
          .update(table)
          .set({ state: "finished", queuePosition: null })
          .where(eq(table.competitionId, competitionId));

        await tx.update(roundsTable).set({ open: false }).where(eq(roundsTable.competitionId, competitionId));
      });

      sendContestFinishedNotification(
        organizerUsers.map((u) => u.email),
        contest,
        creatorPerson?.name ?? "DELETED",
      );
    },
  );

export const unfinishContestSF = actionClient
  .metadata({ permissions: { competitions: ["publish"], meetups: ["publish"] } })
  .inputSchema(
    z.strictObject({
      competitionId: z.string().nonempty(),
    }),
  )
  .action(async ({ parsedInput: { competitionId } }) => {
    logMessage("CC0008", `Un-finishing contest ${competitionId}`);

    const contest = await db.query.contests.findFirst({ columns: { state: true }, where: { competitionId } });
    if (!contest) throw new CcActionError(`Contest with ID ${competitionId} not found`);
    if (contest.state !== "finished") throw new CcActionError("Contest cannot be un-finished");

    // Set contest state back to ongoing and re-open all final rounds
    await db.transaction(async (tx) => {
      await tx.update(table).set({ state: "ongoing" }).where(eq(table.competitionId, competitionId));

      await tx
        .update(roundsTable)
        .set({ open: true })
        .where(and(eq(roundsTable.competitionId, competitionId), eq(roundsTable.roundTypeId, "f")));
    });
  });

export const publishContestSF = actionClient
  .metadata({ permissions: { competitions: ["publish"], meetups: ["publish"] } })
  .inputSchema(
    z.strictObject({
      competitionId: z.string().nonempty(),
    }),
  )
  .action(async ({ parsedInput: { competitionId } }) => {
    logMessage("CC0009", `Publishing contest ${competitionId}`);

    const contest = await db.query.contests.findFirst({
      columns: {
        competitionId: true,
        name: true,
        shortName: true,
        type: true,
        state: true,
        createdBy: true,
      },
      where: { competitionId },
    });
    if (!contest) throw new CcActionError(`Contest with ID ${competitionId} not found`);
    if (contest.state !== "finished") throw new CcActionError("Contest cannot be published");

    const creatorUser = await db.query.users.findFirst({
      columns: { email: true },
      where: { id: contest.createdBy! },
    });
    const wcaPersons: { name: string; wcaId: string; countryIso2: string }[] = [];

    if (contest.type === "wca-comp") {
      const res = await fetch(`https://www.worldcubeassociation.org/api/v0/competitions/${competitionId}/results`);
      const wcaCompResultsData = await res.json();
      if (!wcaCompResultsData || wcaCompResultsData.length === 0) {
        throw new CcActionError(
          "You must wait until the results have been published on the WCA website before publishing the contest",
        );
      }

      for (const result of wcaCompResultsData) {
        if (!wcaPersons.some((p) => p.wcaId === result.wca_id))
          wcaPersons.push({ name: result.name, wcaId: result.wca_id, countryIso2: result.country_iso2 });
      }
    }

    await db.transaction(async (tx) => {
      await tx.update(table).set({ state: "published" }).where(eq(table.competitionId, competitionId));

      await tx.update(resultsTable).set({ approved: true }).where(eq(resultsTable.competitionId, competitionId));

      const participantIds = await getContestParticipantIds(tx, competitionId);
      const personsToBeApproved = await tx.query.persons.findMany({
        where: { id: { in: participantIds }, approved: false },
      });

      if (personsToBeApproved.length > 0) {
        logMessage("CC0023", `Approving participants from ${contest.name}`);

        if (contest.type === "wca-comp") {
          for (const person of personsToBeApproved) {
            const updatePersonObject: Partial<SelectPerson> = { approved: true };

            if (!person.wcaId) {
              for (const wcaPerson of wcaPersons) {
                const { name, localizedName } = getNameAndLocalizedName(wcaPerson.name);

                if (name === person.name && wcaPerson.countryIso2 === person.regionCode) {
                  if (updatePersonObject.wcaId) {
                    throw new CcActionError(
                      `Multiple matches found while assigning WCA ID for ${name}. Resolve this manually and publish the contest again.`,
                    );
                  }

                  updatePersonObject.wcaId = wcaPerson.wcaId;
                  if (localizedName) updatePersonObject.localizedName = localizedName;
                }
              }

              if (!updatePersonObject.wcaId)
                throw new CcActionError(`No matches found while assigning WCA ID for ${person.name}`);
            }

            await tx.update(personsTable).set(updatePersonObject).where(eq(personsTable.id, person.id));
          }
        } else {
          for (const person of personsToBeApproved) {
            if (!person.wcaId) {
              const matchedPersonWcaId = await getPersonExactMatchWcaId(person);
              if (matchedPersonWcaId) {
                throw new CcActionError(
                  `${person.name} has an exact name and country match with the WCA competitor with WCA ID ${matchedPersonWcaId}. Resolve this manually and publish the contest again.`,
                );
              }
            }
          }

          await tx
            .update(personsTable)
            .set({ approved: true })
            .where(
              inArray(
                personsTable.id,
                personsToBeApproved.map((p) => p.id),
              ),
            );
        }
      }
    });

    if (creatorUser) sendContestPublishedNotification(creatorUser.email, contest);
  });

export const updateContestSF = actionClient
  .metadata({ permissions: { competitions: ["update"], meetups: ["update"] } })
  .inputSchema(
    z.strictObject({
      originalCompetitionId: z.string().nonempty(),
      newContestDto: ContestValidator,
      rounds: RoundsListValidator,
    }),
  )
  .action(
    async ({
      parsedInput: { originalCompetitionId, newContestDto, rounds },
      ctx: {
        session: { user },
      },
    }) => {
      logMessage("CC0010", `Updating contest ${originalCompetitionId}`);

      const isAdmin = getIsAdmin(user.role);

      const contestPromise = db.query.contests.findFirst({
        columns: { competitionId: true, type: true, state: true, organizerIds: true, schedule: true },
        where: { competitionId: originalCompetitionId },
      });
      const prevRoundsPromise = db.query.rounds.findMany({ where: { competitionId: originalCompetitionId } });
      const resultsPromise = db.query.results.findMany({ where: { competitionId: originalCompetitionId } });

      const [contest, prevRounds, results] = await Promise.all([contestPromise, prevRoundsPromise, resultsPromise]);

      if (!contest) throw new CcActionError(`Contest with ID ${originalCompetitionId} not found`);
      if (!getUserHasAccessToContest(user, contest))
        throw new CcActionError("You do not have access rights for this contest");
      if (!["created", "approved", "ongoing"].includes(contest.state))
        throw new CcActionError("Finished contests cannot be edited");

      await validateAndCleanUpContest(newContestDto, rounds, user);

      await db.transaction(async (tx) => {
        const updateContestObject: Partial<SelectContest> = {
          organizerIds: newContestDto.organizerIds,
          contact: newContestDto.contact,
          description: newContestDto.description,
        };

        if (isAdmin || contest.state === "created") {
          if (newContestDto.competitionId !== originalCompetitionId) {
            const sameIdContest = await db.query.contests.findFirst({
              where: { competitionId: newContestDto.competitionId },
            });
            if (sameIdContest)
              throw new CcActionError(`A contest with the ID ${newContestDto.competitionId} already exists`);

            // Update competition ID everywhere
            updateContestObject.competitionId = newContestDto.competitionId;
            await tx
              .update(resultsTable)
              .set({ competitionId: newContestDto.competitionId })
              .where(eq(resultsTable.competitionId, originalCompetitionId));
            await tx
              .update(roundsTable)
              .set({ competitionId: newContestDto.competitionId })
              .where(eq(roundsTable.competitionId, originalCompetitionId));
          }

          updateContestObject.name = newContestDto.name;
          updateContestObject.shortName = newContestDto.shortName;
          updateContestObject.city = newContestDto.city;
          updateContestObject.venue = newContestDto.venue;
          updateContestObject.address = newContestDto.address;
          updateContestObject.latitudeMicrodegrees = newContestDto.latitudeMicrodegrees;
          updateContestObject.longitudeMicrodegrees = newContestDto.longitudeMicrodegrees;
          updateContestObject.competitorLimit = newContestDto.competitorLimit;
        }

        // Even an admin is not allowed to edit the date after a comp has been approved
        if (contest.state === "created") {
          updateContestObject.startDate = newContestDto.startDate;
          updateContestObject.endDate = newContestDto.endDate;
        }

        if (contest.type === "meetup") {
          updateContestObject.startTime = newContestDto.startTime;
          updateContestObject.timezone = newContestDto.timezone;
        } else {
          updateContestObject.schedule = await getUpdatedSchedule(contest.schedule!, newContestDto.schedule!);
        }

        await updateRounds(tx, prevRounds, rounds, results, {
          canAddNewEvents: isAdmin || contest.state === "created",
        });

        await tx.update(table).set(updateContestObject).where(eq(table.competitionId, originalCompetitionId));
      });
    },
  );

export const deleteContestSF = actionClient
  .metadata({ permissions: { competitions: ["delete"], meetups: ["delete"] } })
  .inputSchema(z.strictObject({ competitionId: z.string() }))
  .action(async ({ parsedInput: { competitionId } }) => {
    logMessage("CC0011", `Deleting contest ${competitionId}`);

    const contest = await db.query.contests.findFirst({
      columns: {
        competitionId: true,
        name: true,
        state: true,
        type: true,
        participants: true,
        queuePosition: true,
        schedule: true,
        createdBy: true,
      },
      where: { competitionId },
    });
    if (!contest) throw new CcActionError(`Contest with ID ${competitionId} not found`);
    if (contest.participants > 0) throw new CcActionError("You may not remove a contest that has results");

    await db.transaction(async (tx) => {
      const newCompetitionId = `${competitionId}_REMOVED`;

      await tx
        .update(table)
        .set({ state: "removed", competitionId: newCompetitionId, queuePosition: null })
        .where(eq(table.competitionId, competitionId));

      await tx
        .update(roundsTable)
        .set({ competitionId: newCompetitionId, open: false })
        .where(eq(roundsTable.competitionId, competitionId));

      // This was part of the old Nest JS API
      // await this.authService.deleteAuthTokens(competitionId);
    });

    const creatorUser = await db.query.users.findFirst({ columns: { email: true }, where: { id: contest.createdBy! } });
    if (creatorUser) sendEmail(creatorUser.email, "Contest removed", `Your contest ${contest.name} has been removed.`);
  });

export const openRoundSF = actionClient
  .metadata({ permissions: { competitions: ["create"], meetups: ["create"] } })
  .inputSchema(
    z.strictObject({
      competitionId: z.string().nonempty(),
      eventId: z.string().nonempty(),
    }),
  )
  .action<RoundResponse>(
    async ({
      parsedInput: { competitionId, eventId },
      ctx: {
        session: { user },
      },
    }) => {
      logMessage("CC0012", `Opening next round for event ${eventId} (contest ${competitionId})`);

      const contestPromise = db.query.contests.findFirst({
        columns: { state: true, organizerIds: true },
        where: { competitionId },
      });
      const roundsPromise = db.query.rounds.findMany({
        where: { competitionId, eventId },
        orderBy: { roundNumber: "asc" },
      });
      const resultsPromise = db.query.results.findMany({ where: { competitionId, eventId } });

      const [contest, rounds, results] = await Promise.all([contestPromise, roundsPromise, resultsPromise]);
      const prevOpenRound = rounds.find((r) => r.open === true);

      if (!contest) throw new CcActionError(`Contest with ID ${competitionId} not found`);
      if (!getUserHasAccessToContest(user, contest))
        throw new CcActionError("You do not have access rights for this contest");
      if (!prevOpenRound) throw new CcActionError("Previous open round not found");
      if (prevOpenRound.roundTypeId === "f") throw new CcActionError("The final round for this event is already open");
      if (getMaxAllowedRounds(rounds, results) < prevOpenRound.roundNumber)
        throw new CcActionError("Previous rounds do not have enough competitors (see WCA regulation 9m)");

      const [openedRound] = await db.transaction(async (tx) => {
        await tx.update(roundsTable).set({ open: false }).where(eq(roundsTable.id, prevOpenRound.id));

        const roundToOpenId = rounds.find((r) => r.roundNumber === prevOpenRound.roundNumber + 1)!.id;
        return await tx
          .update(roundsTable)
          .set({ open: true })
          .where(eq(roundsTable.id, roundToOpenId))
          .returning(roundsPublicCols);
      });

      return openedRound;
    },
  );

async function validateAndCleanUpContest(
  contest: ContestDto,
  rounds: RoundDto[],
  user: typeof auth.$Infer.Session.user,
) {
  const isAdmin = getIsAdmin(user.role);
  const events = await db.query.events.findMany({
    columns: { eventId: true, name: true, category: true, format: true },
  });

  // Protect against admin-only stuff
  if (!isAdmin) {
    if (!contest.organizerIds.some((id) => id === user.personId))
      throw new CcActionError("You cannot create a contest which you are not organizing");
  }

  const activityCodes = new Set<string>(); // also used below in schedule validation

  for (const round of rounds) {
    const activityCode = `${round.eventId}-r${round.roundNumber}`;
    if (activityCodes.has(activityCode)) throw new CcActionError(`Duplicate round found: ${activityCode}`);
    activityCodes.add(activityCode);

    if (round.competitionId !== contest.competitionId)
      throw new CcActionError("A round may not have a competition ID different from the contest's competition ID");

    const event = events.find((e) => e.eventId === round.eventId);
    if (!event) throw new CcActionError(`Event with ID ${round.eventId} not found`);
    if (event.category === "removed") throw new CcActionError(`${event.name} is a removed event, so it cannot be held`);
    if (event.format === "time" && !round.timeLimitCentiseconds)
      throw new CcActionError(`${event.name} round ${round.roundNumber} doesn't have a time limit`);

    if (
      event.format !== "time" &&
      (round.timeLimitCentiseconds ||
        round.timeLimitCumulativeRoundIds ||
        round.cutoffAttemptResult ||
        round.cutoffNumberOfAttempts)
    )
      throw new CcActionError("A round of an event with a non-time format cannot have a time limit or cutoff");
  }

  // Check round numbers and round types
  for (const event of events) {
    const eventRounds = rounds.filter((r) => r.eventId === event.eventId);
    if (eventRounds.length > 0) {
      eventRounds.sort((a, b) => a.roundNumber - b.roundNumber);

      for (let i = 0; i < eventRounds.length; i++) {
        const { roundNumber, roundTypeId } = eventRounds[i];
        if (roundNumber !== i + 1)
          throw new CcActionError(`${event.name} has a missing round number. Please contact the development team.`);

        const message = `${event.name} has a mismatch between the round numbers and round types. Please contact the development team.`;
        if (roundTypeId === "f") {
          if (roundNumber !== eventRounds.length) throw new CcActionError(message);
        } else if (roundTypeId === "s") {
          if (roundNumber !== eventRounds.length - 1) throw new CcActionError(message);
        } else if (roundTypeId !== roundNumber.toString()) {
          throw new CcActionError(message);
        }
      }
    }
  }

  // Make sure all organizer IDs are valid
  const organizers = await db
    .select({ id: personsTable.id })
    .from(personsTable)
    .where(inArray(personsTable.id, contest.organizerIds));
  if (organizers.length !== contest.organizerIds.length)
    throw new CcActionError("One of the organizer persons was not found");

  // Validation of meetups
  if (contest.type === "meetup") {
    if (rounds.length > C.maxTotalMeetupRounds)
      throw new CcActionError("You may not hold more than 15 rounds in total at a meetup");

    const correctTz = findTimezone(contest.latitudeMicrodegrees / 1000000, contest.longitudeMicrodegrees / 1000000)[0];
    if (contest.timezone !== correctTz)
      throw new CcActionError("Contest time zone doesn't match time zone at the given coordinates");
  }
  // Validation of WCA competitions and unofficial competitions
  else {
    for (const round of rounds) {
      const event = events.find((e) => e.eventId === round.eventId)!;
      if (contest.type === "wca-comp" && event.category === "wca") {
        throw new CcActionError(
          "WCA events may not be added for the WCA Competition contest type. They must be held through the WCA website only.",
        );
      }

      let isRoundActivityFound = false;
      for (const venue of contest.schedule!.venues) {
        isRoundActivityFound = venue.rooms.some((r) =>
          r.activities.some((a) => a.activityCode === `${round.eventId}-r${round.roundNumber}`),
        );
        if (isRoundActivityFound) break;
      }
      if (!isRoundActivityFound) throw new CcActionError("Please add all rounds to the schedule");
    }

    // Schedule validation
    for (const venue of contest.schedule!.venues) {
      if (venue.countryIso2 !== contest.regionCode)
        throw new CcActionError("A venue may not have a country different from the contest country");
      if (
        venue.latitudeMicrodegrees !== contest.latitudeMicrodegrees ||
        venue.longitudeMicrodegrees !== contest.longitudeMicrodegrees
      )
        throw new CcActionError("The schedule may not have coordinates different from the contest coordinates");

      const correctTz = findTimezone(venue.latitudeMicrodegrees / 1000000, venue.longitudeMicrodegrees / 1000000)[0];
      if (venue.timezone !== correctTz)
        throw new CcActionError("Venue time zone doesn't match time zone at the given coordinates");

      for (const room of venue.rooms) {
        for (const activity of room.activities) {
          if (!/^other-/.test(activity.activityCode) && !activityCodes.has(activity.activityCode))
            throw new CcActionError(`Activity ${activity.activityCode} does not have a corresponding round`);

          const zonedStartTime = toZonedTime(activity.startTime, venue.timezone).getTime();
          if (zonedStartTime < contest.startDate.getTime())
            throw new CcActionError("An activity may not start before the start date");
          const zonedEndTime = toZonedTime(activity.endTime, venue.timezone).getTime();
          if (zonedEndTime > endOfDay(contest.endDate).getTime())
            throw new CcActionError("An activity may not end after the end date");
          if (zonedStartTime >= zonedEndTime)
            throw new CcActionError("An activity start time may not be after or at the same time as the end time");
        }
      }
    }
  }
}

async function createRounds(tx: DbTransactionType, rounds: RoundDto[]) {
  await tx
    .insert(roundsTable)
    .values(
      rounds.map((r) =>
        r.roundNumber === 1 ? { ...r, id: undefined, open: true } : { ...r, id: undefined, open: false },
      ),
    );
}

async function updateRounds(
  tx: DbTransactionType,
  prevRounds: SelectRound[],
  newRounds: RoundDto[],
  results: SelectResult[],
  { canAddNewEvents }: { canAddNewEvents: boolean },
) {
  // Remove deleted rounds
  const roundsToDelete: number[] = [];
  for (const prevRound of prevRounds) {
    const sameRoundInNew = newRounds.find((r) => r.id === prevRound.id);
    if (!sameRoundInNew) {
      const roundHasResult = results.some((r) => r.roundId === prevRound.id);
      if (roundHasResult) {
        throw new CcActionError(
          `Round ${prevRound.eventId}-r${prevRound.roundNumber} cannot be deleted, because it has results`,
        );
      } else {
        roundsToDelete.push(prevRound.id);
      }
    }
  }
  if (roundsToDelete.length > 0) await tx.delete(roundsTable).where(inArray(roundsTable.id, roundsToDelete));

  // Add new rounds and update existing rounds
  const roundsToCreate: RoundDto[] = [];
  for (const newRound of newRounds) {
    const sameRoundInPrev = prevRounds.find((r) => r.id === newRound.id);

    // Add new round
    if (!sameRoundInPrev) {
      const isNewEvent = !prevRounds.some((r) => r.eventId === newRound.eventId);

      if (!isNewEvent) {
        // Set the result proceeds values for the previous final round, if it had any results
        const precedingRound = prevRounds.find((r) => r.eventId === newRound.eventId && r.roundTypeId === "f")!;
        const precedingRoundResults = results.filter((r) => r.roundId === precedingRound.id);

        if (precedingRoundResults.length > 0) {
          // First, set all proceeds values to false, then set the results that proceeded
          await tx.update(resultsTable).set({ proceeds: false }).where(eq(resultsTable.roundId, precedingRound.id));

          const roundFormat = roundFormats.find((rf) => rf.value === precedingRound.format)!;
          const resultsToProceed: number[] = [];
          for (const result of precedingRoundResults)
            if (getResultProceeds(result, precedingRound, roundFormat, results)) resultsToProceed.push(result.id);

          await tx.update(resultsTable).set({ proceeds: true }).where(inArray(resultsTable.id, resultsToProceed));
        }
      } else if (!canAddNewEvents) {
        throw new CcActionError("Moderators are not allowed to add new events. Please contact the admin team.");
      }

      roundsToCreate.push(newRound);
    }
    // Update existing round
    else {
      const updateRoundObject: Partial<SelectRound> = {
        roundTypeId: newRound.roundTypeId,
        proceedValue: newRound.proceedValue,
        proceedType: newRound.proceedType,
      };
      const roundHasResult = results.some((r) => r.roundId === newRound.id);

      if (!roundHasResult) {
        updateRoundObject.format = newRound.format;
        updateRoundObject.timeLimitCentiseconds = newRound.timeLimitCentiseconds;
        updateRoundObject.timeLimitCumulativeRoundIds = newRound.timeLimitCumulativeRoundIds;
        updateRoundObject.cutoffAttemptResult = newRound.cutoffAttemptResult;
        updateRoundObject.cutoffNumberOfAttempts = newRound.cutoffNumberOfAttempts;
      }

      if (newRound.open) {
        updateRoundObject.open = true;

        // If the round became the final round after a deletion, remove the result proceeds values in that round
        if (newRound.roundTypeId === "f" && sameRoundInPrev.roundTypeId !== "f")
          await tx.update(resultsTable).set({ proceeds: null }).where(eq(resultsTable.roundId, sameRoundInPrev.id));
      }

      await tx.update(roundsTable).set(updateRoundObject).where(eq(roundsTable.id, sameRoundInPrev.id));
    }
  }
  if (roundsToCreate.length > 0) await createRounds(tx, roundsToCreate);
}

async function getUpdatedSchedule(prevSchedule: Schedule, newSchedule: Schedule): Promise<Schedule> {
  // TO-DO: ADD PROPER SUPPORT FOR MULTIPLE VENUES, WITH ADDITION AND DELETION OF VENUES!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  for (const venue of newSchedule.venues) {
    const sameVenueInPrev = prevSchedule.venues.find((v) => v.id === venue.id);
    if (!sameVenueInPrev) throw new CcActionError(`Schedule venue with ID ${venue.id} not found`);

    sameVenueInPrev.name = venue.name;
    sameVenueInPrev.latitudeMicrodegrees = venue.latitudeMicrodegrees;
    sameVenueInPrev.longitudeMicrodegrees = venue.longitudeMicrodegrees;
    sameVenueInPrev.timezone = venue.timezone;
    // Remove deleted rooms
    sameVenueInPrev.rooms = sameVenueInPrev.rooms.filter((r1) => venue.rooms.some((r2) => r2.id === r1.id));

    for (const room of venue.rooms) {
      const sameRoomInPrev = sameVenueInPrev.rooms.find((r) => r.id === room.id);

      if (sameRoomInPrev) {
        sameRoomInPrev.name = room.name;
        sameRoomInPrev.color = room.color;
        // Remove deleted activities
        sameRoomInPrev.activities = sameRoomInPrev.activities.filter((a1) =>
          room.activities.some((a2) => a2.id === a1.id),
        );

        // TO-DO: ADD SUPPORT FOR CHILD ACTIVITIES!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // Update activities
        for (const activity of room.activities) {
          const sameActivityInPrev = sameRoomInPrev.activities.find((a) => a.id === activity.id);

          if (sameActivityInPrev) {
            sameActivityInPrev.activityCode = activity.activityCode;
            sameActivityInPrev.name = sameActivityInPrev.activityCode === "other-misc" ? activity.name : undefined;
            sameActivityInPrev.startTime = activity.startTime;
            sameActivityInPrev.endTime = activity.endTime;
          } else {
            // If it's a new activity, add it
            sameRoomInPrev.activities.push(activity);
          }
        }
      } else {
        // If it's a new room, add it
        sameVenueInPrev.rooms.push(room);
      }
    }
  }

  return prevSchedule;
}
