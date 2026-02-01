import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import Handlebars from "handlebars";
import { MailtrapClient } from "mailtrap";
import { Countries } from "~/helpers/Countries.ts";
import { C } from "~/helpers/constants.ts";
import { roundFormats } from "~/helpers/roundFormats.ts";
import { getFormattedTime, getIsCompType, getIsUrgent } from "~/helpers/utilityFunctions.ts";
import type { SelectContest } from "~/server/db/schema/contests.ts";
import { logMessage } from "~/server/serverUtilityFunctions.ts";
import type { SelectEvent } from "../db/schema/events.ts";
import type { ResultResponse } from "../db/schema/results.ts";

// This is needed when running Better Auth DB migrations
if (process.env.NODE_ENV !== "production") loadEnvConfig(process.cwd(), true);

if (!process.env.PROD_HOSTNAME) console.error("PROD_HOSTNAME environment variable not set!");
if (!process.env.NEXT_PUBLIC_BASE_URL) console.error("NEXT_PUBLIC_BASE_URL environment variable not set!");

// Mailtrap documentation: https://github.com/mailtrap/mailtrap-nodejs
const client = new MailtrapClient({
  token: process.env.EMAIL_API_KEY ?? "",
  sandbox: process.env.NODE_ENV !== "production",
  testInboxId: process.env.NODE_ENV === "production" ? undefined : Number(process.env.EMAIL_TEST_INBOX_ID),
});

const from = {
  name: "No Reply",
  email: `no-reply@${process.env.PROD_HOSTNAME}`,
};
const contestsEmail = {
  name: "Contests",
  email: `contests@${process.env.PROD_HOSTNAME}`,
};
const resultsEmail = {
  name: "Results",
  email: `results@${process.env.PROD_HOSTNAME}`,
};
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";

async function send({
  templateFileName = "default.hbs",
  context,
  callback,
}: {
  templateFileName?: string;
  context: Record<string, string | number | boolean>;
  callback: (html: string) => Promise<void>;
}) {
  if (process.env.VITEST) return;
  if (!process.env.EMAIL_API_KEY) {
    if (process.env.NODE_ENV === "production")
      console.warn("Warning: Not sending email, because EMAIL_API_KEY environment variable isn't set!");
    return;
  }

  try {
    const currFilePath = import.meta.url.replace(/^file:/, "");
    const templateContents = await readFile(join(currFilePath, "../templates", templateFileName), "utf-8");
    const template = Handlebars.compile(templateContents, { strict: true });
    const html = template(context);

    await callback(html);
  } catch (err) {
    logMessage("RR5001", `Error while sending email with template ${templateFileName}: ${err}`);
  }
}

// Email functions

export function sendEmail(to: string, subject: string, content: string) {
  send({
    context: { content },
    callback: async (html) => {
      await client.send({
        from,
        to: [{ email: to }],
        subject,
        html,
      });
    },
  });
}

export function sendVerificationEmail(to: string, url: string) {
  send({
    templateFileName: "email-verification.hbs",
    context: {
      ccUrl: baseUrl,
      verificationLink: url,
    },
    callback: async (html) => {
      await client.send({
        from,
        to: [{ email: to }],
        subject: "Email verification",
        html,
      });
    },
  });
}

export function sendResetPasswordEmail(to: string, url: string) {
  send({
    templateFileName: "password-reset-request.hbs",
    context: {
      ccUrl: baseUrl,
      passwordResetLink: url,
    },
    callback: async (html) => {
      await client.send({
        from,
        to: [{ email: to }],
        subject: "Password reset",
        html,
      });
    },
  });
}

export function sendPasswordChangedEmail(to: string) {
  send({
    templateFileName: "password-changed.hbs",
    context: {
      ccUrl: baseUrl,
    },
    callback: async (html) => {
      await client.send({
        from,
        to: [{ email: to }],
        subject: "Password change successful",
        html,
      });
    },
  });
}

export function sendRoleChangedEmail(
  to: string,
  role: string,
  { canAccessModDashboard }: { canAccessModDashboard: boolean },
) {
  send({
    templateFileName: "role-changed.hbs",
    context: {
      ccUrl: baseUrl,
      role,
      extra: canAccessModDashboard
        ? ` You can now access the <a href="${baseUrl}/mod">Moderator Dashboard</a> from the navigation bar.`
        : "",
    },
    callback: async (html) => {
      await client.send({
        from,
        to: [{ email: to }],
        subject: "Role changed",
        html,
      });
    },
  });
}

