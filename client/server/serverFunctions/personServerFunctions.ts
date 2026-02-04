"use server";

import { and, eq, ilike, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { CountryCodes } from "~/helpers/Countries.ts";
import { C } from "~/helpers/constants.ts";
import { fetchWcaPerson, getIsAdmin, getSimplifiedString } from "~/helpers/utilityFunctions.ts";
import { type PersonDto, PersonValidator } from "~/helpers/validators/Person.ts";
import { WcaIdValidator } from "~/helpers/validators/Validators.ts";
import { db } from "~/server/db/provider.ts";
import {
  type PersonResponse,
  personsPublicCols,
  type SelectPerson,
  personsTable as table,
} from "~/server/db/schema/persons.ts";
import { actionClient, RrActionError } from "../safeAction.ts";
import { checkUserPermissions, getPersonExactMatchWcaId, logMessage } from "../serverUtilityFunctions.ts";

type GetOrCreatePersonObject = {
  person: PersonResponse;
  isNew: boolean;
};

export const getPersonByIdSF = actionClient
  .metadata({ permissions: null })
  .inputSchema(
    z.strictObject({
      id: z.int().min(1),
    }),
  )
  .action<PersonResponse>(async ({ parsedInput: { id } }) => {
    const [person] = await db.select(personsPublicCols).from(table).where(eq(table.id, id));
    if (!person) throw new RrActionError(`Person with ID ${id} not found`);
    return person;
  });

export const getPersonsByNameSF = actionClient
  .metadata({ permissions: null })
  .inputSchema(
    z.strictObject({
      name: z.string().max(60),
    }),
  )
  .action<PersonResponse[]>(async ({ parsedInput: { name } }) => {
    const simplifiedParts = getSimplifiedString(name)
      .split(" ")
      .map((part) => `%${part}%`);
    const nameQuery = and(...simplifiedParts.map((part) => sql`UNACCENT(${table.name}) ILIKE ${part}`));
    const locNameQuery = and(...simplifiedParts.map((part) => ilike(table.localizedName, part)));

    return await db.select(personsPublicCols).from(table).where(or(nameQuery, locNameQuery)).limit(C.maxPersonMatches);
  });

export const getOrCreatePersonSF = actionClient
  .metadata({ permissions: { persons: ["create"] } })
  .inputSchema(
    z.strictObject({
      name: z.string(),
      regionCode: z.enum(CountryCodes),
    }),
  )
  .action<GetOrCreatePersonObject>(async ({ parsedInput: { name, regionCode } }) => {
    const persons = await db
      .select(personsPublicCols)
      .from(table)
      .where(and(eq(table.name, name), eq(table.regionCode, regionCode)));

    if (persons.length > 1)
      throw new RrActionError(`Multiple people were found with the name ${name} and country ${regionCode}`);

    if (persons.length === 1) return { person: persons[0], isNew: false };

    const res = await createPersonSF({
      newPersonDto: { name, localizedName: null, regionCode: regionCode, wcaId: null },
    });
    if (!res.data) throw new Error(res.serverError?.message || C.unknownErrorMsg);

    return { person: res.data, isNew: true };
  });

export const getOrCreatePersonByWcaIdSF = actionClient
  .metadata({ permissions: { persons: ["create"] } })
  .inputSchema(
    z.strictObject({
      wcaId: WcaIdValidator,
    }),
  )
  .action<GetOrCreatePersonObject>(async ({ parsedInput: { wcaId } }) => {
    const [person] = await db.select(personsPublicCols).from(table).where(eq(table.wcaId, wcaId)).limit(1);
    if (person) return { person, isNew: false };

    const wcaPerson = await fetchWcaPerson(wcaId);
    if (!wcaPerson) throw new RrActionError(`Person with WCA ID ${wcaId} not found`);

    const res = await createPersonSF({ newPersonDto: wcaPerson });
    if (!res.data) throw new Error(res.serverError?.message || C.unknownErrorMsg);

    return { person: res.data, isNew: true };
  });

export const createPersonSF = actionClient
  .metadata({ permissions: { persons: ["create"] } })
  .inputSchema(
    z.strictObject({
      newPersonDto: PersonValidator,
      ignoreDuplicate: z.boolean().default(false),
    }),
  )
  .action<PersonResponse | SelectPerson>(
    async ({
      parsedInput: { newPersonDto, ignoreDuplicate },
      ctx: {
        session: { user },
      },
    }) => {
      newPersonDto.name = newPersonDto.name.trim();
      if (newPersonDto.localizedName) newPersonDto.localizedName = newPersonDto.localizedName.trim();
      const { name, wcaId } = newPersonDto;
      logMessage("RR0019", `Creating person with name ${name} and ${wcaId ? `WCA ID ${wcaId}` : "no WCA ID"}`);

      const canApprove = await checkUserPermissions(user.id, { persons: ["approve"] });

      await validatePerson(newPersonDto, { ignoreDuplicate, isAdmin: getIsAdmin(user.role) });

      // TO-DO: ADD SUPPORT FOR EXTERNAL DATA ENTRY!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      const query = db.insert(table).values({ ...newPersonDto, createdBy: user.id });
      const [createdPerson] = await (canApprove ? query.returning() : query.returning(personsPublicCols));
      return createdPerson;
    },
  );

export const updatePersonSF = actionClient
  .metadata({ permissions: { persons: ["update"] } })
  .inputSchema(
    z.strictObject({
      id: z.int(),
      newPersonDto: PersonValidator,
      ignoreDuplicate: z.boolean().default(false),
    }),
  )
  .action<PersonResponse | SelectPerson>(
    async ({ parsedInput: { id, newPersonDto, ignoreDuplicate }, ctx: { session } }) => {
      const { name, wcaId } = newPersonDto;
      logMessage("RR0020", `Updating person with name ${name} and ${wcaId ? `WCA ID ${wcaId}` : "no WCA ID"}`);

      const canApprove = await checkUserPermissions(session.user.id, { persons: ["approve"] });

      const [person] = await db.select().from(table).where(eq(table.id, id)).limit(1);
      if (!person) throw new RrActionError("Person with the provided ID not found");
      if (!canApprove && person.approved) throw new RrActionError("You may not edit a person who has been approved");
      if (person.wcaId && person.wcaId !== newPersonDto.wcaId)
        throw new RrActionError("Changing a person's WCA ID is not allowed");
      // TO-DO: WE MAY HAVE TO DO SOMETHING ABOUT PAST RECORDS SET BY THE COMPETITOR WHO IS CHANGING THEIR COUNTRY!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      if (person.regionCode !== newPersonDto.regionCode) {
        throw new RrActionError(
          "Changing a person's country is not currently supported. Please contact the development team.",
        );
      }

      await validatePerson(newPersonDto, { excludeId: id, ignoreDuplicate, isAdmin: canApprove });

      let personDto: PersonDto = newPersonDto;

      if (newPersonDto.wcaId) {
        const wcaPerson = await fetchWcaPerson(newPersonDto.wcaId);
        if (!wcaPerson) throw new RrActionError(`Person with WCA ID ${newPersonDto.wcaId} not found`);
        personDto = wcaPerson;
      }

      const query = db.update(table).set(personDto).where(eq(table.id, id));
      const [updatedPerson] = await (canApprove ? query.returning() : query.returning(personsPublicCols));
      return updatedPerson;
    },
  );

