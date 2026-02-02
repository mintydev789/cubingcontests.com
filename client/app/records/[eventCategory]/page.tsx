import omitBy from "lodash/omitBy";
import Link from "next/link";
import { Suspense } from "react";
import AffiliateLink from "~/app/components/AffiliateLink.tsx";
import Loading from "~/app/components/UI/Loading";
import Tabs from "~/app/components/UI/Tabs.tsx";
import RegionSelect from "~/app/rankings/[eventId]/[singleOrAvg]/RegionSelect";
import RecordsTable from "~/app/records/[eventCategory]/RecordsTable";
import { eventCategories } from "~/helpers/eventCategories.ts";
import type { NavigationItem } from "~/helpers/types/NavigationItem.ts";
import type { RecordCategory } from "~/helpers/types.ts";
import { getRecords } from "~/server/serverUtilityFunctions";

export const metadata = {
  title: "Records | Cubing Contests",
  description: "Records from unofficial Rubik's Cube competitions and speedcuber meetups.",
  keywords:
    "records rankings rubik's rubiks cube contest contests competition competitions meetup meetups speedcubing speed cubing puzzle",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL!),
  openGraph: {
    images: [`${process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BUCKET_BASE_URL}/assets/screenshots/cubing_contests_3.jpg`],
  },
};

type Props = {
  params: Promise<{ eventCategory: string }>;
  searchParams: Promise<{
    category?: RecordCategory;
    region?: string;
  }>;
};

async function RecordsPage({ params, searchParams }: Props) {
  const { eventCategory } = await params;
  const { category, region } = await searchParams;

  const urlSearchParams = new URLSearchParams(omitBy({ category, region } as any, (val) => !val));
  const urlSearchParamsWithoutCategory = new URLSearchParams(omitBy({ region } as any, (val) => !val));

  const recordCategory = category ?? (eventCategory === "extreme-bld" ? "video-based-results" : "competitions");

  const recordsDataPromise = getRecords(eventCategory, recordCategory, region);

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
        The website just received a major update! Read our{" "}
        <Link href="/posts/the-big-update" prefetch={false}>
          blog post
        </Link>{" "}
        to learn more.
      </div>

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
          </div>
        </div>
      </div>

      {eventCategory === "extremebld" && (
        <Link href="/user/submit-results" prefetch={false} className="btn btn-success btn ms-2">
          Submit a result
        </Link>
      )}

      <Suspense fallback={<Loading />}>
        <RecordsTable recordsDataPromise={recordsDataPromise} />
      </Suspense>
    </div>
  );
}

export default RecordsPage;
