import omitBy from "lodash/omitBy";
import Link from "next/link";
import { Suspense } from "react";
import AffiliateLink from "~/app/components/AffiliateLink.tsx";
import EventButtons from "~/app/components/EventButtons.tsx";
import EventTitle from "~/app/components/EventTitle.tsx";
import Loading from "~/app/components/UI/Loading";
import Tooltip from "~/app/components/UI/Tooltip";
import RankingsTable from "~/app/rankings/[eventId]/[singleOrAvg]/RankingsTable";
import RegionSelect from "~/app/rankings/[eventId]/[singleOrAvg]/RegionSelect.tsx";
import type { RecordCategory } from "~/helpers/types";
import { db } from "~/server/db/provider";
import { eventsPublicCols, eventsTable as table } from "~/server/db/schema/events";
import { getRankings } from "~/server/serverUtilityFunctions";

const eventsWith3x3 = [
  "333",
  "333oh",
  "333bf",
  "333bf_oh",
  "333fm",
  "333mbf",
  "333_team_bld",
  "333_team_bld_old",
  "333_linear_fm",
  "333_speed_bld",
  "333mts",
  "333ft",
  "333mbo",
  "333_team_factory",
  "333_one_move_team_factory",
  "333_inspectionless",
  "333_scrambling",
  "333oh_x2",
  "333_oven_mitts",
  "333_doubles",
  "333_one_side",
  "333_supersolve",
  "333_cube_mile",
  "333bf_2_person_relay",
  "333bf_3_person_relay",
  "333bf_4_person_relay",
  "333bf_8_person_relay",
  "333_oh_bld_team_relay",
];

export const metadata = {
  title: "Rankings | Cubing Contests",
  description: "Rankings for unofficial Rubik's Cube competitions and speedcuber meetups.",
  keywords:
    "rankings rubik's rubiks cube contest contests competition competitions meetup meetups speedcubing speed cubing puzzle",
  icons: { icon: "/favicon.png" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL!),
  openGraph: { images: ["/screenshots/cubing_contests_4.jpg"] },
};

type Props = {
  params: Promise<{
    eventId: string;
    singleOrAvg: "single" | "average";
  }>;
  searchParams: Promise<{
    show?: "results";
    category?: RecordCategory | "all";
    region?: string;
    topN?: string;
  }>;
};

