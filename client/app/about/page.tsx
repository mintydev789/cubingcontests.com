import PartialHomePageDetails from "~/app/components/PartialHomePageDetails.tsx";
import { db } from "~/server/db/provider";

export const dynamic = "force-dynamic";

async function AboutPage() {
  const adminUsers = await db.query.users.findMany({ columns: { personId: true }, where: { role: "admin" } });
  const adminPersons = await db.query.persons.findMany({
    columns: { id: true, name: true },
    where: { id: { in: adminUsers.map((u) => u.personId!) } },
  });

  return (
    <section className="lh-lg px-3 pb-4">
      <h2 className="mb-4 text-center">About</h2>

      {/* Largely copied from the home page */}
      <p>
        Cubing Contests is a place for hosting unofficial Rubik's Cube competitions, unofficial events held at WCA
        competitions, speedcuber meetups, and other unofficial events.
      </p>
      <p>
        The events are split up into multiple categories: Unofficial, WCA, Extreme BLD, and Miscellaneous. Extreme BLD
        events are not meant to be done in a competition-like setting, but instead need to be submitted individually
        with video evidence. Some other events also allow submitted results.
      </p>

      <h3 className="cc-basic-heading">Mission Statement</h3>
      <p>
        Our mission is to provide the go-to place for unofficial speedcubing results and to give the community the tools
        it needs to host speedcubing events. We aim to serve the interests of the community alongside the World Cube
        Association, and we follow the{" "}
        <a href="https://www.worldcubeassociation.org/about" target="_blank" rel="noopener">
          WCA Spirit
        </a>
        .
      </p>

      <h3 className="cc-basic-heading">The Team</h3>
      <p>
        We are a team of volunteers who work as admins on this website. Our activities include approving contests,
        publishing results, resolving critical incidents, and moderating the Cubing Contests Discord server. The admin
        team consists of the following members:
      </p>
      <ul>
        {adminPersons.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>

      <PartialHomePageDetails />
    </section>
  );
}

export default AboutPage;
