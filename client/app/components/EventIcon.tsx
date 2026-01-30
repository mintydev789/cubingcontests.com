import "@cubing/icons";
import { CubingIcons } from "@cubing/icons/js";
import { shortenEventName } from "~/helpers/utilityFunctions.ts";
import type { EventResponse } from "~/server/db/schema/events.ts";

type Props = {
  event: Pick<EventResponse, "eventId" | "name" | "category" | "removedWca">;
  onClick?: () => void;
  isActive?: boolean;
};

function EventIcon({ event, onClick, isActive }: Props) {
  const isOrWasWCAEvent = event.category === "wca" || event.removedWca;
  const availableIcons = Object.values(CubingIcons).map((iconId) =>
    (iconId as string).replace("event-", "").replace("unofficial-", ""),
  );
  const iconExists = isOrWasWCAEvent || availableIcons.includes(event.eventId);

  if (!iconExists) {
    if (!onClick) return undefined;

    return (
      <button type="button" onClick={onClick} className={`btn btn-lightdark btn-sm m-1 ${isActive ? "active" : ""}`}>
        {shortenEventName(event.name)}
      </button>
    );
  }

  const iconElement = (
    <span className={`cubing-icon ${isOrWasWCAEvent ? "event" : "unofficial"}-${event.eventId}`} title={event.name} />
  );

  if (!onClick) return iconElement;

  return (
    <button type="button" onClick={onClick} className={`cc-icon-button ${isActive ? "cc-icon-button--active" : ""}`}>
      {iconElement}
    </button>
  );
}

export default EventIcon;
