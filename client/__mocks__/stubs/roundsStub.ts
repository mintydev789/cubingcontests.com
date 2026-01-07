import type { RoundFormat, RoundProceed, RoundType } from "~/helpers/types.ts";
import type { InsertRound } from "~/server/db/schema/rounds.ts";

// All set to open at the bottom
export const roundsStub: (InsertRound & { id: number })[] = [
  // 2020
  {
    competitionId: "TestMeetupJan2020",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestMeetupJan2020",
    eventId: "444bf",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 60 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestCompJan2020",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestMeetupFeb2020",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestCompFeb2020",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestMeetupMar2020",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestCompMar2020",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  // 2023
  {
    competitionId: "TestComp2023",
    eventId: "333",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "a" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    cutoffAttemptResult: 8 * 60 * 100,
    cutoffNumberOfAttempts: 2,
  },
  {
    competitionId: "TestComp2023",
    eventId: "222",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat, // intentionally set to non-default format
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestComp2023",
    eventId: "333bf",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestComp2023",
    eventId: "444bf",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 60 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestComp2023",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
    cutoffAttemptResult: 8 * 60 * 100,
    cutoffNumberOfAttempts: 1,
  },
  {
    competitionId: "TestMeetupJan2023",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestMeetupFeb2023",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestMeetupMar2023",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  // 2025
  {
    competitionId: "TestMeetupJan2025",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestCompJan2025",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 1,
    roundTypeId: "1" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
    proceedType: "number" as RoundProceed,
    proceedValue: 1, // this isn't allowed normally, but this is just for testing purposes
  },
  {
    competitionId: "TestCompJan2025",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 2,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestMeetupFeb2025",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestCompFeb2025",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestMeetupMar2025",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestCompMar2025",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestCompApr2025",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
].map((r, index) => ({ ...r, id: index + 1, open: true }));
// The id is set just for testing purposes; it's left out when seeding the mock DB

// 2020
export const testMeetupJan2020_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupJan2020" && r.eventId === "333bf_2_person_relay",
)!;
export const testMeetupJan2020_444bf_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupJan2020" && r.eventId === "444bf",
)!;
export const testCompJan2020_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestCompJan2020" && r.eventId === "333_oh_bld_team_relay",
)!;
export const testMeetupFeb2020_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupFeb2020" && r.eventId === "333bf_2_person_relay",
)!;
export const testCompFeb2020_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestCompFeb2020" && r.eventId === "333_oh_bld_team_relay",
)!;
export const testMeetupMar2020_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupMar2020" && r.eventId === "333bf_2_person_relay",
)!;
export const testCompMar2020_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestCompMar2020" && r.eventId === "333_oh_bld_team_relay",
)!;

// 2023
export const testComp2023_333_r1 = roundsStub.find((r) => r.competitionId === "TestComp2023" && r.eventId === "333")!;
export const testComp2023_222_r1 = roundsStub.find((r) => r.competitionId === "TestComp2023" && r.eventId === "222")!;
export const testComp2023_333bf_r1 = roundsStub.find(
  (r) => r.competitionId === "TestComp2023" && r.eventId === "333bf",
)!;
export const testComp2023_444bf_r1 = roundsStub.find(
  (r) => r.competitionId === "TestComp2023" && r.eventId === "444bf",
)!;
export const testComp2023_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestComp2023" && r.eventId === "333_oh_bld_team_relay",
)!;
export const testMeetupJan2023_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupJan2023" && r.eventId === "333bf_2_person_relay",
)!;
export const testMeetupFeb2023_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupFeb2023" && r.eventId === "333bf_2_person_relay",
)!;
export const testMeetupMar2023_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupMar2023" && r.eventId === "333bf_2_person_relay",
)!;

// 2025
export const testMeetupJan2025_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupJan2025" && r.eventId === "333bf_2_person_relay",
)!;
export const testCompJan2025_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestCompJan2025" && r.eventId === "333_oh_bld_team_relay" && r.roundNumber === 1,
)!;
export const testCompJan2025_333_oh_bld_team_relay_r2 = roundsStub.find(
  (r) => r.competitionId === "TestCompJan2025" && r.eventId === "333_oh_bld_team_relay" && r.roundNumber === 2,
)!;
export const testMeetupFeb2025_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupFeb2025" && r.eventId === "333bf_2_person_relay",
)!;
export const testCompFeb2025_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestCompFeb2025" && r.eventId === "333_oh_bld_team_relay",
)!;
export const testMeetupMar2025_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupMar2025" && r.eventId === "333bf_2_person_relay",
)!;
export const testCompMar2025_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestCompMar2025" && r.eventId === "333_oh_bld_team_relay",
)!;
export const testCompApr2025_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestCompApr2025" && r.eventId === "333_oh_bld_team_relay",
)!;
