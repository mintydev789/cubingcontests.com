import type { InsertPerson } from "~/server/db/schema/persons.ts";

// All set to approved at the bottom
export const personsStub: (InsertPerson & { id: number })[] = [
  {
    name: "Tom Dillon",
    regionCode: "GB",
  },
  {
    name: "Sam Marsh",
    regionCode: "GB",
  },
  {
    name: "James Stone",
    regionCode: "GB",
  },
  {
    name: "Hans Bauer",
    regionCode: "DE",
  },
  {
    name: "Jakob Bach",
    regionCode: "DE",
  },
  {
    name: "Stefan Steinmeier",
    regionCode: "DE",
  },
  {
    name: "Naoko Yoshida",
    regionCode: "JP",
  },
  {
    name: "Satoshi Nakamura",
    regionCode: "JP",
  },
  {
    name: "Dong-Jun Hyon",
    regionCode: "KR",
  },
  {
    name: "Soo-Min Nam",
    regionCode: "KR",
  },
  {
    name: "John Doe",
    regionCode: "US",
  },
  {
    name: "Jay Scott",
    regionCode: "US",
  },
  {
    name: "Josh Calhoun",
    regionCode: "CA",
  },
  {
    name: "Matt Baker",
    regionCode: "CA",
  },
  {
    name: "Bob Starmer",
    regionCode: "CA",
  },
  {
    name: "Brian Stevenson",
    regionCode: "CA",
  },
].map((p, index) => ({ ...p, id: index + 1, approved: true }));
// The id is set just for testing purposes; it's left out when seeding the mock DB

export const gbPersonTomDillon = personsStub.find((p) => p.name === "Tom Dillon")!;
export const gbPersonSamMarsh = personsStub.find((p) => p.name === "Sam Marsh")!;
export const gbPersonJamesStone = personsStub.find((p) => p.name === "James Stone")!;
export const dePersonHansBauer = personsStub.find((p) => p.name === "Hans Bauer")!;
export const dePersonJakobBach = personsStub.find((p) => p.name === "Jakob Bach")!;
export const dePersonStefanSteinmeier = personsStub.find((p) => p.name === "Stefan Steinmeier")!;
export const jpPersonNaokoYoshida = personsStub.find((p) => p.name === "Naoko Yoshida")!;
export const jpPersonSatoshiNakamura = personsStub.find((p) => p.name === "Satoshi Nakamura")!;
export const krPersonDongJunHyon = personsStub.find((p) => p.name === "Dong-Jun Hyon")!;
export const krPersonSooMinNam = personsStub.find((p) => p.name === "Soo-Min Nam")!;
export const usPersonJohnDoe = personsStub.find((p) => p.name === "John Doe")!;
export const usPersonJayScott = personsStub.find((p) => p.name === "Jay Scott")!;
export const caPersonJoshCalhoun = personsStub.find((p) => p.name === "Josh Calhoun")!;
export const caPersonMattBaker = personsStub.find((p) => p.name === "Matt Baker")!;
export const caPersonBobStarmer = personsStub.find((p) => p.name === "Bob Starmer")!;
export const caPersonBrianStevenson = personsStub.find((p) => p.name === "Brian Stevenson")!;
