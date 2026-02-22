import { describe, expect, it } from "vitest";
import { eventsStub } from "~/__mocks__/stubs/eventsStub.ts";
import { resultsStub } from "~/__mocks__/stubs/resultsStub";
import { C } from "~/helpers/constants.ts";
import type { EventWrPair } from "~/helpers/types";
import {
  compareAvgs,
  compareSingles,
  getAttempt,
  getBestAndAverage,
  getFormattedTime,
  setResultWorldRecords,
} from "~/helpers/utilityFunctions.ts";
import type { EventResponse } from "~/server/db/schema/events.ts";
import type { Attempt, ResultResponse } from "~/server/db/schema/results";

const mockTimeEvent = eventsStub.find((e) => e.eventId === "333") as any;
const roundOpts = { roundTime: true, roundMemo: true };

const timeExamples = [
  {
    inputs: { time: "553", memo: undefined },
    outputAtt: { result: 553, memo: undefined },
  },
  {
    inputs: { time: "2453", memo: undefined },
    outputAtt: { result: 2453, memo: undefined },
  },
  {
    inputs: { time: "24253", memo: undefined },
    outputAtt: { result: 16253, memo: undefined },
  },
  {
    inputs: { time: "141786", memo: undefined },
    outputAtt: { result: 85786, memo: undefined },
  },
  {
    inputs: { time: "1000284", memo: undefined },
    outputAtt: { result: 360284, memo: undefined },
  },
  {
    inputs: { time: "11510694", memo: undefined },
    outputAtt: { result: 4266694, memo: undefined },
  },
  // With memo
  {
    inputs: { time: "51234", memo: "25842" },
    outputAtt: { result: 31234, memo: 17842 },
  },
  {
    inputs: { time: "242344", memo: "155452" },
    outputAtt: { result: 146344, memo: 95452 },
  },
  // INVALID TIMES
  {
    inputs: { time: "248344", memo: "653452" }, // 83 seconds; 65 minutes
    outputAtt: { result: NaN, memo: NaN },
  },
  {
    inputs: { time: "155452", memo: "242344" }, // memo longer than time
    outputAtt: { result: NaN, memo: 146344 },
  },
  {
    inputs: { time: "25085622", memo: undefined }, // > 24 hours
    outputAtt: { result: NaN, memo: undefined },
  },
];

const mockNumberEvent = {
  eventId: "333fm",
  format: "number",
  category: "wca",
} as EventResponse;

const mockMultiEvent = {
  eventId: "333mbf",
  format: "multi",
  category: "wca",
} as EventResponse;

const mockOldStyleEvent = {
  eventId: "333mbo",
  format: "multi",
  category: "wca",
} as EventResponse;

const multiBlindExamples = [
  {
    result: 999700043890000,
    formatted: "2/2 43.89",
    memo: undefined,
    inputs: {
      time: "4389",
      solved: 2,
      attempted: 2,
      memo: undefined,
    },
  },
  {
    result: 999600065570000,
    formatted: "3/3 1:05.57",
    memo: undefined,
    inputs: {
      time: "10557",
      solved: 3,
      attempted: 3,
      memo: undefined,
    },
  },
  {
    result: 999901499000002,
    formatted: "2/4 24:59",
    memo: undefined,
    inputs: {
      time: "245900",
      solved: 2,
      attempted: 4,
      memo: undefined,
    },
  },
  {
    result: 999100774000001,
    formatted: "9/10 12:54",
    memo: undefined,
    inputs: {
      time: "125400",
      solved: 9,
      attempted: 10,
      memo: undefined,
    },
  },
  {
    result: 995203486000004,
    formatted: "51/55 58:06",
    memo: undefined,
    inputs: {
      time: "580600",
      solved: 51,
      attempted: 55,
      memo: undefined,
    },
  },
  {
    result: 995803600000008,
    formatted: "49/57 1:00:00",
    memo: undefined,
    inputs: {
      time: "1000000",
      solved: 49,
      attempted: 57,
      memo: undefined,
    },
  },
  {
    result: 89335998000047,
    formatted: "9153/9200 9:59:58", // Old Style
    memo: undefined,
    inputs: {
      time: "9595800",
      solved: 9153,
      attempted: 9200,
      memo: undefined,
    },
  },
  // DNFs
  {
    result: -999603161000009,
    formatted: "DNF (6/15 52:41)",
    memo: undefined,
    inputs: {
      time: "524100",
      solved: 6,
      attempted: 15,
      memo: undefined,
    },
  },
  {
    result: -999900516420001,
    formatted: "DNF (1/2 8:36.42)",
    memo: undefined,
    inputs: {
      time: "83642",
      solved: 1,
      attempted: 2,
      memo: undefined,
    },
  },
];

