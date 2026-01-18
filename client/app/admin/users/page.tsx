import { inArray } from "drizzle-orm";
import { headers } from "next/headers";
import LoadingError from "~/app/components/UI/LoadingError.tsx";
import { auth } from "~/server/auth.ts";
import { db } from "~/server/db/provider.ts";
import { personsPublicCols, personsTable } from "~/server/db/schema/persons.ts";
import { authorizeUser } from "~/server/serverUtilityFunctions.ts";
import ManageUsersScreen from "./ManageUsersScreen.tsx";

async function ManageUsersPage() {
  await authorizeUser({ permissions: { user: ["list"] } });

  const res = await auth.api.listUsers({
    query: { filterField: "emailVerified", filterValue: true, sortBy: "createdAt" },
    headers: await headers(),
  });

  if (!res.users) return <LoadingError loadingEntity="users" />;

  // TO-DO: THIS SHOULDN'T BE NECESSARY!!!!! https://github.com/better-auth/better-auth/issues/7452
  const users = res.users as (typeof auth.$Infer.Session.user)[];
  const personIds = Array.from(new Set(users.filter((u) => u.personId).map((u) => u.personId!)));
  const persons = await db.select(personsPublicCols).from(personsTable).where(inArray(personsTable.id, personIds));

  return (
    <section>
      <h2 className="mb-4 text-center">Users</h2>

      <ManageUsersScreen users={users} userPersons={persons} />
    </section>
  );
}

export default ManageUsersPage;
