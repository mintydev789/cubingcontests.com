"use client";

import { faPencil } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAction } from "next-safe-action/hooks";
import { useContext, useMemo, useState } from "react";
import Competitor from "~/app/components/Competitor.tsx";
import FiltersContainer from "~/app/components/FiltersContainer.tsx";
import Form from "~/app/components/form/Form.tsx";
import FormPersonInputs from "~/app/components/form/FormPersonInputs.tsx";
import FormSelect from "~/app/components/form/FormSelect.tsx";
import FormTextInput from "~/app/components/form/FormTextInput.tsx";
import Button from "~/app/components/UI/Button.tsx";
import ToastMessages from "~/app/components/UI/ToastMessages.tsx";
import type { authClient } from "~/helpers/authClient.ts";
import { C } from "~/helpers/constants.ts";
import { MainContext } from "~/helpers/contexts.ts";
import type { MultiChoiceOption } from "~/helpers/types/MultiChoiceOption.ts";
import type { InputPerson } from "~/helpers/types.ts";
import { getActionError, getSimplifiedString } from "~/helpers/utilityFunctions.ts";
import type { PersonResponse } from "~/server/db/schema/persons.ts";
import type { Role, Roles } from "~/server/permissions.ts";
import { updateUserSF } from "~/server/serverFunctions/serverFunctions.ts";

const roleOptions: MultiChoiceOption[] = [
  { label: "User", value: "user" },
  { label: "Mod", value: "mod" },
  { label: "Admin", value: "admin" },
];

type Props = {
  users: (typeof authClient.$Infer.Session.user)[];
  userPersons: PersonResponse[];
};

function ManageUsersScreen({ users: initUsers, userPersons: initUserPersons }: Props) {
  const { changeErrorMessages, resetMessages } = useContext(MainContext);

  const { executeAsync: updateUser, isPending: isUpdating } = useAction(updateUserSF);
  const [users, setUsers] = useState(initUsers);
  const [userPersons, setUserPersons] = useState(initUserPersons);
  const [userId, setUserId] = useState<string>();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [personNames, setPersonNames] = useState([""]);
  const [persons, setPersons] = useState<InputPerson[]>([null]);
  const [role, setRole] = useState<(typeof Roles)[number]>("user");
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const simplifiedSearch = getSimplifiedString(search);

    return users.filter(
      (u) =>
        u.username.toLocaleLowerCase().includes(simplifiedSearch) ||
        getSimplifiedString(userPersons.find((p) => p.id === u.personId)?.name ?? "").includes(simplifiedSearch),
    );
  }, [search, users, userPersons]);

  const handleSubmit = async () => {
    if (persons[0] === null && personNames[0].trim() !== "") {
      changeErrorMessages(["The competitor has not been entered. Either enter them or clear the input."]);
      return;
    }

    const res = await updateUser({ id: userId!, personId: persons[0]?.id, role });

    if (res.serverError || res.validationErrors) {
      changeErrorMessages([getActionError(res)]);
    } else {
      resetMessages();
      setUserId(undefined);
      setUsername("");
      setUsers(users.map((u) => (u.id === userId ? res.data!.user : u)));
      const { person } = res.data!;
      if (person && !userPersons.some((p) => p.id === person.id)) setUserPersons([...userPersons, person]);
    }
  };

  const onEditUser = (user: typeof authClient.$Infer.Session.user) => {
    window.scrollTo(0, 0);
    resetMessages();

    setUserId(user.id);
    setUsername(user.username);
    setEmail(user.email);

    if (!user.role) throw new Error("Error: user role is empty");
    setRole(user.role as Role);

    const person = user.personId ? userPersons.find((p) => p.id === user.personId) : undefined;

    if (person) {
      setPersons([person]);
      setPersonNames([person.name]);
    } else {
      setPersons([null]);
      setPersonNames([""]);
    }
  };

  return (
    <>
      <ToastMessages />

      {username && (
        <Form
          buttonText="Submit"
          onSubmit={handleSubmit}
          hideToasts
          onCancel={() => setUsername("")}
          isLoading={isUpdating}
        >
          <div className="row mb-3">
            <div className="col">
              <FormTextInput title="Username" value={username} disabled />
            </div>
            <div className="col">
              <FormTextInput title="Email" value={email} setValue={setEmail} disabled />
            </div>
          </div>
          <FormPersonInputs
            title="Competitor"
            persons={persons}
            setPersons={setPersons}
            personNames={personNames}
            setPersonNames={setPersonNames}
            addNewPersonMode="default"
          />
          <FormSelect title="Role" options={roleOptions} selected={role} setSelected={setRole} />
        </Form>
      )}

      <FiltersContainer className="mt-4">
        <FormTextInput title="Search" value={search} setValue={setSearch} oneLine />
      </FiltersContainer>

      <p className="mb-2 px-3">
        Number of users:&nbsp;<b>{filteredUsers.length}</b>
        {filteredUsers.length === C.maxUsers ? " (reached limit; please contact the development team)" : ""}
      </p>

      <div className="table-responsive mt-3">
        <table className="table-hover table text-nowrap">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Username</th>
              <th scope="col">Email</th>
              <th scope="col">Competitor</th>
              <th scope="col">Role</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user, index) => {
              const person = userPersons.find((p) => p.id === user.personId);

              return (
                <tr key={user.id}>
                  <td>{index + 1}</td>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>{person && <Competitor person={person} noFlag />}</td>
                  <td>{user.role}</td>
                  <td>
                    <Button
                      id={`edit_${user.username}_button`}
                      type="button"
                      onClick={() => onEditUser(user)}
                      className="btn-xs"
                      title="Edit"
                      ariaLabel="Edit"
                    >
                      <FontAwesomeIcon icon={faPencil} />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default ManageUsersScreen;
