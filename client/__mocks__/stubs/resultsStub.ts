import { contestsStub } from "~/__mocks__/stubs/contestsStub.ts";
import { eventsStub } from "~/__mocks__/stubs/eventsStub.ts";
import { Countries } from "~/helpers/Countries.ts";
import { roundFormats } from "~/helpers/roundFormats.ts";
import { getBestAndAverage } from "~/helpers/sharedFunctions.ts";
import { RecordCategoryValues } from "~/helpers/types.ts";
import type { Attempt, InsertResult } from "~/server/db/schema/results.ts";
import type { InsertRound } from "~/server/db/schema/rounds.ts";
import {
  caPersonBobStarmer,
  caPersonBrianStevenson,
  caPersonJoshCalhoun,
  caPersonMattBaker,
  dePersonHansBauer,
  dePersonJakobBach,
  dePersonStefanSteinmeier,
  gbPersonJamesStone,
  gbPersonSamMarsh,
  gbPersonTomDillon,
  jpPersonNaokoYoshida,
  jpPersonSatoshiNakamura,
  krPersonDongJunHyon,
  krPersonSooMinNam,
  personsStub,
  usPersonJayScott,
  usPersonJohnDoe,
} from "./personsStub.ts";
import {
  testComp2023_222_r1,
  testComp2023_333bf_r1,
  testComp2023_444bf_r1,
  testCompApr2025_333_oh_bld_team_relay_r1,
  testCompFeb2020_333_oh_bld_team_relay_r1,
  testCompFeb2025_333_oh_bld_team_relay_r1,
  testCompJan2020_333_oh_bld_team_relay_r1,
  testCompJan2025_333_oh_bld_team_relay_r1,
  testCompMar2020_333_oh_bld_team_relay_r1,
  testCompMar2025_333_oh_bld_team_relay_r1,
  testMeetupFeb2020_333bf_2_person_relay_r1,
  testMeetupFeb2023_333bf_2_person_relay_r1,
  testMeetupFeb2025_333bf_2_person_relay_r1,
  testMeetupJan2020_333bf_2_person_relay_r1,
  testMeetupJan2020_444bf_r1,
  testMeetupJan2023_333bf_2_person_relay_r1,
  testMeetupJan2025_333bf_2_person_relay_r1,
  testMeetupMar2020_333bf_2_person_relay_r1,
  testMeetupMar2023_333bf_2_person_relay_r1,
  testMeetupMar2025_333bf_2_person_relay_r1,
} from "./roundsStub.ts";

const years = [2021, 2024, 2026];
const resultsPerYear = 50;

function generateRandom444bfResults(): InsertResult[] {
  const results: InsertResult[] = [];

  for (const year of years) {
    for (let i = 0; i < resultsPerYear; i++) {
      const randomMonth = Math.floor(Math.random() * 12);
      const randomDay = Math.floor(Math.random() * 28) + 1;
      const date = new Date(year, randomMonth, randomDay);
      const personId = Math.floor(Math.random() * personsStub.length);
      const regionCode = personsStub[personId].regionCode;
      const recordCategory = RecordCategoryValues[Math.floor(Math.random() * 3)];
      const isVideoBasedResult = recordCategory === "video-based-results";

      const attemptCounts = [1, 2, 3, 5];
      const numAttempts = attemptCounts[Math.floor(Math.random() * attemptCounts.length)];
      // We want all attempts to be slower than any potential record attempt
      const firstAttempt = Math.floor(Math.random() * 90 * 100) + 100 * 100; // 100-190 seconds
      const attempts: Attempt[] = [];
      for (let j = 0; j < numAttempts; j++) attempts.push({ result: firstAttempt + j * 100 });

      const best = firstAttempt;
      let average: number;
      if (numAttempts === 1 || numAttempts === 2) average = 0;
      else average = attempts[numAttempts === 3 ? 1 : 2].result; // average is the middle attempt result

      results.push({
        eventId: "444bf",
        date,
        personIds: [personId],
        regionCode,
        superRegionCode: Countries.find((c) => c.code === regionCode)!.superRegionCode,
        attempts,
        best,
        average,
        recordCategory,
        competitionId: isVideoBasedResult ? null : "TestComp2023",
        roundId: isVideoBasedResult ? null : testComp2023_444bf_r1.id,
        ranking: isVideoBasedResult ? null : 1, // doesn't matter for tests using these random results
        videoLink: isVideoBasedResult ? "https://example.com" : null,
      });
    }
  }

  return results;
}

