"use client";

import { useMemo } from "react";
import Time from "~/app/components/Time.tsx";
import { getBestAndAverage, setResultWorldRecords } from "~/helpers/sharedFunctions.ts";
import type { EventWrPair, RoundFormat } from "~/helpers/types.ts";
import type { EventResponse } from "~/server/db/schema/events.ts";
import type { RecordConfigResponse } from "~/server/db/schema/record-configs.ts";
import type { Attempt, ResultResponse } from "~/server/db/schema/results.ts";

type Props = {
  event: EventResponse;
  roundFormat: RoundFormat;
  attempts: Attempt[];
  eventWrPair: EventWrPair | undefined;
  recordConfigs: RecordConfigResponse[];
  cutoffAttemptResult?: number | null;
  cutoffNumberOfAttempts?: number | null;
};

function BestAndAverage({
  event,
  roundFormat,
  attempts,
  eventWrPair,
  recordConfigs,
  cutoffAttemptResult,
  cutoffNumberOfAttempts,
}: Props) {
  const pseudoResult = useMemo<ResultResponse>(() => {
    const { best, average } = getBestAndAverage(
      attempts,
      event.format,
      roundFormat,
      cutoffAttemptResult,
      cutoffNumberOfAttempts,
    );
    let tempResult = { best, average, attempts, eventId: event.eventId } as ResultResponse;
    if (eventWrPair) tempResult = setResultWorldRecords(tempResult, event, eventWrPair);
    return tempResult;
  }, [attempts, event, roundFormat, eventWrPair, cutoffAttemptResult, cutoffNumberOfAttempts]);

  return (
    <div>
      <div>
        Best:&nbsp;
        <Time result={pseudoResult} event={event} recordConfigs={recordConfigs} />
      </div>
      {attempts.length >= 3 && (
        <div className="mt-2">
          {attempts.length === 5 ? "Average:" : "Mean:"}&nbsp;
          <Time result={pseudoResult} event={event} recordConfigs={recordConfigs} average />
        </div>
      )}
    </div>
  );
}

export default BestAndAverage;
