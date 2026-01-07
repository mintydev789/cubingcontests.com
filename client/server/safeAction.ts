import "server-only";
import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";
import z from "zod";
import type { authClient } from "~/helpers/authClient.ts";
// import { testUsers } from "~/instrumentation.ts";
import type { CcServerErrorObject } from "../helpers/types.ts";
import { authorizeUser } from "./serverUtilityFunctions.ts";

export const actionClient = createSafeActionClient({
  defineMetadataSchema() {
    return z.object({
      // null means the user simply needs to be logged in; undefined means authorization isn't necessary
      permissions: z.any().nullable().optional(),
    });
  },
  handleServerError(e): CcServerErrorObject {
    if (e instanceof CcActionError) {
      if (!process.env.VITEST) console.error("CC action error:", e.message);
      return { message: e.message, data: e.data };
    }

    console.error("Action error:", e.message);
    return { message: DEFAULT_SERVER_ERROR_MESSAGE };
  },
}).use<{ session: typeof authClient.$Infer.Session }>(async ({ next, metadata }) => {
  // We still want to check authentication when permissions = null
  if (metadata.permissions !== undefined) {
    if (process.env.VITEST) {
      // testUsers ???
      const adminTestUser = { personId: 1, email: "admin@example.com", role: "admin" };
      const moderator1TestUser = { personId: 2, email: "mod1@example.com", role: "mod" };

      const user = process.env.TEST_USER === "moderator1" ? moderator1TestUser : adminTestUser;

      return next({ ctx: { session: { user } } });
    } else {
      const session = await authorizeUser({ permissions: metadata.permissions });
      return next({ ctx: { session } });
    }
  } else {
    return next();
  }
});

export class CcActionError extends Error {
  data?: any;

  constructor(message: string, options?: { data: any }, ...rest: any[]) {
    super(message, ...rest);

    this.name = "CcActionError";
    if (options) {
      this.data = options.data;
    }
  }
}
