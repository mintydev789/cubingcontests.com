import { differenceInDays, isSameDay, isSameMonth, isSameYear, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import type { SafeActionResult } from "next-safe-action";
import { remove as removeAccents } from "remove-accents";
import z from "zod";
import { C } from "~/helpers/constants.ts";
import type { CcServerErrorObject, InputPerson } from "~/helpers/types.ts";
import { WcaPersonValidator } from "~/helpers/validators/wca/WcaPerson.ts";
import type { SelectContest } from "~/server/db/schema/contests.ts";
import type { EventResponse } from "~/server/db/schema/events.ts";
import type { Attempt, ResultResponse } from "~/server/db/schema/results.ts";
import type { RoundResponse, SelectRound } from "~/server/db/schema/rounds.ts";
import { type RoundFormatObject, roundFormats } from "./roundFormats.ts";
import type { MultiChoiceOption } from "./types/MultiChoiceOption.ts";
import type { ContestType, EventFormat, EventWrPair, RoundFormat } from "./types.ts";
import type { PersonDto } from "./validators/Person.ts";

export function getIsAdmin(rolesString: string | null | undefined): boolean {
  return !!rolesString?.split(",").some((role) => role === "admin");
}

export function getFormattedDate(startDate: Date, endDate?: Date | null): string {
  if (!startDate) throw new Error("Start date missing!");
  if (!(startDate instanceof Date)) throw new Error("Invalid format for start date");
  if (endDate && !(endDate instanceof Date)) throw new Error("Invalid format for end date");

  const fullFormat = "d MMM yyyy";

  if (!endDate || isSameDay(startDate, endDate)) {
    return formatInTimeZone(startDate, "UTC", fullFormat);
  } else {
    let startFormat: string;

    if (!isSameYear(startDate, endDate)) startFormat = fullFormat;
    else if (!isSameMonth(startDate, endDate)) startFormat = "d MMM";
    else startFormat = "d";

    return `${formatInTimeZone(startDate, "UTC", startFormat)} - ${formatInTimeZone(endDate, "UTC", fullFormat)}`;
  }
}

// Returns null if the time is invalid
const getCentiseconds = (
  time: string, // the time string without formatting (e.g. 1:35.97 should be "13597")
  {
    round = true,
    throwErrorWhenInvalidTime = false,
  }: {
    round?: boolean;
    throwErrorWhenInvalidTime?: boolean;
  } = { round: true, throwErrorWhenInvalidTime: false },
): number | null => {
  if (time === "") return 0;

  let hours = 0;
  let minutes = 0;
  let centiseconds: number;

  if (time.length >= 5) {
    // Round attempts >= 10 minutes long, unless noRounding = true
    if (time.length >= 6 && round) time = `${time.slice(0, -2)}00`;

    if (time.length >= 7) hours = parseInt(time.slice(0, time.length - 6), 10);
    minutes = parseInt(time.slice(Math.max(time.length - 6, 0), -4), 10);
    centiseconds = parseInt(time.slice(-4), 10);
  } else {
    centiseconds = parseInt(time, 10);
  }

  // Disallow >60 minutes, >60 seconds, and times more than 24 hours long
  if (minutes >= 60 || centiseconds >= 6000 || hours > 24 || (hours === 24 && minutes > 0 && centiseconds > 0)) {
    if (throwErrorWhenInvalidTime) {
      throw new Error(
        `Invalid time: ${time}. Debug info: hours = ${hours}, minutes = ${minutes}, centiseconds = ${centiseconds}, time = ${time}, round = ${round}`,
      );
    }
    return null;
  }

  return hours * 360000 + minutes * 6000 + centiseconds;
};

// Returns null if the time is invalid (e.g. 8145); returns 0 if it's empty.
// solved and attempted are only required for the Multi event format.
export function getAttempt(
  attempt: Attempt,
  event: EventResponse,
  time: string, // a time string without formatting (e.g. 1534 represents 15.34, 25342 represents 2:53.42)
  {
    roundTime = false,
    roundMemo = false,
    solved,
    attempted,
    memo,
  }: {
    roundTime?: boolean;
    roundMemo?: boolean;
    // These three parameters are optional if the event format is Number
    solved?: number | undefined;
    attempted?: number | undefined;
    memo?: string; // only used for events with hasMemo = true
  } = { roundTime: false, roundMemo: false },
): Attempt {
  if (time.length > 8 || (memo && memo.length > 8)) throw new Error("Times longer than 8 digits are not supported");

  const maxFmResultDigits = C.maxFmMoves.toString().length;
  if (time.length > maxFmResultDigits && event.format === "number")
    throw new Error(`Fewest Moves solutions longer than ${maxFmResultDigits} digits are not supported`);

  if (event.format === "number") return { ...attempt, result: time ? parseInt(time, 10) : 0 };

  const newAttempt: Attempt = { result: getCentiseconds(time, { round: roundTime }) as any };
  if (memo) {
    newAttempt.memo = getCentiseconds(memo, { round: roundMemo }) as any;
    if (newAttempt.memo && newAttempt.result && newAttempt.memo >= newAttempt.result) {
      return { ...newAttempt, result: null as any };
    }
  }

  if (event.format === "multi" && newAttempt.result) {
    if (typeof solved !== "number" || typeof attempted !== "number" || solved > attempted)
      return { result: null as any };

    const maxTime = Math.min(attempted, 6) * 60000 + attempted * 200; // accounts for +2s

    // Disallow submitting multi times > max time, and <= 1 hour for old style
    if (event.eventId === "333mbf" && newAttempt.result > maxTime) {
      return { ...newAttempt, result: null as any };
    } else if (event.eventId === "333mbo" && newAttempt.result <= 360000) {
      return { ...newAttempt, result: null as any };
    }

    // See the IResult interface for information about how this works
    let multiOutput = ""; // DDDDTTTTTTTMMMM
    const missed: number = attempted - solved;
    let points: number = solved - missed;

    if (points <= 0) {
      if (points < 0 || solved < 2) multiOutput += "-";
      points = -points;
    }

    multiOutput += 9999 - points;
    multiOutput += new Array(7 - newAttempt.result.toString().length).fill("0").join("") + newAttempt.result;
    multiOutput += new Array(4 - missed.toString().length).fill("0").join("") + missed;

    newAttempt.result = parseInt(multiOutput, 10);
  }

  return newAttempt;
}

export function getContestIdFromName(name: string): string {
  let output = removeAccents(name).replaceAll(/[^a-zA-Z0-9 ]/g, "");
  const parts = output.split(" ");

  output = parts
    .filter((el) => el !== "")
    .map((el) => el[0].toUpperCase() + el.slice(1))
    .join("");

  return output;
}

export function genericOnKeyDown(
  e: any,
  {
    nextFocusTargetId,
    onKeyDown,
    submitOnEnter,
  }: {
    nextFocusTargetId?: string;
    onKeyDown?: (e: any) => void;
    submitOnEnter?: boolean;
  },
) {
  if (e.key === "Enter") {
    if (!submitOnEnter) e.preventDefault();
    if (nextFocusTargetId) document.getElementById(nextFocusTargetId)?.focus();
  }

  if (onKeyDown) onKeyDown(e);
}

export function shortenEventName(name: string): string {
  return name
    .replaceAll("2x2x2", "2x2")
    .replaceAll("3x3x3", "3x3")
    .replaceAll("4x4x4", "4x4")
    .replaceAll("5x5x5", "5x5")
    .replaceAll("6x6x6", "6x6")
    .replaceAll("7x7x7", "7x7")
    .replaceAll("8x8x8", "8x8")
    .replaceAll("9x9x9", "9x9")
    .replaceAll("10x10x10", "10x10")
    .replaceAll("11x11x11", "11x11")
    .replace("Blindfolded", "BLD")
    .replace("Multi-Blind", "MBLD")
    .replace("One-Handed", "OH")
    .replace("Match The Scramble", "MTS")
    .replace("Face-Turning Octahedron", "FTO")
    .replace(" Cuboid", "")
    .replace(" Challenge", "")
    .replace("Three 3x3 Cubes", "3x 3x3");
}

export const getRoundFormatOptions = (roundFormats: RoundFormatObject[]): MultiChoiceOption[] =>
  roundFormats.map((rf) => ({ label: rf.label, value: rf.value }));

export const getBlankCompetitors = (participants: number): [InputPerson[], string[]] => {
  const persons = new Array(participants).fill(null);
  const personNames = new Array(participants).fill("");
  return [persons, personNames];
};

export function getActionError(actionResult: SafeActionResult<CcServerErrorObject, any>) {
  if (actionResult.serverError?.message) return actionResult.serverError.message;

  if (actionResult.validationErrors) {
    const getValidationError = (errorObject: any, currentErrors: string[], fieldName?: string) => {
      for (const key in errorObject) {
        if (key === "_errors" && fieldName) {
          if (fieldName) currentErrors.push(...(errorObject._errors as string[]).map((e) => `${fieldName}: ${e}`));
          else currentErrors.push(...(errorObject._errors as string[]));
        } else {
          getValidationError(errorObject[key], currentErrors, key);
        }
      }
    };

    const validationErrors: string[] = [];
    getValidationError(actionResult.validationErrors, validationErrors);
    return validationErrors.join("\n");
  }

  return "Unknown error";
}

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

export function setResultWorldRecords(
  result: ResultResponse,
  event: EventResponse,
  eventWrPair: EventWrPair,
): ResultResponse {
  const comparisonToRecordSingle = compareSingles(result, { best: eventWrPair.best ?? Infinity });
  if (result.best > 0 && comparisonToRecordSingle <= 0) result.regionalSingleRecord = "WR";

  if (result.attempts.length === getDefaultAverageAttempts(event.defaultRoundFormat)) {
    const comparisonToRecordAvg = compareAvgs(result, { average: eventWrPair.average ?? Infinity });
    if (result.average > 0 && comparisonToRecordAvg <= 0) result.regionalAverageRecord = "WR";
  }

  return result;
}

export function getDateOnly(date: Date | null): Date | null {
  if (!date) {
    console.error(`The date passed to getDateOnly is invalid: ${date}`);
    return null;
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getFormattedTime(
  time: number,
  {
    event,
    noDelimiterChars = false,
    showMultiPoints = false,
    showDecimals = true,
    alwaysShowMinutes = false,
  }: {
    event?: Pick<EventResponse, "category" | "format">;
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
): string {
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
      else if (minutes < 10 && hours > 0) output += `0${minutes}`;
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
}

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

export function getResultProceeds(
  result: ResultResponse,
  round: Pick<SelectRound, "proceedType" | "proceedValue">,
  roundFormat: RoundFormatObject,
  results: ResultResponse[],
): boolean {
  return (
    getIsProceedableResult(result, roundFormat) &&
    result.ranking! <= Math.floor(results.length * 0.75) && // extra check for top 75%
    result.ranking! <=
      (round.proceedType === "number" ? round.proceedValue! : Math.floor((results.length * round.proceedValue!) / 100))
  );
}

export function getDefaultAverageAttempts(eventDefaultRoundFormat: RoundFormat) {
  const roundFormat = roundFormats.find((rf) => rf.value === eventDefaultRoundFormat)!;
  return roundFormat.attempts === 5 ? 5 : 3;
}

export const getAlwaysShowDecimals = (event: Pick<EventResponse, "category" | "format">): boolean =>
  event.category === "extreme-bld" && event.format !== "multi";

export function getIsCompType(contestType: ContestType | undefined): boolean {
  if (!contestType) throw new Error("getIsCompType cannot accept undefined contestType");

  return ["wca-comp", "comp"].includes(contestType);
}

export function getNameAndLocalizedName(wcaName: string): { name: string; localizedName: string | undefined } {
  const [name, localizedName] = wcaName.replace(/\)$/, "").split(" (");
  return { name, localizedName };
}

export async function fetchWcaPerson(wcaId: string): Promise<PersonDto | undefined> {
  const res = await fetch(`${C.wcaApiBaseUrl}/persons/${wcaId}`);
  if (res.ok) {
    const data = await res.json();
    const wcaPerson = z.object({ person: WcaPersonValidator }).parse(data).person;

    const { name, localizedName } = getNameAndLocalizedName(wcaPerson.name);
    const newPerson: PersonDto = {
      name,
      localizedName: localizedName ?? null,
      wcaId,
      regionCode: wcaPerson.country_iso2,
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
