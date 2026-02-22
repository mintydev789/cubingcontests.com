export const C = {
  cubingContestsHostname: "cubingcontests.com",
  sourceCodeLink: "https://github.com/mintydev789/cubingcontests.com",
  discordServerLink: "https://discord.gg/7rRMQA8jnU", // this is hardcoded in .mdx
  fetchDebounceTimeout: 600, // the timeout in ms between doing repetitive fetch requests that need to be limited
  maxRounds: 4,
  minResultsForThreeMoreRounds: 100,
  minResultsForTwoMoreRounds: 16,
  minResultsForOneMoreRound: 8,
  maxTime: 24 * 60 * 60 * 100, // 24 hours
  maxTimeHumanReadable: "24000000", // MUST MATCH maxTime!
  maxResult: 999_999_999_999_999, // accounts for max possible Multi-Blind result
  maxFmMoves: 999,
  maxTimeLimit: 60 * 60 * 100, // 1 hour
  defaultTimeLimit: 10 * 60 * 100, // 10 minutes
  minCompetitorLimit: 5,
  minCompetitorsForNonWca: 3,
  maxConfirmationCodeAttempts: 3,
  minProceedNumber: 2,
  maxProceedPercentage: 75,
  maxTotalEvents: 30, // this is hardcoded on the rules page
  maxTotalMeetupEvents: 15, // this is hardcoded on the rules page
  maxPersonMatches: 6,
  maxRankings: 100_000,
  maxUsers: 5000,
  duePerCompetitor: 0.1,
  wcaApiBaseUrl: "https://api.worldcubeassociation.org",
  wcaV0ApiBaseUrl: "https://www.worldcubeassociation.org/api/v0",
  wcaIdRegex: /[0-9]{4}[A-Z]{4}[0-9]{2}/,
  wcaIdRegexLoose: /[0-9]{4}[a-zA-Z]{4}[0-9]{2}/, // allows lowercase letters too
  // From this date onwards, average records are only set for results with the same number of attempts as the ranked average format
  cutoffDateForFlexibleAverageRecords: "2023-01-01T00:00:00.000Z",
  navigationKeys: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"],
  moneroDonationAddress:
    "8AaML2et9RQKmZp4NYm9STKbjhfFB4h81ZxeGV166oapNzPFUTneaRmakwE61cyHr1ZUYreEU7eHF8XmMBykG8TpAwM6SVq",
  unknownErrorMsg: "Unknown error",
  videoNoLongerAvailableMsg: "Video no longer available",
  color: {
    // These are the same as the Bootstrap colors
    primary: "#0d6efd",
    success: "#198754",
    warning: "#ffc107",
    danger: "#dc3545",
  },
};

export const IS_CUBING_CONTESTS_INSTANCE = new RegExp(`https://${C.cubingContestsHostname}`).test(
  process.env.NEXT_PUBLIC_BASE_URL ?? "",
);

export const PUBLIC_EXPORTS_FORMAT_VERSIONS = ["v1"];

export const PUBLIC_EXPORTS_README = `# ${process.env.NEXT_PUBLIC_PROJECT_NAME} Database Export Readme

- Export format version: ${PUBLIC_EXPORTS_FORMAT_VERSIONS.at(-1)}
- Website: ${process.env.NEXT_PUBLIC_BASE_URL}

This is a database export for ${process.env.NEXT_PUBLIC_PROJECT_NAME}. When opening one of the CSV files, make sure to set , (comma) as the separator and " (double quote) as the string delimiter.

## License

The results in these exports are available under the [CC Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/) license.

## Using the export files

The CSV files can be used directly for putting together various statistics based on the data. They can also be imported using Supabase (e.g. for testing the website using real data in local development). The import process is as follows:

1. Go to "Table Editor" and select schema \`${process.env.RR_DB_SCHEMA}\`.
2. Click "Insert" -> "Import data from CSV".
3. Deselect \`id\` column in "Configure import data" and click "Import data".

## Attempt results

The results are stored in a format based on the WCA format. See the [WCA exports page](https://www.worldcubeassociation.org/export/results) for the details. The differences are outlined below.

Results for events of the "time" type use the max time value (${C.maxTime}) for unknown time. This is used for Extreme BLD results, where the mere evidence of a successful attempt is an achievement in and of itself. This can only be set by an admin.

Results for events of the "multi" type are based on the WCA multi format. The difference is that these exports omit the leading 0/1 character (all results are based on the new format), allow multi results up to 9999 cubes instead of 99, time is stored as centiseconds instead of seconds, and DNFs are stored with all of the same information (e.g. "DNF (5/12 52:13)"), just as negative numbers. So the full format using WCA notation is as follows:

\`\`\`
(-)DDDDTTTTTTTMMMM

isDnf              = the result is a negative value (all DNFs are treated as tied)
difference         = 9999 - |DDDD| (the latter is the absolute value of solved - missed, to accommodate DNFs)
timeInCentiseconds = TTTTTTT (${C.maxTime} means unknown time and is the maximum time value)
missed             = MMMM
solved             = difference + missed
attempted          = solved + missed
\`\`\`
`;
