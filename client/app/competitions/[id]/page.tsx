import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import Markdown from "react-markdown";
import ContestLayout from "~/app/competitions/[id]/ContestLayout.tsx";
import Competitor from "~/app/components/Competitor.tsx";
import ContestTypeBadge from "~/app/components/ContestTypeBadge.tsx";
import Country from "~/app/components/Country.tsx";
import LoadingError from "~/app/components/UI/LoadingError.tsx";
import ToastMessages from "~/app/components/UI/ToastMessages.tsx";
import WcaCompAdditionalDetails from "~/app/components/WcaCompAdditionalDetails.tsx";
import ContestControls from "~/app/mod/ContestControls.tsx";
import { getDateOnly, getFormattedDate, getIsAdmin } from "~/helpers/utilityFunctions.ts";
import { auth } from "~/server/auth.ts";
import { db } from "~/server/db/provider.ts";
import { contestsPublicCols, contestsTable as table } from "~/server/db/schema/contests.ts";
import { personsPublicCols, personsTable } from "~/server/db/schema/persons.ts";
import { getUserHasAccessToContest } from "~/server/serverUtilityFunctions";

type Props = {
  params: Promise<{ id: string }>;
};

async function ContestDetailsPage({ params }: Props) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  const [contest] = await db.select(contestsPublicCols).from(table).where(eq(table.competitionId, id));
  if (!contest) return <LoadingError loadingEntity="contest" />;

  const hasAccessToContest = session && (await getUserHasAccessToContest(session.user, contest));

  const organizers = await db
    .select(personsPublicCols)
    .from(personsTable)
    .where(inArray(personsTable.id, contest.organizerIds));

  const formattedDate = getFormattedDate(contest.startDate, contest.endDate || null);
  // Not used for competition type contests
  const formattedTime =
    contest.startTime && contest.timezone ? formatInTimeZone(contest.startTime, contest.timezone, "H:mm") : null;
  const startOfDayInVenueTZ = getDateOnly(toZonedTime(new Date(), contest.timezone ?? "UTC"))!;
  const start = new Date(contest.startDate);
  const isOngoing =
    ["approved", "ongoing"].includes(contest.state) &&
    ((!contest.endDate && start.getTime() === startOfDayInVenueTZ.getTime()) ||
      (contest.endDate && start <= startOfDayInVenueTZ && new Date(contest.endDate) >= startOfDayInVenueTZ));

  const getFormattedCoords = () => {
    const latitude = (contest.latitudeMicrodegrees / 1000000).toFixed(6);
    const longitude = (contest.longitudeMicrodegrees / 1000000).toFixed(6);

    return (
      <a
        href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=18`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {latitude}, {longitude}
      </a>
    );
  };

  return (
    <ContestLayout contest={contest} activeTab="details">
      <div className="row fs-5 mx-0 w-100">
        <div className="col-md-5 px-0">
          <div className="px-2">
            <div className="mb-3">
              <ContestTypeBadge type={contest.type} />
            </div>
            <p className="mb-2">Date:&#8194;{formattedDate}</p>
            {formattedTime && <p className="mb-2">Starts at:&#8194;{formattedTime}</p>}
            <p className="mb-2">
              City:&#8194;{contest.city}, <Country countryIso2={contest.regionCode} swapPositions />
            </p>
            {/* Venue and address may be undefined for some old WCA competitions */}
            {contest.venue && <p className="mb-2">Venue:&#8194;{contest.venue}</p>}
            {contest.address && <p className="mb-2">Address:&#8194;{contest.address}</p>}
            <p className="mb-2">Coordinates:&#8194;{getFormattedCoords()}</p>
            {contest.contact && (
              <p className="mb-2">
                Contact:&#8194;<span className="fs-6">{contest.contact}</span>
              </p>
            )}
            <p className="mb-2">
              {organizers.length > 1 ? "Organizers" : "Organizer"}:&#8194;
              {organizers.map((org, index) => (
                <span key={org.id} className="d-flex-inline">
                  {index !== 0 && <span className="me-1">,</span>}
                  <Competitor person={org} noFlag />
                </span>
              ))}
            </p>
            {contest.participants > 0 ? (
              <p className="mb-2">
                Number of participants:&#8194;<b>{contest.participants}</b>
              </p>
            ) : (
              contest.competitorLimit && (
                <p className="mb-2">
                  Competitor limit:&#8194;<b>{contest.competitorLimit}</b>
                </p>
              )
            )}
          </div>
        </div>

        <hr className="d-md-none mt-2 mb-3" />

        <div className="col-md-7 px-0">
          <div className="px-2">
            <div className="mb-3">
              <ToastMessages />
              {hasAccessToContest && (
                <ContestControls contest={contest} isAdmin={getIsAdmin(session.user.role)} forPage="contest-details" />
              )}
            </div>

            {contest.state === "created" ? (
              <p className="mb-4">This contest is currently awaiting approval</p>
            ) : isOngoing ? (
              <p className="mb-4">This contest is currently ongoing</p>
            ) : contest.state === "finished" ? (
              <p className="mb-4">The results for this contest are currently being checked</p>
            ) : contest.state === "removed" ? (
              <p className="mb-4 text-danger">THIS CONTEST HAS BEEN REMOVED!</p>
            ) : undefined}

            {contest.type === "wca-comp" && (
              <WcaCompAdditionalDetails name={contest.name} competitionId={contest.competitionId} />
            )}

            {contest.description && (
              <>
                <p className="fw-bold">Description:</p>
                <div style={{ overflowX: "auto" }}>
                  <Markdown>{contest.description}</Markdown>
                </div>
                {contest.queuePosition && (
                  <p className="mt-5">
                    Current position in queue: <b>{contest.queuePosition}</b>
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </ContestLayout>
  );
}

export default ContestDetailsPage;
