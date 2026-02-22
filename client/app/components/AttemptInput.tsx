"use client";

import { useEffect, useMemo, useState } from "react";
import { C } from "~/helpers/constants.ts";
import { getAlwaysShowDecimals, getAttempt, getFormattedTime } from "~/helpers/utilityFunctions.ts";
import type { EventResponse } from "~/server/db/schema/events.ts";
import type { Attempt } from "~/server/db/schema/results.ts";
import FormNumberInput from "./form/FormNumberInput.tsx";
import FormTextInput from "./form/FormTextInput.tsx";

const DNFKeys = ["f", "F", "d", "D", "/"];
const DNSKeys = ["s", "S", "*"];
const unknownTimeKeys = ["u", "U"];

const getFormattedText = (text: string, { forMemo = false, isNumberFormat = false }): string => {
  if (isNumberFormat) return text;

  let output = "";
  const decimals = forMemo ? 0 : 2;

  if (text === "") return forMemo ? "0:00" : "0.00";
  else if (["DNF", "DNS", "Unknown"].includes(text)) return text;
  // Memo time formatting always requires minutes, even if they're 0
  else if (text.length < 5 && !forMemo) {
    output = (parseInt(text, 10) / 100).toFixed(decimals);
  } else {
    if (text.length >= 7) output += `${text.slice(0, text.length - 6)}:`; // hours
    if (text.length >= 5) {
      output += `${text.slice(Math.max(text.length - 6, 0), -4)}:`; // minutes
      const seconds = parseInt(text.slice(text.length - 4), 10) / 100;
      output += (seconds < 10 ? "0" : "") + seconds.toFixed(decimals); // seconds
    } else {
      const seconds = Number(text.slice(0, -2));
      output += `0:${seconds < 10 ? "0" : ""}${seconds}`;
    }
  }

  return output;
};

type Props = {
  attNumber: number; // number of the attempt (use 0 if the input is used for a time limit or cutoff)
  attempt: Attempt;
  setAttempt: (val: Attempt) => void;
  event: EventResponse;
  timeLimitCentiseconds?: number | null;
  memoInputForBld?: boolean;
  allowUnknownTime?: boolean;
  maxTime?: number; // maximum allowed time in centiseconds (can be used for time limit/cutoff inputs)
  disabled?: boolean;
  nextFocusTargetId?: string;
};

