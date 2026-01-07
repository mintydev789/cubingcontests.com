import { describe, expect, it } from "vitest";
import { eventsStub } from "~/__mocks__/stubs/eventsStub.ts";
import { resultsStub } from "~/__mocks__/stubs/resultsStub.ts";
import { compareAvgs, compareSingles, getBestAndAverage, setResultWorldRecords } from "~/helpers/sharedFunctions.ts";
import type { EventWrPair } from "~/helpers/types.ts";
import type { EventResponse } from "~/server/db/schema/events.ts";
import type { Attempt, ResultResponse } from "~/server/db/schema/results.ts";

const mockTimeEvent = eventsStub.find((e) => e.eventId === "333")!;

describe(getBestAndAverage.name, () => {
  it("sets average to 0 when there is only one attempt", () => {
    const attempts: Attempt[] = [{ result: 1234 }];

    const { best, average } = getBestAndAverage(attempts, mockTimeEvent.format, "1");

    expect(best).toBe(1234);
    expect(average).toBe(0);
  });

  it("sets average to 0 when there are only 2 attempts", () => {
    const attempts: Attempt[] = [{ result: 1234 }, { result: 2345 }];

    const { best, average } = getBestAndAverage(attempts, mockTimeEvent.format, "2");

    expect(best).toBe(1234);
    expect(average).toBe(0);
  });
});

describe(compareSingles.name, () => {
  it("compares singles correctly when a < b", () => {
    expect(compareSingles({ best: 10 }, { best: 11 })).toBeLessThan(0);
  });

  it("compares singles correctly when a > b", () => {
    expect(compareSingles({ best: 10 }, { best: 9 })).toBeGreaterThan(0);
  });

  it("compares singles correctly when a = b", () => {
    expect(compareSingles({ best: 10 }, { best: 10 })).toBe(0);
  });

  it("compares singles correctly when a is DNF", () => {
    expect(compareSingles({ best: -1 }, { best: 10 })).toBeGreaterThan(0);
  });

  it("compares singles correctly when b is DNF", () => {
    expect(compareSingles({ best: 10 }, { best: -1 })).toBeLessThan(0);
  });

  it("compares singles correctly when a and b are DNF", () => {
    expect(compareSingles({ best: -1 }, { best: -1 })).toBe(0);
  });

  it("compares singles correctly when a is DNS and b is DNF", () => {
    expect(compareSingles({ best: -2 }, { best: -1 })).toBe(0);
  });

  it("compares singles correctly when a is DNF and b is DNS", () => {
    expect(compareSingles({ best: -1 }, { best: -2 })).toBe(0);
  });

  describe("compare Multi-Blind singles", () => {
    it("compares Multi-Blind singles correctly when a is 2/2 and b is 9/10", () => {
      expect(compareSingles({ best: 999700043890000 }, { best: 999100774000001 })).toBeGreaterThan(0);
    });

    it("compares Multi-Blind singles correctly when a is 3/3 59.68 and b is 3/3 1:05.57", () => {
      expect(compareSingles({ best: 999600059680000 }, { best: 999600065570000 })).toBeLessThan(0);
    });

    it("compares Multi-Blind singles correctly when a is 51/55 58:06 and b is 49/51 58:06", () => {
      expect(compareSingles({ best: 995203486000004 }, { best: 995203486000002 })).toBeGreaterThan(0);
    });

    it("compares Multi-Blind singles correctly when a is DNF (6/15) and b is DNF (1/2)", () => {
      expect(compareSingles({ best: -999603161000009 }, { best: -999900516420001 })).toBe(0);
    });
  });
});

describe(compareAvgs.name, () => {
  it("compares averages correctly when a < b", () => {
    expect(compareAvgs({ average: 10 }, { average: 11 })).toBeLessThan(0);
  });

  it("compares averages correctly when a > b", () => {
    expect(compareAvgs({ average: 10 }, { average: 9 })).toBeGreaterThan(0);
  });

  it("compares averages correctly when b is DNF", () => {
    expect(compareAvgs({ average: 10 }, { average: -1 })).toBeLessThan(0);
  });

  it("compares averages correctly when a is DNF", () => {
    expect(compareAvgs({ average: -1 }, { average: 10 })).toBeGreaterThan(0);
  });

  it("compares averages correctly when a and b are DNF", () => {
    expect(compareAvgs({ average: -1, best: 10 }, { average: -1, best: 11 }, true)).toBeLessThan(0);
  });

  it("compares same averages correctly when the singles are different", () => {
    expect(compareAvgs({ average: 10, best: 5 }, { average: 10, best: 6 }, true)).toBeLessThan(0);
  });

  it("compares same averages correctly when the singles are the same", () => {
    expect(compareAvgs({ average: 10, best: 5 }, { average: 10, best: 5 }, true)).toBe(0);
  });
});

describe(setResultWorldRecords.name, () => {
  const mock333WrPair: EventWrPair = { eventId: "333", best: 1000, average: 1100 };
  const mock222WrPair: EventWrPair = { eventId: "222", best: 124, average: 211 };
  const mockBLDWrPair: EventWrPair = { eventId: "333bf", best: 2217, average: 2795 };

  it("sets new 3x3x3 records correctly", () => {
    const event = eventsStub.find((e) => e.eventId === "333") as EventResponse;
    const stubResult = resultsStub.find((r) => r.eventId === "333") as ResultResponse;
    const result = setResultWorldRecords(stubResult, event, mock333WrPair);

    expect(result.best).toBe(686);
    expect(result.regionalSingleRecord).toBe("WR");
    expect(result.average).toBe(800);
    expect(result.regionalAverageRecord).toBe("WR");
  });

  it("updates 3x3x3 BLD single record correctly", () => {
    const event = eventsStub.find((e) => e.eventId === "333bf") as EventResponse;
    const stubResult = resultsStub.find((r) => r.eventId === "333bf") as ResultResponse;
    const result = setResultWorldRecords(stubResult, event, mockBLDWrPair);

    expect(result.regionalSingleRecord).toBe("WR");
    expect(result.regionalAverageRecord).toBeUndefined();
  });

  it("doesn't set avg records when the # of attempts doesn't match the default format's # of attempts", () => {
    const event = eventsStub.find((e) => e.eventId === "222") as EventResponse;
    const stubResult = resultsStub.find((r) => r.eventId === "222") as ResultResponse;
    const result = setResultWorldRecords(stubResult, event, mock222WrPair);

    expect(result.best).toBe(100);
    expect(result.regionalSingleRecord).toBe("WR");
    expect(result.average).toBe(101);
    expect(result.regionalAverageRecord).toBeUndefined();
  });
});