export const deletePersonSF = actionClient
  .metadata({ permissions: { persons: ["delete"] } })
  .inputSchema(
    z.strictObject({
      id: z.int(),
    }),
  )
  .action(async ({ parsedInput: { id }, ctx: { session } }) => {
    logMessage("RR0021", `Deleting person with ID ${id}`);

    const canApprove = await checkUserPermissions(session.user.id, { persons: ["approve"] });

    const [person] = await db.select().from(table).where(eq(table.id, id)).limit(1);
    if (!person) throw new RrActionError("Person with the provided ID not found");
    if (!canApprove && person.approved) throw new RrActionError("You may not delete an approved person");

    const user = await db.query.users.findFirst({ where: { personId: person.id } });
    if (user) {
      throw new RrActionError(
        `You may not delete a person tied to a user. This person is tied to the user ${user.username}.`,
      );
    }

    const result = await db.query.results.findFirst({ where: { personIds: { arrayContains: [person.id] } } });
    if (result) {
      throw new RrActionError(
        `You may not delete a person who has a result. This person has a result in ${result.eventId}${result.competitionId ? ` at ${result.competitionId}` : " (video-based result)"}.`,
      );
    }

    const organizedContest = await db.query.contests.findFirst({ where: { organizerIds: { arrayContains: [id] } } });
    if (organizedContest) {
      throw new RrActionError(
        `You may not delete a person who has organized a contest. This person was an organizer at ${organizedContest.competitionId}.`,
      );
    }

    await db.delete(table).where(eq(table.id, id));
  });