function AttemptInput({
  attNumber,
  attempt,
  setAttempt,
  event,
  timeLimitCentiseconds,
  memoInputForBld = false,
  allowUnknownTime = false,
  maxTime,
  disabled = false,
  nextFocusTargetId,
}: Props) {
  const [solved, setSolved] = useState<number | undefined>(undefined);
  const [attempted, setAttempted] = useState<number | undefined>(undefined);
  const [attemptText, setAttemptText] = useState<string>("");
  const [memoText, setMemoText] = useState<string>("");

  const formattedAttemptText = useMemo(
    () => getFormattedText(attemptText, { isNumberFormat: event.format === "number" }),
    [attemptText, event],
  );
  const formattedMemoText = useMemo(
    () => getFormattedText(memoText, { forMemo: true, isNumberFormat: event.format === "number" }),
    [memoText, event],
  );

  const isInvalidAttempt =
    Number.isNaN(attempt.result) || Number.isNaN(attempt.memo) || (!!maxTime && attempt.result > maxTime);
  const includeMemo = memoInputForBld && event.hasMemo;

  useEffect(() => {
    if (!Number.isNaN(attempt.result) && !Number.isNaN(attempt.memo)) {
      if (attempt.result === -1) {
        setAttemptText("DNF");
      } else if (attempt.result === -2) {
        setAttemptText("DNS");
      } else if (attempt.result === C.maxTime) {
        setAttemptText("Unknown");
      } else {
        // Attempt time
        if (attempt.result === 0) {
          setAttemptText("");
        } else if (event.format !== "multi") {
          setAttemptText(getFormattedTime(attempt.result, { event, noDelimiterChars: true }));
        } else {
          const formattedTime = getFormattedTime(attempt.result, { event, noDelimiterChars: true });
          const [newSolved, newAttempted, newAttText] = formattedTime.split(";");

          setSolved(Number(newSolved));
          setAttempted(Number(newAttempted));
          setAttemptText(newAttText === C.maxTimeHumanReadable ? "Unknown" : newAttText);
        }

        // Memo time
        if (attempt.memo && attempt.memo > 0) {
          setMemoText(getFormattedTime(attempt.memo, { noDelimiterChars: true }));
        } else if (attempt.memo === undefined) {
          setMemoText("");
        }
      }
    }
  }, [attempt]);

  //////////////////////////////////////////////////////////////////////////////
  // FUNCTIONS
  //////////////////////////////////////////////////////////////////////////////

  const focusNext = () => {
    if (nextFocusTargetId) {
      document.getElementById(nextFocusTargetId)?.focus();
    } else {
      const solvedInput = document.getElementById(`attempt_${attNumber + 1}_solved`);
      if (solvedInput && !(solvedInput as any).disabled) solvedInput.focus();
      else document.getElementById(`attempt_${attNumber + 1}`)?.focus();
    }
  };

  const handleSetDNS = (e: any) => {
    e.preventDefault();

    setAttempt({ result: -2 }); // set DNS
    setSolved(undefined);
    setAttempted(undefined);
    setAttemptText("DNS");
    setMemoText("");
  };

  const changeSolved = (newSolved: number | undefined) => {
    setSolved(newSolved);
    if (attemptText) {
      setAttempt(
        getAttempt(attempt, event, attemptText, {
          solved: newSolved,
          attempted,
          memo: memoText,
        }),
      );
    }
  };

  const changeAttempted = (newAttempted: number | undefined) => {
    setAttempted(newAttempted);
    if (attemptText) {
      setAttempt(
        getAttempt(attempt, event, attemptText, {
          solved,
          attempted: newAttempted,
          memo: memoText,
        }),
      );
    }
  };

  const onCubesKeyDown = (e: any) => {
    if (DNSKeys.includes(e.key)) handleSetDNS(e);
  };

  const onTimeChange = (e: any, forMemo = false) => {
    const prevValue = forMemo ? formattedMemoText : formattedAttemptText;

    // Erase character
    if (e.target.value.length < prevValue.length) {
      if (
        // For non-multi results we can erase DNF, DNS, and Unknown time
        (event.format !== "multi" &&
          !Number.isNaN(attempt.result) &&
          (attempt.result < 0 || attempt.result === C.maxTime)) ||
        // For Multi format we can only erase a DNS, otherwise we must be erasing the time
        (event.format === "multi" && attempt.result === -2)
      ) {
        setAttempt({ ...attempt, result: 0 });
        if (event.format === "multi") document.getElementById(`attempt_${attNumber}_solved`)?.focus();
      } else {
        if (!forMemo && attemptText !== "") {
          const newAttText = attemptText.slice(0, -1);
          setAttemptText(newAttText);
          setAttempt(getAttempt(attempt, event, newAttText, { solved, attempted, memo: memoText }));
        } else if (forMemo && memoText) {
          // This is different, because the memo input has no decimals, but memo time is still stored as centiseconds
          let newMemoText: string = memoText.slice(0, -3);
          if (newMemoText) newMemoText += "00";

          setMemoText(newMemoText);
          setAttempt(getAttempt(attempt, event, attemptText, { solved, attempted, memo: newMemoText }));
        }
      }
    } // Add character
    else if (e.target.value.length > prevValue.length) {
      const newCharacter = e.target.value[e.target.selectionStart - 1];

      if (!forMemo && DNFKeys.includes(newCharacter)) {
        if (event.format !== "multi") dnfTheAttempt();
      } else if (!forMemo && DNSKeys.includes(newCharacter)) {
        handleSetDNS(e);
      } else if (!forMemo && unknownTimeKeys.includes(newCharacter)) {
        // Multi-Blind doesn't allow unknown time, but Multi-Blind Old Style does
        if (allowUnknownTime && event.eventId !== "333mbf") {
          if (event.format !== "multi") {
            setAttempt({ result: C.maxTime });
            setAttemptText("Unknown");
            setMemoText("");
          } else {
            setAttempt(getAttempt(attempt, event, C.maxTimeHumanReadable, { solved, attempted }));
          }

          focusNext();
        }
      } else if (/[0-9]/.test(newCharacter)) {
        let text: string;
        if (forMemo) text = memoText || "00";
        else text = Number.isNaN(Number(attemptText)) ? "" : attemptText;

        if (newCharacter === "0" && ["", "00"].includes(text)) return; // don't allow entering 0 as the first digit

        const newText = !forMemo ? text + newCharacter : `${text.slice(0, -2)}${newCharacter}00`;

        if (newText.length <= C.maxFmMoves.toString().length || (newText.length <= 8 && event.format !== "number")) {
          const newAttempt = getAttempt(attempt, event, forMemo ? attemptText : newText, {
            solved,
            attempted,
            memo: forMemo ? newText : memoText,
          });
          setAttempt(newAttempt);

          // If the updated attempt is valid, it will get updated in useEffect anyways
          if (Number.isNaN(newAttempt.result) || Number.isNaN(newAttempt.memo)) {
            if (forMemo) setMemoText(newText);
            else setAttemptText(newText);
          }
        }
      }
    }
  };

  const onTimeKeyDown = (e: any, forMemo = false) => {
    if (e.key === "Enter") {
      e.preventDefault();

      // If it's not the memo input and there is a time limit that wasn't met, DNF the attempt
      if (
        !forMemo &&
        timeLimitCentiseconds &&
        !Number.isNaN(attempt.result) &&
        attempt.result >= timeLimitCentiseconds
      ) {
        dnfTheAttempt();
        focusNext();
      } else if (!forMemo && includeMemo) {
        document.getElementById(`attempt_${attNumber}_memo`)?.focus();
      } else {
        focusNext();
      }
    } else if (C.navigationKeys.includes(e.key)) {
      e.preventDefault();
    }
  };

  const onTimeFocusOut = (forMemo = false) => {
    // Get rid of the decimals if one of the times is >= 10 minutes and the event category is not
    // ExtremeBLD (with the exception of Multi format, which should still have its time rounded)
    if (attemptText.length >= 6 || (forMemo && memoText?.length >= 6)) {
      const newAttempt = getAttempt(attempt, event, attemptText, {
        roundTime: !getAlwaysShowDecimals(event),
        roundMemo: true,
        solved,
        attempted,
        memo: memoText,
      });

      if (newAttempt.result !== attempt.result || newAttempt.memo !== attempt.memo) setAttempt(newAttempt);
    }
  };

  const dnfTheAttempt = () => {
    setAttempt({ result: -1 }); // set DNF
    setAttemptText("DNF");
    setMemoText("");
  };

  const resetCursorPosition = (e: any) => {
    e.target.selectionStart = e.target.value.length;
    e.target.selectionEnd = e.target.value.length;
  };

  const cubesInputClasses = `px-0 ${includeMemo ? "col-2" : "col-3"}`;

  let timeInputTooltip = "";

  if (attNumber === 1) {
    const extraTip = allowUnknownTime ? "\nUse U for Unknown time." : "";

    if (event.format !== "multi") {
      timeInputTooltip = `Use D, F, or / for DNF.\nUse S or * for DNS.${extraTip}`;
    } else {
      timeInputTooltip =
        "Enter the result even for DNF attempts (they're treated as DNF, but the result is still shown).\nUse S or * for DNS." +
        extraTip;
    }
  }

  return (
    <div className={`${attNumber !== 0 ? "row px-3" : ""} gap-2 gap-md-3`}>
      {event.format === "multi" && (
        <>
          <div className={cubesInputClasses}>
            <FormNumberInput
              id={`attempt_${attNumber}_solved`}
              title={attNumber === 1 ? "Solved" : ""}
              value={solved}
              setValue={changeSolved}
              onKeyDown={(e: any) => onCubesKeyDown(e)}
              nextFocusTargetId={`attempt_${attNumber}_attempted`}
              disabled={attempt.result === -2}
              integer
              min={0}
              max={event.eventId === "333mbo" ? 999 : 99}
              invalid={isInvalidAttempt}
            />
          </div>
          <div className={cubesInputClasses}>
            <FormNumberInput
              id={`attempt_${attNumber}_attempted`}
              title={attNumber === 1 ? "Total" : ""}
              value={attempted}
              setValue={changeAttempted}
              onKeyDown={(e: any) => onCubesKeyDown(e)}
              nextFocusTargetId={`attempt_${attNumber}`}
              disabled={attempt.result === -2}
              integer
              min={2}
              max={event.eventId === "333mbo" ? 999 : 99}
              invalid={isInvalidAttempt}
            />
          </div>
        </>
      )}
      <div className="col px-0">
        <FormTextInput
          id={`attempt_${attNumber}`}
          title={attNumber === 1 ? (event.format !== "number" ? "Time" : "Moves") : ""}
          tooltip={timeInputTooltip}
          value={formattedAttemptText}
          onChange={(e) => onTimeChange(e)}
          onKeyDown={(e) => onTimeKeyDown(e)}
          onClick={resetCursorPosition}
          onFocus={resetCursorPosition}
          onBlur={() => onTimeFocusOut()}
          invalid={isInvalidAttempt}
          disabled={disabled}
          className={attNumber === 0 ? "" : "mb-2"}
        />
      </div>
      {includeMemo && (
        <div className="col px-0">
          <FormTextInput
            id={`attempt_${attNumber}_memo`}
            title={attNumber === 1 ? "Memo" : ""}
            tooltip="Memorization time without the decimals. If unknown, leave as 0."
            value={formattedMemoText}
            onChange={(e) => onTimeChange(e, true)}
            onKeyDown={(e: any) => onTimeKeyDown(e, true)}
            onClick={resetCursorPosition}
            onFocus={resetCursorPosition}
            onBlur={() => onTimeFocusOut(true)}
            disabled={["DNF", "DNS", "Unknown"].includes(formattedAttemptText)}
            invalid={isInvalidAttempt}
          />
        </div>
      )}
    </div>
  );
}

export default AttemptInput;
