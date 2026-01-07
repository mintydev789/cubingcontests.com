import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin as adminPlugin, username } from "better-auth/plugins";
import { db } from "~/server/db/provider.ts";
import {
  accountsTable as accounts,
  sessionsTable as sessions,
  usersTable as users,
  verificationsTable as verifications,
} from "~/server/db/schema/auth-schema.ts";
import { sendResetPasswordEmail, sendVerificationEmail } from "~/server/email/mailer.ts";
import { ac, admin, mod, user } from "~/server/permissions.ts";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      users,
      sessions,
      accounts,
      verifications,
    },
    usePlural: true,
  }),
  plugins: [
    nextCookies(),
    username({
      usernameValidator: (username) => /^[0-9a-zA-Z-_.]*$/.test(username),
    }),
    adminPlugin({
      ac,
      roles: { admin, mod, user },
    }),
  ],
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    sendResetPassword: ({ user, url }) => sendResetPasswordEmail(user.email, url),
  },
  emailVerification: {
    sendVerificationEmail: ({ user, url }) => sendVerificationEmail(user.email, url),
  },
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: true,
      },
      personId: {
        type: "number",
        required: false,
      },
    },
    deleteUser: {
      enabled: true,
    },
  },
});
