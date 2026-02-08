import { eq } from "drizzle-orm";
import ResultsSubmissionForm from "~/app/components/adminAndModerator/ResultsSubmissionForm.tsx";
import LoadingError from "~/app/components/UI/LoadingError.tsx";
import { creatorCols } from "~/server/db/dbUtils";
import { db } from "~/server/db/provider.ts";
import { usersTable } from "~/server/db/schema/auth-schema";
import { authorizeUser, getRecordConfigs, getVideoBasedEvents } from "~/server/serverUtilityFunctions.ts";

type Props = {
  params: Promise<{ resultId: string }>;
};

async function EditResultPage({ params }: Props) {
  await authorizeUser({ permissions: { videoBasedResults: ["update", "approve"] } });
  const { resultId } = await params;

  const [events, recordConfigs, result] = await Promise.all([
    getVideoBasedEvents(),
    getRecordConfigs("video-based-results"),
    db.query.results.findFirst({ where: { id: Number(resultId) } }),
  ]);

  if (!result) return <LoadingError />;

  const participants = await db.query.persons.findMany({ where: { id: { in: result.personIds } } });
  const [creator] = result.createdBy
    ? await db.select(creatorCols).from(usersTable).where(eq(usersTable.id, result.createdBy))
    : [];
  const creatorPerson = creator?.personId
    ? await db.query.persons.findFirst({ where: { id: creator.personId } })
    : undefined;

  return (
    <section>
      <ResultsSubmissionForm
        events={events}
        recordConfigs={recordConfigs}
        result={result}
        participants={participants}
        creator={creator}
        creatorPerson={creatorPerson}
      />
    </section>
  );
}

export default EditResultPage;
