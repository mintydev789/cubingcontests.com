import { addYears } from "date-fns";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  caPersonJoshCalhoun,
  dePersonHansBauer,
  dePersonJakobBach,
  dePersonStefanSteinmeier,
  gbPersonJamesStone,
  gbPersonSamMarsh,
  gbPersonTomDillon,
  krPersonDongJunHyon,
  krPersonSooMinNam,
  usPersonJohnDoe,
} from "~/__mocks__/stubs/personsStub.ts";
import { resultsStub } from "~/__mocks__/stubs/resultsStub.ts";
import {
  testComp2026_333_oh_bld_team_relay_r1,
  testComp2026_333_r1,
  testCompJan2023_333_oh_bld_team_relay_r1,
  testCompJan2028_333_oh_bld_team_relay_r1,
  testCompJan2028_333_oh_bld_team_relay_r2,
  testMeetupFeb2023_333bf_2_person_relay_r1,
  testMeetupMar2023_333bf_2_person_relay_r1,
} from "~/__mocks__/stubs/roundsStub.ts";
import { getFormattedTime } from "~/helpers/utilityFunctions.ts";
import { db } from "~/server/db/provider.ts";
import {
  createContestResultSF,
  createVideoBasedResultSF,
  deleteContestResultSF,
  getWrPairUpToDateSF,
  updateContestResultSF,
} from "~/server/serverFunctions/resultServerFunctions.ts";
import { reseedTestData } from "~/vitest-setup";

const date = new Date(2026, 0, 1);

describe("getWrPairUpToDateSF", () => {
  beforeAll(reseedTestData);

  it("gets WR pair up to date", async () => {
    const res = await getWrPairUpToDateSF({
      eventId: "444bf",
      recordCategory: "video-based-results",
      recordsUpTo: date,
    });

    expect(res.serverError).toBeUndefined();
    expect(res.validationErrors).toBeUndefined();
    expect(res.data).toBeDefined();
    expect(res.data!.eventId).toBe("444bf");
    expect(res.data!.best).toBe(6500);
    expect(res.data!.average).toBe(6600);
  });

  it("ignores better results from other categories while getting XWR pair", async () => {
    const res = await getWrPairUpToDateSF({ eventId: "444bf", recordCategory: "competitions", recordsUpTo: date });

    expect(res.data).toBeDefined();
    expect(res.data!.eventId).toBe("444bf");
    expect(res.data!.best).toBe(7500);
    expect(res.data!.average).toBe(7600);
  });

  it("ignores better results from other categories while getting MWR pair", async () => {
    const res = await getWrPairUpToDateSF({ eventId: "444bf", recordCategory: "meetups", recordsUpTo: date });

    expect(res.data).toBeDefined();
    expect(res.data!.eventId).toBe("444bf");
    expect(res.data!.best).toBeGreaterThanOrEqual(7000);
    expect(res.data!.average).toBeGreaterThanOrEqual(7100);
  });

  it("doesn't get WR single or average if there are no successful results for the event yet", async () => {
    const res = await getWrPairUpToDateSF({
      eventId: "555bf",
      recordCategory: "video-based-results",
      recordsUpTo: date,
    });

    expect(res.data).toBeDefined();
    expect(res.data!.eventId).toBe("555bf");
    expect(res.data!.best).toBeUndefined();
    expect(res.data!.average).toBeUndefined();
  });

  it("doesn't get WR average if there are no successful averages for the event yet (also checks that records set on the same day get included)", async () => {
    const res = await getWrPairUpToDateSF({ eventId: "333bf", recordCategory: "competitions", recordsUpTo: date });

    expect(res.data).toBeDefined();
    expect(res.data!.eventId).toBe("333bf");
    expect(res.data!.best).toBe(2000);
    expect(res.data!.average).toBeUndefined();
  });

  it("excludes result", async () => {
    const res = await getWrPairUpToDateSF({
      eventId: "333bf",
      recordCategory: "competitions",
      recordsUpTo: date,
      // Assumes the results stub only has one 3x3x3 Blindfolded result
      excludeResultId: resultsStub.findIndex((r) => r.eventId === "333bf")! + 1,
    });

    expect(res.data).toBeDefined();
    expect(res.data!.eventId).toBe("333bf");
    expect(res.data!.best).toBeUndefined();
    expect(res.data!.average).toBeUndefined();
  });
});