describe(getAttempt.name, () => {
  const dummyAtt = { result: 0 };

  describe("parse time attempts", () => {
    for (const example of timeExamples) {
      const { inputs, outputAtt } = example;

      it(`parses ${example.inputs.time}${example.inputs.memo ? ` with ${inputs.memo} memo` : ""} correctly`, () => {
        const output = getAttempt(dummyAtt, mockTimeEvent, inputs.time, { ...roundOpts, memo: inputs.memo });
        const expectedResult =
          !Number.isNaN(outputAtt.result) && outputAtt.result >= 60000
            ? outputAtt.result - (outputAtt.result % 100)
            : outputAtt.result;
        const expectedMemo =
          !Number.isNaN(outputAtt.memo) && outputAtt.memo && outputAtt.memo >= 60000
            ? outputAtt.memo - (outputAtt.memo % 100)
            : outputAtt.memo;

        expect(output.result).toBe(expectedResult);
        expect(output.memo).toBe(expectedMemo);
      });

      it(`parses ${inputs.time}${inputs.memo ? ` with ${inputs.memo} memo` : ""} without rounding correctly`, () => {
        const output = getAttempt(dummyAtt, mockTimeEvent, inputs.time, {
          memo: inputs.memo,
        });

        expect(output.result).toBe(outputAtt.result);
        expect(output.memo).toBe(outputAtt.memo);
      });
    }

    it("parses empty time correctly", () => {
      expect(getAttempt(dummyAtt, mockTimeEvent, "", roundOpts).result).toBe(0);
    });
  });

  describe("parse Time attempts", () => {
    it("parses 36 move FMC correctly", () => {
      const output = getAttempt(dummyAtt, mockNumberEvent, "36", roundOpts);
      expect(output.result).toBe(36);
      expect(output.memo).toBeUndefined();
    });

    it("parses empty number correctly", () => {
      const output = getAttempt(dummyAtt, mockNumberEvent, "", roundOpts);
      expect(output.result).toBe(0);
      expect(output.memo).toBe(undefined);
    });
  });

  describe("parse Multi attempts", () => {
    for (const example of multiBlindExamples) {
      const { inputs: inp } = example;

      if (Number(inp.time) <= 1002000) {
        it(`parses ${example.formatted} for Multi-Blind correctly`, () => {
          const output = getAttempt(dummyAtt, mockMultiEvent, inp.time, {
            ...roundOpts,
            solved: inp.solved,
            attempted: inp.attempted,
            memo: inp.memo,
          });
          expect(output.result).toBe(output.result);
          expect(output.memo).toBe(example.memo);
        });

        it(`disallows ${example.formatted} for Multi-Blind Old Style`, () => {
          const output = getAttempt(dummyAtt, mockOldStyleEvent, inp.time, {
            ...roundOpts,
            solved: inp.solved,
            attempted: inp.attempted,
            memo: inp.memo,
          });
          expect(output.result).toBeNaN();
          expect(output.memo).toBe(example.memo);
        });
      } else {
        it(`parses ${example.formatted} for Multi-Blind Old Style correctly`, () => {
          const output = getAttempt(dummyAtt, mockOldStyleEvent, inp.time, {
            ...roundOpts,
            solved: inp.solved,
            attempted: inp.attempted,
            memo: inp.memo,
          });
          expect(output.result).toBe(output.result);
          expect(output.memo).toBe(example.memo);
        });

        it(`disallows ${example.formatted} for Multi-Blind`, () => {
          const output = getAttempt(dummyAtt, mockMultiEvent, inp.time, {
            ...roundOpts,
            solved: inp.solved,
            attempted: inp.attempted,
            memo: inp.memo,
          });
          expect(output.result).toBeNaN();
          expect(output.memo).toBe(example.memo);
        });
      }
    }

    it("parses empty Multi-Blind attempt correctly", () => {
      expect(getAttempt(dummyAtt, mockMultiEvent, "", roundOpts).result).toBe(0);
    });

    it("disallows unknown time for Multi-Blind", () => {
      expect(
        getAttempt(dummyAtt, mockMultiEvent, C.maxTimeHumanReadable, {
          solved: 36,
          attempted: 36,
        }).result,
      ).toBeNaN();
    });

    it("parses Multi-Blind Old Style attempt with unknown time correctly", () => {
      expect(
        getAttempt(dummyAtt, mockOldStyleEvent, C.maxTimeHumanReadable, {
          solved: 36,
          attempted: 36,
        }).result,
      ).toBe(996386400000000);
    });
  });
});

