import type { RoundFormat, RoundProceed, RoundType } from "~/helpers/types.ts";
import type { InsertRound } from "~/server/db/schema/rounds.ts";

// All set to open at the bottom
export const roundsStub: (InsertRound & { id: number })[] = [
  // 2023
  {
    competitionId: "TestMeetupJan2023",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestMeetupJan2023",
    eventId: "444bf",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 60 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestCompJan2023",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestMeetupFeb2023",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    cutoffAttemptResult: 8 * 60 * 100,
    cutoffNumberOfAttempts: 1,
  },
  {
    competitionId: "TestCompFeb2023",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestMeetupMar2023",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestCompMar2023",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestCompMar2023",
    eventId: "skewb",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "a" as RoundFormat,
    timeLimitCentiseconds: 1 * 60 * 100,
    cutoffAttemptResult: 15 * 100,
    cutoffNumberOfAttempts: 2,
  },
  // 2026
  {
    competitionId: "TestComp2026",
    eventId: "333",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "a" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    cutoffAttemptResult: 8 * 60 * 100,
    cutoffNumberOfAttempts: 2,
  },
  {
    competitionId: "TestComp2026",
    eventId: "222",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat, // intentionally set to non-default format
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestComp2026",
    eventId: "333bf",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestComp2026",
    eventId: "444bf",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 60 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestComp2026",
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
    competitionId: "TestMeetupJan2026",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestMeetupFeb2026",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestMeetupMar2026",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  // 2028
  {
    competitionId: "TestMeetupJan2028",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestCompJan2028",
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
    competitionId: "TestCompJan2028",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 2,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestMeetupFeb2028",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestCompFeb2028",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestMeetupMar2028",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "3" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestCompMar2028",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
  {
    competitionId: "TestMeetupApr2028",
    eventId: "333bf_2_person_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "a" as RoundFormat, // not the ranked average format
    timeLimitCentiseconds: 10 * 60 * 100,
  },
  {
    competitionId: "TestCompApr2028",
    eventId: "333_oh_bld_team_relay",
    roundNumber: 1,
    roundTypeId: "f" as RoundType,
    format: "m" as RoundFormat,
    timeLimitCentiseconds: 10 * 60 * 100,
    timeLimitCumulativeRoundIds: [],
  },
].map((r, index) => ({ ...r, id: index + 1, open: true }));
// The id is set just for testing purposes; it's left out when seeding the mock DB

// 2023
export const testMeetupJan2023_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupJan2023" && r.eventId === "333bf_2_person_relay",
)!;
export const testMeetupJan2023_444bf_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupJan2023" && r.eventId === "444bf",
)!;
export const testCompJan2023_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestCompJan2023" && r.eventId === "333_oh_bld_team_relay",
)!;
export const testMeetupFeb2023_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupFeb2023" && r.eventId === "333bf_2_person_relay",
)!;
export const testCompFeb2023_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestCompFeb2023" && r.eventId === "333_oh_bld_team_relay",
)!;
export const testMeetupMar2023_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupMar2023" && r.eventId === "333bf_2_person_relay",
)!;
export const testCompMar2023_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestCompMar2023" && r.eventId === "333_oh_bld_team_relay",
)!;
export const testCompMar2023_skewb_r1 = roundsStub.find(
  (r) => r.competitionId === "TestCompMar2023" && r.eventId === "skewb",
)!;

// 2026
export const testComp2026_333_r1 = roundsStub.find((r) => r.competitionId === "TestComp2026" && r.eventId === "333")!;
export const testComp2026_222_r1 = roundsStub.find((r) => r.competitionId === "TestComp2026" && r.eventId === "222")!;
export const testComp2026_333bf_r1 = roundsStub.find(
  (r) => r.competitionId === "TestComp2026" && r.eventId === "333bf",
)!;
export const testComp2026_444bf_r1 = roundsStub.find(
  (r) => r.competitionId === "TestComp2026" && r.eventId === "444bf",
)!;
export const testComp2026_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestComp2026" && r.eventId === "333_oh_bld_team_relay",
)!;
export const testMeetupJan2026_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupJan2026" && r.eventId === "333bf_2_person_relay",
)!;
export const testMeetupFeb2026_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupFeb2026" && r.eventId === "333bf_2_person_relay",
)!;
export const testMeetupMar2026_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupMar2026" && r.eventId === "333bf_2_person_relay",
)!;

// 2028
export const testMeetupJan2028_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupJan2028" && r.eventId === "333bf_2_person_relay",
)!;
export const testCompJan2028_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestCompJan2028" && r.eventId === "333_oh_bld_team_relay" && r.roundNumber === 1,
)!;
export const testCompJan2028_333_oh_bld_team_relay_r2 = roundsStub.find(
  (r) => r.competitionId === "TestCompJan2028" && r.eventId === "333_oh_bld_team_relay" && r.roundNumber === 2,
)!;
export const testMeetupFeb2028_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupFeb2028" && r.eventId === "333bf_2_person_relay",
)!;
export const testCompFeb2028_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestCompFeb2028" && r.eventId === "333_oh_bld_team_relay",
)!;
export const testMeetupMar2028_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupMar2028" && r.eventId === "333bf_2_person_relay",
)!;
export const testCompMar2028_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestCompMar2028" && r.eventId === "333_oh_bld_team_relay",
)!;
export const testMeetupApr2028_333bf_2_person_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestMeetupApr2028" && r.eventId === "333bf_2_person_relay",
)!;
export const testCompApr2028_333_oh_bld_team_relay_r1 = roundsStub.find(
  (r) => r.competitionId === "TestCompApr2028" && r.eventId === "333_oh_bld_team_relay",
)!;