type MockInsertResult = Omit<InsertResult, "best" | "average" | "recordCategory" | "competitionId" | "roundId">;

function getVideoBasedResult(result: MockInsertResult): InsertResult {
  const event = eventsStub.find((e) => e.eventId === result.eventId)!;
  const roundFormat = roundFormats.find((rf) => rf.value !== "3" && rf.attempts === result.attempts.length)!;
  const { best, average } = getBestAndAverage(result.attempts, event.format, roundFormat.value);

  return {
    ...result,
    best,
    average,
    recordCategory: "video-based-results",
    videoLink: "https://example.com",
  };
}

function getContestResult(
  round: InsertRound & { id: number },
  result: Omit<MockInsertResult, "eventId" | "date">,
): InsertResult {
  const contest = contestsStub.find((c) => c.competitionId === round.competitionId)!;
  const event = eventsStub.find((e) => e.eventId === round.eventId)!;
  const { best, average } = getBestAndAverage(
    result.attempts,
    event.format,
    round.format,
    round.cutoffAttemptResult,
    round.cutoffNumberOfAttempts,
  );

  return {
    ...result,
    eventId: round.eventId,
    date: contest.startDate,
    best,
    average,
    recordCategory: contest.type === "meetup" ? "meetups" : "competitions",
    competitionId: round.competitionId,
    roundId: round.id,
  };
}

