import omitBy from "lodash/omitBy";
import Link from "next/link";
import AffiliateLink from "~/app/components/AffiliateLink.tsx";
import Competitors from "~/app/components/Competitors.tsx";
import EventTitle from "~/app/components/EventTitle.tsx";
import RankingLinks from "~/app/components/RankingLinks.tsx";
import RankingRow from "~/app/components/RankingRow";
import Solves from "~/app/components/Solves.tsx";
import Tabs from "~/app/components/UI/Tabs.tsx";
import RegionSelect from "~/app/rankings/[eventId]/[singleOrAvg]/RegionSelect";
import { eventCategories } from "~/helpers/eventCategories.ts";
import type { NavigationItem } from "~/helpers/types/NavigationItem.ts";
import type { EventRecords, RecordRanking } from "~/helpers/types/Rankings";
import type { RecordCategory } from "~/helpers/types.ts";
import { getFormattedDate, getFormattedTime } from "~/helpers/utilityFunctions.ts";
import { db } from "~/server/db/provider";
import { getRankings } from "~/server/serverUtilityFunctions";

export const metadata = {
  title: "Records | Cubing Contests",
  description: "Records from unofficial Rubik's Cube competitions and speedcuber meetups.",
  keywords:
    "records rankings rubik's rubiks cube contest contests competition competitions meetup meetups speedcubing speed cubing puzzle",
  icons: { icon: "/favicon.png" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL!),
  openGraph: {
    images: ["/screenshots/cubing_contests_3.jpg"],
  },
};

type Props = {
  params: Promise<{ eventCategory: string }>;
  searchParams: Promise<{
    category?: RecordCategory | "all";
    region?: string;
  }>;
};

