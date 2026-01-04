import "server-only";
import { defineRelations } from "drizzle-orm";
import { accountsTable as accounts, sessionsTable as sessions, usersTable as users } from "./schema/auth-schema.ts";
import { collectiveSolutionsTable as collectiveSolutions } from "./schema/collective-solutions.ts";
import { contestsTable as contests } from "./schema/contests.ts";
import { eventsTable as events } from "./schema/events.ts";
import { personsTable as persons } from "./schema/persons.ts";
import { resultsTable as results } from "./schema/results.ts";
import { roundsTable as rounds } from "./schema/rounds.ts";

export const relations = defineRelations(
  {
    users,
    sessions,
    accounts,
    events,
    contests,
    rounds,
    results,
    persons,
    collectiveSolutions,
  },
  (r) => ({
    // Auth relations
    users: {
      sessions: r.many.sessions(),
      accounts: r.many.accounts(),
      person: r.one.persons({
        from: r.users.personId,
        to: r.persons.id,
      }),
    },
    sessions: {
      user: r.one.users({
        from: r.sessions.userId,
        to: r.users.id,
        optional: false,
      }),
    },
    accounts: {
      user: r.one.users({
        from: r.accounts.userId,
        to: r.users.id,
        optional: false,
      }),
    },

    // CC relations
    contests: {
      rounds: r.many.rounds(),
      // organizers: r.many.persons({
      //   from: r.contests.organizerIds,
      //   to: r.persons.id,
      // }),
    },
    rounds: {
      contest: r.one.contests({
        from: r.rounds.competitionId,
        to: r.contests.competitionId,
        optional: false,
      }),
      event: r.one.events({
        from: r.rounds.eventId,
        to: r.events.eventId,
        optional: false,
      }),
      results: r.many.results(),
    },
    results: {
      event: r.one.events({
        from: r.results.eventId,
        to: r.events.eventId,
        optional: false,
      }),
      // persons: r.many.persons({
      //   from: r.results.personIds,
      //   to: r.persons.id,
      //   where: { id: { in: r.results.personIds } },
      // }),
      contest: r.one.contests({
        from: r.results.competitionId,
        to: r.contests.competitionId,
      }),
      round: r.one.rounds({
        from: r.results.roundId,
        to: r.rounds.id,
      }),
      creator: r.one.users({
        from: r.results.createdBy,
        to: r.users.id,
      }),
    },
  }),
);
