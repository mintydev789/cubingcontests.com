"use client";

import omit from "lodash/omit";
import Link from "next/link";
import { use } from "react";
import Competitors from "~/app/components/Competitors.tsx";
import EventTitle from "~/app/components/EventTitle.tsx";
import RankingLinks from "~/app/components/RankingLinks.tsx";
import RankingRow from "~/app/components/RankingRow";
import Solves from "~/app/components/Solves.tsx";
import type { RecordRanking, RecordsData } from "~/helpers/types/Rankings";
import { getFormattedDate, getFormattedTime } from "~/helpers/utilityFunctions.ts";

type Props = {
  recordsDataPromise: Promise<RecordsData>;
};

function RecordsTable({ recordsDataPromise }: Props) {
  const recordsData = use(recordsDataPromise);

  return (
    <div className="mt-4">
      {recordsData.records.length === 0 ? (
        <p className="fs-5 mx-2">No records have been set yet</p>
      ) : (
        recordsData.events.map((event) => {
          const eventRecords: RecordRanking[] = [];
          let hasComp = false;
          let hasLink = false;

          const getCurrentTiedRecords = (type: "single" | "average") => {
            let currentRecordResult: number | undefined;

            for (const record of recordsData.records) {
              if (record.eventId === event.eventId && (record.type === "single-and-avg" || record.type === type)) {
                const result = type === "single" ? record.best : record.average;
                if (!currentRecordResult) currentRecordResult = result;
                else if (result > currentRecordResult) break;

                eventRecords.push({
                  ...omit(record, ["best", "average"]),
                  rankingId: record.rankingId.replace(/_.*$/, `_${type}`),
                  type,
                  result,
                });

                if (record.contest) hasComp = true;
                if (record.videoLink || record.discussionLink) hasLink = true;
              }
            }
          };

          getCurrentTiedRecords("single");
          getCurrentTiedRecords("average");

          return (
            <div key={event.eventId} className="mb-3">
              <EventTitle event={event} showIcon linkToRankings showDescription />

              {/* MOBILE VIEW */}
              <div className="d-lg-none mt-2 mb-4 border-bottom border-top">
                <ul className="list-group list-group-flush">
                  {eventRecords.map((record) => (
                    <li
                      key={record.rankingId}
                      className="d-flex flex-column list-group-item list-group-item-secondary gap-2 py-3"
                    >
                      <div className="d-flex justify-content-between">
                        <span>
                          <b>{getFormattedTime(record.result, { event })}</b>
                          &#8194;
                          {record.type === "single" ? "Single" : record.attempts.length === 3 ? "Mean" : "Average"}
                        </span>
                        {record.contest ? (
                          <Link href={`/competitions/${record.contest.competitionId}`} prefetch={false}>
                            {getFormattedDate(record.date)}
                          </Link>
                        ) : (
                          <span>{getFormattedDate(record.date)}</span>
                        )}
                      </div>
                      <Competitors persons={record.persons} vertical />
                      {record.attempts && <Solves event={event} attempts={record.attempts} />}
                      {!record.contest && <RankingLinks ranking={record} />}
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
                      {eventRecords.map((record) =>
                        record.persons.map((person, i) => (
                          <RankingRow
                            key={`${record.rankingId}_${person.id}`}
                            type={record.type === "average" ? "average-record" : "single-record"}
                            ranking={record}
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
        })
      )}
    </div>
  );
}

export default RecordsTable;
