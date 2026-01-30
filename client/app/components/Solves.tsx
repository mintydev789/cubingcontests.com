import { getFormattedTime } from "~/helpers/utilityFunctions.ts";
import type { EventResponse } from "~/server/db/schema/events.ts";
import type { Attempt } from "~/server/db/schema/results.ts";

type Props = {
  event: Pick<EventResponse, "category" | "format">;
  attempts: Attempt[];
  showMultiPoints?: boolean;
};

function Solves({ event, attempts, showMultiPoints = false }: Props) {
  return (
    <div className="d-flex gap-2">
      {attempts.map((attempt, index) => (
        <span key={index}>{getFormattedTime(attempt.result, { event, showMultiPoints })}</span>
      ))}
    </div>
  );
}

export default Solves;