describe("createContestResultSF", () => {
  beforeEach(reseedTestData);

  it("creates non-record result", async () => {
    const res = await createContestResultSF({
      newResultDto: {
        eventId: "333_oh_bld_team_relay",
        personIds: [gbPersonTomDillon.id, gbPersonSamMarsh.id, gbPersonJamesStone.id],
        attempts: [{ result: 10000 }, { result: 10100 }, { result: 10200 }],
        competitionId: testComp2026_333_oh_bld_team_relay_r1.competitionId,
        roundId: testComp2026_333_oh_bld_team_relay_r1.id,
      },
    });

    expect(res.serverError).toBeUndefined();
    expect(res.validationErrors).toBeUndefined();
    expect(res.data?.length).toBe(1);
    expect(res.data![0]).toBeDefined();
    expect(res.data![0].regionCode).toBe("GB");
    expect(res.data![0].superRegionCode).toBe("EUROPE");
    expect(res.data![0].best).toBe(10000);
    expect(res.data![0].average).toBe(10100);
    expect(res.data![0].date.getTime()).toBe(new Date(2026, 0, 1).getTime());
    expect(res.data![0].regionalSingleRecord).toBeNull();
    expect(res.data![0].regionalAverageRecord).toBeNull();
  });

  it("creates non-record result that doesn't make cutoff", async () => {
    const firstAttempt = testComp2026_333_oh_bld_team_relay_r1.cutoffAttemptResult! + 1;
    const res = await createContestResultSF({
      newResultDto: {
        eventId: "333_oh_bld_team_relay",
        personIds: [gbPersonTomDillon.id, gbPersonSamMarsh.id, gbPersonJamesStone.id],
        attempts: [{ result: firstAttempt }, { result: 0 }, { result: 0 }],
        competitionId: testComp2026_333_oh_bld_team_relay_r1.competitionId,
        roundId: testComp2026_333_oh_bld_team_relay_r1.id,
      },
    });

    expect(res.serverError).toBeUndefined();
    expect(res.validationErrors).toBeUndefined();
    expect(res.data?.length).toBe(1);
    expect(res.data![0].best).toBe(firstAttempt);
    expect(res.data![0].average).toBe(0);
  });

  describe("validation errors", async () => {
    it("throws validation error for the same person being entered twice", async () => {
      const res = await createContestResultSF({
        newResultDto: {
          eventId: "333_oh_bld_team_relay",
          personIds: [1, 2, 1],
          attempts: [{ result: 1234 }],
          competitionId: testCompJan2023_333_oh_bld_team_relay_r1.competitionId,
          roundId: testCompJan2023_333_oh_bld_team_relay_r1.id,
        },
      });

      expect(res.serverError).toBeUndefined();
      expect((res.validationErrors?.newResultDto?.personIds as any)._errors?.[0]).toBe(
        "You cannot enter the same person twice in the same result",
      );
      expect(res.data).toBeUndefined();
    });

    it("throws validation error for all attempts being empty", async () => {
      const res = await createContestResultSF({
        newResultDto: {
          eventId: "333_oh_bld_team_relay",
          personIds: [1, 2, 3],
          attempts: [{ result: 0 }, { result: 0 }, { result: 0 }],
          competitionId: testCompJan2023_333_oh_bld_team_relay_r1.competitionId,
          roundId: testCompJan2023_333_oh_bld_team_relay_r1.id,
        },
      });

      expect(res.serverError).toBeUndefined();
      expect((res.validationErrors?.newResultDto?.attempts as any)._errors?.[0]).toBe(
        "You cannot submit only DNS attempts or only empty attempts",
      );
      expect(res.data).toBeUndefined();
    });

    it("throws validation error for all attempts being DNS", async () => {
      const res = await createContestResultSF({
        newResultDto: {
          eventId: "333_oh_bld_team_relay",
          personIds: [1, 2, 3],
          attempts: [{ result: -2 }, { result: -2 }, { result: -2 }],
          competitionId: testCompJan2023_333_oh_bld_team_relay_r1.competitionId,
          roundId: testCompJan2023_333_oh_bld_team_relay_r1.id,
        },
      });

      expect(res.serverError).toBeUndefined();
      expect((res.validationErrors?.newResultDto?.attempts as any)._errors?.[0]).toBe(
        "You cannot submit only DNS attempts or only empty attempts",
      );
      expect(res.data).toBeUndefined();
    });
  });

  describe("server errors", async () => {
    it("throws error for contest not found", async () => {
      const competitionId = "INVALID";
      const res = await createContestResultSF({
        newResultDto: {
          eventId: "333_oh_bld_team_relay",
          personIds: [1, 2, 3],
          attempts: [{ result: 10000 }, { result: 10100 }, { result: 10200 }],
          competitionId,
          roundId: testComp2026_333_oh_bld_team_relay_r1.id,
        },
      });

      expect(res.serverError?.message).toBe(`Contest with ID ${competitionId} not found`);
      expect(res.data).toBeUndefined();
    });

    it("throws error for no access rights to contest", async () => {
      vi.stubEnv("TEST_USER", "mod");

      const res = await createContestResultSF({
        newResultDto: {
          eventId: "333_oh_bld_team_relay",
          personIds: [1, 2, 3],
          attempts: [{ result: 10000 }, { result: 10100 }, { result: 10200 }],
          competitionId: testComp2026_333_oh_bld_team_relay_r1.competitionId,
          roundId: testComp2026_333_oh_bld_team_relay_r1.id,
        },
      });

      expect(res.serverError?.message).toBe("You do not have access rights for this contest");
      expect(res.data).toBeUndefined();
    });

    it("throws error for invalid event ID", async () => {
      const eventId = "INVALID";
      const res = await createContestResultSF({
        newResultDto: {
          eventId,
          personIds: [1],
          attempts: [{ result: 10000 }, { result: 10100 }, { result: 10200 }],
          competitionId: testComp2026_333_oh_bld_team_relay_r1.competitionId,
          roundId: testComp2026_333_oh_bld_team_relay_r1.id,
        },
      });

      expect(res.serverError?.message).toBe(`Event with ID ${eventId} not found`);
      expect(res.data).toBeUndefined();
    });

    it("throws error for invalid round ID", async () => {
      const roundId = 0;
      const res = await createContestResultSF({
        newResultDto: {
          eventId: "333_oh_bld_team_relay",
          personIds: [1, 2, 3],
          attempts: [{ result: 10000 }, { result: 10100 }, { result: 10200 }],
          competitionId: "TestComp2026",
          roundId,
        },
      });

      expect(res.serverError?.message).toBe(`Round with ID ${roundId} not found`);
      expect(res.data).toBeUndefined();
    });

    it("throws error for invalid person ID", async () => {
      const personId = 999999;
      const res = await createContestResultSF({
        newResultDto: {
          eventId: "333_oh_bld_team_relay",
          personIds: [1, 2, personId],
          attempts: [{ result: 10000 }, { result: 10100 }, { result: 10200 }],
          competitionId: testComp2026_333_oh_bld_team_relay_r1.competitionId,
          roundId: testComp2026_333_oh_bld_team_relay_r1.id,
        },
      });

      expect(res.serverError?.message).toBe(`Person with ID ${personId} not found`);
      expect(res.data).toBeUndefined();
    });

    it("throws error for wrong number of participants (too few)", async () => {
      const res = await createContestResultSF({
        newResultDto: {
          eventId: "333_oh_bld_team_relay",
          personIds: [1, 2],
          attempts: [{ result: 10000 }, { result: 10100 }, { result: 10200 }],
          competitionId: testComp2026_333_oh_bld_team_relay_r1.competitionId,
          roundId: testComp2026_333_oh_bld_team_relay_r1.id,
        },
      });

      expect(res.serverError?.message).toBe("This event must have 3 participants");
      expect(res.data).toBeUndefined();
    });

    it("throws error for second result in the same round for the same competitor", async () => {
      const resultFrom_333_oh_bld_team_relay_Round = await db.query.results.findFirst({
        where: { eventId: "333_oh_bld_team_relay", roundId: testCompJan2023_333_oh_bld_team_relay_r1.id },
      });
      const res = await createContestResultSF({
        newResultDto: {
          eventId: "333_oh_bld_team_relay",
          personIds: resultFrom_333_oh_bld_team_relay_Round!.personIds,
          attempts: [{ result: 10000 }, { result: 10100 }, { result: 10200 }],
          competitionId: resultFrom_333_oh_bld_team_relay_Round!.competitionId!,
          roundId: resultFrom_333_oh_bld_team_relay_Round!.roundId!,
        },
      });

      expect(res.serverError?.message).toBe("The competitor(s) already has a result in this round");
      expect(res.data).toBeUndefined();
    });

    it("throws error for one of the competitors not proceeding to subsequent round", async () => {
      const resultFrom_333_oh_bld_team_relay_FirstRound = await db.query.results.findFirst({
        where: {
          eventId: "333_oh_bld_team_relay",
          roundId: testCompJan2028_333_oh_bld_team_relay_r1.id,
          proceeds: false,
        },
      });
      const res = await createContestResultSF({
        newResultDto: {
          eventId: "333_oh_bld_team_relay",
          personIds: resultFrom_333_oh_bld_team_relay_FirstRound!.personIds,
          attempts: [{ result: 10000 }, { result: 10100 }, { result: 10200 }],
          competitionId: testCompJan2028_333_oh_bld_team_relay_r2.competitionId,
          roundId: testCompJan2028_333_oh_bld_team_relay_r2.id,
        },
      });

      expect(res.serverError?.message).toBe("Competitor 1 has not proceeded to this round");
      expect(res.data).toBeUndefined();
    });

    it("throws error for result having too few attempts", async () => {
      const res = await createContestResultSF({
        newResultDto: {
          eventId: "333_oh_bld_team_relay",
          personIds: [1, 2, 3],
          attempts: [{ result: 10000 }],
          competitionId: testComp2026_333_oh_bld_team_relay_r1.competitionId,
          roundId: testComp2026_333_oh_bld_team_relay_r1.id,
        },
      });

      expect(res.serverError?.message).toBe("The number of attempts should be 3; received: 1");
      expect(res.data).toBeUndefined();
    });

    it("throws error for result not meeting the time limit", async () => {
      const { id: roundId, timeLimitCentiseconds: timeLimit } = testComp2026_333_oh_bld_team_relay_r1;
      const res = await createContestResultSF({
        newResultDto: {
          eventId: "333_oh_bld_team_relay",
          personIds: [1, 2, 3],
          attempts: [{ result: timeLimit! + 1 }, { result: 1234 }, { result: 1234 }],
          competitionId: "TestComp2026",
          roundId,
        },
      });

      expect(res.serverError?.message).toBe(`This round has a time limit of ${getFormattedTime(timeLimit!)}`);
      expect(res.data).toBeUndefined();
    });

    it("throws error for result not meeting the cumulative time limit", async () => {
      const { id: roundId, timeLimitCentiseconds: timeLimit } = testComp2026_333_oh_bld_team_relay_r1;
      const res = await createContestResultSF({
        newResultDto: {
          eventId: "333_oh_bld_team_relay",
          personIds: [1, 2, 3],
          // First result just barely passes the time limit, but the second one pushes it over the cumulative limit
          attempts: [{ result: timeLimit! }, { result: 1234 }, { result: 1234 }],
          competitionId: "TestComp2026",
          roundId,
        },
      });

      expect(res.serverError?.message).toBe(
        `This round has a cumulative time limit of ${getFormattedTime(timeLimit!)}`,
      );
      expect(res.data).toBeUndefined();
    });

    it("throws error for result that doesn't meet cutoff having too many attempts", async () => {
      const { id: roundId, cutoffAttemptResult } = testComp2026_333_oh_bld_team_relay_r1;
      const res = await createContestResultSF({
        newResultDto: {
          eventId: "333_oh_bld_team_relay",
          personIds: [1, 2, 3],
          attempts: [{ result: cutoffAttemptResult! + 1 }, { result: 1234 }, { result: 1234 }],
          competitionId: "TestComp2026",
          roundId,
        },
      });

      expect(res.serverError?.message).toBe(`This round has a cutoff of ${getFormattedTime(cutoffAttemptResult!)}`);
      expect(res.data).toBeUndefined();
    });

    it("throws error for result that doesn't meet cutoff having too few attempts", async () => {
      const { id: roundId, cutoffAttemptResult, cutoffNumberOfAttempts } = testComp2026_333_r1;
      const res = await createContestResultSF({
        newResultDto: {
          eventId: "333",
          personIds: [1],
          attempts: [{ result: cutoffAttemptResult! + 1 }],
          competitionId: "TestComp2026",
          roundId,
        },
      });

      expect(res.serverError?.message).toBe(`The number of attempts should be ${cutoffNumberOfAttempts}; received: 1`);
      expect(res.data).toBeUndefined();
    });
  });

  describe("Record result creation", async () => {
    describe("3x3x3 + OH + BLD Team Relay results", async () => {
      const eventId = "333_oh_bld_team_relay";
      const partialResult = {
        eventId,
        competitionId: testComp2026_333_oh_bld_team_relay_r1.competitionId,
        roundId: testComp2026_333_oh_bld_team_relay_r1.id,
      };

      it("creates NR result and cancels future NR", async () => {
        const res = await createContestResultSF({
          newResultDto: {
            ...partialResult,
            personIds: [gbPersonJamesStone.id, gbPersonSamMarsh.id, gbPersonTomDillon.id],
            attempts: [{ result: 6600 }, { result: 6700 }, { result: 6800 }],
          },
        });

        expect(res.data?.length).toBe(1);
        expect(res.data![0].regionCode).toBe("GB");
        expect(res.data![0].regionalSingleRecord).toBe("NR");
        expect(res.data![0].regionalAverageRecord).toBe("NR");

        const cancelledNr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 0, 1) }, ranking: 2 },
        });
        expect(cancelledNr?.regionalSingleRecord).toBeNull();
        expect(cancelledNr?.regionalAverageRecord).toBeNull();
      });

      it("creates CR result and cancels future NR and CR", async () => {
        const res = await createContestResultSF({
          newResultDto: {
            ...partialResult,
            personIds: [gbPersonJamesStone.id, gbPersonSamMarsh.id, gbPersonTomDillon.id],
            attempts: [{ result: 6200 }, { result: 6300 }, { result: 6400 }],
          },
        });

        expect(res.data?.length).toBe(1);
        expect(res.data![0].regionCode).toBe("GB");
        expect(res.data![0].superRegionCode).toBe("EUROPE");
        expect(res.data![0].regionalSingleRecord).toBe("ER");
        expect(res.data![0].regionalAverageRecord).toBe("ER");

        const cancelledCrWithNoRegion = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 0, 1) }, ranking: 1 },
        });
        expect(cancelledCrWithNoRegion?.regionalSingleRecord).toBeNull();
        expect(cancelledCrWithNoRegion?.regionalAverageRecord).toBeNull();
        const cancelledNr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 0, 1) }, ranking: 2 },
        });
        expect(cancelledNr?.regionalSingleRecord).toBeNull();
        expect(cancelledNr?.regionalAverageRecord).toBeNull();
        const cancelledCr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 1, 1) }, ranking: 2 },
        });
        expect(cancelledCr?.regionalSingleRecord).toBeNull();
        expect(cancelledCr?.regionalAverageRecord).toBeNull();
      });

      it("creates CR result (no reg. code), cancels future CR (no reg. code) and changes future CR to NR", async () => {
        const res = await createContestResultSF({
          newResultDto: {
            ...partialResult,
            personIds: [dePersonStefanSteinmeier.id, gbPersonSamMarsh.id, gbPersonTomDillon.id],
            attempts: [{ result: 6200 }, { result: 6300 }, { result: 6400 }],
          },
        });

        expect(res.data?.length).toBe(1);
        expect(res.data![0].regionCode).toBeNull();
        expect(res.data![0].superRegionCode).toBe("EUROPE");
        expect(res.data![0].regionalSingleRecord).toBe("ER");
        expect(res.data![0].regionalAverageRecord).toBe("ER");

        const cancelledCr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 0, 1) }, ranking: 1 },
        });
        expect(cancelledCr?.regionalSingleRecord).toBeNull();
        expect(cancelledCr?.regionalAverageRecord).toBeNull();
        const notCancelledNr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 0, 1) }, ranking: 2 },
        });
        expect(notCancelledNr?.regionalSingleRecord).toBe("NR");
        expect(notCancelledNr?.regionalAverageRecord).toBe("NR");
        const crChangedToNr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 1, 1) }, ranking: 2 },
        });
        expect(crChangedToNr?.regionalSingleRecord).toBe("NR");
        expect(crChangedToNr?.regionalAverageRecord).toBe("NR");
      });

      it("creates WR result, cancels future WR, WR (no reg. code) and WR (no s-reg. code)", async () => {
        const res = await createContestResultSF({
          newResultDto: {
            ...partialResult,
            personIds: [gbPersonJamesStone.id, gbPersonSamMarsh.id, gbPersonTomDillon.id],
            attempts: [{ result: 5500 }, { result: 5600 }, { result: 5700 }],
          },
        });

        expect(res.data?.length).toBe(1);
        expect(res.data![0].regionCode).toBe("GB");
        expect(res.data![0].superRegionCode).toBe("EUROPE");
        expect(res.data![0].regionalSingleRecord).toBe("WR");
        expect(res.data![0].regionalAverageRecord).toBe("WR");

        const cancelledCr1 = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 0, 1) }, ranking: 1 },
        });
        expect(cancelledCr1?.regionalSingleRecord).toBeNull();
        expect(cancelledCr1?.regionalAverageRecord).toBeNull();
        const cancelledNr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 0, 1) }, ranking: 2 },
        });
        expect(cancelledNr?.regionalSingleRecord).toBeNull();
        expect(cancelledNr?.regionalAverageRecord).toBeNull();
        const cancelledWr1 = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 1, 1) }, ranking: 1 },
        });
        expect(cancelledWr1?.regionalSingleRecord).toBeNull();
        expect(cancelledWr1?.regionalAverageRecord).toBeNull();
        const cancelledCr2 = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 1, 1) }, ranking: 2 },
        });
        expect(cancelledCr2?.regionalSingleRecord).toBeNull();
        expect(cancelledCr2?.regionalAverageRecord).toBeNull();
        const cancelledWr2 = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 2, 1) } },
        });
        expect(cancelledWr2?.regionalSingleRecord).toBeNull();
        expect(cancelledWr2?.regionalAverageRecord).toBeNull();
        const cancelledWr3 = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 3, 1) } },
        });
        expect(cancelledWr3?.regionalSingleRecord).toBeNull();
        expect(cancelledWr3?.regionalAverageRecord).toBeNull();
      });

      it("creates WR result (no reg. code), cancels future WR (no reg. code) and changes future WR to NR", async () => {
        const res = await createContestResultSF({
          newResultDto: {
            ...partialResult,
            personIds: [dePersonStefanSteinmeier.id, gbPersonSamMarsh.id, gbPersonTomDillon.id],
            attempts: [{ result: 5500 }, { result: 5600 }, { result: 5700 }],
          },
        });

        expect(res.data?.length).toBe(1);
        expect(res.data![0].regionCode).toBeNull();
        expect(res.data![0].superRegionCode).toBe("EUROPE");
        expect(res.data![0].regionalSingleRecord).toBe("WR");
        expect(res.data![0].regionalAverageRecord).toBe("WR");

        const cancelledCr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 0, 1) }, ranking: 1 },
        });
        expect(cancelledCr?.regionalSingleRecord).toBeNull();
        expect(cancelledCr?.regionalAverageRecord).toBeNull();
        const cancelledWr1 = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 1, 1) }, ranking: 1 },
        });
        expect(cancelledWr1?.regionalSingleRecord).toBeNull();
        expect(cancelledWr1?.regionalAverageRecord).toBeNull();
        const crChangedToNr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 1, 1) }, ranking: 2 },
        });
        expect(crChangedToNr?.regionalSingleRecord).toBe("NR");
        expect(crChangedToNr?.regionalAverageRecord).toBe("NR");
        const cancelledWr2 = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 2, 1) } },
        });
        expect(cancelledWr2?.regionalSingleRecord).toBeNull();
        expect(cancelledWr2?.regionalAverageRecord).toBeNull();
        const wrChangedToNr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 3, 1) } },
        });
        expect(wrChangedToNr?.regionalSingleRecord).toBe("NR");
        expect(wrChangedToNr?.regionalAverageRecord).toBe("NR");
      });

      it("creates WR result (no s-reg. code), changes future WR to CR", async () => {
        const res = await createContestResultSF({
          newResultDto: {
            ...partialResult,
            personIds: [dePersonStefanSteinmeier.id, gbPersonSamMarsh.id, caPersonJoshCalhoun.id],
            attempts: [{ result: 5500 }, { result: 5600 }, { result: 5700 }],
          },
        });

        expect(res.data?.length).toBe(1);
        expect(res.data![0].regionCode).toBeNull();
        expect(res.data![0].superRegionCode).toBeNull();
        expect(res.data![0].regionalSingleRecord).toBe("WR");
        expect(res.data![0].regionalAverageRecord).toBe("WR");

        const cancelledWr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 1, 1) }, ranking: 1 },
        });
        expect(cancelledWr?.regionalSingleRecord).toBeNull();
        expect(cancelledWr?.regionalAverageRecord).toBeNull();
        const notCancelledCr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 1, 1) }, ranking: 2 },
        });
        expect(notCancelledCr?.regionalSingleRecord).toBe("ER");
        expect(notCancelledCr?.regionalAverageRecord).toBe("ER");
        const wrChangedToCr1 = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 2, 1) } },
        });
        expect(wrChangedToCr1?.regionalSingleRecord).toBe("ER");
        expect(wrChangedToCr1?.regionalAverageRecord).toBe("ER");
        const wrChangedToCr2 = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 3, 1) } },
        });
        expect(wrChangedToCr2?.regionalSingleRecord).toBe("ER");
        expect(wrChangedToCr2?.regionalAverageRecord).toBe("ER");
      });
    });
  });
});

