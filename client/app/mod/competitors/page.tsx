import { desc, eq, inArray } from "drizzle-orm";
import LoadingError from "~/app/components/UI/LoadingError.tsx";
import ManageCompetitorsScreen from "~/app/mod/competitors/ManageCompetitorsScreen.tsx";
import type { Creator } from "~/helpers/types.ts";
import { db } from "~/server/db/provider.ts";
import { usersTable } from "~/server/db/schema/auth-schema.ts";
import {
  type PersonResponse,
  personsPublicCols,
  type SelectPerson,
  personsTable as table,
} from "~/server/db/schema/persons.ts";
import { authorizeUser, checkUserPermissions } from "~/server/serverUtilityFunctions.ts";

async function CompetitorsPage() {
  const { user } = await authorizeUser({ permissions: { persons: ["create", "update", "delete"] } });
  const isAdmin = await checkUserPermissions(user.id, { persons: ["approve"] });

  let persons: SelectPerson[] | PersonResponse[] | undefined;
  let users: Creator[] | undefined;

  if (isAdmin) {
    persons = await db.select().from(table).orderBy(desc(table.id));
    const userIds = Array.from(
      new Set(persons.filter((p) => (p as SelectPerson).createdBy).map((p) => (p as SelectPerson).createdBy)),
    );

    users = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        personId: usersTable.personId,
      })
      .from(usersTable)
      .where(inArray(usersTable.id, userIds as string[]));
  } else {
    persons = await db
      .select(personsPublicCols)
      .from(table)
      .where(eq(table.createdBy, user.id))
      .orderBy(desc(table.id));
  }

  if (!persons || (isAdmin && !users)) return <LoadingError loadingEntity="persons" />;

  return (
    <section>
      <h2 className="mb-4 text-center">Competitors</h2>

      <ManageCompetitorsScreen persons={persons} users={users} />
    </section>
  );
}

export default CompetitorsPage;
