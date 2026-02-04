"use client";

import { faBrain, faCopy, faEyeSlash, faPencil, faVideo, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAction } from "next-safe-action/hooks";
import { useContext, useState } from "react";
import EventTitle from "~/app/components/EventTitle.tsx";
import Form from "~/app/components/form/Form.tsx";
import FormCheckbox from "~/app/components/form/FormCheckbox.tsx";
import FormNumberInput from "~/app/components/form/FormNumberInput.tsx";
import FormRadio from "~/app/components/form/FormRadio.tsx";
import FormSelect from "~/app/components/form/FormSelect.tsx";
import FormTextArea from "~/app/components/form/FormTextArea.tsx";
import FormTextInput from "~/app/components/form/FormTextInput.tsx";
import Button from "~/app/components/UI/Button.tsx";
import ToastMessages from "~/app/components/UI/ToastMessages.tsx";
import { MainContext } from "~/helpers/contexts.ts";
import { eventCategories } from "~/helpers/eventCategories.ts";
import { eventCategoryOptions, eventFormatOptions } from "~/helpers/multipleChoiceOptions.ts";
import { roundFormats } from "~/helpers/roundFormats.ts";
import type { EventFormat, ListPageMode, RoundFormat } from "~/helpers/types.ts";
import { getActionError, getRoundFormatOptions } from "~/helpers/utilityFunctions.ts";
import type { EventDto } from "~/helpers/validators/Event.ts";
import type { SelectEvent } from "~/server/db/schema/events.ts";
import { createEventSF, updateEventSF } from "~/server/serverFunctions/eventServerFunctions.ts";

type Props = {
  events: SelectEvent[];
};