describe("updateContestResultSF", () => {
  beforeEach(reseedTestData);

  it("updates non-record result", async () => {
    const res = await updateContestResultSF({
      id: 4,
      newAttempts: [{ result: 8801 }, { result: 8901 }, { result: 9001 }],
    });

    expect(res.serverError).toBeUndefined();
    expect(res.validationErrors).toBeUndefined();
    expect(res.data?.length).toBe(2);
    expect(res.data![0]).toBeDefined();
    expect(res.data![0].regionCode).toBeNull();
    expect(res.data![0].superRegionCode).toBeNull();
    expect(res.data![0].best).toBe(8801);
    expect(res.data![0].average).toBe(8901);
    expect(res.data![0].regionalSingleRecord).toBeNull();
    expect(res.data![0].regionalAverageRecord).toBeNull();
  });

  describe("server errors", async () => {
    it("throws error for result having too few attempts", async () => {
      const res = await updateContestResultSF({ id: 4, newAttempts: [{ result: 10000 }] });

      expect(res.serverError?.message).toBe("The number of attempts should be 3; received: 1");
      expect(res.data).toBeUndefined();
    });

    it("throws error for result not meeting the time limit", async () => {
      const { timeLimitCentiseconds: timeLimit } = testMeetupMar2023_333bf_2_person_relay_r1;
      const res = await updateContestResultSF({
        id: 4,
        newAttempts: [{ result: timeLimit! + 1 }, { result: 1234 }, { result: 1234 }],
      });

      expect(res.serverError?.message).toBe(`This round has a time limit of ${getFormattedTime(timeLimit!)}`);
      expect(res.data).toBeUndefined();
    });

    it("throws error for result not meeting the cumulative time limit", async () => {
      const { timeLimitCentiseconds: timeLimit } = testMeetupMar2023_333bf_2_person_relay_r1;
      const res = await updateContestResultSF({
        id: 4,
        // First result just barely passes the time limit, but the second one pushes it over the cumulative limit
        newAttempts: [{ result: timeLimit! }, { result: 1234 }, { result: 1234 }],
      });

      expect(res.serverError?.message).toBe(
        `This round has a cumulative time limit of ${getFormattedTime(timeLimit!)}`,
      );
      expect(res.data).toBeUndefined();
    });

    it("throws error for result that doesn't meet cutoff having too many attempts", async () => {
      const { cutoffAttemptResult } = testMeetupFeb2023_333bf_2_person_relay_r1;
      const res = await updateContestResultSF({
        id: 3,
        newAttempts: [{ result: cutoffAttemptResult! + 1 }, { result: 1234 }, { result: 1234 }],
      });

      expect(res.serverError?.message).toBe(`This round has a cutoff of ${getFormattedTime(cutoffAttemptResult!)}`);
      expect(res.data).toBeUndefined();
    });
  });
});

