import Link from "next/link";
import Tooltip from "~/app/components/UI/Tooltip.tsx";
import type { EventResponse } from "~/server/db/schema/events.ts";
import EventIcon from "./EventIcon.tsx";

type Props = {
  event: Pick<EventResponse, "eventId" | "name" | "category" | "removedWca" | "description">;
  showIcon?: boolean;
  showDescription?: boolean;
  linkToRankings?: boolean;
  noMargin?: boolean;
  fontSize?: "1" | "2" | "3" | "4" | "5" | "6";
};

function EventTitle({ event, showIcon, showDescription, linkToRankings, noMargin, fontSize = "3" }: Props) {
  return (
    <h3 className={`d-flex gap-2 align-items-center fs-${fontSize} ${noMargin ? "m-0" : "ms-2 me-3 mb-3"}`}>
      {showIcon && <EventIcon event={event} />}

      {!linkToRankings ? (
        event.name
      ) : (
        <Link
          href={`/rankings/${event.eventId}/single`}
          prefetch={false}
          className="link-body-emphasis link-underline-opacity-0 link-underline-opacity-100-hover"
          style={{ maxWidth: "80vw" }}
        >
          {event.name}
        </Link>
      )}

      {showDescription && event.description && <Tooltip id={`${event.eventId}_tooltip`} text={event.description} />}
    </h3>
  );
}

export default EventTitle;
