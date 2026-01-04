import { eq, inArray, ne, sql } from "drizzle-orm";
import LoadingError from "~/app/components/UI/LoadingError.tsx";
import type { Creator } from "~/helpers/types.ts";
import { getIsAdmin } from "~/helpers/utilityFunctions.ts";
import { creatorCols } from "~/server/db/dbUtils.ts";
import { db } from "~/server/db/provider.ts";
import { usersTable } from "~/server/db/schema/auth-schema.ts";
import { eventsPublicCols, eventsTable } from "~/server/db/schema/events.ts";
import { type PersonResponse, personsPublicCols, personsTable } from "~/server/db/schema/persons.ts";
import { resultsTable } from "~/server/db/schema/results.ts";
import { roundsPublicCols, roundsTable } from "~/server/db/schema/rounds.ts";
import { authorizeUser, getUserHasAccessToContest } from "~/server/serverUtilityFunctions.ts";
import ContestForm from "./ContestForm.tsx";

type Props = {
  searchParams: Promise<{
    editId?: string;
    copyId?: string;
  }>;
};

async function CreateEditContestPage({ searchParams }: Props) {
  const session = await authorizeUser({ permissions: { competitions: ["create", "update"] } });
  const { editId, copyId } = await searchParams;

  const isAdmin = getIsAdmin(session.user.role);
  const mode = editId ? "edit" : copyId ? "copy" : "new";
  const competitionId = editId ?? copyId;

  const eventsPromise = db
    .select(eventsPublicCols)
    .from(eventsTable)
    .where(ne(eventsTable.category, "removed"))
    .orderBy(eventsTable.rank);
  const contestPromise = competitionId
    ? db.query.contests.findFirst({
        columns: isAdmin
          ? undefined
          : {
              createdBy: false,
              createdAt: false,
              updatedAt: false,
            },
        where: { competitionId },
      })
    : undefined;
  const roundsPromise = competitionId
    ? db.select(roundsPublicCols).from(roundsTable).where(eq(roundsTable.competitionId, competitionId))
    : undefined;

  try {
    const [events, contest, rounds] = await Promise.all([eventsPromise, contestPromise, roundsPromise]);

    if (competitionId && !contest) return <LoadingError reason="Contest not found" />;

    let totalResultsByRound: { roundId: number; totalResults: number }[] | undefined;
    let organizers: PersonResponse[] | undefined;
    let creator: Creator | undefined;
    let creatorPerson: PersonResponse | undefined;

    if (contest) {
      if (!getUserHasAccessToContest(session.user, contest))
        return <LoadingError reason="You do not have access rights for this contest" />;

      const totalResultsByRoundPromise =
        contest.participants > 0
          ? db
              .execute(
                sql`SELECT ${resultsTable.roundId}, COUNT(*) AS total_results
                  FROM ${resultsTable}
                  WHERE ${resultsTable.competitionId} = ${contest.competitionId}
                  GROUP BY ${resultsTable.roundId}`,
              )
              .then((res) =>
                res.map((row) => ({ roundId: row.round_id as number, totalResults: Number(row.total_results ?? 0) })),
              )
          : undefined;
      const organizersPromise = db
        .select(personsPublicCols)
        .from(personsTable)
        .where(inArray(personsTable.id, contest.organizerIds));
      const creatorPromise =
        isAdmin && contest.createdBy
          ? db.select(creatorCols).from(usersTable).where(eq(usersTable.id, contest.createdBy))
          : undefined;
      const [totalResultsByRoundRes, organizersRes, creatorRes] = await Promise.all([
        totalResultsByRoundPromise,
        organizersPromise,
        creatorPromise,
      ]);
      totalResultsByRound = totalResultsByRoundRes;
      organizers = organizersRes;
      creator = creatorRes?.[0];

      if (creator?.personId) {
        creatorPerson = (
          await db.select(personsPublicCols).from(personsTable).where(eq(personsTable.id, creator.personId))
        ).at(0);
      }
    }

    return (
      <div>
        <h2 className="mb-4 text-center">{mode === "edit" ? "Edit Contest" : "Create Contest"}</h2>

        <ContestForm
          events={events}
          rounds={rounds}
          totalResultsByRound={totalResultsByRound}
          mode={mode}
          contest={contest}
          organizers={organizers}
          creator={creator}
          creatorPerson={creatorPerson}
          session={session}
        />
      </div>
    );
  } catch (err) {
    console.error(err);
    return <LoadingError />;
  }
}

export default CreateEditContestPage;
