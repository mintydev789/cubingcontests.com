import { and, eq, ne } from "drizzle-orm";
import Link from "next/link";
import ContestsTable from "~/app/components/ContestsTable.tsx";
import EventButtons from "~/app/components/EventButtons.tsx";
import { Continents, Countries } from "~/helpers/Countries.ts";
import { db } from "~/server/db/provider.ts";
import { eventsPublicCols, eventsTable } from "~/server/db/schema/events.ts";
import AffiliateLink from "../components/AffiliateLink.tsx";
import LoadingError from "../components/UI/LoadingError.tsx";
import RegionSelect from "../rankings/[eventId]/[singleOrAvg]/RegionSelect.tsx";

export const metadata = {
  title: "All contests | Cubing Contests",
  description: "List of unofficial Rubik's Cube competitions and speedcuber meetups.",
  keywords:
    "rubik's rubiks cube contest contests competition competitions meetup meetups speedcubing speed cubing puzzle",
  icons: { icon: "/favicon.png" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL!),
  openGraph: {
    images: ["/screenshots/cubing_contests_2.jpg"],
  },
};

type Props = {
  searchParams: Promise<{
    eventId?: string;
    region?: string;
  }>;
};

async function ContestsPage({ searchParams }: Props) {
  const { eventId, region } = await searchParams;

  const filterBySuperRegion = !!region && Continents.some((c) => region === c.code);
  const regionCodes = filterBySuperRegion && Countries.filter((c) => c.superRegionCode === region).map((c) => c.code);
  const contestsPromise = db.query.contests.findMany({
    columns: {
      competitionId: true,
      shortName: true,
      type: true,
      city: true,
      regionCode: true,
      startDate: true,
      endDate: true,
      participants: true,
    },
    with: { rounds: { columns: { eventId: true } } },
    where: {
      state: { notIn: ["created", "removed"] },
      rounds: eventId ? { eventId } : undefined,
      regionCode: regionCodes ? { in: regionCodes } : region,
    },
    orderBy: { startDate: "desc" },
  });
  const eventsPromise = db
    .select(eventsPublicCols)
    .from(eventsTable)
    .where(and(ne(eventsTable.category, "removed"), eq(eventsTable.hidden, false)))
    .orderBy(eventsTable.rank);

  const [contests, events] = await Promise.all([contestsPromise, eventsPromise]);

  return (
    <div>
      <h2 className="mb-4 text-center">All contests</h2>

      <AffiliateLink type="other" />

      {events.length === 0 ? (
        <LoadingError loadingEntity="contests" />
      ) : (
        <>
          <div className="mb-3 px-2">
            <div className="alert alert-warning mb-4" role="alert">
              The website just received a major update! Read our <Link href="/posts/the-big-update">blog post</Link> to
              learn more.
            </div>

            <EventButtons key={eventId} eventId={eventId} events={events} forPage="competitions" />
            <div style={{ maxWidth: "24rem" }}>
              <RegionSelect />
            </div>
          </div>

          {contests.length === 0 ? (
            <p className="fs-5 mx-3">No contests have been held yet</p>
          ) : (
            <ContestsTable contests={contests} />
          )}
        </>
      )}
    </div>
  );
}

export default ContestsPage;
