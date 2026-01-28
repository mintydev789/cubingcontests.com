"use client";

import { faUserGroup } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useContext, useState } from "react";
import ContestTypeBadge from "~/app/components/ContestTypeBadge.tsx";
import Country from "~/app/components/Country.tsx";
import Loading from "~/app/components/UI/Loading.tsx";
import ToastMessages from "~/app/components/UI/ToastMessages.tsx";
import ModFilters from "~/app/mod/ModFilters.tsx";
import type { authClient } from "~/helpers/authClient.ts";
import { C } from "~/helpers/constants.ts";
import { MainContext } from "~/helpers/contexts.ts";
import type { ContestState } from "~/helpers/types.ts";
import { getActionError, getFormattedDate, getIsAdmin } from "~/helpers/utilityFunctions.ts";
import type { ContestResponse } from "~/server/db/schema/contests.ts";
import type { PersonResponse } from "~/server/db/schema/persons.ts";
import { getModContestsSF } from "~/server/serverFunctions/contestServerFunctions.ts";
import ContestControls from "./ContestControls.tsx";

type Props = {
  contests: ContestResponse[];
  session: typeof authClient.$Infer.Session;
};

function ModDashboardScreen({ contests: initContests, session }: Props) {
  const router = useRouter();
  const { changeErrorMessages } = useContext(MainContext);

  const { executeAsync: getModContests, isPending: isPendingContests } = useAction(getModContestsSF);
  const [contests, setContests] = useState<ContestResponse[]>(initContests);

  const isAdmin = getIsAdmin(session.user.role);
  const pendingContests = contests.filter((c) => ["created", "ongoing", "finished"].includes(c.state)).length;

  const fetchContests = async (newOrganizerPersonId?: number) => {
    const res = await getModContests({ organizerPersonId: newOrganizerPersonId });

    if (res.serverError || res.validationErrors) changeErrorMessages([getActionError(res)]);
    else setContests(res.data!);
  };

  const updateContestState = (competitionId: string, newState: ContestState) => {
    setContests(contests.map((c) => (c.competitionId === competitionId ? { ...c, state: newState } : c)));
  };

  const selectPerson = (person: PersonResponse) => {
    router.replace(`/mod?organizerPersonId=${person.id}`);
    fetchContests(person.id);
  };

  const resetFilters = () => {
    router.replace("/mod");
    fetchContests();
  };

  return (
    <>
      <div className="px-2">
        <ToastMessages />

        <div className="alert alert-light mb-4" role="alert">
          We have a Cubing Contests Discord server!{" "}
          <a href={C.discordServerLink} target="_blank" rel="noopener noreferrer">
            Click here to join
          </a>
          , then send your CC username and your Discord username in an email to {C.contactEmail} so you can be given the
          moderator role on the server.
        </div>

        <div className="d-flex fs-5 my-4 flex-wrap gap-3">
          <Link href="/mod/competition" prefetch={false} className="btn btn-success btn-sm btn-lg-md">
            Create new contest
          </Link>
          <Link href="/mod/competitors" prefetch={false} className="btn btn-warning btn-sm btn-lg-md">
            Manage competitors
          </Link>
          {isAdmin ? (
            <>
              <Link href="/admin/results" prefetch={false} className="btn btn-warning btn-sm btn-lg-md">
                Manage results
              </Link>
              <Link href="/admin/users" prefetch={false} className="btn btn-warning btn-sm btn-lg-md">
                Manage users
              </Link>
              <Link href="/admin/events" prefetch={false} className="btn btn-secondary btn-sm btn-lg-md">
                Configure events
              </Link>
              <Link href="/admin/records-configuration" prefetch={false} className="btn btn-secondary btn-sm btn-lg-md">
                Configure records
              </Link>
            </>
          ) : (
            <a
              href="https://docs.google.com/forms/d/12AuZdtH4qHwTxd4Kxd2Y_TwZHlBuBu8XuKX3VdKrE60"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-light btn-sm btn-lg-md"
            >
              Request new event
            </a>
          )}
        </div>
        <p>
          Total contests:&nbsp;<b>{contests.length ?? 0}</b>&#8194;|&#8194;Pending:&nbsp;<b>{pendingContests}</b>
        </p>
        {!isAdmin && contests && (
          <>
            {!contests.some((c) => c.state !== "created") && (
              <p className="fw-bold my-3 text-danger">
                Your contests will not be publicly visible and you will not be able to enter results until an admin
                approves them
              </p>
            )}
            <p>
              Number of contests: <b>{contests.length}</b>
            </p>
          </>
        )}
      </div>

      <ModFilters onSelectPerson={selectPerson} onResetFilters={resetFilters} disabled={isPendingContests} />

      <div className="alert alert-warning mb-4" role="alert">
        The website just received a major update! Read our <Link href="/posts/the-big-update">blog post</Link> to learn
        more.
      </div>

      {isPendingContests ? (
        <Loading />
      ) : contests.length === 0 ? (
        <p className="fs-5 px-2">You haven't created any contests yet</p>
      ) : (
        <div className="table-responsive mb-5">
          <table className="table-hover table text-nowrap">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Name</th>
                <th scope="col">Place</th>
                <th scope="col">Type</th>
                <th scope="col">
                  <FontAwesomeIcon
                    icon={faUserGroup}
                    title="Number of participants"
                    aria-label="Number of participants"
                  />
                </th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contests.map((contest) => (
                <tr key={contest.competitionId}>
                  <td>{getFormattedDate(contest.startDate, contest.endDate)}</td>
                  <td>
                    <Link href={`/competitions/${contest.competitionId}`} prefetch={false} className="link-primary">
                      {contest.shortName}
                    </Link>
                  </td>
                  <td>
                    <div className="d-flex align-items-center">
                      <span className="d-inline-block m-0 text-truncate" style={{ maxWidth: "18rem" }}>
                        {contest.city}
                      </span>
                      <span className="me-1">,</span>
                      <Country countryIso2={contest.regionCode} swapPositions shorten />
                    </div>
                  </td>
                  <td>
                    <ContestTypeBadge type={contest.type} short />
                  </td>
                  <td>{contest.participants || ""}</td>
                  <td>
                    {contest.state === "removed" ? (
                      <span className="text-danger">Removed</span>
                    ) : (
                      <ContestControls
                        contest={contest}
                        isAdmin={isAdmin}
                        forPage="mod-dashboard"
                        onUpdateContestState={updateContestState}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default ModDashboardScreen;
