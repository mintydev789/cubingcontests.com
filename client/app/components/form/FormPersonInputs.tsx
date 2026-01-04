"use client";

import debounce from "lodash/debounce";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useCallback, useContext, useState } from "react";
import Competitor from "~/app/components/Competitor.tsx";
import Loading from "~/app/components/UI/Loading.tsx";
import { C } from "~/helpers/constants.ts";
import { MainContext } from "~/helpers/contexts.ts";
import type { InputPerson } from "~/helpers/types.ts";
import { getActionError } from "~/helpers/utilityFunctions.ts";
import type { PersonResponse } from "~/server/db/schema/persons.ts";
import { getOrCreatePersonByWcaIdSF, getPersonsByNameSF } from "~/server/serverFunctions/personServerFunctions.ts";
import FormTextInput from "./FormTextInput.tsx";

const personInputTooltip =
  "Enter the competitor's name if they are already on Cubing Contests. If not, enter their full WCA ID to add them.";

type Props = {
  title: string;
  persons: InputPerson[];
  setPersons: (val: InputPerson[]) => void;
  personNames: string[];
  setPersonNames: (val: string[]) => void;
  onSelectPerson?: (val: PersonResponse) => void;
  infiniteInputs?: boolean;
  nextFocusTargetId?: string;
  disabled?: boolean;
  addNewPersonMode: "default" | "from-new-tab" | "disabled"; // must be disabled for unauthorized users
  redirectToOnAddPerson?: string;
  display?: "basic" | "grid" | "one-line";
};