describe("deleteContestResultSF", () => {
  beforeEach(reseedTestData);

  it("deletes non-record result", async () => {
    const nonRecordResult = await db.query.results.findFirst({
      where: {
        recordCategory: "meetups",
        regionalSingleRecord: { isNull: true },
        regionalAverageRecord: { isNull: true },
      },
    });
    const res = await deleteContestResultSF({ id: nonRecordResult!.id });

    expect(res.serverError).toBeUndefined();
    expect(res.validationErrors).toBeUndefined();
    expect(res.data).toBeDefined();
  });

  describe("server errors", async () => {
    it("throws error for invalid result ID", async () => {
      const id = 0;
      const res = await deleteContestResultSF({ id });

      expect(res.serverError?.message).toBe(`Result with ID ${id} not found`);
      expect(res.data).toBeUndefined();
    });

    it("throws error for non-contest result", async () => {
      const videoBasedResult = await db.query.results.findFirst({ where: { recordCategory: "video-based-results" } });
      const res = await deleteContestResultSF({ id: videoBasedResult!.id });

      expect(res.serverError?.message).toBe(`Result with ID ${videoBasedResult!.id} not found`);
      expect(res.data).toBeUndefined();
    });

    it("throws error for no access rights to contest", async () => {
      vi.stubEnv("TEST_USER", "mod");

      const res = await deleteContestResultSF({ id: 1 });

      expect(res.serverError?.message).toBe("You do not have access rights for this contest");
      expect(res.data).toBeUndefined();
    });
  });

  describe("Record result deletion (sometimes leading to future records being set)", async () => {
    describe("3x3x3 Blindfolded 2-man Relay results", async () => {
      const eventId = "333bf_2_person_relay";

      it("deletes NR result and sets prevented future NR", async () => {
        const res = await deleteContestResultSF({ id: 13 });

        expect(res.serverError).toBeUndefined();
        expect(res.validationErrors).toBeUndefined();
        expect(res.data?.length).toBe(2);

        const newNr = await db.query.results.findFirst({ where: { id: 17, eventId } });
        expect(newNr?.regionalSingleRecord).toBe("NR");
        expect(newNr?.regionalAverageRecord).toBe("NR");
      });

      it("deletes CR result (no reg. code), sets prevented future CR (no reg. code) and changes future NR to CR", async () => {
        const res = await deleteContestResultSF({ id: 10 });

        expect(res.serverError).toBeUndefined();
        expect(res.validationErrors).toBeUndefined();
        expect(res.data?.length).toBe(2);

        const nrChangedToCr = await db.query.results.findFirst({ where: { id: 16, eventId } });
        expect(nrChangedToCr?.regionalSingleRecord).toBe("AsR");
        expect(nrChangedToCr?.regionalAverageRecord).toBe("AsR");
        const newCr = await db.query.results.findFirst({ where: { id: 18, eventId } });
        expect(newCr?.regionalSingleRecord).toBe("AsR");
        expect(newCr?.regionalAverageRecord).toBe("AsR");
      });

      it("deletes CR result, sets prevented future CR, sets prevented future NR and changes future NR to CR", async () => {
        const res = await deleteContestResultSF({ id: 8 });

        expect(res.serverError).toBeUndefined();
        expect(res.validationErrors).toBeUndefined();
        expect(res.data?.length).toBe(2);

        const newCr = await db.query.results.findFirst({ where: { id: 11, eventId } });
        expect(newCr?.regionalSingleRecord).toBe("ER");
        expect(newCr?.regionalAverageRecord).toBe("ER");
        const nrChangedToCr = await db.query.results.findFirst({ where: { id: 13, eventId } });
        expect(nrChangedToCr?.regionalSingleRecord).toBe("ER");
        expect(nrChangedToCr?.regionalAverageRecord).toBe("ER");
        const newNr = await db.query.results.findFirst({ where: { id: 19, eventId } });
        expect(newNr?.regionalSingleRecord).toBe("NR");
        expect(newNr?.regionalAverageRecord).toBe("NR");
      });

      it("deletes WR result (no s-reg. code), sets prevented future WR (no s-reg. code) and changes CR set on the same day to WR", async () => {
        const res = await deleteContestResultSF({ id: 6 });

        expect(res.serverError).toBeUndefined();
        expect(res.validationErrors).toBeUndefined();
        expect(res.data?.length).toBe(2);

        const crChangedToWr = await db.query.results.findFirst({ where: { id: 7, eventId } });
        expect(crChangedToWr?.regionalSingleRecord).toBe("WR");
        expect(crChangedToWr?.regionalAverageRecord).toBe("WR");
        const newWr = await db.query.results.findFirst({ where: { id: 9, eventId } });
        expect(newWr?.regionalSingleRecord).toBe("WR");
        expect(newWr?.regionalAverageRecord).toBe("WR");
      });

      it("deletes WR result (no reg. code), sets prevented future CR (no reg. code), sets prevented future WR (no reg. code), changes future NR to CR", async () => {
        const res = await deleteContestResultSF({ id: 2 });

        expect(res.serverError).toBeUndefined();
        expect(res.validationErrors).toBeUndefined();
        expect(res.data?.length).toBe(1);

        const newCr = await db.query.results.findFirst({ where: { id: 3, eventId } });
        expect(newCr?.regionalSingleRecord).toBe("ER");
        expect(newCr?.regionalAverageRecord).toBe("ER");
        const newWr = await db.query.results.findFirst({ where: { id: 4, eventId } });
        expect(newWr?.regionalSingleRecord).toBe("WR");
        expect(newWr?.regionalAverageRecord).toBe("WR");
        const nrChangedToCr = await db.query.results.findFirst({ where: { id: 5, eventId } });
        expect(nrChangedToCr?.regionalSingleRecord).toBe("ER");
        expect(nrChangedToCr?.regionalAverageRecord).toBe("ER");
      });

      it("deletes WR result, sets prevented future CR and sets prevented future NR, changes future NR to CR and changes future CR to WR", async () => {
        const res = await deleteContestResultSF({ id: 12 });

        expect(res.serverError).toBeUndefined();
        expect(res.validationErrors).toBeUndefined();
        expect(res.data?.length).toBe(2);

        const newCr = await db.query.results.findFirst({ where: { id: 21, eventId } });
        expect(newCr?.regionalSingleRecord).toBe("NAR");
        expect(newCr?.regionalAverageRecord).toBe("NAR");
        const newNr = await db.query.results.findFirst({ where: { id: 14, eventId } });
        expect(newNr?.regionalSingleRecord).toBe("NR");
        expect(newNr?.regionalAverageRecord).toBe("NR");
        const nrChangedToCr = await db.query.results.findFirst({ where: { id: 15, eventId } });
        expect(nrChangedToCr?.regionalSingleRecord).toBe("NAR");
        expect(nrChangedToCr?.regionalAverageRecord).toBe("NAR");
        const crChangedToWr = await db.query.results.findFirst({ where: { id: 20, eventId } });
        expect(crChangedToWr?.regionalSingleRecord).toBe("WR");
        expect(crChangedToWr?.regionalAverageRecord).toBe("WR");
      });

      describe("edge cases", async () => {
        it("deletes NR result and doesn't set future average NR with a different average format", async () => {
          const res = await deleteContestResultSF({ id: 16 });

          expect(res.serverError).toBeUndefined();
          expect(res.validationErrors).toBeUndefined();
          expect(res.data?.length).toBe(2);

          const differentAverageFormatResult = await db.query.results.findFirst({ where: { id: 24, eventId } });
          expect(differentAverageFormatResult?.regionalSingleRecord).toBe("NR");
          expect(differentAverageFormatResult?.regionalAverageRecord).toBeNull();
        });

        it("deletes CR result and doesn't set future average CR with a different average format", async () => {
          const res = await deleteContestResultSF({ id: 20 });

          expect(res.serverError).toBeUndefined();
          expect(res.validationErrors).toBeUndefined();
          expect(res.data?.length).toBe(1);

          const differentAverageFormatResult = await db.query.results.findFirst({ where: { id: 23, eventId } });
          expect(differentAverageFormatResult?.regionalSingleRecord).toBe("ER");
          expect(differentAverageFormatResult?.regionalAverageRecord).toBeNull();
        });

        it("deletes WR result and doesn't set future average WR with a different average format", async () => {
          const res = await deleteContestResultSF({ id: 12 });

          expect(res.serverError).toBeUndefined();
          expect(res.validationErrors).toBeUndefined();
          expect(res.data?.length).toBe(2);

          const differentAverageFormatResult = await db.query.results.findFirst({ where: { id: 22, eventId } });
          expect(differentAverageFormatResult?.regionalSingleRecord).toBe("WR");
          expect(differentAverageFormatResult?.regionalAverageRecord).toBeNull();
        });
      });
    });
  });
});

