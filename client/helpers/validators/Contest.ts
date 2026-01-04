import { toZonedTime } from "date-fns-tz";
import z from "zod";
import { CountryCodes } from "~/helpers/Countries.ts";
import { C } from "~/helpers/constants.ts";
import { getDateOnly } from "~/helpers/sharedFunctions.ts";
import type { Activity } from "~/helpers/types/Schedule.ts";
import { ContestTypeValues } from "~/helpers/types.ts";
import { ColorValidator } from "~/helpers/validators/Validators.ts";

const ActivityValidator = z.lazy((): any =>
  z
    .strictObject({
      id: z.int().min(1),
      activityCode: z.string().regex(/^[a-z0-9][a-z0-9-_]{2,}$/),
      name: z.string().nonempty().optional(), // only set when activityCode = other-misc (see superRefine() below)
      startTime: z.date(),
      endTime: z.date(),
      // childActivities: z.array(ActivityValidator),
      childActivities: z.array(z.never()).max(0),
    })
    .superRefine((val, ctx) => {
      if (val.activityCode === "other-misc" && !val.name) {
        ctx.addIssue({
          code: "custom",
          message: "A custom activity must have a custom title",
          input: val.name,
        });
      } else if (val.activityCode !== "other-misc" && val.name) {
        ctx.addIssue({
          code: "custom",
          message: "A non-custom activity may not have a custom title",
          input: val.name,
        });
      }
    }),
);

const RoomValidator = z.strictObject({
  id: z.int().min(1),
  name: z.string().nonempty(),
  color: ColorValidator,
  activities: z
    .array(ActivityValidator)
    .nonempty({ error: "Please create at least one activity" })
    .superRefine((val, ctx) => {
      const duplicateFoundObj = { id: false, activityCode: false };

      const checkActivityDuplicates = (activities: Activity[], key: "id" | "activityCode") => {
        if (activities.length !== new Set(activities.map((a) => a[key])).size) {
          duplicateFoundObj[key] = true;
        } else {
          activities.forEach((a) => void checkActivityDuplicates(a.childActivities, key));
        }
      };

      checkActivityDuplicates(val, "id");
      checkActivityDuplicates(val, "activityCode");

      if (duplicateFoundObj.id) {
        ctx.addIssue({
          code: "custom",
          message: "Activities must not have duplicate IDs",
        });
      }
      if (duplicateFoundObj.activityCode) {
        ctx.addIssue({
          code: "custom",
          message: "Activities must not have duplicate activity codes",
        });
      }
    }),
});

const latitudeMicrodegrees = z
  .int()
  .min(-90000000, { error: "The latitude cannot be less than -90 degrees" })
  .max(90000000, { error: "The latitude cannot be more than 90 degrees" })
  .refine((val) => val !== 0, { error: "Please enter the venue latitude" });
const longitudeMicrodegrees = z
  .int()
  .min(-180000000, { error: "The longitude cannot be less than -180 degrees" })
  .max(180000000, { error: "The longitude cannot be more than 180 degrees" })
  .refine((val) => val !== 0, { error: "Please enter the venue longitude" });
const duplicateIdsCheck = (val: any[]) => val.length === new Set(val.map((v) => v.id)).size;

const VenueValidator = z.strictObject({
  id: z.int().min(1),
  name: z.string().nonempty(),
  countryIso2: z.enum(CountryCodes),
  latitudeMicrodegrees,
  longitudeMicrodegrees,
  timezone: z.string().nonempty(),
  rooms: z
    .array(RoomValidator)
    .nonempty({ error: "Please create at least one room" })
    .refine(duplicateIdsCheck, { error: "Venue rooms must not have duplicate IDs" }),
});

const ScheduleValidator = z.strictObject({
  venues: z
    .array(VenueValidator)
    .nonempty({ error: "Please create at least one venue" })
    .refine(duplicateIdsCheck, { error: "Schedule venues must not have duplicate IDs" }),
});

export const ContestValidator = z
  .strictObject({
    // id: z.int().optional(), // not needed when creating new contest
    competitionId: z
      .string()
      .min(5)
      .regex(/^[a-zA-Z0-9]*$/, { error: "The contest ID must only contain alphanumeric characters" }),
    // state: z.enum(ContestStateValues).optional(), // not needed when creating new contest
    name: z
      .string()
      .min(10)
      .regex(/.* [0-9]{4}$/, { error: "The contest name must have the year at the end, separated by a space" }),
    shortName: z
      .string()
      .min(8)
      .max(32)
      .regex(/.* [0-9]{4}$/, { error: "The short name must have the year at the end, separated by a space" }),
    type: z.enum(ContestTypeValues),
    city: z.string().nonempty(),
    regionCode: z.enum(CountryCodes, { error: "Please select a country" }),
    venue: z.string().nonempty(),
    address: z.string().nonempty(),
    latitudeMicrodegrees,
    longitudeMicrodegrees,
    startDate: z.date(),
    endDate: z.date(),
    startTime: z.date().optional(),
    timezone: z.string().nonempty().optional(),
    organizerIds: z
      .array(z.int())
      .nonempty()
      .refine((val) => val.length === new Set(val).size, { error: "List of organizers must not have duplicates" }),
    contact: z.email().optional(),
    description: z.string(),
    competitorLimit: z.int().min(C.minCompetitorLimit).optional(),
    // participants: z.int().default(0),
    // queuePosition: z.int().optional(),
    schedule: ScheduleValidator.optional(),
    // createdBy: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    for (const key of ["competitionId", "name", "shortName"]) {
      if (/championship/i.test((val as any)[key]) || /national/i.test((val as any)[key])) {
        ctx.addIssue({
          code: "custom",
          message: 'The name must not contain "championship" or "national"',
          input: (val as any)[key],
        });
      }

      if (val.type === "meetup" && /open/i.test((val as any)[key])) {
        ctx.addIssue({
          code: "custom",
          message: 'The name must not contain "open" (only applies to meetups)',
          input: (val as any)[key],
        });
      }
    }

    if (val.startDate > val.endDate) {
      ctx.addIssue({
        code: "custom",
        message: "The start date must be before the end date",
        input: val.startDate,
      });
    }

    if (val.type === "meetup") {
      const correctStartDate = getDateOnly(toZonedTime(val.startTime!, val.timezone!))!;
      if (val.startDate.getTime() !== correctStartDate.getTime()) {
        ctx.addIssue({
          code: "custom",
          message: `Mismatch between startDate (${val.startDate.toDateString()}) and startTime (${correctStartDate.toDateString()}). Please report this to the admin team.`,
          input: val.startTime,
        });
      }
    } else if (!val.competitorLimit) {
      ctx.addIssue({
        code: "custom",
        message: "Please enter the competitor limit",
        input: val.competitorLimit,
      });
    }
  });

export type ContestDto = z.infer<typeof ContestValidator>;
