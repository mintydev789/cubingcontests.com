import { C } from "~/helpers/constants.ts";
import type { Ranking, RecordRanking } from "~/helpers/types/Rankings";

type Props = {
  ranking: Ranking | RecordRanking;
};

function RankingLinks({ ranking }: Props) {
  return (
    <div className="d-flex gap-2">
      {ranking.videoLink ? (
        <a href={ranking.videoLink} target="_blank" rel="noopener noreferrer">
          Video
        </a>
      ) : (
        C.videoNoLongerAvailableMsg
      )}
      {ranking.discussionLink && (
        <a href={ranking.discussionLink} target="_blank" rel="noopener noreferrer">
          Discussion
        </a>
      )}
    </div>
  );
}

export default RankingLinks;