async function RecordsPage({ params, searchParams }: Props) {
  const { eventCategory } = await params;
  const { category, region } = await searchParams;

  const urlSearchParams = new URLSearchParams(omitBy({ category, region } as any, (val) => !val));
  const urlSearchParamsWithoutCategory = new URLSearchParams(omitBy({ region } as any, (val) => !val));

  const events = await db.query.events.findMany({
    where: { AND: [{ hidden: false }, { category: eventCategory }] },
    orderBy: { rank: "asc" },
  });

  const recordCategory = category ?? (eventCategory === "extreme-bld" ? "video-based-results" : "competitions");
  const records: EventRecords[] = [];
  let hasComp = false;
  let hasLink = false;

  for (const event of events) {
    const singleRecords = await getRankings(event, "best", recordCategory, { show: "results", region, topN: 1 });
    const averageRecords = await getRankings(event, "average", recordCategory, { show: "results", region, topN: 1 });

    if (singleRecords.length > 0) {
      records.push({
        event,
        records: [
          ...singleRecords.map((r): RecordRanking => ({ ...r, type: "single" })),
          ...averageRecords.map((r): RecordRanking => ({ ...r, type: "average" })),
        ],
      });

      hasComp = hasComp || records.at(-1)!.records.some((r) => r.contest);
      hasLink = hasLink || records.at(-1)!.records.some((r) => r.videoLink || r.discussionLink);
    }
  }

  const selectedCat = eventCategories.find((ec) => ec.value === eventCategory)!;
  const tabs: NavigationItem[] = eventCategories.map((cat) => ({
    title: cat.title,
    shortTitle: cat.shortTitle,
    value: cat.value,
    route: `/records/${cat.value}?${urlSearchParams}`,
    hidden: cat.value === "removed",
  }));

  return (
    <div>
      <h2 className="mb-4 text-center">Records</h2>

      <AffiliateLink type={eventCategory === "unofficial" ? "fto" : eventCategory === "wca" ? "wca" : "other"} />

      <div className="alert alert-warning mx-2 mb-4" role="alert">
        The website just received a major update! Read our <Link href="/posts/the-big-update">blog post</Link> to learn
        more.
      </div>

      {records.length === 0 ? (
        <p className="fs-5 mx-2">No records have been set yet</p>
      ) : (
        <>
          <Tabs tabs={tabs} activeTab={eventCategory} forServerSidePage />

          {selectedCat.description && <p className="mx-2">{selectedCat.description}</p>}

          {/* Similar code to the rankings page */}
          <div className="d-flex flex-wrap gap-3 px-2">
            <RegionSelect />

            <div>
              <h5>Category</h5>
              {/* biome-ignore lint/a11y/useSemanticElements: this is the most suitable way to make a button group */}
              <div className="btn-group btn-group-sm mt-2" role="group" aria-label="Contest Type">
                <Link
                  href={`/records/${eventCategory}?${
                    urlSearchParamsWithoutCategory.toString() ? `${urlSearchParamsWithoutCategory}&` : ""
                  }category=competitions`}
                  prefetch={false}
                  className={`btn btn-primary ${recordCategory === "competitions" ? "active" : ""}`}
                >
                  Competitions
                </Link>
                <Link
                  href={`/records/${eventCategory}/?${
                    urlSearchParamsWithoutCategory.toString() ? `${urlSearchParamsWithoutCategory}&` : ""
                  }category=meetups`}
                  prefetch={false}
                  className={`btn btn-primary ${recordCategory === "meetups" ? "active" : ""}`}
                >
                  Meetups
                </Link>
                <Link
                  href={`/records/${eventCategory}?${
                    urlSearchParamsWithoutCategory.toString() ? `${urlSearchParamsWithoutCategory}&` : ""
                  }category=video-based-results`}
                  prefetch={false}
                  className={`btn btn-primary ${recordCategory === "video-based-results" ? "active" : ""}`}
                >
                  Video-based
                </Link>
                <Link
                  href={`/records/${eventCategory}?${
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

          {eventCategory === "extremebld" && (
            <Link href="/user/submit-results" prefetch={false} className="btn btn-success btn ms-2">
              Submit a result
            </Link>
          )}

          <div className="mt-4">
            {records.map(({ event, records: eventRecords }) => {
              return (
                <div key={event.eventId} className="mb-3">
                  <EventTitle event={event} showIcon linkToRankings showDescription />

                  {/* MOBILE VIEW */}
                  <div className="d-lg-none mt-2 mb-4 border-bottom border-top">
                    <ul className="list-group list-group-flush">
                      {eventRecords.map((r) => (
                        <li
                          key={r.rankingId}
                          className="d-flex flex-column list-group-item list-group-item-secondary gap-2 py-3"
                        >
                          <div className="d-flex justify-content-between">
                            <span>
                              <b>{getFormattedTime(r.result, { event })}</b>
                              &#8194;
                              {r.type === "single" ? "Single" : r.attempts.length === 3 ? "Mean" : "Average"}
                            </span>
                            {r.contest ? (
                              <Link href={`/competitions/${r.contest.competitionId}`} prefetch={false}>
                                {getFormattedDate(r.date)}
                              </Link>
                            ) : (
                              <span>{getFormattedDate(r.date)}</span>
                            )}
                          </div>
                          <Competitors persons={r.persons} vertical />
                          {r.attempts && <Solves event={event} attempts={r.attempts} />}
                          {!r.contest && <RankingLinks ranking={r} />}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* DESKTOP VIEW */}
                  <div className="d-none d-lg-block">
                    <div className="table-responsive flex-grow-1">
                      <table className="table-hover table-responsive table text-nowrap">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Name</th>
                            <th>Result</th>
                            <th>Representing</th>
                            <th>Date</th>
                            <th>
                              {hasComp ? "Contest" : ""}
                              {hasComp && hasLink ? " / " : ""}
                              {hasLink ? "Links" : ""}
                            </th>
                            <th>Solves</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eventRecords.map((ranking) =>
                            ranking.persons.map((person, i) => (
                              <RankingRow
                                key={`${ranking.rankingId}_${person.id}`}
                                type={ranking.type === "average" ? "average-record" : "single-record"}
                                ranking={ranking}
                                event={event}
                                showOnlyPersonWithId={i === 0 ? undefined : i}
                              />
                            )),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default RecordsPage;