async function RankingsPage({ params, searchParams }: Props) {
  const { eventId, singleOrAvg } = await params;
  const { show, category, region, topN } = await searchParams;

  const urlSearchParams = new URLSearchParams(omitBy({ show, category, region, topN } as any, (val) => !val));
  const urlSearchParamsWithoutShow = new URLSearchParams(omitBy({ category, region, topN } as any, (val) => !val));
  const urlSearchParamsWithoutCategory = new URLSearchParams(omitBy({ show, region, topN } as any, (val) => !val));
  const urlSearchParamsWithoutTopN = new URLSearchParams(omitBy({ show, category, region } as any, (val) => !val));

  const events = await db.select(eventsPublicCols).from(table).orderBy(table.rank);

  const visibleEvents = events.filter((e) => e.category !== "removed" && !e.hidden);
  const event = events.find((e) => e.eventId === eventId);
  if (!event) return <p className="fs-4 mt-5 text-center">Event not found</p>;
  const recordCategory =
    category ??
    (event.category === "extreme-bld" || (event.category !== "unofficial" && event.submissionsAllowed)
      ? "video-based-results"
      : "competitions");

  const rankingsPromise = getRankings(event, singleOrAvg === "single" ? "best" : "average", recordCategory, {
    show,
    region,
    topN: topN ? parseInt(topN, 10) : undefined,
  });

  const affiliateLinkType = eventsWith3x3.includes(eventId)
    ? "3x3"
    : ["222", "222bf", "222fm", "222oh"].includes(eventId)
      ? "2x2"
      : event.category === "wca"
        ? "wca"
        : ["fto", "fto_bld", "fto_mbld", "mfto", "baby_fto"].includes(eventId)
          ? "fto"
          : ["333_mirror_blocks", "333_mirror_blocks_bld", "222_mirror_blocks"].includes(eventId)
            ? "mirror"
            : eventId === "kilominx"
              ? "kilominx"
              : "other";

  return (
    <div>
      <h2 className="mb-3 text-center">Rankings</h2>

      <AffiliateLink type={affiliateLinkType} />

      <div className="mb-3 px-2">
        <div className="alert alert-warning mb-4" role="alert">
          The website just received a major update! Read our{" "}
          <Link href="/posts/the-big-update" prefetch={false}>
            blog post
          </Link>{" "}
          to learn more.
        </div>

        <h4>Event</h4>
        <EventButtons eventId={eventId} events={visibleEvents} forPage="rankings" />

        {/* Similar code to the records page */}
        <div className="d-flex mb-4 flex-wrap gap-3">
          <RegionSelect />

          <div className="d-flex flex-wrap gap-3">
            <div>
              <h5 className="d-flex gap-1">
                Type
                {singleOrAvg === "average" && (
                  <Tooltip
                    id="type_tooltip"
                    text="For results from 01.01.2023 onwards this only includes averages that have the ranked average format"
                  />
                )}
              </h5>
              {/* biome-ignore lint/a11y/useSemanticElements: this is the most suitable way to make a button group */}
              <div className="btn-group btn-group-sm mt-2" role="group" aria-label="Type">
                <Link
                  href={`/rankings/${eventId}/single?${urlSearchParams}`}
                  prefetch={false}
                  className={`btn btn-primary ${singleOrAvg === "single" ? "active" : ""}`}
                >
                  Single
                </Link>
                <Link
                  href={`/rankings/${eventId}/average?${urlSearchParams}`}
                  prefetch={false}
                  className={`btn btn-primary ${singleOrAvg === "average" ? "active" : ""}`}
                >
                  {event.defaultRoundFormat === "a" ? "Average" : "Mean"}
                </Link>
              </div>
            </div>

            <div>
              <h5>Show</h5>
              {/* biome-ignore lint/a11y/useSemanticElements: this is the most suitable way to make a button group */}
              <div className="btn-group btn-group-sm mt-2" role="group" aria-label="Show">
                <Link
                  href={`/rankings/${eventId}/${singleOrAvg}?${urlSearchParamsWithoutShow}`}
                  prefetch={false}
                  className={`btn btn-primary ${!show ? "active" : ""}`}
                >
                  Top Persons
                </Link>
                <Link
                  href={`/rankings/${eventId}/${singleOrAvg}?${
                    urlSearchParamsWithoutShow.toString() ? `${urlSearchParamsWithoutShow}&` : ""
                  }show=results`}
                  prefetch={false}
                  className={`btn btn-primary ${show ? "active" : ""}`}
                >
                  Top Results
                </Link>
              </div>
            </div>

            <div>
              <h5>Top</h5>
              {/* biome-ignore lint/a11y/useSemanticElements: this is the most suitable way to make a button group */}
              <div className="btn-group btn-group-sm mt-2" role="group" aria-label="Top">
                <Link
                  href={`/rankings/${eventId}/${singleOrAvg}?${urlSearchParamsWithoutTopN}`}
                  prefetch={false}
                  className={`btn btn-primary ${!topN || topN === "100" ? "active" : ""}`}
                >
                  100
                </Link>
                <Link
                  href={`/rankings/${eventId}/${singleOrAvg}?${
                    urlSearchParamsWithoutTopN.toString() ? `${urlSearchParamsWithoutTopN}&` : ""
                  }topN=1000`}
                  prefetch={false}
                  className={`btn btn-primary ${topN === "1000" ? "active" : ""}`}
                >
                  1000
                </Link>
                <Link
                  href={`/rankings/${eventId}/${singleOrAvg}?${
                    urlSearchParamsWithoutTopN.toString() ? `${urlSearchParamsWithoutTopN}&` : ""
                  }topN=10000`}
                  prefetch={false}
                  className={`btn btn-primary ${topN === "10000" ? "active" : ""}`}
                >
                  10000
                </Link>
              </div>
            </div>

            <div>
              <h5>Category</h5>
              {/* biome-ignore lint/a11y/useSemanticElements: this is the most suitable way to make a button group */}
              <div className="btn-group btn-group-sm mt-2" role="group" aria-label="Contest Type">
                <Link
                  href={`/rankings/${eventId}/${singleOrAvg}?${
                    urlSearchParamsWithoutCategory.toString() ? `${urlSearchParamsWithoutCategory}&` : ""
                  }category=competitions`}
                  prefetch={false}
                  className={`btn btn-primary ${recordCategory === "competitions" ? "active" : ""}`}
                >
                  Competitions
                </Link>
                <Link
                  href={`/rankings/${eventId}/${singleOrAvg}?${
                    urlSearchParamsWithoutCategory.toString() ? `${urlSearchParamsWithoutCategory}&` : ""
                  }category=meetups`}
                  prefetch={false}
                  className={`btn btn-primary ${recordCategory === "meetups" ? "active" : ""}`}
                >
                  Meetups
                </Link>
                <Link
                  href={`/rankings/${eventId}/${singleOrAvg}?${
                    urlSearchParamsWithoutCategory.toString() ? `${urlSearchParamsWithoutCategory}&` : ""
                  }category=video-based-results`}
                  prefetch={false}
                  className={`btn btn-primary ${recordCategory === "video-based-results" ? "active" : ""}`}
                >
                  Video-based
                </Link>
                <Link
                  href={`/rankings/${eventId}/${singleOrAvg}?${
                    urlSearchParamsWithoutCategory.toString() ? `${urlSearchParamsWithoutCategory}&` : ""
                  }category=all`}
                  prefetch={false}
                  className={`btn btn-primary ${recordCategory === "all" ? "active" : ""}`}
                >
                  All
                </Link>
              </div>
            </div>
          </div>
        </div>

        {(event.category === "extreme-bld" || event.submissionsAllowed) && (
          <Link href={`/user/submit-results?eventId=${eventId}`} prefetch={false} className="btn btn-success btn-sm">
            Submit a result
          </Link>
        )}
      </div>

      <EventTitle event={event} showDescription />

      {event.category === "removed" ? (
        <p className="ms-2 text-danger">This is a removed event</p>
      ) : event.hidden ? (
        <p className="ms-2 text-danger">This is a hidden event</p>
      ) : undefined}

      <Suspense fallback={<Loading />}>
        <RankingsTable rankingsPromise={rankingsPromise} event={event} singleOrAvg={singleOrAvg} show={show} />
      </Suspense>
    </div>
  );
}

export default RankingsPage;
