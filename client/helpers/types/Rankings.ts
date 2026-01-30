import type { ContestResponse } from "~/server/db/schema/contests";
import type { EventResponse } from "~/server/db/schema/events";
import type { PersonResponse } from "~/server/db/schema/persons";
import type { Attempt } from "~/server/db/schema/results";

export type Ranking = {
  rankingId: string;
  ranking: number;
  date: Date;
  personId?: number; // only set for top persons rankings
  persons: Pick<PersonResponse, "id" | "name" | "localizedName" | "regionCode" | "wcaId">[];
  result: number;
  memo: number | null; // only set for top single rankings for events that have memo
  attempts: Attempt[];
  contest: Pick<ContestResponse, "competitionId" | "shortName" | "regionCode" | "type"> | null; // only set for contest results
  videoLink: string | null; // only set for video-based results
  discussionLink: string | null; // only set for video-based results
};

export type RecordRanking = Omit<Ranking, "ranking" | "memo"> & {
  type: "single" | "average" | "single-and-avg";
};

export type RecordsData = {
  events: Pick<EventResponse, "eventId" | "name" | "category" | "format" | "removedWca" | "description">[];
  records: (Omit<RecordRanking, "result"> & {
    eventId: string;
    best: number;
    average: number;
  })[];
};
