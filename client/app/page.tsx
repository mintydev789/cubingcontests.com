import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ne } from "drizzle-orm";
import Link from "next/link";
import CollectiveCubing from "~/app/components/CollectiveCubing.tsx";
import { C } from "~/helpers/constants.ts";
import { db } from "~/server/db/provider.ts";
import {
  collectiveSolutionsPublicCols,
  collectiveSolutionsTable as csTable,
} from "../server/db/schema/collective-solutions.ts";
import PartialHomePageDetails from "./components/PartialHomePageDetails.tsx";

async function HomePage() {
  const [collectiveSolution] = await db
    .select(collectiveSolutionsPublicCols)
    .from(csTable)
    .where(ne(csTable.state, "archived"))
    .limit(1);

  return (
    <div className="px-3">
      <h1 className="mb-4 text-center">Cubing Contests</h1>

      <div className="alert alert-warning mb-4" role="alert">
        The website just received a major update! Read our <Link href="/posts/the-big-update">blog post</Link> to learn
        more.
      </div>

      <div className="alert alert-light mb-4" role="alert">
        Join the Cubing Contests{" "}
        <a href={C.discordServerLink} target="_blank" rel="noopener noreferrer">
          Discord server
        </a>
        !
      </div>

      <p>
        This is a place for hosting unofficial Rubik's Cube competitions, unofficial events held at{" "}
        <a href="https://www.worldcubeassociation.org/" target="_blank" rel="noopener">
          WCA
        </a>{" "}
        competitions, speedcuber meetups, and other unofficial events.
      </p>
      <p>
        The events are split up into multiple categories: Unofficial, WCA, Extreme BLD, and Miscellaneous. Extreme BLD
        events are not meant to be done in a competition-like setting, but instead need to be submitted individually
        with video evidence. Some other events also allow submitted results.
      </p>

      <div className="d-flex justify-content-center fs-5 my-4 flex-column flex-md-row gap-3 gap-lg-4 align-items-center">
        <Link href="/about" prefetch={false} className="cc-homepage-link btn btn-primary">
          About Us
        </Link>
        <Link href="/competitions" prefetch={false} className="cc-homepage-link btn btn-primary">
          See All Contests
        </Link>
        <Link href="/records" prefetch={false} className="cc-homepage-link btn btn-primary">
          See Current Records
        </Link>
        <Link href="/rankings" prefetch={false} className="cc-homepage-link btn btn-primary">
          See Rankings
        </Link>
      </div>

      <h3 className="cc-basic-heading">Holding a contest</h3>
      <p>
        Cubing Contests is an open platform where anyone can hold their competitions and meetups. However, you must
        first be granted moderator access to be able to create new contests. If you would like to hold unofficial events
        at a WCA competition or create an unofficial competition or meetup, you must first read the moderator
        instructions.
      </p>
      <div className="fw-bold mx-3 mt-4 rounded-3 border p-3">
        <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
        Please note that an unofficial competition can only be hosted on Cubing Contests if it's infeasible for it to be
        held as an official{" "}
        <a href="https://www.worldcubeassociation.org/" target="_blank" rel="noopener">
          WCA
        </a>{" "}
        competition.
      </div>
      <Link href="/moderator-instructions" prefetch={false} className="btn btn-secondary mt-4">
        Moderator Instructions
      </Link>

      <PartialHomePageDetails />

      <h3 className="cc-basic-heading">Collective Cubing</h3>

      <CollectiveCubing initCollectiveSolution={collectiveSolution ?? null} />
    </div>
  );
}

export default HomePage;