export const approvePersonSF = actionClient
  .metadata({ permissions: { persons: ["approve"] } })
  .inputSchema(
    z.strictObject({
      id: z.int(),
      ignoredWcaMatches: z.array(z.string()).default([]),
    }),
  )
  .action<SelectPerson>(async ({ parsedInput: { id, ignoredWcaMatches } }) => {
    const [person] = await db.select().from(table).where(eq(table.id, id)).limit(1);
    if (!person) throw new RrActionError("Person not found");
    if (person.approved) throw new RrActionError(`${person.name} has already been approved`);

    const result = await db.query.results.findFirst({ where: { personIds: { arrayContains: [id] } } });
    if (!result) {
      const organizedContest = await db.query.contests.findFirst({ where: { organizerIds: { arrayContains: [id] } } });
      if (!organizedContest) {
        throw new RrActionError(
          `${person.name} has no results and hasn't organized any contests. They could have been added by accident.`,
        );
      }
    }

    const matchedPersonWcaId = await getPersonExactMatchWcaId(person, ignoredWcaMatches);
    if (matchedPersonWcaId) {
      throw new RrActionError(
        `${person.name} has an exact name and country match with the WCA competitor with WCA ID ${matchedPersonWcaId}. If that is the same person, edit their profile, adding the WCA ID. If it's a different person, simply approve them again to confirm.`,
        { data: { wcaMatches: [...ignoredWcaMatches, matchedPersonWcaId] } },
      );
    }

    logMessage("RR0022", `Approving person ${person.name} (CC ID: ${person.id})`);

    const [approvedPerson] = await db.update(table).set({ approved: true }).where(eq(table.id, id)).returning();
    return approvedPerson;
  });

async function validatePerson(
  newPersonDto: PersonDto,
  {
    ignoreDuplicate,
    excludeId,
    isAdmin,
  }: {
    ignoreDuplicate?: boolean;
    excludeId?: number;
    isAdmin?: boolean;
  } = {},
) {
  const excludeCondition = excludeId ? ne(table.id, excludeId) : undefined;

  if (newPersonDto.wcaId) {
    const [sameWcaIdPerson] = await db
      .select()
      .from(table)
      .where(and(eq(table.wcaId, newPersonDto.wcaId), excludeCondition))
      .limit(1);

    if (sameWcaIdPerson) throw new RrActionError("A person with the same WCA ID already exists in the CC database");
  } else if (!ignoreDuplicate || !isAdmin) {
    const [duplicatePerson] = await db
      .select()
      .from(table)
      .where(and(eq(table.name, newPersonDto.name), eq(table.regionCode, newPersonDto.regionCode), excludeCondition))
      .limit(1);

    if (duplicatePerson) {
      throw new RrActionError(
        `A person with the same name and country already exists. If it's actually a different competitor with the same name, ${
          isAdmin
            ? "simply submit them again."
            : "please report this to the admin team. For now, simply add (2) at the end of their name to do data entry."
        }`,
        { data: { isDuplicatePerson: true } },
      );
    }
  }
}
