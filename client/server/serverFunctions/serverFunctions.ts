"use server";

import { Alg } from "cubing/alg";
import { cube2x2x2 } from "cubing/puzzles";
import { randomScrambleForEvent } from "cubing/scramble";
import { and, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { C } from "~/helpers/constants.ts";
import { nxnMoves } from "~/helpers/types/NxNMove.ts";
import { getIsAdmin } from "~/helpers/utilityFunctions.ts";
import { auth } from "~/server/auth.ts";
import { db } from "~/server/db/provider.ts";
import { usersTable } from "~/server/db/schema/auth-schema.ts";
import {
  type CollectiveSolutionResponse,
  collectiveSolutionsPublicCols,
  collectiveSolutionsTable as csTable,
} from "~/server/db/schema/collective-solutions.ts";
import { sendEmail, sendRoleChangedEmail } from "~/server/email/mailer.ts";
import { type Role, Roles } from "~/server/permissions.ts";
import { type PersonResponse, personsPublicCols, personsTable } from "../db/schema/persons.ts";
import { actionClient, RrActionError } from "../safeAction.ts";
import { checkUserPermissions, logMessage } from "../serverUtilityFunctions.ts";

export const logAffiliateLinkClickSF = actionClient
  .metadata({})
  .inputSchema(
    z.strictObject({
      message: z.string().nonempty(),
    }),
  )
  .action(async ({ parsedInput: { message } }) => {
    logMessage("RR0004", message);
  });

export const logErrorSF = actionClient
  .metadata({})
  .inputSchema(
    z.strictObject({
      message: z.string().nonempty(),
    }),
  )
  .action(async ({ parsedInput: { message } }) => {
    logMessage("RR5000", message);
  });

export const logUserDeletedSF = actionClient
  .metadata({ permissions: null })
  .inputSchema(
    z.strictObject({
      id: z.string().nonempty(),
    }),
  )
  .action(async ({ parsedInput: { id } }) => {
    logMessage("RR0034", `Deleting user with ID ${id}`);
  });

export const updateUserSF = actionClient
  .metadata({ permissions: { user: ["set-role"] } })
  .inputSchema(
    z.strictObject({
      id: z.string(),
      personId: z.int().min(1).nullable().default(null),
      role: z.enum(Roles),
    }),
  )
  .action<{ user: typeof auth.$Infer.Session.user; person?: PersonResponse }>(
    async ({ parsedInput: { id, personId, role } }) => {
      logMessage("RR0033", `Updating user with ID ${id} (new person ID: ${personId}; new role: ${role})`);

      const hdrs = await headers();

      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
      if (!user) throw new RrActionError("User not found");
      if (!user.emailVerified) throw new RrActionError("This user hasn't verified their email address yet");

      let person: PersonResponse | undefined;
      if (personId) {
        if (personId !== user.personId) {
          const [samePersonUser] = await db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(and(ne(usersTable.id, id), eq(usersTable.personId, personId)))
            .limit(1);
          if (samePersonUser) throw new RrActionError("The selected person is already tied to another user");
        }

        person = (
          await db.select(personsPublicCols).from(personsTable).where(eq(personsTable.id, personId)).limit(1)
        ).at(0);
        if (!person) throw new RrActionError(`Person with ID ${personId} not found`);
      } else if (role !== "user") {
        throw new RrActionError("Privileged users must have a person tied to their account");
      }

      if (user.role !== role) {
        await auth.api.setRole({ body: { userId: id, role: role as Role }, headers: hdrs });
        const canAccessModDashboard = await checkUserPermissions(user.id, { modDashboard: ["view"] });

        sendRoleChangedEmail(user.email, role, { canAccessModDashboard });

        if (getIsAdmin(role)) {
          sendEmail(
            C.contactEmail,
            "Important: New admin user",
            `User ${user.username}${person ? ` (${person.name})` : ""} has been given the admin role.`,
          );
        }
      }

      const [updatedUser] = await db.update(usersTable).set({ personId }).where(eq(usersTable.id, id)).returning();

      // Log out user to avoid stale session data
      await auth.api.revokeUserSessions({ body: { userId: id }, headers: hdrs });

      return { user: updatedUser, person };
    },
  );

export const startNewCollectiveCubingSolutionSF = actionClient
  .metadata({ permissions: null })
  .action<CollectiveSolutionResponse>(async ({ ctx: { session } }) => {
    logMessage("RR0029", "Starting new Collective Cubing solution");

    const ongoingSolution = await db.query.collectiveSolutions.findFirst({ where: { state: "ongoing" } });
    if (ongoingSolution) throw new RrActionError("The cube has already been scrambled", { data: ongoingSolution });

    const eventId = "222";
    const scramble = await randomScrambleForEvent(eventId);

    const [createdSolution] = await db.transaction(async (tx) => {
      await tx.update(csTable).set({ state: "archived" }).where(eq(csTable.state, "solved"));

      return await tx
        .insert(csTable)
        .values({
          eventId,
          scramble: scramble.toString(),
          lastUserWhoInteracted: session.user.id,
          usersWhoMadeMoves: [],
        })
        .returning(collectiveSolutionsPublicCols);
    });

    return createdSolution;
  });

async function getIsSolved(currentState: Alg): Promise<boolean> {
  const kpuzzle = await cube2x2x2.kpuzzle();
  const isSolved = kpuzzle
    .defaultPattern()
    .applyAlg(currentState)
    .experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true });

  return isSolved;
}

export const makeCollectiveCubingMoveSF = actionClient
  .metadata({ permissions: null })
  .inputSchema(
    z.strictObject({
      move: z.enum(nxnMoves),
      lastSeenSolution: z.string(),
    }),
  )
  .action<CollectiveSolutionResponse>(
    async ({
      parsedInput: { move, lastSeenSolution },
      ctx: {
        session: { user },
      },
    }) => {
      const [ongoingSolution] = await db.select().from(csTable).where(eq(csTable.state, "ongoing")).limit(1);

      if (!ongoingSolution) {
        throw new RrActionError("The puzzle is already solved", { data: { isSolved: true } });
      }

      if (user.id === ongoingSolution.lastUserWhoInteracted) {
        throw new RrActionError(
          ongoingSolution.solution
            ? "You may not make two moves in a row"
            : "You scrambled the cube, so you may not make the first move",
        );
      }

      if (ongoingSolution.solution !== lastSeenSolution) {
        throw new RrActionError("The state of the cube has changed before your move", { data: ongoingSolution });
      }

      const solution = new Alg(ongoingSolution.solution).concat(move);
      const state = (await getIsSolved(new Alg(ongoingSolution.scramble).concat(solution))) ? "solved" : "ongoing";

      const [updatedSolution] = await db
        .update(csTable)
        .set({
          state,
          solution: solution.toString(),
          lastUserWhoInteracted: user.id,
          usersWhoMadeMoves: !ongoingSolution.usersWhoMadeMoves.includes(user.id)
            ? [...ongoingSolution.usersWhoMadeMoves, user.id]
            : ongoingSolution.usersWhoMadeMoves,
        })
        .where(eq(csTable.id, ongoingSolution.id))
        .returning(collectiveSolutionsPublicCols);

      return updatedSolution;
    },
  );
