"use client";

import pick from "lodash/pick";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useContext, useEffect, useRef, useState } from "react";
import CreatorDetails from "~/app/components/CreatorDetails.tsx";
import Form from "~/app/components/form/Form.tsx";
import FormCheckbox from "~/app/components/form/FormCheckbox.tsx";
import FormCountrySelect from "~/app/components/form/FormCountrySelect.tsx";
import FormTextInput from "~/app/components/form/FormTextInput.tsx";
import { MainContext } from "~/helpers/contexts.ts";
import type { Creator } from "~/helpers/types.ts";
import { getActionError } from "~/helpers/utilityFunctions.ts";
import type { PersonDto } from "~/helpers/validators/Person.ts";
import type { PersonResponse } from "~/server/db/schema/persons.ts";
import {
  createPersonSF,
  getOrCreatePersonByWcaIdSF,
  updatePersonSF,
} from "~/server/serverFunctions/personServerFunctions.ts";

type Props = {
  personUnderEdit: PersonResponse | undefined;
  creator: Creator | undefined;
  creatorPerson: PersonResponse | undefined;
  onSubmit: (person: PersonResponse, { isNew }: { isNew: boolean }) => void;
  onCancel: (() => void) | undefined;
};

function PersonForm({ personUnderEdit, creator, creatorPerson, onSubmit, onCancel }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { changeErrorMessages, changeSuccessMessage, resetMessages } = useContext(MainContext);

  const { executeAsync: createPerson, isPending: isCreating } = useAction(createPersonSF);
  const { executeAsync: getOrCreatePersonByWcaId, isPending: isGettingOrCreatingWcaPerson } =
    useAction(getOrCreatePersonByWcaIdSF);
  const { executeAsync: updatePerson, isPending: isUpdating } = useAction(updatePersonSF);
  const [nextFocusTarget, setNextFocusTarget] = useState("");
  const [name, setName] = useState(personUnderEdit?.name ?? "");
  const [localizedName, setLocalizedName] = useState(personUnderEdit?.localizedName ?? "");
  const [wcaId, setWcaId] = useState(personUnderEdit?.wcaId ?? "");
  const [hasWcaId, setHasWcaId] = useState<boolean>(personUnderEdit === undefined || !!personUnderEdit.wcaId);
  const [regionCode, setRegionCode] = useState(personUnderEdit?.regionCode ?? "NOT_SELECTED");
  // This is set to true when the user is an admin, and they attempted to set a person with a duplicate name/country combination.
  // If the person is submitted again with no changes, the request will be sent with ignoreDuplicate=true.
  const isConfirmation = useRef(false);

  const isPending = isCreating || isGettingOrCreatingWcaPerson || isUpdating;

  useEffect(() => {
    if (nextFocusTarget) {
      document.getElementById(nextFocusTarget)?.focus();
      setNextFocusTarget("");
    }
    // These dependencies are required so that it focuses AFTER everything has been rerendered
  }, [nextFocusTarget, name, localizedName, wcaId, hasWcaId, regionCode, isPending]);

  useEffect(() => {
    if (isConfirmation.current) isConfirmation.current = false;
  }, [name, regionCode, wcaId, hasWcaId]);

  const handleSubmit = async () => {
    const baseRequest = {
      newPersonDto: {
        name: name.trim(),
        localizedName: localizedName.trim() || null,
        wcaId: hasWcaId ? wcaId.trim().toUpperCase() : null,
        regionCode,
      } satisfies PersonDto,
      ignoreDuplicate: isConfirmation.current,
    };

    const res = personUnderEdit
      ? await updatePerson({ ...baseRequest, id: personUnderEdit.id })
      : await createPerson(baseRequest);

    if (res.serverError || res.validationErrors) {
      if (res.serverError?.data?.isDuplicatePerson) isConfirmation.current = true;
      changeErrorMessages([getActionError(res)]);
    } else {
      afterSubmit(res.data!);
    }
  };

  const afterSubmit = (newPerson: PersonResponse) => {
    const redirect = searchParams.get("redirect");

    reset();
    changeSuccessMessage(
      `${newPerson.name} successfully ${personUnderEdit ? "updated" : "added"}${redirect ? ". Going back..." : ""}`,
    );

    // Redirect if there is a redirect parameter in the URL, otherwise focus the first input
    if (!redirect) {
      onSubmit(newPerson, { isNew: !personUnderEdit });

      if (hasWcaId) setNextFocusTarget("wca_id");
      else setNextFocusTarget("full_name");
    } else {
      setTimeout(() => router.push(redirect), 2000);
    }
  };

  const changeWcaId = async (newWcaId: string) => {
    newWcaId = newWcaId.trim().toUpperCase();

    if (/[^A-Z0-9]/.test(newWcaId)) {
      changeErrorMessages(["A WCA ID can only have alphanumeric characters"]);
    } else if (newWcaId.length <= 10) {
      setWcaId(newWcaId);

      if (!personUnderEdit) reset(true);

      if (newWcaId.length === 10) {
        resetMessages();

        if (!personUnderEdit) {
          const res = await getOrCreatePersonByWcaId({ wcaId: newWcaId });

          if (res.serverError || res.validationErrors) {
            changeErrorMessages([getActionError(res)]);
          } else if (res.data?.isNew) {
            afterSubmit(res.data.person);
          } else {
            changeErrorMessages(["A competitor with this WCA ID already exists"]);
            setName(res.data!.person.name);
            setLocalizedName(res.data!.person.localizedName ?? "");
            setRegionCode(res.data!.person.regionCode);
          }

          setNextFocusTarget("wca_id");
        } else {
          const res = await updatePerson({
            id: personUnderEdit.id,
            newPersonDto: { ...pick(personUnderEdit, "name", "localizedName", "regionCode"), wcaId: newWcaId },
          });

          if (res.serverError || res.validationErrors) changeErrorMessages([getActionError(res)]);
          else afterSubmit(res.data!);
        }
      }
    }
  };

  const changeHasWcaId = (noWcaId: boolean) => {
    resetMessages();
    setHasWcaId(!noWcaId);

    if (noWcaId) {
      setWcaId("");
      setNextFocusTarget("full_name");
    } else {
      if (!personUnderEdit) reset();
      setNextFocusTarget("wca_id");
    }
  };

  const reset = (exceptWcaId = false) => {
    setName("");
    setLocalizedName("");
    setRegionCode("NOT_SELECTED");
    if (!exceptWcaId) setWcaId("");
  };

  return (
    <Form
      buttonText="Submit"
      onSubmit={handleSubmit}
      onCancel={onCancel}
      hideToasts // they're shown on the page itself
      hideSubmitButton={hasWcaId}
      disableControls={isPending}
      isLoading={isCreating || isUpdating}
    >
      {personUnderEdit && (
        <CreatorDetails
          creator={creator}
          person={creatorPerson}
          createdExternally={(personUnderEdit as any).createdExternally}
        />
      )}
      {personUnderEdit && <p>CC ID: {personUnderEdit.id}</p>}
      <FormTextInput
        title="WCA ID"
        id="wca_id"
        monospace
        value={wcaId}
        setValue={changeWcaId}
        autoFocus
        disabled={isPending || !hasWcaId}
        className="mb-2"
      />
      <FormCheckbox
        title="Competitor doesn't have a WCA ID"
        selected={!hasWcaId}
        setSelected={changeHasWcaId}
        disabled={isPending}
      />
      <FormTextInput
        title="Full Name (name, last name)"
        id="full_name"
        value={name}
        setValue={setName}
        nextFocusTargetId="localized_name"
        disabled={isPending || hasWcaId}
        className="mb-3"
      />
      <FormTextInput
        title="Localized Name (optional)"
        id="localized_name"
        value={localizedName}
        setValue={setLocalizedName}
        nextFocusTargetId="country_iso_2"
        disabled={isPending || hasWcaId}
        className="mb-3"
      />
      <FormCountrySelect
        countryIso2={regionCode}
        setCountryIso2={setRegionCode}
        nextFocusTargetId="form_submit_button"
        disabled={isPending || hasWcaId}
      />
    </Form>
  );
}

export default PersonForm;
