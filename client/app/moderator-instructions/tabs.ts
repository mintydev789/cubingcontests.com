import type { NavigationItem } from "~/helpers/types/NavigationItem";

export const tabs: NavigationItem[] = [
  {
    title: "WCA Competition",
    shortTitle: "WCA",
    value: "wca",
    route: "/moderator-instructions/wca",
  },
  {
    title: "Unofficial Competition",
    shortTitle: "Unofficial",
    value: "unofficial",
    route: "/moderator-instructions/unofficial",
  },
  {
    title: "Meetup",
    value: "meetup",
    route: "/moderator-instructions/meetup",
  },
];
