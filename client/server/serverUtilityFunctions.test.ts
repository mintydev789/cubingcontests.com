import { beforeAll, describe, expect, it } from "vitest";
import { testCompMar2023_skewb_r1 } from "~/__mocks__/stubs/roundsStub";
import { createContestResultSF } from "~/server/serverFunctions/resultServerFunctions";
import { reseedTestData } from "~/vitest-setup";

// THESE TESTS ARE RUN SEQUENTIALLY, WITHOUT THE DB BEING RESET AFTER EACH ONE, SO THE MUTATIONS ARE PERSISTENT!
describe("setRankingAndProceedsValues", () => {
  const { id: roundId, eventId, competitionId, cutoffAttemptResult } = testCompMar2023_skewb_r1;

  beforeAll(async () => {
    await reseedTestData();

    await createContestResultSF({
      newResultDto: {
        eventId,
        personIds: [1], // irrelevant
        attempts: [{ result: 1234 }, { result: 1235 }, { result: 1236 }, { result: 1237 }, { result: 1238 }],
        competitionId,
        roundId,
      },
    });
  });

  describe.for([
    {
      testDetails: "result with better average",
      personId: 2,
      attempts: [{ result: 1100 }, { result: 1101 }, { result: 1102 }, { result: 1103 }, { result: 1104 }],
      expectedRanking: 1,
    },
    {
      testDetails: "result with tied average and better single",
      personId: 3,
      attempts: [{ result: 1000 }, { result: 1101 }, { result: 1102 }, { result: 1103 }, { result: 1104 }],
      expectedRanking: 1,
    },
    {
      testDetails: "result with tied average and single",
      personId: 4,
      attempts: [{ result: 1234 }, { result: 1235 }, { result: 1236 }, { result: 1237 }, { result: 1238 }],
      expectedRanking: 3,
    },
    {
      testDetails: "result that doesn't make cutoff",
      personId: 5,
      attempts: [{ result: cutoffAttemptResult! + 5 * 100 }, { result: cutoffAttemptResult! + 6 * 100 }],
      expectedRanking: 5,
    },
    {
      testDetails: "result that doesn't make cutoff with better single than another result that doesn't make cutoff",
      personId: 6,
      attempts: [{ result: cutoffAttemptResult! + 1 * 100 }, { result: cutoffAttemptResult! + 2 * 100 }],
      expectedRanking: 5,
    },
    {
      testDetails: "result that doesn't make cutoff with single between two other results that don't make cutoff",
      personId: 7,
      attempts: [{ result: cutoffAttemptResult! + 3 * 100 }, { result: cutoffAttemptResult! + 4 * 100 }],
      expectedRanking: 6,
    },
  ])("ranking values", ({ testDetails, personId, attempts, expectedRanking }) => {
    it(`sets correct rankings when adding ${testDetails}`, async () => {
      const res = await createContestResultSF({
        newResultDto: {
          eventId,
          personIds: [personId],
          attempts,
          competitionId,
          roundId,
        },
      });

      expect(res.serverError).toBeUndefined();
      expect(res.validationErrors).toBeUndefined();
      expect(res.data?.length).toBe(personId); // it's assumed that the person ID is the same as the number of entered results
      expect(res.data!.find((result) => result.personIds[0] === personId)!.ranking).toBe(expectedRanking);
    });
  });
});
