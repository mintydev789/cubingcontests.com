import { differenceInDays, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { remove as removeAccents } from "remove-accents";
import type { SelectContest } from "~/server/db/schema/contests.ts";
import type { EventResponse } from "~/server/db/schema/events.ts";
import type { Attempt, ResultResponse } from "~/server/db/schema/results.ts";
import type { RoundResponse } from "~/server/db/schema/rounds.ts";
import { C } from "./constants.ts";
import { type RoundFormatObject, roundFormats } from "./roundFormats.ts";
import type { ContestType, EventFormat, EventWrPair, RoundFormat } from "./types.ts";
import type { PersonDto } from "./validators/Person.ts";

// Returns >0 if a is worse than b, <0 if a is better than b, and 0 if it's a tie.
// This means that this function can be used in the Array.sort() method.
export function compareSingles(a: { best: number }, b: { best: number }): number {
  if (a.best <= 0 && b.best > 0) return 1;
  else if (a.best > 0 && b.best <= 0) return -1;
  else if (a.best <= 0 && b.best <= 0) return 0;
  return a.best - b.best;
}

// Same logic as above, except the single can also be used as a tie breaker if the averages are equivalent
export function compareAvgs(a: { average: number }, b: { average: number }, useTieBreaker?: false): number;
export function compareAvgs(
  a: { average: number; best: number },
  b: { average: number; best: number },
  useTieBreaker: true,
): number;
export function compareAvgs(
  a: { average: number; best?: number },
  b: { average: number; best?: number },
  useTieBreaker = false,
): number {
  const breakTie = () => compareSingles({ best: a.best! }, { best: b.best! });

  if (a.average <= 0) {
    if (b.average <= 0) {
      if (useTieBreaker) return breakTie();
      return 0;
    }
    return 1;
  } else if (a.average > 0 && b.average <= 0) {
    return -1;
  }
  if (a.average === b.average && useTieBreaker) return breakTie();
  return a.average - b.average;
}

export const setResultWorldRecords = (
  result: ResultResponse,
  event: EventResponse,
  eventWrPair: EventWrPair,
): ResultResponse => {
  const comparisonToRecordSingle = compareSingles(result, { best: eventWrPair.best ?? Infinity });
  if (result.best > 0 && comparisonToRecordSingle <= 0) result.regionalSingleRecord = "WR";

  if (result.attempts.length === getDefaultAverageAttempts(event.defaultRoundFormat)) {
    const comparisonToRecordAvg = compareAvgs(result, { average: eventWrPair.average ?? Infinity });
    if (result.average > 0 && comparisonToRecordAvg <= 0) result.regionalAverageRecord = "WR";
  }

  return result;
};

export const getDateOnly = (date: Date | null): Date | null => {
  if (!date) {
    console.error(`The date passed to getDateOnly is invalid: ${date}`);
    return null;
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

export const getFormattedTime = (
  time: number,
  {
    event,
    noDelimiterChars = false,
    showMultiPoints = false,
    showDecimals = true,
    alwaysShowMinutes = false,
  }: {
    event?: EventResponse;
    noDelimiterChars?: boolean;
    showMultiPoints?: boolean;
    showDecimals?: boolean; // if the time is >= 1 hour, they won't be shown regardless of this value
    alwaysShowMinutes?: boolean;
  } = {
    noDelimiterChars: false,
    showMultiPoints: false,
    showDecimals: true,
    alwaysShowMinutes: false,
  },
): string => {
  if (time === 0) {
    return "?";
  } else if (time === -1) {
    return "DNF";
  } else if (time === -2) {
    return "DNS";
  } else if (time === C.maxTime) {
    return "Unknown";
  } else if (event?.format === "number") {
    // FM singles are limited to 999 moves, so if it's more than that, it must be the mean. Format it accordingly.
    if (time > C.maxFmMoves && !noDelimiterChars) return (time / 100).toFixed(2);
    else return time.toString();
  } else {
    let centiseconds: number;
    let timeStr = time.toString();

    if (event?.format !== "multi") centiseconds = time;
    else centiseconds = parseInt(timeStr.slice(timeStr.length - 11, -4), 10);

    let output = "";
    const hours = Math.floor(centiseconds / 360000);
    const minutes = Math.floor(centiseconds / 6000) % 60;
    const seconds = (centiseconds - hours * 360000 - minutes * 6000) / 100;

    if (hours > 0) {
      output = hours.toString();
      if (!noDelimiterChars) output += ":";
    }

    const showMinutes = hours > 0 || minutes > 0 || alwaysShowMinutes;

    if (showMinutes) {
      if (hours > 0 && minutes === 0) output += "00";
      else if (minutes < 10 && hours > 0) output += "0" + minutes;
      else output += minutes;

      if (!noDelimiterChars) output += ":";
    }

    if (seconds < 10 && showMinutes) output += "0";

    // Only times under ten minutes can have decimals, or if noDelimiterChars = true, or if it's an event that always
    // includes the decimals (but the time is still < 1 hour). If showDecimals = false, the decimals aren't shown.
    if (
      ((hours === 0 && minutes < 10) || noDelimiterChars || (event && getAlwaysShowDecimals(event) && time < 360000)) &&
      showDecimals
    ) {
      output += seconds.toFixed(2);
      if (noDelimiterChars) output = Number(output.replace(".", "")).toString();
    } else {
      output += Math.floor(seconds).toFixed(0); // remove the decimals
    }

    if (event?.format !== "multi") {
      return output;
    } else {
      if (time < 0) timeStr = timeStr.replace("-", "");

      const points = (time < 0 ? -1 : 1) * (9999 - parseInt(timeStr.slice(0, -11), 10));
      const missed = parseInt(timeStr.slice(timeStr.length - 4), 10);
      const solved = points + missed;

      if (time > 0) {
        if (noDelimiterChars) return `${solved};${solved + missed};${output}`;
        // This includes an En space before the points part
        return (
          `${solved}/${solved + missed} ${centiseconds !== C.maxTime ? output : "Unknown time"}` +
          (showMultiPoints ? ` (${points})` : "")
        );
      } else {
        if (noDelimiterChars) return `${solved};${solved + missed};${output}`;
        return `DNF (${solved}/${solved + missed} ${output})`;
      }
    }
  }
};

// If the round has no cutoff (undefined), return true
export const getMakesCutoff = (
  attempts: Attempt[],
  cutoffAttemptResult: number | null | undefined,
  cutoffNumberOfAttempts: number | null | undefined,
): boolean =>
  !cutoffAttemptResult ||
  !cutoffNumberOfAttempts ||
  attempts.some((a, i) => i < cutoffNumberOfAttempts && a.result && a.result > 0 && a.result < cutoffAttemptResult);

// Returns the best and average times
export function getBestAndAverage(
  attempts: Attempt[],
  eventFormat: EventFormat,
  roundFormat: RoundFormat,
  cutoffAttemptResult?: number | null,
  cutoffNumberOfAttempts?: number | null,
): { best: number; average: number } {
  let best: number, average: number;
  let sum = 0;
  let dnfDnsCount = 0;
  const makesCutoff = getMakesCutoff(attempts, cutoffAttemptResult, cutoffNumberOfAttempts);
  const expectedAttempts = roundFormats.find((rf) => rf.value === roundFormat)!.attempts;
  const enteredAttempts = attempts.filter((a) => a.result !== 0).length;

  // This actually follows the rule that the lower the attempt value is - the better
  const convertedAttempts: number[] = attempts.map(({ result }) => {
    if (result) {
      if (result > 0) {
        sum += result;
        return result;
      }
      if (result !== 0) dnfDnsCount++;
    }
    return Infinity;
  });

  best = Math.min(...convertedAttempts);
  if (best === Infinity) best = -1; // if infinity, that means every attempt was DNF/DNS

  if (!makesCutoff || expectedAttempts < 3 || enteredAttempts < expectedAttempts) {
    average = 0;
  } else if (dnfDnsCount > 1 || (dnfDnsCount > 0 && roundFormat !== "a")) {
    average = -1;
  } else {
    // Subtract best and worst results, if it's an Ao5 round
    if (attempts.length === 5) {
      sum -= best;
      if (dnfDnsCount === 0) sum -= Math.max(...convertedAttempts);
    }

    average = Math.round((sum / 3) * (eventFormat === "number" ? 100 : 1));
  }

  return { best, average };
}

export const getIsProceedableResult = (result: ResultResponse, roundFormat: RoundFormatObject): boolean =>
  (roundFormat.isAverage && result.average > 0) || result.best > 0;

export const getDefaultAverageAttempts = (eventDefaultRoundFormat: RoundFormat) => {
  const roundFormat = roundFormats.find((rf) => rf.value === eventDefaultRoundFormat)!;
  return roundFormat.attempts === 5 ? 5 : 3;
};

export const getAlwaysShowDecimals = (event: EventResponse): boolean =>
  event.category === "extreme-bld" && event.format !== "multi";

export const getIsCompType = (contestType: ContestType | undefined): boolean => {
  if (!contestType) throw new Error("getIsCompType cannot accept undefined contestType");

  return ["wca-comp", "comp"].includes(contestType);
};

export function getNameAndLocalizedName(wcaName: string): { name: string; localizedName: string | undefined } {
  const [name, localizedName] = wcaName.replace(/\)$/, "").split(" (");
  return { name, localizedName };
}

export async function fetchWcaPerson(wcaId: string): Promise<PersonDto | undefined> {
  const res = await fetch(`${C.wcaUnofficialApiBaseUrl}/persons/${wcaId}.json`);
  if (res.ok) {
    const data = await res.json();

    const { name, localizedName } = getNameAndLocalizedName(data.name);
    const newPerson: PersonDto = {
      name,
      localizedName: localizedName ?? null,
      wcaId,
      regionCode: data.country,
    };
    return newPerson;
  }
}

export const getSimplifiedString = (input: string): string => removeAccents(input.trim().toLocaleLowerCase());

export function getMaxAllowedRounds(rounds: RoundResponse[], results: ResultResponse[]): number {
  const resultsByRound = rounds
    .map((r) => ({ round: r, results: results.filter((res) => res.roundId === r.id) }))
    .sort((a, b) => a.round.roundNumber - b.round.roundNumber);

  const getRoundHasEnoughResults = ({ results }: (typeof resultsByRound)[number]): boolean =>
    results.length >= C.minResultsForOneMoreRound && results.filter((r) => r.proceeds).length >= C.minProceedNumber;

  if (!getRoundHasEnoughResults(resultsByRound[0])) return 1;

  if (resultsByRound[0].results.length < C.minResultsForTwoMoreRounds || !getRoundHasEnoughResults(resultsByRound[1]))
    return 2;

  if (
    resultsByRound[0].results.length < C.minResultsForThreeMoreRounds ||
    resultsByRound[1].results.length < C.minResultsForTwoMoreRounds ||
    !getRoundHasEnoughResults(resultsByRound[2])
  )
    return 3;

  return 4;
}

export function parseRoundId(roundId: string): [string, number] {
  const [eventPart, roundPart] = roundId.split("-");
  if (!eventPart || !roundPart) throw new Error(`Invalid round ID: ${roundId}`);

  const roundNumber = parseInt(roundPart.slice(1), 10);
  if (Number.isNaN(roundNumber) || roundNumber < 1 || roundNumber > C.maxRounds)
    throw new Error(`Round ID has invalid round number: ${roundId}`);

  return [eventPart, roundNumber];
}

export function getIsUrgent(startDate: Date) {
  const difference = differenceInDays(startDate, fromZonedTime(startOfDay(new Date()), "UTC"));
  return difference >= 0 && difference <= 7;
}

export function getRoundDate(round: RoundResponse, contest: Pick<SelectContest, "startDate" | "schedule">): Date {
  if (contest.schedule) {
    const roundActivityCode = `${round.eventId}-r${round.roundNumber}`;

    for (const venue of contest.schedule.venues) {
      for (const room of venue.rooms) {
        // ADD SUPPORT FOR CHILD ACTIVITIES!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        const activity = room.activities.find((a) => a.activityCode === roundActivityCode);

        if (activity) return getDateOnly(toZonedTime(activity.startTime, contest.schedule.venues[0].timezone))!;
      }
    }

    throw new Error(`Activity with code ${roundActivityCode} not found in schedule`);
  } else {
    return contest.startDate;
  }
}
