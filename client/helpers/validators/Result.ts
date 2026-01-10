import { differenceInHours } from "date-fns";
import z from "zod";
import { C } from "../constants.ts";

const personIds = z
  .array(z.int())
  .min(1)
  .refine((val) => val.length === new Set(val).size, {
    error: "You cannot enter the same person twice in the same result",
  });
const memo = z
  .int()
  .min(1)
  .max(C.maxTime - 1)
  .optional();

export const AttemptsValidator = z
  .array(z.strictObject({ result: z.int(), memo }))
  .min(1)
  .max(5)
  .refine((val) => val.some((a) => a.result !== -2) && val.some((a) => a.result !== 0), {
    error: "You cannot submit only DNS attempts or only empty attempts",
  });

export const ResultValidator = z.strictObject({
  eventId: z.string().nonempty(),
  personIds,
  attempts: AttemptsValidator,
  competitionId: z.string().nonempty(),
  roundId: z.int(),
});

export type ResultDto = z.infer<typeof ResultValidator>;

export const VideoBasedResultValidator = z.strictObject({
  eventId: z.string().nonempty(),
  // TO-DO: MAKE IT SO THE DIFFERENCE IN HOURS THING GIVES NO MARGIN AND JUST ACCOUNTS FOR TIME ZONES!!!!!!!!!!!!!!!!!!
  date: z.date().refine(
    // Only checked in production and test environments
    (val) => !["production", "test"].includes(process.env.NODE_ENV) || differenceInHours(val, new Date()) <= 40,
    { error: "The date cannot be in the future" },
  ),
  personIds,
  attempts: z
    .array(
      z.strictObject({
        result: z.int().refine((val) => val !== 0, { error: "You cannot submit an empty attempt" }),
        memo,
      }),
    )
    .min(1)
    .max(5)
    .refine((val) => val.some((a) => a.result > 0), { error: "You cannot submit only DNF/DNS attempts" }),
  videoLink: z.url(),
  discussionLink: z.url().nullable(),
});

export type VideoBasedResultDto = z.infer<typeof VideoBasedResultValidator>;
