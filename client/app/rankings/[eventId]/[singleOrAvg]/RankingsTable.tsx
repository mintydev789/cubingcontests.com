"use client";

import { use } from "react";
import RankingRow from "~/app/components/RankingRow";
import type { Ranking } from "~/helpers/types/Rankings";
import type { EventResponse } from "~/server/db/schema/events";

type Props = {
  rankingsPromise: Promise<Ranking[]>;
  event: EventResponse;
  singleOrAvg: "single" | "average";
  show?: "results";
};

function RankingsTable({ rankingsPromise, event, singleOrAvg, show }: Props) {
  const rankings = use(rankingsPromise);

  const hasComp = rankings.some((r) => r.contest);
  const hasLink = rankings.some((r) => r.videoLink || r.discussionLink);
  const showAllTeammates = event && event.participants > 1 && show === "results";
  const showTeamColumn = event && event.participants > 1 && !showAllTeammates;
  const showDetailsColumn = singleOrAvg === "average" || rankings.some((e) => e.memo);

  return (
    <div className="table-responsive flex-grow-1">
      <table className="table-hover table-responsive table text-nowrap">
        <thead>
          <tr>
            <th>#</th>
            <th>{!showAllTeammates ? "Name" : "Team"}</th>
            <th>Result</th>
            {!showAllTeammates && <th>Representing</th>}
            <th>Date</th>
            <th>
              {hasComp ? "Contest" : ""}
              {hasComp && hasLink ? " / " : ""}
              {hasLink ? "Links" : ""}
            </th>
            {showTeamColumn && <th>Team</th>}
            {showDetailsColumn && <th>{singleOrAvg === "average" ? "Solves" : "Memorization time"}</th>}
          </tr>
        </thead>
        <tbody>
          {rankings.length === 0 ? (
            <p className="fs-5 mx-2 mt-4">No rankings found matching the requested parameters</p>
          ) : (
            rankings.map((ranking, i) => (
              <RankingRow
                key={ranking.rankingId}
                type={singleOrAvg === "single" ? "single-ranking" : "average-ranking"}
                ranking={ranking}
                isTiedRanking={ranking.ranking !== i + 1}
                event={event}
                showAllTeammates={showAllTeammates}
                showTeamColumn={showTeamColumn}
                showDetailsColumn={showDetailsColumn}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default RankingsTable;