describe(getFormattedTime.name, () => {
  describe("format time singles", () => {
    it("formats 0.07 correctly", () => {
      expect(getFormattedTime(7)).toBe("0.07");
    });

    it("formats 0.35 correctly", () => {
      expect(getFormattedTime(35)).toBe("0.35");
    });

    it("formats 8.80 correctly", () => {
      expect(getFormattedTime(880)).toBe("8.80");
    });

    it("formats 10.00 correctly", () => {
      expect(getFormattedTime(1000)).toBe("10.00");
    });

    it("formats 30.05 correctly", () => {
      expect(getFormattedTime(3005)).toBe("30.05");
    });

    it("formats 2:45.07 correctly", () => {
      expect(getFormattedTime(16507)).toBe("2:45.07");
    });

    // Results over ten minutes long must have no decimals
    it("formats 23:00.35 correctly", () => {
      expect(getFormattedTime(138035)).toBe("23:00");
    });

    it("formats 1:32:08(.36) correctly", () => {
      expect(getFormattedTime(552836)).toBe("1:32:08");
    });
  });

  describe("format time singles without formatting (no commas or colons)", () => {
    it("formats 0.09 without formatting correctly", () => {
      expect(getFormattedTime(9, { noDelimiterChars: true })).toBe("9");
    });

    it("formats 0.78 without formatting correctly", () => {
      expect(getFormattedTime(78, { noDelimiterChars: true })).toBe("78");
    });

    it("formats 20.00 correctly", () => {
      expect(getFormattedTime(2000, { noDelimiterChars: true })).toBe("2000");
    });

    it("formats 1:08.45 without formatting correctly", () => {
      expect(getFormattedTime(6845, { noDelimiterChars: true })).toBe("10845");
    });

    it("formats 12:35.00 correctly", () => {
      expect(getFormattedTime(75500, { noDelimiterChars: true })).toBe("123500");
    });
  });

  describe("format numbers (FMC)", () => {
    it("formats 37 correctly", () => {
      expect(getFormattedTime(37, { event: mockNumberEvent })).toBe("37");
    });

    it("formats 41.33 correctly", () => {
      expect(getFormattedTime(4133, { event: mockNumberEvent })).toBe("41.33");
    });

    it("formats 40.00 correctly", () => {
      expect(getFormattedTime(4000, { event: mockNumberEvent })).toBe("40.00");
    });

    it("formats 39.66 without formatting correctly", () => {
      expect(getFormattedTime(3966, { event: mockNumberEvent, noDelimiterChars: true })).toBe("3966");
    });
  });

  describe("format Multi-Blind attempts", () => {
    for (const example of multiBlindExamples) {
      it(`formats ${example.formatted} correctly`, () => {
        expect(getFormattedTime(example.result, { event: mockMultiEvent })).toBe(example.formatted);
      });

      it(`formats ${example.formatted} without formatting correctly`, () => {
        expect(
          getFormattedTime(example.result, {
            event: mockMultiEvent,
            noDelimiterChars: true,
          }),
        ).toBe(`${example.inputs.solved};${example.inputs.attempted};${example.inputs.time}`);
      });
    }

    it("formats Multi-Blind result with unknown time correctly", () => {
      expect(getFormattedTime(996386400000000, { event: mockMultiEvent })).toBe("36/36 Unknown time");
    });
  });

  it("formats DNF correctly", () => {
    expect(getFormattedTime(-1)).toBe("DNF");
  });

  it("formats DNS correctly", () => {
    expect(getFormattedTime(-2)).toBe("DNS");
  });

  it("formats unknown time correctly", () => {
    expect(getFormattedTime(C.maxTime)).toBe("Unknown");
  });

  it("formats Multi attempt with unknown time correctly", () => {
    const attempt = Number(`9995${C.maxTime}0001`);
    expect(getFormattedTime(attempt, { event: mockMultiEvent })).toBe("5/6 Unknown time");
  });

  it("formats 0:34 memo time correctly", () => {
    expect(getFormattedTime(3400, { alwaysShowMinutes: true, showDecimals: false })).toBe("0:34");
  });

  it("formats 14:07 memo time correctly", () => {
    expect(getFormattedTime(84700, { showDecimals: false })).toBe("14:07");
  });
});

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