describe("createVideoBasedResultSF", () => {
  beforeEach(reseedTestData);

  it("creates non-record result", async () => {
    const res = await createVideoBasedResultSF({
      newResultDto: {
        eventId: "444bf",
        date,
        personIds: [1],
        attempts: [{ result: 10000, memo: 50 }, { result: 10100 }, { result: 10200 }],
        videoLink: "https://example.com",
        discussionLink: null,
      },
    });

    expect(res.serverError).toBeUndefined();
    expect(res.validationErrors).toBeUndefined();
    expect(res.data).toBeDefined();
    expect(res.data!.regionCode).toBe("GB");
    expect(res.data!.superRegionCode).toBe("EUROPE");
    expect(res.data!.best).toBe(10000);
    expect(res.data!.average).toBe(10100);
    expect(res.data!.date.getTime()).toBe(date.getTime());
    expect(res.data!.regionalSingleRecord).toBeNull();
    expect(res.data!.regionalAverageRecord).toBeNull();
  });

  it("doesn't set average record for result with different average format", async () => {
    const res = await createVideoBasedResultSF({
      newResultDto: {
        eventId: "444bf",
        date,
        personIds: [1],
        attempts: [{ result: 1234 }, { result: 1234 }, { result: 1234 }, { result: 1234 }, { result: 1234 }],
        videoLink: "https://example.com",
        discussionLink: null,
      },
    });

    expect(res.data).toBeDefined();
    expect(res.data!.regionalAverageRecord).toBeNull();
  });

  describe("validation errors", async () => {
    it("throws validation error for date being in the future", async () => {
      const res = await createVideoBasedResultSF({
        newResultDto: {
          eventId: "444bf",
          date: addYears(date, 100), // looking forward to when this breaks in the year 2123 :)
          personIds: [1],
          attempts: [{ result: 1234 }],
          videoLink: "https://example.com",
          discussionLink: null,
        },
      });

      expect(res.serverError).toBeUndefined();
      expect(res.validationErrors?.newResultDto?.date?._errors?.[0]).toBe("The date cannot be in the future");
      expect(res.data).toBeUndefined();
    });

    it("throws validation error for empty attempt", async () => {
      const res = await createVideoBasedResultSF({
        newResultDto: {
          eventId: "444bf",
          date,
          personIds: [1],
          attempts: [{ result: 0 }],
          videoLink: "https://example.com",
          discussionLink: null,
        },
      });

      expect(res.serverError).toBeUndefined();
      expect((res.validationErrors?.newResultDto?.attempts as any[])[0].result?._errors?.[0]).toBe(
        "You cannot submit an empty attempt",
      );
      expect(res.data).toBeUndefined();
    });

    it("throws validation error for all attempts being DNF/DNS", async () => {
      const res = await createVideoBasedResultSF({
        newResultDto: {
          eventId: "444bf",
          date,
          personIds: [1],
          attempts: [{ result: -1 }, { result: -2 }, { result: -1 }],
          videoLink: "https://example.com",
          discussionLink: null,
        },
      });

      expect(res.serverError).toBeUndefined();
      expect((res.validationErrors?.newResultDto?.attempts as any)?._errors?.[0]).toBe(
        "You cannot submit only DNF/DNS attempts",
      );
      expect(res.data).toBeUndefined();
    });
  });

  describe("server errors", async () => {
    it("throws error for invalid event ID", async () => {
      const eventId = "INVALID";
      const res = await createVideoBasedResultSF({
        newResultDto: {
          eventId,
          date,
          personIds: [1],
          attempts: [{ result: 1234 }],
          videoLink: "https://example.com",
          discussionLink: null,
        },
      });

      expect(res.serverError?.message).toBe(`Event with ID ${eventId} not found`);
      expect(res.data).toBeUndefined();
    });

    it("throws error for invalid person ID", async () => {
      const personId = 999999;
      const res = await createVideoBasedResultSF({
        newResultDto: {
          eventId: "444bf",
          date,
          personIds: [personId],
          attempts: [{ result: 1234 }],
          videoLink: "https://example.com",
          discussionLink: null,
        },
      });

      expect(res.serverError?.message).toBe(`Person with ID ${personId} not found`);
      expect(res.data).toBeUndefined();
    });

    it("throws error for wrong number of participants (too few)", async () => {
      const res = await createVideoBasedResultSF({
        newResultDto: {
          eventId: "333_team_bld",
          date,
          personIds: [1],
          attempts: [{ result: 1234 }],
          videoLink: "https://example.com",
          discussionLink: null,
        },
      });

      expect(res.serverError?.message).toContain("event must have 2 participants");
      expect(res.data).toBeUndefined();
    });

    it("throws error for wrong number of participants (too many)", async () => {
      const res = await createVideoBasedResultSF({
        newResultDto: {
          eventId: "444bf",
          date,
          personIds: [1, 2],
          attempts: [{ result: 1234 }],
          videoLink: "https://example.com",
          discussionLink: null,
        },
      });

      expect(res.serverError?.message).toContain("event must have 1 participant");
      expect(res.data).toBeUndefined();
    });
  });

  describe("Record result creation", async () => {
    describe("4x4x4 Blindfolded results", async () => {
      const eventId = "444bf";
      const partialResult = { eventId, date, videoLink: "https://example.com", discussionLink: null };

      it("creates NR result (beating FWR) and cancels future NR", async () => {
        const res = await createVideoBasedResultSF({
          newResultDto: {
            ...partialResult,
            personIds: [usPersonJohnDoe.id],
            attempts: [{ result: 8800 }, { result: 8900 }, { result: 9000 }],
          },
        });

        expect(res.data).toBeDefined();
        expect(res.data!.regionCode).toBe("US");
        expect(res.data!.regionalSingleRecord).toBe("NR");
        expect(res.data!.regionalAverageRecord).toBe("NR");

        const cancelledNr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 0, 1) } },
        });
        expect(cancelledNr?.regionalSingleRecord).toBeNull();
        expect(cancelledNr?.regionalAverageRecord).toBeNull();
      });

      it("creates CR result (beating FWR), cancels future NR and changes future CR to NR", async () => {
        const res = await createVideoBasedResultSF({
          newResultDto: {
            ...partialResult,
            personIds: [usPersonJohnDoe.id],
            attempts: [{ result: 8300 }, { result: 8400 }, { result: 8500 }],
          },
        });

        expect(res.data).toBeDefined();
        expect(res.data!.superRegionCode).toBe("NORTH_AMERICA");
        expect(res.data!.regionalSingleRecord).toBe("NAR");
        expect(res.data!.regionalAverageRecord).toBe("NAR");

        const cancelledNr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 0, 1) } },
        });
        expect(cancelledNr?.regionalSingleRecord).toBeNull();
        expect(cancelledNr?.regionalAverageRecord).toBeNull();
        const crChangedToNr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 1, 1) } },
        });
        expect(crChangedToNr?.regionalSingleRecord).toBe("NR");
        expect(crChangedToNr?.regionalAverageRecord).toBe("NR");
      });

      it("creates NR result (beating FCR)", async () => {
        const res = await createVideoBasedResultSF({
          newResultDto: {
            ...partialResult,
            personIds: [krPersonDongJunHyon.id],
            attempts: [{ result: 7800 }, { result: 7900 }, { result: 8000 }],
          },
        });

        expect(res.data).toBeDefined();
        expect(res.data!.regionCode).toBe("KR");
        expect(res.data!.regionalSingleRecord).toBe("NR");
        expect(res.data!.regionalAverageRecord).toBe("NR");
      });

      it("creates NR result", async () => {
        const res = await createVideoBasedResultSF({
          newResultDto: {
            ...partialResult,
            personIds: [dePersonHansBauer.id],
            attempts: [{ result: 7300 }, { result: 7400 }, { result: 7500 }],
          },
        });

        expect(res.data).toBeDefined();
        expect(res.data!.regionCode).toBe("DE");
        expect(res.data!.regionalSingleRecord).toBe("NR");
        expect(res.data!.regionalAverageRecord).toBe("NR");
      });

      it("creates CR result and cancels future CR", async () => {
        const res = await createVideoBasedResultSF({
          newResultDto: {
            ...partialResult,
            personIds: [krPersonSooMinNam.id],
            attempts: [{ result: 6800 }, { result: 6900 }, { result: 7000 }],
          },
        });

        expect(res.data).toBeDefined();
        expect(res.data!.superRegionCode).toBe("ASIA");
        expect(res.data!.regionalSingleRecord).toBe("AsR");
        expect(res.data!.regionalAverageRecord).toBe("AsR");

        const cancelledCr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 2, 1) } },
        });
        expect(cancelledCr?.regionalSingleRecord).toBeNull();
        expect(cancelledCr?.regionalAverageRecord).toBeNull();
      });

      it("creates WR result, cancels future WR, changes future WR to CR and changes future WR to NR", async () => {
        const res = await createVideoBasedResultSF({
          newResultDto: {
            ...partialResult,
            personIds: [dePersonJakobBach.id],
            attempts: [{ result: 5000 }, { result: 5100 }, { result: 5200 }],
          },
        });

        expect(res.data).toBeDefined();
        expect(res.data!.regionalSingleRecord).toBe("WR");
        expect(res.data!.regionalAverageRecord).toBe("WR");

        const cancelledWr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 3, 1) } },
        });
        expect(cancelledWr?.regionalSingleRecord).toBeNull();
        expect(cancelledWr?.regionalAverageRecord).toBeNull();
        const wrChangedToCr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 4, 1) } },
        });
        expect(wrChangedToCr?.regionalSingleRecord).toBe("AsR");
        expect(wrChangedToCr?.regionalAverageRecord).toBe("AsR");
        const wrChangedToNr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 5, 1) } },
        });
        expect(wrChangedToNr?.regionalSingleRecord).toBe("NR");
        expect(wrChangedToNr?.regionalAverageRecord).toBe("NR");
      });

      it("creates WR result, cancels future WR, changes future WR to CR and changes future CR to NR", async () => {
        const res = await createVideoBasedResultSF({
          newResultDto: {
            ...partialResult,
            personIds: [krPersonSooMinNam.id],
            attempts: [{ result: 5000 }, { result: 5100 }, { result: 5200 }],
          },
        });

        expect(res.data).toBeDefined();
        expect(res.data!.regionalSingleRecord).toBe("WR");
        expect(res.data!.regionalAverageRecord).toBe("WR");

        const cancelledCr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 2, 1) } },
        });
        expect(cancelledCr?.regionalSingleRecord).toBeNull();
        expect(cancelledCr?.regionalAverageRecord).toBeNull();
        const wrChangedToCr1 = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 3, 1) } },
        });
        expect(wrChangedToCr1?.regionalSingleRecord).toBe("ER");
        expect(wrChangedToCr1?.regionalAverageRecord).toBe("ER");
        const wrChangedToNr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 4, 1) } },
        });
        expect(wrChangedToNr?.regionalSingleRecord).toBe("NR");
        expect(wrChangedToNr?.regionalAverageRecord).toBe("NR");
        const wrChangedToCr2 = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 5, 1) } },
        });
        expect(wrChangedToCr2?.regionalSingleRecord).toBe("ER");
        expect(wrChangedToCr2?.regionalAverageRecord).toBe("ER");
      });

      it("creates WR result, changes future WR to CR, cancels future CR and cancels future NR", async () => {
        const res = await createVideoBasedResultSF({
          newResultDto: {
            ...partialResult,
            personIds: [usPersonJohnDoe.id],
            attempts: [{ result: 5000 }, { result: 5100 }, { result: 5200 }],
          },
        });

        expect(res.data).toBeDefined();
        expect(res.data!.regionalSingleRecord).toBe("WR");
        expect(res.data!.regionalAverageRecord).toBe("WR");

        const cancelledNr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 0, 1) } },
        });
        expect(cancelledNr?.regionalSingleRecord).toBeNull();
        expect(cancelledNr?.regionalAverageRecord).toBeNull();
        const crChangedToNr = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 1, 1) } },
        });
        expect(crChangedToNr?.regionalSingleRecord).toBe("NR");
        expect(crChangedToNr?.regionalAverageRecord).toBe("NR");
        const wrChangedToCr1 = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 3, 1) } },
        });
        expect(wrChangedToCr1?.regionalSingleRecord).toBe("ER");
        expect(wrChangedToCr1?.regionalAverageRecord).toBe("ER");
        const wrChangedToCr2 = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 4, 1) } },
        });
        expect(wrChangedToCr2?.regionalSingleRecord).toBe("AsR");
        expect(wrChangedToCr2?.regionalAverageRecord).toBe("AsR");
        const wrChangedToCr3 = await db.query.results.findFirst({
          where: { eventId, date: { eq: new Date(2028, 5, 1) } },
        });
        expect(wrChangedToCr3?.regionalSingleRecord).toBe("ER");
        expect(wrChangedToCr3?.regionalAverageRecord).toBe("ER");
      });

      describe("edge cases", async () => {
        it("creates tied NR result (tying FWR)", async () => {
          const res = await createVideoBasedResultSF({
            newResultDto: {
              ...partialResult,
              personIds: [usPersonJohnDoe.id],
              attempts: [{ result: 9000 }, { result: 9100 }, { result: 9200 }],
            },
          });

          expect(res.data).toBeDefined();
          expect(res.data!.regionCode).toBe("US");
          expect(res.data!.regionalSingleRecord).toBe("NR");
          expect(res.data!.regionalAverageRecord).toBe("NR");
        });

        it("creates tied NR result (tying future NR)", async () => {
          const res = await createVideoBasedResultSF({
            newResultDto: {
              ...partialResult,
              personIds: [usPersonJohnDoe.id],
              attempts: [{ result: 8900 }, { result: 9000 }, { result: 9100 }],
            },
          });

          expect(res.data).toBeDefined();
          expect(res.data!.regionCode).toBe("US");
          expect(res.data!.regionalSingleRecord).toBe("NR");
          expect(res.data!.regionalAverageRecord).toBe("NR");

          const notCancelledTiedNr = await db.query.results.findFirst({
            where: { eventId, date: { eq: new Date(2028, 0, 1) } },
          });
          expect(notCancelledTiedNr?.regionalSingleRecord).toBe("NR");
          expect(notCancelledTiedNr?.regionalAverageRecord).toBe("NR");
        });

        it("creates tied CR result (tying FWR) and cancels future NR", async () => {
          const res = await createVideoBasedResultSF({
            newResultDto: {
              ...partialResult,
              personIds: [usPersonJohnDoe.id],
              attempts: [{ result: 8500 }, { result: 8600 }, { result: 8700 }],
            },
          });

          expect(res.data).toBeDefined();
          expect(res.data!.superRegionCode).toBe("NORTH_AMERICA");
          expect(res.data!.regionalSingleRecord).toBe("NAR");
          expect(res.data!.regionalAverageRecord).toBe("NAR");

          const cancelledNr = await db.query.results.findFirst({
            where: { eventId, date: { eq: new Date(2028, 0, 1) } },
          });
          expect(cancelledNr?.regionalSingleRecord).toBeNull();
          expect(cancelledNr?.regionalAverageRecord).toBeNull();
        });

        it("creates tied CR result (tying future CR) and cancels future NR", async () => {
          const res = await createVideoBasedResultSF({
            newResultDto: {
              ...partialResult,
              personIds: [usPersonJohnDoe.id],
              attempts: [{ result: 8400 }, { result: 8500 }, { result: 8600 }],
            },
          });

          expect(res.data).toBeDefined();
          expect(res.data!.superRegionCode).toBe("NORTH_AMERICA");
          expect(res.data!.regionalSingleRecord).toBe("NAR");
          expect(res.data!.regionalAverageRecord).toBe("NAR");

          const cancelledNr = await db.query.results.findFirst({
            where: { eventId, date: { eq: new Date(2028, 0, 1) } },
          });
          expect(cancelledNr?.regionalSingleRecord).toBeNull();
          expect(cancelledNr?.regionalAverageRecord).toBeNull();
          const notCancelledTiedCr = await db.query.results.findFirst({
            where: { eventId, date: { eq: new Date(2028, 1, 1) } },
          });
          expect(notCancelledTiedCr?.regionalSingleRecord).toBe("NAR");
          expect(notCancelledTiedCr?.regionalAverageRecord).toBe("NAR");
        });

        it("creates tied WR result, changes future CR to NR and cancels future NR", async () => {
          const res = await createVideoBasedResultSF({
            newResultDto: {
              ...partialResult,
              personIds: [usPersonJohnDoe.id],
              attempts: [{ result: 6500 }, { result: 6600 }, { result: 6700 }],
            },
          });

          expect(res.data).toBeDefined();
          expect(res.data!.regionalSingleRecord).toBe("WR");
          expect(res.data!.regionalAverageRecord).toBe("WR");

          const cancelledNr = await db.query.results.findFirst({
            where: { eventId, date: { eq: new Date(2028, 0, 1) } },
          });
          expect(cancelledNr?.regionalSingleRecord).toBeNull();
          expect(cancelledNr?.regionalAverageRecord).toBeNull();
          const crChangedToNr = await db.query.results.findFirst({
            where: { eventId, date: { eq: new Date(2028, 1, 1) } },
          });
          expect(crChangedToNr?.regionalSingleRecord).toBe("NR");
          expect(crChangedToNr?.regionalAverageRecord).toBe("NR");
        });

        it("creates tied WR result (tying future WR), changes future CR to NR and cancels future NR", async () => {
          const res = await createVideoBasedResultSF({
            newResultDto: {
              ...partialResult,
              personIds: [usPersonJohnDoe.id],
              attempts: [{ result: 6400 }, { result: 6500 }, { result: 6600 }],
            },
          });

          expect(res.data).toBeDefined();
          expect(res.data!.regionalSingleRecord).toBe("WR");
          expect(res.data!.regionalAverageRecord).toBe("WR");

          const cancelledNr = await db.query.results.findFirst({
            where: { eventId, date: { eq: new Date(2028, 0, 1) } },
          });
          expect(cancelledNr?.regionalSingleRecord).toBeNull();
          expect(cancelledNr?.regionalAverageRecord).toBeNull();
          const crChangedToNr = await db.query.results.findFirst({
            where: { eventId, date: { eq: new Date(2028, 1, 1) } },
          });
          expect(crChangedToNr?.regionalSingleRecord).toBe("NR");
          expect(crChangedToNr?.regionalAverageRecord).toBe("NR");
          const notCancelledTiedWr = await db.query.results.findFirst({
            where: { eventId, date: { eq: new Date(2028, 3, 1) } },
          });
          expect(notCancelledTiedWr?.regionalSingleRecord).toBe("WR");
          expect(notCancelledTiedWr?.regionalAverageRecord).toBe("WR");
        });

        it("doesn't set record, when there was a better record on the same day", async () => {
          const res = await createVideoBasedResultSF({
            newResultDto: {
              ...partialResult,
              personIds: [dePersonJakobBach.id],
              date: new Date(2023, 5, 1), // same date as German NR by Hans Bauer
              attempts: [{ result: 7600 }, { result: 7700 }, { result: 7800 }],
            },
          });

          expect(res.data).toBeDefined();
          expect(res.data!.regionCode).toBe("DE");
          expect(res.data!.regionalSingleRecord).toBeNull();
          expect(res.data!.regionalAverageRecord).toBeNull();
        });

        it("cancels record set on the same day with an even better record", async () => {
          const res = await createVideoBasedResultSF({
            newResultDto: {
              ...partialResult,
              personIds: [dePersonJakobBach.id],
              date: new Date(2023, 5, 1), // same date as German NR by Hans Bauer
              attempts: [{ result: 7200 }, { result: 7300 }, { result: 7400 }],
            },
          });

          expect(res.data).toBeDefined();
          expect(res.data!.regionCode).toBe("DE");
          expect(res.data!.regionalSingleRecord).toBe("NR");
          expect(res.data!.regionalAverageRecord).toBe("NR");

          const cancelledNr = await db.query.results.findFirst({
            where: { id: { ne: res.data!.id }, eventId, date: { eq: new Date(2023, 5, 1) } },
          });
          expect(cancelledNr?.regionalSingleRecord).toBeNull();
          expect(cancelledNr?.regionalAverageRecord).toBeNull();
        });
      });
    });
  });
});
