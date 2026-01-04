import type { Schedule } from "~/helpers/types/Schedule.ts";
import type { ContestType } from "~/helpers/types.ts";
import type { InsertContest } from "~/server/db/schema/contests.ts";

function getSchedule(
  contest: Pick<InsertContest, "competitionId" | "startDate" | "endDate">,
  eventIds: string[],
): Schedule {
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
            activities: eventIds.map((eventId) => ({
              id: 1,
              activityCode: `${eventId}-r1`,
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
    competitionId: "TestMeetup2020",
    name: "Test Meetup 2020",
    type: "meetup" as ContestType,
    startDate: new Date(2020, 0, 1),
    endDate: new Date(2020, 0, 1),
    eventIds: ["555bf"],
  },
  {
    competitionId: "TestCompJan2020",
    name: "Test Competition January 2020",
    type: "comp" as ContestType,
    startDate: new Date(2020, 0, 1),
    endDate: new Date(2020, 0, 1),
    eventIds: ["333_oh_bld_team_relay"],
  },
  {
    competitionId: "TestCompFeb2020",
    name: "Test Competition February 2020",
    type: "comp" as ContestType,
    startDate: new Date(2020, 1, 1),
    endDate: new Date(2020, 1, 1),
    eventIds: ["333_oh_bld_team_relay"],
  },
  {
    competitionId: "TestCompMar2020",
    name: "Test Competition March 2020",
    type: "comp" as ContestType,
    startDate: new Date(2020, 2, 1),
    endDate: new Date(2020, 2, 1),
    eventIds: ["333_oh_bld_team_relay"],
  },
  // 2023
  {
    competitionId: "TestComp2023",
    name: "Test Competition 2023",
    type: "comp" as ContestType,
    startDate: new Date(2023, 0, 1),
    endDate: new Date(2023, 0, 1),
    eventIds: ["333", "222", "333bf", "444bf", "333_oh_bld_team_relay"],
  },
  // 2025
  {
    competitionId: "TestCompJan2025",
    name: "Test Competition January 2025",
    type: "comp" as ContestType,
    startDate: new Date(2025, 0, 1),
    endDate: new Date(2025, 0, 1),
    eventIds: ["333_oh_bld_team_relay"],
  },
  {
    competitionId: "TestCompFeb2025",
    name: "Test Competition February 2025",
    type: "comp" as ContestType,
    startDate: new Date(2025, 1, 1),
    endDate: new Date(2025, 1, 1),
    eventIds: ["333_oh_bld_team_relay"],
  },
  {
    competitionId: "TestCompMar2025",
    name: "Test Competition March 2025",
    type: "comp" as ContestType,
    startDate: new Date(2025, 2, 1),
    endDate: new Date(2025, 2, 1),
    eventIds: ["333_oh_bld_team_relay"],
  },
  {
    competitionId: "TestCompApr2025",
    name: "Test Competition April 2025",
    type: "comp" as ContestType,
    startDate: new Date(2025, 3, 1),
    endDate: new Date(2025, 3, 1),
    eventIds: ["333_oh_bld_team_relay"],
  },
].map(({ eventIds, ...c }) => ({
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
  schedule: c.type === "meetup" ? undefined : getSchedule(c, eventIds),
}));
