"use client";

import { faCopy, faPencil } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAction } from "next-safe-action/hooks";
import { useContext, useState } from "react";
import Form from "~/app/components/form/Form.tsx";
import FormCheckbox from "~/app/components/form/FormCheckbox.tsx";
import FormNumberInput from "~/app/components/form/FormNumberInput.tsx";
import FormSelect from "~/app/components/form/FormSelect.tsx";
import FormTextInput from "~/app/components/form/FormTextInput.tsx";
import Button from "~/app/components/UI/Button.tsx";
import ColorSquare from "~/app/components/UI/ColorSquare.tsx";
import ToastMessages from "~/app/components/UI/ToastMessages.tsx";
import { Continents } from "~/helpers/Countries.ts";
import { C } from "~/helpers/constants.ts";
import { MainContext } from "~/helpers/contexts.ts";
import type { MultiChoiceOption } from "~/helpers/types/MultiChoiceOption.ts";
import {
  type ListPageMode,
  type RecordCategory,
  RecordCategoryValues,
  type RecordType,
  RecordTypeValues,
} from "~/helpers/types.ts";
import { getActionError } from "~/helpers/utilityFunctions.ts";
import type { RecordConfigDto } from "~/helpers/validators/RecordConfig.ts";
import type { RecordConfigResponse } from "~/server/db/schema/record-configs.ts";
import { createRecordConfigSF, updateRecordConfigSF } from "~/server/serverFunctions/recordConfigServerFunctions.ts";

const recordCategoryOptions: MultiChoiceOption[] = [
  {
    value: "competitions",
    label: "Competitions",
  },
  {
    value: "meetups",
    label: "Meetups",
  },
  {
    value: "video-based-results",
    label: "Video-based results",
  },
];
const recordTypeOptions: MultiChoiceOption[] = RecordTypeValues.map((v) => ({ value: v, label: v }));

type Props = {
  recordConfigs: RecordConfigResponse[];
};

