import { getModContestsSF } from "~/server/serverFunctions/contestServerFunctions.ts";
import { authorizeUser } from "~/server/serverUtilityFunctions.ts";
import LoadingError from "../components/UI/LoadingError.tsx";
import ModDashboardScreen from "./ModDashboardScreen.tsx";

type Props = {
  searchParams: Promise<{ organizerPersonId: string }>;
};

async function ModeratorDashboardPage({ searchParams }: Props) {
  const session = await authorizeUser({ permissions: { modDashboard: ["view"] } });
  const { organizerPersonId } = await searchParams;

  const res = await getModContestsSF({ organizerPersonId: organizerPersonId ? Number(organizerPersonId) : undefined });

  if (!res.data) return <LoadingError loadingEntity="contests" />;

  return (
    <section>
      <h2 className="mb-4 text-center">Moderator Dashboard</h2>

      <ModDashboardScreen contests={res.data} session={session} />
    </section>
  );
}

export default ModeratorDashboardPage;
