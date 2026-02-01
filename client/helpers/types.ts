import type { authClient } from "~/helpers/authClient.ts";
import type { PersonResponse } from "~/server/db/schema/persons.ts";

// WCIF types
export type {
  Activity as WcifActivity,
  Competition as WcifCompetition,
  Event as WcifEvent,
  Round as WcifRound,
  Schedule as WcifSchedule,
} from "@wca/helpers";

// Other types

export type ResultRankingType = "single" | "average" | "mean";

export type PageSize = "A4" | "A6";

export type ListPageMode = "view" | "add" | "edit";

export type InputPerson = PersonResponse | null;

// This has to stay consistent with the creator columns object in dbUtils.ts
export type Creator = Pick<typeof authClient.$Infer.Session.user, "id" | "username" | "email" | "personId">;

export const EventFormatValues = [
  "time",
  "number", // for Fewest Moves events
  "multi",
] as const;
export type EventFormat = (typeof EventFormatValues)[number];

export const RoundFormatValues = ["a", "m", "3", "2", "1"] as const;
export type RoundFormat = (typeof RoundFormatValues)[number];

export const RoundTypeValues = ["1", "2", "3", "4", "5", "6", "7", "8", "s", "f"] as const;
export type RoundType = (typeof RoundTypeValues)[number];

export const RoundProceedValues = ["percentage", "number"] as const;
export type RoundProceed = (typeof RoundProceedValues)[number];

// This will be deleted once event categories are stored in the DB
export const EventCategoryValues = ["unofficial", "wca", "extreme-bld", "miscellaneous", "removed"] as const;
export type EventCategory = (typeof EventCategoryValues)[number];

export const RecordCategoryValues = ["competitions", "meetups", "video-based-results"] as const;
export type RecordCategory = (typeof RecordCategoryValues)[number];

export const RecordTypeValues = ["WR", "ER", "NAR", "SAR", "AsR", "AfR", "OcR", "NR"] as const;
export type RecordType = (typeof RecordTypeValues)[number];

export const ContestTypeValues = ["meetup", "wca-comp", "comp"] as const;
export type ContestType = (typeof ContestTypeValues)[number];

export const ContestStateValues = ["created", "approved", "ongoing", "finished", "published", "removed"] as const;
export type ContestState = (typeof ContestStateValues)[number];

export type ContinentCode = "AFRICA" | "ASIA" | "EUROPE" | "NORTH_AMERICA" | "OCEANIA" | "SOUTH_AMERICA";

export type EventWrPair = {
  eventId: string;
  best?: number;
  average?: number;
};