function ConfigureRecordsScreen({ recordConfigs: initRecordConfigs }: Props) {
  const { changeErrorMessages, changeSuccessMessage, resetMessages } = useContext(MainContext);

  const { executeAsync: createRecordConfig, isPending: isCreating } = useAction(createRecordConfigSF);
  const { executeAsync: updateRecordConfig, isPending: isUpdating } = useAction(updateRecordConfigSF);
  const [mode, setMode] = useState<ListPageMode>("view");
  const [recordConfigs, setRecordConfigs] = useState(initRecordConfigs);

  const [recordConfigIdUnderEdit, setRecordConfigIdUnderEdit] = useState<number | undefined>();
  const [category, setCategory] = useState<RecordCategory>(RecordCategoryValues[0]);
  const [recordTypeId, setRecordTypeId] = useState<RecordType>(RecordTypeValues[0]);
  const [label, setLabel] = useState("");
  const [active, setActive] = useState(true);
  const [rank, setRank] = useState<number | undefined>();
  const [color, setColor] = useState(C.color.danger);

  const isPending = isCreating || isUpdating;

  const handleSubmit = async () => {
    const newRecordConfigDto = {
      category,
      recordTypeId,
      label,
      active,
      rank: rank!,
      color,
    } satisfies RecordConfigDto;

    const res =
      mode === "add"
        ? await createRecordConfig({ newRecordConfigDto })
        : await updateRecordConfig({ id: recordConfigIdUnderEdit!, newRecordConfigDto });

    if (res.serverError || res.validationErrors) {
      changeErrorMessages([getActionError(res)]);
    } else {
      changeSuccessMessage(`Record type successfully ${mode === "add" ? "created" : "updated"}`);
      setMode("view");

      const newRecordConfigs =
        mode === "add"
          ? [...recordConfigs, res.data!]
          : recordConfigs.map((rc) => (rc.id === recordConfigIdUnderEdit ? res.data! : rc));
      newRecordConfigs.sort((a, b) => a.rank - b.rank);
      setRecordConfigs(newRecordConfigs);
    }
  };

  const onAddRecordConfig = () => {
    resetMessages();
    setMode("add");

    setRecordConfigIdUnderEdit(undefined);
    setCategory("competitions");
    setRecordTypeId("WR");
    setLabel("");
    setActive(true);
    setRank(undefined);
    setColor(C.color.danger);
  };

  const onEditRecordConfig = (recordConfig: RecordConfigResponse, clone = false) => {
    window.scrollTo(0, 0);
    resetMessages();
    setMode(clone ? "add" : "edit");

    setRecordConfigIdUnderEdit(clone ? undefined : recordConfig.id);
    setCategory(recordConfig.category);
    setRecordTypeId(recordConfig.recordTypeId);
    setLabel(recordConfig.label);
    setActive(recordConfig.active);
    setRank(recordConfig.rank);
    setColor(recordConfig.color);
  };

  const cancel = () => {
    setMode("view");
    resetMessages();
  };

  const changeRecordTypeId = (newRecordTypeId: RecordType) => {
    setRecordTypeId(newRecordTypeId);

    if (newRecordTypeId === "WR") setColor(C.color.danger);
    else if (Continents.some((c) => c.recordTypeId === newRecordTypeId)) setColor(C.color.warning);
    else if (newRecordTypeId === "NR") setColor(C.color.success);
    else setColor(C.color.primary);
  };

  return (
    <>
      <ToastMessages />

      {mode === "view" ? (
        <Button onClick={onAddRecordConfig} className="btn-success btn-sm ms-3">
          Create Record Type
        </Button>
      ) : (
        <Form buttonText="Submit" onSubmit={handleSubmit} onCancel={cancel} hideToasts isLoading={isPending}>
          <div className="row mb-3">
            <div className="col">
              <FormSelect
                title="Record Category"
                options={recordCategoryOptions}
                selected={category}
                setSelected={setCategory}
                disabled={isPending}
              />
            </div>
            <div className="col">
              <FormSelect
                title="Record Type"
                options={recordTypeOptions}
                selected={recordTypeId}
                setSelected={changeRecordTypeId}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="row mb-3">
            <div className="col">
              <FormTextInput
                id="record_config_label"
                title="Label"
                value={label}
                setValue={setLabel}
                disabled={isPending}
              />
            </div>
            <div className="col">
              <FormNumberInput
                title="Rank"
                tooltip="Only used for ordering the record types on this page"
                value={rank}
                setValue={setRank}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="row mb-3">
            <div className="col">
              <label htmlFor="color_input" className="form-label d-block mb-2">
                Color
              </label>
              <input
                id="color_input"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="col">
              <FormCheckbox
                title="Active"
                selected={active}
                setSelected={setActive}
                // disabled={isPending}
                disabled
              />
            </div>
          </div>
        </Form>
      )}

      <p className="mt-3">
        Note: the code assumes that if there is an active NR or CR record type, the WR record type and all CR record
        types under that category are also active.
      </p>

      <div className="table-responsive my-4">
        <table className="table-hover table text-nowrap">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Record category</th>
              <th scope="col">Record type</th>
              <th scope="col">Label</th>
              <th scope="col">Rank</th>
              <th scope="col">Color</th>
              {/*<th scope="col">Active</th>*/}
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {recordConfigs.map((recordConfig, index) => (
              <tr key={recordConfig.id}>
                <td>{index + 1}</td>
                <td>{recordCategoryOptions.find((rf) => rf.value === recordConfig.category)?.label}</td>
                <td>{recordConfig.recordTypeId}</td>
                <td>{recordConfig.label}</td>
                <td>{recordConfig.rank}</td>
                <td>
                  <ColorSquare color={recordConfig.color} small />
                </td>
                {/*<td>
                  <ActiveInactiveIcon isActive={recordConfig.active} />
                </td>*/}
                <td>
                  <div className="d-flex gap-2">
                    <Button
                      onClick={() => onEditRecordConfig(recordConfig)}
                      disabled={mode !== "view"}
                      className="btn-xs"
                      title="Edit"
                      ariaLabel="Edit"
                    >
                      <FontAwesomeIcon icon={faPencil} />
                    </Button>
                    <Button
                      onClick={() => onEditRecordConfig(recordConfig, true)}
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

export default ConfigureRecordsScreen;