// Best and average set at the bottom
export const resultsStub: InsertResult[] = [
  // 3x3x3 Blindfolded 2-man Relay (meetup results)
  // 2020 results
  getContestResult(testMeetupJan2020_333bf_2_person_relay_r1, {
    // id: 1,
    personIds: [usPersonJohnDoe.id, usPersonJayScott.id],
    regionCode: "US",
    superRegionCode: "NORTH_AMERICA",
    attempts: [{ result: 9000 }, { result: 9100 }, { result: 9200 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
    ranking: 1,
  }),
  getContestResult(testMeetupFeb2020_333bf_2_person_relay_r1, {
    // id: 2,
    personIds: [gbPersonJamesStone.id, dePersonHansBauer.id],
    superRegionCode: "EUROPE",
    attempts: [{ result: 8700 }, { result: 8800 }, { result: 8900 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
    ranking: 1,
  }),
  getContestResult(testMeetupFeb2020_333bf_2_person_relay_r1, {
    // id: 3,
    personIds: [gbPersonSamMarsh.id, dePersonJakobBach.id],
    superRegionCode: "EUROPE",
    attempts: [{ result: 9100 }, { result: 9200 }, { result: 9300 }],
    ranking: 2,
  }),
  getContestResult(testMeetupMar2020_333bf_2_person_relay_r1, {
    // id: 4,
    personIds: [gbPersonSamMarsh.id, jpPersonNaokoYoshida.id],
    attempts: [{ result: 8800 }, { result: 8900 }, { result: 9000 }],
    ranking: 1,
  }),
  getContestResult(testMeetupMar2020_333bf_2_person_relay_r1, {
    // id: 5,
    personIds: [dePersonStefanSteinmeier.id, dePersonJakobBach.id],
    regionCode: "DE",
    superRegionCode: "EUROPE",
    attempts: [{ result: 8900 }, { result: 9000 }, { result: 9100 }],
    regionalSingleRecord: "NR",
    regionalAverageRecord: "NR",
    ranking: 2,
  }),
  // 3x3x3 Blindfolded 2-man Relay (meetup results)
  // 2023 results
  getContestResult(testMeetupJan2023_333bf_2_person_relay_r1, {
    // id: 6,
    personIds: [caPersonJoshCalhoun.id, jpPersonNaokoYoshida.id],
    attempts: [{ result: 6500 }, { result: 6600 }, { result: 6700 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
    ranking: 1,
  }),
  getContestResult(testMeetupJan2023_333bf_2_person_relay_r1, {
    // id: 7,
    personIds: [krPersonDongJunHyon.id, krPersonSooMinNam.id],
    regionCode: "KR",
    superRegionCode: "ASIA",
    attempts: [{ result: 8000 }, { result: 8100 }, { result: 8200 }],
    regionalSingleRecord: "AsR",
    regionalAverageRecord: "AsR",
    ranking: 2,
  }),
  getContestResult(testMeetupJan2023_333bf_2_person_relay_r1, {
    // id: 8,
    personIds: [gbPersonJamesStone.id, gbPersonTomDillon.id],
    regionCode: "GB",
    superRegionCode: "EUROPE",
    attempts: [{ result: 8200 }, { result: 8300 }, { result: 8400 }],
    regionalSingleRecord: "ER",
    regionalAverageRecord: "ER",
    ranking: 3,
  }),
  getContestResult(testMeetupFeb2023_333bf_2_person_relay_r1, {
    // id: 9,
    personIds: [jpPersonNaokoYoshida.id, usPersonJayScott.id],
    attempts: [{ result: 6700 }, { result: 6800 }, { result: 6900 }],
    ranking: 1,
  }),
  getContestResult(testMeetupFeb2023_333bf_2_person_relay_r1, {
    // id: 10,
    personIds: [jpPersonSatoshiNakamura.id, krPersonDongJunHyon.id],
    superRegionCode: "ASIA",
    attempts: [{ result: 7000 }, { result: 7100 }, { result: 7200 }],
    regionalSingleRecord: "AsR",
    regionalAverageRecord: "AsR",
    ranking: 2,
  }),
  getContestResult(testMeetupFeb2023_333bf_2_person_relay_r1, {
    // id: 11,
    personIds: [gbPersonJamesStone.id, gbPersonSamMarsh.id],
    regionCode: "GB",
    superRegionCode: "EUROPE",
    attempts: [{ result: 8600 }, { result: 8700 }, { result: 8800 }],
    ranking: 3,
  }),
  getContestResult(testMeetupMar2023_333bf_2_person_relay_r1, {
    // id: 12,
    personIds: [caPersonMattBaker.id, caPersonJoshCalhoun.id],
    regionCode: "CA",
    superRegionCode: "NORTH_AMERICA",
    attempts: [{ result: 5500 }, { result: 5600 }, { result: 5700 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
    ranking: 1,
  }),
  getContestResult(testMeetupMar2023_333bf_2_person_relay_r1, {
    // id: 13,
    personIds: [dePersonHansBauer.id, dePersonJakobBach.id],
    regionCode: "DE",
    superRegionCode: "EUROPE",
    attempts: [{ result: 8300 }, { result: 8400 }, { result: 8500 }],
    regionalSingleRecord: "NR",
    regionalAverageRecord: "NR",
    ranking: 2,
  }),
  getContestResult(testMeetupMar2023_333bf_2_person_relay_r1, {
    // id: 14,
    personIds: [caPersonBobStarmer.id, caPersonBrianStevenson.id],
    regionCode: "CA",
    superRegionCode: "NORTH_AMERICA",
    attempts: [{ result: 9200 }, { result: 9300 }, { result: 9400 }],
    ranking: 3,
  }),
  // 3x3x3 Blindfolded 2-man Relay (meetup results)
  // 2025 results
  getContestResult(testMeetupJan2025_333bf_2_person_relay_r1, {
    // id: 15,
    personIds: [usPersonJayScott.id, usPersonJohnDoe.id],
    regionCode: "US",
    superRegionCode: "NORTH_AMERICA",
    attempts: [{ result: 6600 }, { result: 6700 }, { result: 6800 }],
    regionalSingleRecord: "NR",
    regionalAverageRecord: "NR",
    ranking: 1,
  }),
  getContestResult(testMeetupJan2025_333bf_2_person_relay_r1, {
    // id: 16,
    personIds: [krPersonDongJunHyon.id, krPersonSooMinNam.id],
    regionCode: "KR",
    superRegionCode: "ASIA",
    attempts: [{ result: 7900 }, { result: 8000 }, { result: 8100 }],
    regionalSingleRecord: "NR",
    regionalAverageRecord: "NR",
    ranking: 2,
  }),
  getContestResult(testMeetupJan2025_333bf_2_person_relay_r1, {
    // id: 17,
    personIds: [dePersonHansBauer.id, dePersonJakobBach.id],
    regionCode: "DE",
    superRegionCode: "EUROPE",
    attempts: [{ result: 8400 }, { result: 8500 }, { result: 8600 }],
    ranking: 3,
  }),
  getContestResult(testMeetupFeb2025_333bf_2_person_relay_r1, {
    // id: 18,
    personIds: [krPersonDongJunHyon.id, jpPersonNaokoYoshida.id],
    superRegionCode: "ASIA",
    attempts: [{ result: 7100 }, { result: 7200 }, { result: 7300 }],
    ranking: 1,
  }),
  getContestResult(testMeetupFeb2025_333bf_2_person_relay_r1, {
    // id: 19,
    personIds: [gbPersonJamesStone.id, gbPersonTomDillon.id],
    regionCode: "GB",
    superRegionCode: "EUROPE",
    attempts: [{ result: 8500 }, { result: 8600 }, { result: 8700 }],
    ranking: 2,
  }),
  getContestResult(testMeetupMar2025_333bf_2_person_relay_r1, {
    // id: 20,
    personIds: [gbPersonJamesStone.id, gbPersonSamMarsh.id],
    regionCode: "GB",
    superRegionCode: "EUROPE",
    attempts: [{ result: 6000 }, { result: 6100 }, { result: 6200 }],
    regionalSingleRecord: "ER",
    regionalAverageRecord: "ER",
    ranking: 1,
  }),
  getContestResult(testMeetupMar2025_333bf_2_person_relay_r1, {
    // id: 21,
    personIds: [caPersonBrianStevenson.id, caPersonBobStarmer.id],
    regionCode: "CA",
    superRegionCode: "NORTH_AMERICA",
    attempts: [{ result: 6400 }, { result: 6500 }, { result: 6600 }],
    ranking: 2,
  }),

  // 3x3x3 + OH + BLD Team Relay (competition results)
  // 2020 results
  getContestResult(testCompJan2020_333_oh_bld_team_relay_r1, {
    personIds: [jpPersonSatoshiNakamura.id, krPersonSooMinNam.id, dePersonHansBauer.id],
    attempts: [{ result: 6000 }, { result: 6100 }, { result: 6200 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
    ranking: 1,
  }),
  getContestResult(testCompFeb2020_333_oh_bld_team_relay_r1, {
    personIds: [gbPersonSamMarsh.id, dePersonHansBauer.id, dePersonJakobBach.id],
    superRegionCode: "EUROPE",
    attempts: [{ result: 6500 }, { result: 6600 }, { result: 6700 }],
    regionalSingleRecord: "ER",
    regionalAverageRecord: "ER",
    ranking: 1,
  }),
  getContestResult(testCompMar2020_333_oh_bld_team_relay_r1, {
    personIds: [gbPersonSamMarsh.id, gbPersonTomDillon.id, gbPersonJamesStone.id],
    regionCode: "GB",
    superRegionCode: "EUROPE",
    attempts: [{ result: 6800 }, { result: 6900 }, { result: 7000 }],
    regionalSingleRecord: "NR",
    regionalAverageRecord: "NR",
    ranking: 1,
  }),
  // 3x3x3 + OH + BLD Team Relay (competition results)
  // 2025 results
  getContestResult(testCompJan2025_333_oh_bld_team_relay_r1, {
    personIds: [dePersonStefanSteinmeier.id, gbPersonTomDillon.id, gbPersonJamesStone.id],
    superRegionCode: "EUROPE",
    attempts: [{ result: 6400 }, { result: 6500 }, { result: 6600 }],
    regionalSingleRecord: "ER",
    regionalAverageRecord: "ER",
    ranking: 1,
    proceeds: true,
  }),
  getContestResult(testCompJan2025_333_oh_bld_team_relay_r1, {
    personIds: [gbPersonSamMarsh.id, gbPersonTomDillon.id, gbPersonJamesStone.id],
    regionCode: "GB",
    superRegionCode: "EUROPE",
    attempts: [{ result: 6700 }, { result: 6800 }, { result: 6900 }],
    regionalSingleRecord: "NR",
    regionalAverageRecord: "NR",
    ranking: 2,
    proceeds: false,
  }),
  getContestResult(testCompFeb2025_333_oh_bld_team_relay_r1, {
    personIds: [jpPersonNaokoYoshida.id, krPersonDongJunHyon.id, usPersonJohnDoe.id],
    attempts: [{ result: 5900 }, { result: 6000 }, { result: 6100 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
    ranking: 1,
  }),
  getContestResult(testCompFeb2025_333_oh_bld_team_relay_r1, {
    personIds: [gbPersonSamMarsh.id, gbPersonTomDillon.id, gbPersonJamesStone.id],
    regionCode: "GB",
    superRegionCode: "EUROPE",
    attempts: [{ result: 6300 }, { result: 6400 }, { result: 6500 }],
    regionalSingleRecord: "ER",
    regionalAverageRecord: "ER",
    ranking: 2,
  }),
  getContestResult(testCompMar2025_333_oh_bld_team_relay_r1, {
    personIds: [gbPersonJamesStone.id, dePersonHansBauer.id, gbPersonTomDillon.id],
    superRegionCode: "EUROPE",
    attempts: [{ result: 5800 }, { result: 5900 }, { result: 6000 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
    ranking: 1,
  }),
  getContestResult(testCompApr2025_333_oh_bld_team_relay_r1, {
    personIds: [gbPersonJamesStone.id, gbPersonSamMarsh.id, gbPersonTomDillon.id],
    regionCode: "GB",
    superRegionCode: "EUROPE",
    attempts: [{ result: 5700 }, { result: 5800 }, { result: 5900 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
    ranking: 1,
  }),

  ...generateRandom444bfResults(),

  // 4x4x4 Blindfolded (video-based)
  // 2020 results
  getVideoBasedResult({
    eventId: "444bf",
    date: new Date(2020, 0, 1), // January 1st
    personIds: [usPersonJohnDoe.id],
    regionCode: "US",
    superRegionCode: "NORTH_AMERICA",
    attempts: [{ result: 9000 }, { result: 9100 }, { result: 9200 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
  }),
  getVideoBasedResult({
    eventId: "444bf",
    date: new Date(2020, 1, 1), // February 1st
    personIds: [caPersonJoshCalhoun.id],
    regionCode: "CA",
    superRegionCode: "NORTH_AMERICA",
    attempts: [{ result: 8500 }, { result: 8600 }, { result: 8700 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
  }),
  getVideoBasedResult({
    eventId: "444bf",
    date: new Date(2020, 2, 1), // March 1st
    personIds: [gbPersonTomDillon.id],
    regionCode: "GB",
    superRegionCode: "EUROPE",
    attempts: [{ result: 6500 }, { result: 6600 }, { result: 6700 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
  }),
  getVideoBasedResult({
    eventId: "444bf",
    date: new Date(2020, 3, 1), // April 1st
    personIds: [krPersonDongJunHyon.id],
    regionCode: "KR",
    superRegionCode: "ASIA",
    attempts: [{ result: 8000 }, { result: 8100 }, { result: 8200 }],
    regionalSingleRecord: "AsR",
    regionalAverageRecord: "AsR",
  }),
  getVideoBasedResult({
    eventId: "444bf",
    date: new Date(2020, 4, 1), // May 1st
    personIds: [jpPersonNaokoYoshida.id],
    regionCode: "JP",
    superRegionCode: "ASIA",
    attempts: [{ result: 7000 }, { result: 7100 }, { result: 7200 }],
    regionalSingleRecord: "AsR",
    regionalAverageRecord: "AsR",
  }),
  getVideoBasedResult({
    eventId: "444bf",
    date: new Date(2020, 5, 1), // June 1st
    personIds: [dePersonHansBauer.id],
    regionCode: "DE",
    superRegionCode: "EUROPE",
    attempts: [{ result: 7500 }, { result: 7600 }, { result: 7700 }],
    regionalSingleRecord: "NR",
    regionalAverageRecord: "NR",
  }),
  // 4x4x4 Blindfolded (video-based)
  // 2025 results
  getVideoBasedResult({
    eventId: "444bf",
    date: new Date(2025, 0, 1), // January 1st
    personIds: [usPersonJohnDoe.id],
    regionCode: "US",
    superRegionCode: "NORTH_AMERICA",
    attempts: [{ result: 8900 }, { result: 9000 }, { result: 9100 }],
    regionalSingleRecord: "NR",
    regionalAverageRecord: "NR",
  }),
  getVideoBasedResult({
    eventId: "444bf",
    date: new Date(2025, 1, 1), // February 1st
    personIds: [caPersonJoshCalhoun.id],
    regionCode: "CA",
    superRegionCode: "NORTH_AMERICA",
    attempts: [{ result: 8400 }, { result: 8500 }, { result: 8600 }],
    regionalSingleRecord: "NAR",
    regionalAverageRecord: "NAR",
  }),
  getVideoBasedResult({
    eventId: "444bf",
    date: new Date(2025, 2, 1), // March 1st
    personIds: [krPersonDongJunHyon.id],
    regionCode: "KR",
    superRegionCode: "ASIA",
    attempts: [{ result: 6900 }, { result: 7000 }, { result: 7100 }],
    regionalSingleRecord: "AsR",
    regionalAverageRecord: "AsR",
  }),
  getVideoBasedResult({
    eventId: "444bf",
    date: new Date(2025, 3, 1), // April 1st
    personIds: [dePersonJakobBach.id],
    regionCode: "DE",
    superRegionCode: "EUROPE",
    attempts: [{ result: 6400 }, { result: 6500 }, { result: 6600 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
  }),
  getVideoBasedResult({
    eventId: "444bf",
    date: new Date(2025, 4, 1), // May 1st
    personIds: [jpPersonNaokoYoshida.id],
    regionCode: "JP",
    superRegionCode: "ASIA",
    attempts: [{ result: 6000 }, { result: 6100 }, { result: 6200 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
  }),
  getVideoBasedResult({
    eventId: "444bf",
    date: new Date(2025, 5, 1), // June 1st
    personIds: [gbPersonSamMarsh.id],
    regionCode: "GB",
    superRegionCode: "EUROPE",
    attempts: [{ result: 5500 }, { result: 5600 }, { result: 5700 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
  }),

  // Other results
  {
    // Real result from Cubing Contests
    eventId: "333",
    date: new Date(2023, 5, 30), // June 30th, 2023
    personIds: [9], // Oliver Fritz
    regionCode: "DE",
    superRegionCode: "EUROPE",
    attempts: [{ result: 876 }, { result: 989 }, { result: 812 }, { result: 711 }, { result: 686 }],
    best: 686,
    average: 800,
    recordCategory: "meetups",
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
    competitionId: "Munich30062023",
    roundId: 1, // irrelevant
    ranking: 1,
  },
  getContestResult(testComp2023_222_r1, {
    personIds: [1],
    regionCode: "IRRELEVANT",
    attempts: [{ result: 100 }, { result: 101 }, { result: 102 }],
    regionalSingleRecord: "WR",
    ranking: 1,
  }),
  getContestResult(testComp2023_333bf_r1, {
    personIds: [1],
    regionCode: "IRRELEVANT",
    attempts: [{ result: -1 }, { result: 2000 }, { result: -1 }],
    regionalSingleRecord: "WR",
    ranking: 1,
  }),
  getContestResult(testMeetupJan2020_444bf_r1, {
    personIds: [1],
    regionCode: "IRRELEVANT",
    attempts: [{ result: 7000 }, { result: 7100 }, { result: 7200 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
    ranking: 1,
  }),
  getContestResult(testComp2023_444bf_r1, {
    personIds: [1],
    regionCode: "IRRELEVANT",
    attempts: [{ result: 7500 }, { result: 7600 }, { result: 7700 }],
    regionalSingleRecord: "WR",
    regionalAverageRecord: "WR",
    ranking: 1,
  }),
];