export function sendContestSubmittedNotification(recipients: string[], contest: SelectContest, creator: string) {
  const urgent = getIsUrgent(new Date(contest.startDate));

  send({
    templateFileName: "contest-submitted.hbs",
    context: {
      competitionId: contest.competitionId,
      wcaCompetition: contest.type === "wca-comp",
      contestName: contest.name,
      contestUrl: `${baseUrl}/competitions/${contest.competitionId}`,
      ccUrl: baseUrl,
      creator,
      startDate: contest.startDate.toDateString(),
      location: `${contest.city}, ${Countries.find((c) => c.code === contest.regionCode)?.name ?? "NOT FOUND"}`,
      urgent,
    },
    callback: async (html) => {
      await client.send({
        from,
        reply_to: { email: C.contactEmail },
        to: recipients.map((r) => ({ email: r })),
        bcc: [{ email: C.contactEmail }],
        subject: `${urgent ? "Urgent: " : ""}Contest submitted: ${contest.shortName}`,
        html,
        // priority: urgent ? "high" : "normal",
      });
    },
  });
}

export function sendContestApprovedNotification(
  to: string,
  contest: Pick<SelectContest, "competitionId" | "name" | "shortName">,
) {
  send({
    templateFileName: "contest-approved.hbs",
    context: {
      contestName: contest.name,
      contestUrl: `${baseUrl}/competitions/${contest.competitionId}`,
    },
    callback: async (html) => {
      await client.send({
        from: contestsEmail,
        to: [{ email: to }],
        subject: `Contest approved: ${contest.shortName}`,
        html,
      });
    },
  });
}

export function sendContestFinishedNotification(
  recipients: string[],
  contest: Pick<SelectContest, "competitionId" | "name" | "shortName" | "type" | "participants">,
  creator: string,
) {
  const duesAmount = C.duePerCompetitor * contest.participants;

  send({
    templateFileName: "contest-finished.hbs",
    context: {
      contestName: contest.name,
      contestUrl: `${baseUrl}/competitions/${contest.competitionId}`,
      ccUrl: baseUrl,
      creator,
      duesAmount: getIsCompType(contest.type) && duesAmount >= 1 ? duesAmount.toFixed(2) : "",
      isUnofficialCompetition: contest.type === "comp",
    },
    callback: async (html) => {
      await client.send({
        from: contestsEmail,
        reply_to: { email: C.contactEmail },
        to: recipients.map((r) => ({ email: r })),
        bcc: [{ email: C.contactEmail }],
        subject: `Contest finished: ${contest.shortName}`,
        html,
      });
    },
  });
}

export function sendContestPublishedNotification(
  to: string,
  contest: Pick<SelectContest, "competitionId" | "name" | "shortName">,
) {
  send({
    templateFileName: "contest-published.hbs",
    context: {
      contestName: contest.name,
      contestUrl: `${baseUrl}/competitions/${contest.competitionId}`,
    },
    callback: async (html) => {
      await client.send({
        from: contestsEmail,
        to: [{ email: to }],
        subject: `Contest published: ${contest.shortName}`,
        html,
      });
    },
  });
}

export function sendVideoBasedResultSubmittedNotification(
  to: string,
  event: SelectEvent,
  result: ResultResponse,
  creatorUsername: string,
) {
  send({
    templateFileName: "video-based-result-submitted.hbs",
    context: {
      ccUrl: baseUrl,
      eventName: event.name,
      roundFormat: roundFormats.find((rf) => rf.value !== "3" && rf.attempts === result.attempts.length)!.label,
      best:
        getFormattedTime(result.best, { event, showMultiPoints: true }) +
        (result.regionalSingleRecord ? ` (${result.regionalSingleRecord})` : ""),
      average:
        result.average !== 0
          ? getFormattedTime(result.average, { event }) +
            (result.regionalAverageRecord ? ` (${result.regionalAverageRecord})` : "")
          : "",
      videoLink: result.videoLink!,
      discussionLink: result.discussionLink ?? "",
      creatorUsername,
    },
    callback: async (html) => {
      await client.send({
        from: resultsEmail,
        reply_to: { email: C.contactEmail },
        to: [{ email: to }],
        bcc: [{ email: C.contactEmail }],
        subject: `Result submitted: ${event.name}`,
        html,
      });
    },
  });
}
