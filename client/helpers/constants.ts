export const C = {
  cubingContestsHostname: "cubingcontests.com",
  sourceCodeLink: "https://github.com/mintydev789/cubingcontests.com",
  discordServerLink: "https://discord.gg/7rRMQA8jnU", // this is hardcoded in .mdx
  fetchDebounceTimeout: 600, // the timeout in ms between doing repetitive fetch requests that need to be limited
  maxRounds: 4,
  minResultsForThreeMoreRounds: 100,
  minResultsForTwoMoreRounds: 16,
  minResultsForOneMoreRound: 8,
  // IF THIS IS EVER UPDATED, ALSO CONSIDER THE LINES WITH 24000000 IN AttemptInput
  maxTime: 24 * 60 * 60 * 100, // 24 hours
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
