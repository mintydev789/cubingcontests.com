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
import { sendPasswordChangedEmail, sendResetPasswordEmail, sendVerificationEmail } from "~/server/email/mailer.ts";
import { ac, admin, mod, user } from "~/server/permissions.ts";
import { logMessage } from "~/server/serverUtilityFunctions";

if (!process.env.BETTER_AUTH_URL) console.error("BETTER_AUTH_URL environment variable not set!");
if (!process.env.BETTER_AUTH_SECRET) console.error("BETTER_AUTH_SECRET environment variable not set!");

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
      maxUsernameLength: 40,
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
    sendResetPassword: async ({ user, url }) => {
      if (process.env.EMAIL_API_KEY) logMessage("RR0031", `Sending reset password email for user with ID ${user.id}`);

      sendResetPasswordEmail(user.email, url);
    },
    onPasswordReset: async ({ user }) => {
      if (process.env.EMAIL_API_KEY) logMessage("RR0032", `Sending password changed email for user with ID ${user.id}`);

      sendPasswordChangedEmail(user.email);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      if (process.env.EMAIL_API_KEY) logMessage("RR0030", `Sending verification email for new user with ID ${user.id}`);

      sendVerificationEmail(user.email, url);
    },
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
