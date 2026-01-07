import { roundsStub } from "~/__mocks__/stubs/roundsStub";
import type { Schedule } from "~/helpers/types/Schedule.ts";
import type { ContestType } from "~/helpers/types.ts";
import type { InsertContest } from "~/server/db/schema/contests.ts";

function getSchedule(contest: Pick<InsertContest, "competitionId" | "startDate" | "endDate">): Schedule {
  const rounds = roundsStub.filter((r) => r.competitionId === contest.competitionId);

  return {
    venues: [
      {
        id: 1,
        name: "Venueplace",
        countryIso2: "GB",
        latitudeMicrodegrees: 10,
        longitudeMicrodegrees: 10,
        timezone: "Europe/London",
        rooms: [
          {
            id: 1,
            name: "Roomhall",
            color: "#000000",
            activities: rounds.map((r, index) => ({
              id: index + 1,
              activityCode: `${r.eventId}-r${r.roundNumber}`,
              startTime: contest.startDate,
              endTime: contest.startDate,
              childActivities: [],
            })),
          },
        ],
      },
    ],
  };
}

// Mapped to the final shape at the bottom
export const contestsStub: InsertContest[] = [
  // 2020
  {
    competitionId: "TestMeetupJan2020",
    name: "Test Meetup January 2020",
    type: "meetup" as ContestType,
    startDate: new Date(2020, 0, 1),
    endDate: new Date(2020, 0, 1),
  },
  {
    competitionId: "TestCompJan2020",
    name: "Test Competition January 2020",
    type: "comp" as ContestType,
    startDate: new Date(2020, 0, 1),
    endDate: new Date(2020, 0, 1),
  },
  {
    competitionId: "TestMeetupFeb2020",
    name: "Test Meetup February 2020",
    type: "meetup" as ContestType,
    startDate: new Date(2020, 1, 1),
    endDate: new Date(2020, 1, 1),
  },
  {
    competitionId: "TestCompFeb2020",
    name: "Test Competition February 2020",
    type: "comp" as ContestType,
    startDate: new Date(2020, 1, 1),
    endDate: new Date(2020, 1, 1),
  },
  {
    competitionId: "TestMeetupMar2020",
    name: "Test Meetup March 2020",
    type: "meetup" as ContestType,
    startDate: new Date(2020, 2, 1),
    endDate: new Date(2020, 2, 1),
  },
  {
    competitionId: "TestCompMar2020",
    name: "Test Competition March 2020",
    type: "comp" as ContestType,
    startDate: new Date(2020, 2, 1),
    endDate: new Date(2020, 2, 1),
  },
  // 2023
  {
    competitionId: "TestComp2023",
    name: "Test Competition 2023",
    type: "comp" as ContestType,
    startDate: new Date(2023, 0, 1),
    endDate: new Date(2023, 0, 1),
  },
  {
    competitionId: "TestMeetupJan2023",
    name: "Test Meetup January 2023",
    type: "meetup" as ContestType,
    startDate: new Date(2023, 0, 1),
    endDate: new Date(2023, 0, 1),
  },
  {
    competitionId: "TestMeetupFeb2023",
    name: "Test Meetup February 2023",
    type: "meetup" as ContestType,
    startDate: new Date(2023, 1, 1),
    endDate: new Date(2023, 1, 1),
  },
  {
    competitionId: "TestMeetupMar2023",
    name: "Test Meetup March 2023",
    type: "meetup" as ContestType,
    startDate: new Date(2023, 2, 1),
    endDate: new Date(2023, 2, 1),
  },
  // 2025
  {
    competitionId: "TestMeetupJan2025",
    name: "Test Meetup January 2025",
    type: "meetup" as ContestType,
    startDate: new Date(2025, 0, 1),
    endDate: new Date(2025, 0, 1),
  },
  {
    competitionId: "TestCompJan2025",
    name: "Test Competition January 2025",
    type: "comp" as ContestType,
    startDate: new Date(2025, 0, 1),
    endDate: new Date(2025, 0, 1),
  },
  {
    competitionId: "TestMeetupFeb2025",
    name: "Test Meetup February 2025",
    type: "meetup" as ContestType,
    startDate: new Date(2025, 1, 1),
    endDate: new Date(2025, 1, 1),
  },
  {
    competitionId: "TestCompFeb2025",
    name: "Test Competition February 2025",
    type: "comp" as ContestType,
    startDate: new Date(2025, 1, 1),
    endDate: new Date(2025, 1, 1),
  },
  {
    competitionId: "TestMeetupMar2025",
    name: "Test Meetup March 2025",
    type: "meetup" as ContestType,
    startDate: new Date(2025, 2, 1),
    endDate: new Date(2025, 2, 1),
  },
  {
    competitionId: "TestCompMar2025",
    name: "Test Competition March 2025",
    type: "comp" as ContestType,
    startDate: new Date(2025, 2, 1),
    endDate: new Date(2025, 2, 1),
  },
  {
    competitionId: "TestCompApr2025",
    name: "Test Competition April 2025",
    type: "comp" as ContestType,
    startDate: new Date(2025, 3, 1),
    endDate: new Date(2025, 3, 1),
  },
].map((c) => ({
  ...c,
  state: "approved",
  shortName: c.name,
  city: "Citytown",
  regionCode: "GB",
  venue: "Venueplace",
  address: "Address st. 123",
  latitudeMicrodegrees: 10,
  longitudeMicrodegrees: 10,
  startTime: c.type === "meetup" ? c.startDate : undefined,
  timezone: c.type === "meetup" ? "Europe/London" : undefined,
  organizerIds: [1],
  contact: "email@example.com",
  description: "Description",
  competitorLimit: 100,
  schedule: c.type === "meetup" ? undefined : getSchedule(c),
}));
