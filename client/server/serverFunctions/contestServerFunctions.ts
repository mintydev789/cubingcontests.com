"use server";

import { endOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { and, arrayContains, desc, eq, inArray } from "drizzle-orm";
import { find as findTimezone } from "geo-tz";
import z from "zod";
import { C } from "~/helpers/constants.ts";
import { getMaxAllowedRounds, getNameAndLocalizedName } from "~/helpers/sharedFunctions.ts";
import { getIsAdmin } from "~/helpers/utilityFunctions.ts";
import { type ContestDto, ContestValidator } from "~/helpers/validators/Contest.ts";
import { CoordinatesValidator } from "~/helpers/validators/Coordinates.ts";
import { type RoundDto, RoundValidator } from "~/helpers/validators/Round.ts";
import type { auth } from "~/server/auth.ts";
import { type EventResponse, eventsPublicCols, eventsTable } from "~/server/db/schema/events.ts";
import { type PersonResponse, personsPublicCols, personsTable, type SelectPerson } from "~/server/db/schema/persons.ts";
import type { RecordConfigResponse } from "~/server/db/schema/record-configs.ts";
import { type ResultResponse, resultsPublicCols, resultsTable } from "~/server/db/schema/results.ts";
import { type RoundResponse, roundsPublicCols, roundsTable } from "~/server/db/schema/rounds.ts";
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
import { db } from "../db/provider.ts";
import {
  type ContestResponse,
  contestsPublicCols,
  type SelectContest,
  contestsTable as table,
} from "../db/schema/contests.ts";
import { actionClient, CcActionError } from "../safeAction.ts";

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
      rounds: z.array(RoundValidator).nonempty({ error: "Please select at least one event" }),
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
        await tx
          .insert(roundsTable)
          .values(
            rounds.map((r) =>
              r.roundNumber === 1 ? { ...r, id: undefined, open: true } : { ...r, id: undefined, open: false },
            ),
          );

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

async function validateAndCleanUpContest(
  contest: ContestDto,
  rounds: RoundDto[],
  user: typeof auth.$Infer.Session.user,
) {
  const isAdmin = getIsAdmin(user.role);
  const events = await db.query.events.findMany();

  // Protect against admin-only stuff
  if (!isAdmin) {
    if (!contest.organizerIds.some((id) => id === user.personId))
      throw new CcActionError("You cannot create a contest which you are not organizing");
  }

  const roundIds = new Set<string>();

  for (const round of rounds) {
    const roundId = `${round.eventId}-r${round.roundNumber}`;
    if (roundIds.has(roundId)) throw new CcActionError(`Duplicate round found: ${roundId}`);
    roundIds.add(roundId); // also used below in schedule validation

    if (round.competitionId !== contest.competitionId)
      throw new CcActionError("A round may not have a competition ID different from the contest's competition ID");

    const event = events.find((e) => e.eventId === round.eventId);
    if (!event) throw new CcActionError(`Event with ID ${round.eventId} not found`);
    if (event.category === "removed") throw new CcActionError("Removed events are not allowed");
    if (event.format === "time" && !round.timeLimitCentiseconds)
      throw new CcActionError("Every round of an event with the format Time must have a time limit");

    if (
      event.format !== "time" &&
      (round.timeLimitCentiseconds ||
        round.timeLimitCumulativeRoundIds ||
        round.cutoffAttemptResult ||
        round.cutoffNumberOfAttempts)
    )
      throw new CcActionError("A round of an event with the format Time cannot have a time limit or cutoff");
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
      throw new CcActionError("You may not hold more than 15 rounds at a meetup");

    const correctTZ = findTimezone(contest.latitudeMicrodegrees / 1000000, contest.longitudeMicrodegrees / 1000000)[0];
    if (contest.timezone !== correctTZ)
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

      const correctTZ = findTimezone(venue.latitudeMicrodegrees / 1000000, venue.longitudeMicrodegrees / 1000000)[0];
      if (venue.timezone !== correctTZ)
        throw new CcActionError("Venue time zone doesn't match time zone at the given coordinates");

      for (const room of venue.rooms) {
        for (const activity of room.activities) {
          if (!/^other-/.test(activity.activityCode) && !roundIds.has(activity.activityCode))
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