function FormPersonInputs({
  title,
  persons,
  setPersons,
  personNames,
  setPersonNames,
  onSelectPerson,
  infiniteInputs,
  nextFocusTargetId,
  disabled,
  addNewPersonMode,
  redirectToOnAddPerson = "",
  display = "grid",
}: Props) {
  const router = useRouter();
  const { changeErrorMessages, resetMessages } = useContext(MainContext);

  // The null element represents the option "add new person" and is only an option given to an admin/moderator
  const defaultMatchedPersons: (PersonResponse | null)[] = addNewPersonMode !== "disabled" ? [null] : [];

  const { executeAsync: getPersonsByName, isPending: isPendingPersonsByName } = useAction(getPersonsByNameSF);
  const { executeAsync: getOrCreateWcaPerson, isPending: isPendingWcaPerson } = useAction(getOrCreatePersonByWcaIdSF);
  const [matchedPersons, setMatchedPersons] = useState<(PersonResponse | null)[]>(defaultMatchedPersons);
  const [personSelection, setPersonSelection] = useState(0);
  const [focusedInput, setFocusedInput] = useState<number | null>(null);

  const getMatchedPersons = useCallback(
    debounce(async (value: string) => {
      if (!C.wcaIdRegexLoose.test(value)) {
        const res = await getPersonsByName({ name: value });

        if (res.serverError || res.validationErrors) {
          changeErrorMessages([getActionError(res)]);
        } else {
          resetMessages();

          if (res.data && res.data.length > 0) {
            const newMatchedPersons = [...res.data, ...defaultMatchedPersons];
            setMatchedPersons(newMatchedPersons);
            if (newMatchedPersons.length < personSelection) setPersonSelection(0);
          }
        }
      } else {
        const res = await getOrCreateWcaPerson({ wcaId: value.trim().toUpperCase() });

        if (res.serverError || res.validationErrors) {
          changeErrorMessages([getActionError(res)]);
        } else {
          resetMessages();
          setMatchedPersons([res.data!.person]);
        }
      }
    }, C.fetchDebounceTimeout),
    [personSelection],
  );

  const isPending = isPendingPersonsByName || isPendingWcaPerson;

  const queryMatchedPersons = (value: string) => {
    setMatchedPersons(defaultMatchedPersons);
    setPersonSelection(0);

    value = value.trim();
    if (value) getMatchedPersons(value);
    else getMatchedPersons.cancel();
  };

  // This is called first on focus leave for the previous input and then on focus for the new input
  const changeFocusedInput = (inputIndex: number | null, inputValue = "") => {
    setFocusedInput(inputIndex);
    setPersonSelection(0);
    queryMatchedPersons(inputValue);
  };

  // Returns true if an input was added
  const addEmptyInputIfRequired = (newPersonNames: string[], newPersons: InputPerson[]): boolean => {
    // Add new empty input if there isn't an empty one left
    if (infiniteInputs && !newPersons.some((p) => p === null)) {
      newPersonNames.push("");
      newPersons.push(null);
      return true;
    }

    return false;
  };

  const changePersonName = (index: number, value: string) => {
    if (value) setFocusedInput(index);
    else setFocusedInput(null);

    // Update person name and reset the person object for that organizer
    const newPersonNames = personNames.map((name, i) => (i === index ? value : name));
    // This is done so that setPersons is only called if one of the persons actually had to be reset to null
    let personsUpdated = false;
    const newPersons: InputPerson[] = persons.map((p, i) => {
      if (i === index) {
        if (persons[i] !== null) personsUpdated = true;
        return null;
      }
      return p;
    });

    personsUpdated = personsUpdated || addEmptyInputIfRequired(newPersonNames, newPersons);

    setPersonNames(newPersonNames);
    if (personsUpdated) setPersons(newPersons);
    queryMatchedPersons(value);
  };

  const focusNext = (newPersons: InputPerson[]) => {
    setFocusedInput(null);
    setMatchedPersons(defaultMatchedPersons);
    setPersonSelection(0);

    // Focus on the first attempt input, if all names have been entered, or the next person input,
    // if all names haven't been entered and the last person input is not currently focused
    if (!newPersons.includes(null)) {
      if (nextFocusTargetId) document.getElementById(nextFocusTargetId)?.focus();
    } else {
      const emptyInputIndex = newPersons.findIndex((el) => el === null);
      document.getElementById(`${title}_${emptyInputIndex + 1}`)?.focus();
    }
  };

  const selectPerson = (inputIndex: number, selectionIndex: number) => {
    if (!isPending) {
      if (matchedPersons[selectionIndex] === null) {
        setFocusedInput(null);

        if (addNewPersonMode === "from-new-tab") {
          open("/mod/competitors", "_blank");
        } else if (!redirectToOnAddPerson) {
          router.push("/mod/competitors");
        } else {
          router.push(`/mod/competitors?redirect=${redirectToOnAddPerson}`);
        }
      } else {
        const newSelectedPerson = matchedPersons[selectionIndex];
        const newPersons = persons.map((p, i) => (i !== inputIndex ? p : newSelectedPerson));
        const newPersonNames = personNames.map((pn, i) => (i !== inputIndex ? pn : newSelectedPerson.name));
        setPersons(newPersons);
        setPersonNames(newPersonNames);
        addEmptyInputIfRequired(newPersonNames, newPersons);
        if (onSelectPerson) onSelectPerson(newSelectedPerson);
        // Queue focus next until the next tick, because otherwise the input immediately loses focus when clicking
        setTimeout(() => focusNext(newPersons), 0);
      }
    }
  };

  const onPersonKeyDown = (inputIndex: number, e: any) => {
    if (e.key === "Enter") {
      // Make sure the focused input is not empty
      if (personNames[inputIndex]) selectPerson(inputIndex, personSelection);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();

      if (personSelection + 1 <= matchedPersons.length - defaultMatchedPersons.length) {
        setPersonSelection(personSelection + 1);
      } else {
        setPersonSelection(0);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();

      if (personSelection - 1 >= 0) setPersonSelection(personSelection - 1);
      else setPersonSelection(matchedPersons.length - defaultMatchedPersons.length);
    } // Disallow entering certain characters
    else if (/[()_/\\[\]]/.test(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <div className={display === "grid" ? "row" : ""}>
      {personNames.map((personName: string, inputIndex: number) => (
        <div key={inputIndex} className={personNames.length > 1 && display === "grid" ? "col-md-6" : ""}>
          <div className={`position-relative ${display === "one-line" ? "" : "mb-3"}`}>
            <FormTextInput
              id={`${title}_${inputIndex + 1}`}
              title={personNames.length > 1 ? `${title} ${inputIndex + 1}` : title}
              tooltip={inputIndex === 0 ? personInputTooltip : undefined}
              value={personName}
              setValue={(val: string) => changePersonName(inputIndex, val)}
              onKeyDown={(e: any) => onPersonKeyDown(inputIndex, e)}
              onFocus={() => changeFocusedInput(inputIndex, personName)}
              onBlur={() => changeFocusedInput(null)}
              oneLine={display === "one-line"}
              disabled={disabled}
            />
            {inputIndex === focusedInput && personName && (
              <ul
                className={`position-absolute mt-3 list-group ${display === "one-line" ? "end-0" : ""}`}
                style={{ zIndex: 10, minWidth: display === "one-line" ? "initial" : "100%" }}
              >
                {isPending ? (
                  <li className="list-group-item">
                    <div style={{ minWidth: "200px" }}>
                      <Loading small />
                    </div>
                  </li>
                ) : matchedPersons.length > 0 ? (
                  matchedPersons.map((person: PersonResponse | null, matchIndex: number) => (
                    <li
                      key={matchIndex}
                      className={`list-group-item ${matchIndex === personSelection ? "active" : ""}`}
                      style={{ cursor: "pointer" }}
                      aria-current={matchIndex === personSelection}
                      onMouseEnter={() => setPersonSelection(matchIndex)}
                      onMouseDown={() => selectPerson(inputIndex, matchIndex)}
                    >
                      {person !== null ? <Competitor person={person} showLocalizedName noLink /> : "(add new person)"}
                    </li>
                  ))
                ) : (
                  <li className="list-group-item">(competitor not found)</li>
                )}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default FormPersonInputs;