function ConfigureEventsScreen({ events: initEvents }: Props) {
  const { changeErrorMessages, changeSuccessMessage, resetMessages } = useContext(MainContext);

  const { executeAsync: createEvent, isPending: isCreating } = useAction(createEventSF);
  const { executeAsync: updateEvent, isPending: isUpdating } = useAction(updateEventSF);
  const [events, setEvents] = useState(initEvents);
  const [mode, setMode] = useState<ListPageMode>("view");
  const [eventIdUnlocked, setEventIdUnlocked] = useState(false);

  const [eventIdUnderEdit, setEventIdUnderEdit] = useState("");
  const [newEventId, setNewEventId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("miscellaneous");
  const [rank, setRank] = useState<number | undefined>();
  const [format, setFormat] = useState<EventFormat>("time");
  const [defaultRoundFormat, setDefaultRoundFormat] = useState<RoundFormat>("a");
  const [participants, setParticipants] = useState<number | undefined>(1);
  const [submissionsAllowed, setSubmissionsAllowed] = useState(false);
  const [removedWca, setRemovedWca] = useState(false);
  const [hasMemo, setHasMemo] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [description, setDescription] = useState("");
  const [rule, setRule] = useState("");

  const isPending = isCreating || isUpdating;

  const handleSubmit = async () => {
    if (
      mode !== "edit" ||
      newEventId === eventIdUnderEdit ||
      confirm(`Are you sure you would like to change the event ID from ${eventIdUnderEdit} to ${newEventId}?`)
    ) {
      const newEventDto = {
        eventId: newEventId,
        name,
        category,
        rank: rank as number,
        format,
        defaultRoundFormat,
        participants: participants as number,
        submissionsAllowed,
        removedWca,
        hasMemo,
        hidden,
        description: description || null,
        rule: rule || null,
      } satisfies EventDto;

      const res =
        mode === "add"
          ? await createEvent({ newEventDto })
          : await updateEvent({ newEventDto, originalEventId: eventIdUnderEdit });

      if (res.serverError || res.validationErrors) {
        changeErrorMessages([getActionError(res)]);
      } else {
        changeSuccessMessage(`Event successfully ${mode === "add" ? "created" : "updated"}`);
        setMode("view");

        const newEvents =
          mode === "add" ? [...events, res.data!] : events.map((e) => (e.eventId === eventIdUnderEdit ? res.data! : e));
        newEvents.sort((a, b) => a.rank - b.rank);
        setEvents(newEvents);
      }
    }
  };

  const onAddEvent = () => {
    window.scrollTo(0, 0);
    resetMessages();
    setMode("add");
    setEventIdUnlocked(false);

    setEventIdUnderEdit("");
    setNewEventId("");
    setName("");
    setCategory("miscellaneous");
    setRank(undefined);
    setFormat("time");
    setDefaultRoundFormat("a");
    setParticipants(1);
    setSubmissionsAllowed(false);
    setRemovedWca(false);
    setHasMemo(false);
    setHidden(false);
    setDescription("");
    setRule("");
  };

  const onEditEvent = (event: SelectEvent, clone = false) => {
    window.scrollTo(0, 0);
    resetMessages();
    setMode(clone ? "add" : "edit");
    setEventIdUnlocked(false);

    setEventIdUnderEdit(clone ? "" : event.eventId);
    setNewEventId(event.eventId);
    setName(event.name);
    setCategory(event.category);
    setRank(event.rank);
    setFormat(event.format);
    setDefaultRoundFormat(event.defaultRoundFormat);
    setParticipants(event.participants);
    setSubmissionsAllowed(event.submissionsAllowed);
    setRemovedWca(event.removedWca);
    setHasMemo(event.hasMemo);
    setHidden(event.hidden);
    setDescription(event.description ?? "");
    setRule(event.rule ?? "");
  };

  const cancel = () => {
    setMode("view");
    resetMessages();
  };

  return (
    <>
      <ToastMessages />

      {mode === "view" ? (
        <Button onClick={onAddEvent} className="btn-success btn-sm ms-3">
          Create Event
        </Button>
      ) : (
        <Form buttonText="Submit" onSubmit={handleSubmit} hideToasts onCancel={cancel} isLoading={isPending}>
          <FormTextInput
            id="event_name"
            title="Event name"
            value={name}
            setValue={setName}
            nextFocusTargetId="event_id"
            disabled={isPending}
            className="mb-3"
          />
          <div className="row mb-3">
            <div className="col">
              <FormTextInput
                id="event_id"
                title="Event ID"
                value={newEventId}
                setValue={setNewEventId}
                nextFocusTargetId="rank"
                disabled={(mode === "edit" && !eventIdUnlocked) || isPending}
              />
            </div>
            <div className="col">
              <FormNumberInput
                id="rank"
                title="Rank"
                tooltip="Determines the order of the events"
                value={rank}
                setValue={setRank}
                nextFocusTargetId="default_format"
                disabled={isPending}
                integer
                min={1}
              />
            </div>
          </div>
          {mode === "edit" && (
            <FormCheckbox title="Unlock event ID" selected={eventIdUnlocked} setSelected={setEventIdUnlocked} />
          )}
          <div className="row mb-3">
            <div className="col">
              <FormSelect
                id="default_format"
                title="Default format"
                options={getRoundFormatOptions(roundFormats)}
                selected={defaultRoundFormat}
                setSelected={setDefaultRoundFormat}
                disabled={mode === "edit" || isPending}
              />
            </div>
            <div className="col">
              <FormNumberInput
                title="Participants"
                value={participants}
                setValue={setParticipants}
                disabled={mode === "edit" || isPending}
                integer
                min={1}
              />
            </div>
          </div>
          <FormRadio
            title="Event format"
            options={eventFormatOptions}
            selected={format}
            setSelected={setFormat}
            disabled={mode === "edit" || isPending}
          />
          <div className="mb-4">
            <FormRadio
              title="Event category"
              options={eventCategoryOptions}
              selected={category}
              setSelected={setCategory}
              disabled={isPending}
            />
          </div>
          <h5 className="mb-4">Options</h5>
          <FormCheckbox
            title="Allow video-based results"
            selected={submissionsAllowed}
            setSelected={setSubmissionsAllowed}
            disabled={isPending}
          />
          <FormCheckbox
            title="Formerly WCA event"
            selected={removedWca}
            setSelected={setRemovedWca}
            disabled={isPending}
          />
          <FormCheckbox
            title="Has memorization time input"
            selected={hasMemo}
            setSelected={setHasMemo}
            disabled={isPending}
          />
          <FormCheckbox title="Hidden" selected={hidden} setSelected={setHidden} disabled={isPending} />
          <FormTextArea
            title="Description (optional)"
            value={description}
            setValue={setDescription}
            rows={4}
            disabled={isPending}
          />
          <FormTextArea
            title="Rules (optional, Markdown supported)"
            value={rule}
            setValue={setRule}
            rows={5}
            disabled={isPending}
          />
        </Form>
      )}

      <div className="table-responsive my-4">
        <table className="table-hover table text-nowrap">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Name</th>
              <th scope="col">Event ID</th>
              <th scope="col">Rank</th>
              <th scope="col">Default format</th>
              <th scope="col">Category</th>
              <th scope="col">Options</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event: SelectEvent, index: number) => (
              <tr key={event.eventId}>
                <td>{index + 1}</td>
                <td>
                  <EventTitle fontSize="6" event={event} showIcon linkToRankings noMargin />
                </td>
                <td>{event.eventId}</td>
                <td
                  className={
                    events.some((e) => e.eventId !== event.eventId && e.rank === event.rank)
                      ? "fw-bold text-danger"
                      : ""
                  }
                >
                  {event.rank}
                </td>
                <td>{roundFormats.find((rf) => rf.value === event.defaultRoundFormat)?.shortLabel ?? "ERROR"}</td>
                <td>
                  <span
                    className={`badge ${
                      event.category === "wca"
                        ? "bg-danger"
                        : event.category === "unofficial"
                          ? "bg-warning text-dark"
                          : event.category === "extreme-bld"
                            ? "bg-primary"
                            : event.category === "miscellaneous"
                              ? "bg-light text-dark"
                              : ""
                    }`}
                  >
                    {eventCategories.find((ec) => event.category === ec.value)?.title}
                  </span>
                </td>
                <td>
                  <div className="d-flex gap-2">
                    {/* For some reason FontAwesomeIcon doesn't like having title attributes (causes hydration errors) */}
                    {event.submissionsAllowed && (
                      <span title="Allow video-based results">
                        <FontAwesomeIcon icon={faVideo} />
                      </span>
                    )}
                    {event.removedWca && (
                      <span title="Formerly WCA event">
                        <FontAwesomeIcon icon={faXmark} />
                      </span>
                    )}
                    {event.hasMemo && (
                      <span title="Has memorization time input">
                        <FontAwesomeIcon icon={faBrain} />
                      </span>
                    )}
                    {event.hidden && (
                      <span title="Hidden">
                        <FontAwesomeIcon icon={faEyeSlash} />
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="d-flex gap-2">
                    <Button
                      onClick={() => onEditEvent(event)}
                      disabled={mode !== "view"}
                      className="btn-xs"
                      title="Edit"
                      ariaLabel="Edit"
                    >
                      <FontAwesomeIcon icon={faPencil} />
                    </Button>
                    <Button
                      onClick={() => onEditEvent(event, true)}
                      disabled={mode !== "view"}
                      className="btn-xs"
                      title="Clone"
                      aria-label="Clone"
                    >
                      <FontAwesomeIcon icon={faCopy} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default ConfigureEventsScreen;
