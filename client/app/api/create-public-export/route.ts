import { StorageClient } from "@supabase/storage-js";
import { format } from "date-fns";
import { eq, notInArray } from "drizzle-orm";
import JSZip from "jszip";
import type { NextRequest } from "next/server";
import { generateCsv } from "~/helpers/utilityFunctions";
import { db } from "~/server/db/provider.ts";
import { contestsPublicCols, contestsTable } from "~/server/db/schema/contests";
import { eventsPublicCols, eventsTable } from "~/server/db/schema/events.ts";
import { personsPublicCols, personsTable } from "~/server/db/schema/persons";
import { resultsPublicCols, resultsTable } from "~/server/db/schema/results";
import { roundsPublicCols, roundsTable } from "~/server/db/schema/rounds";

export async function POST(req: NextRequest) {
  if (!process.env.SERVICE_ROLE_KEY) {
    console.error("SERVICE_ROLE_KEY environment variable not set!");
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
  if (!process.env.SUPABASE_STORAGE_URL) {
    console.error("SUPABASE_STORAGE_URL environment variable not set!");
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
  if (!process.env.PUBLIC_EXPORTS_BUCKET_NAME) {
    console.error("PUBLIC_EXPORTS_BUCKET_NAME environment variable not set!");
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token || token !== process.env.SERVICE_ROLE_KEY)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const storageClient = new StorageClient(process.env.SUPABASE_STORAGE_URL, {
    apikey: process.env.SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SERVICE_ROLE_KEY}`,
  });

  const { data, error } = await storageClient.listBuckets();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (!data.some((bucket) => bucket.name === process.env.PUBLIC_EXPORTS_BUCKET_NAME)) {
    await storageClient.createBucket(process.env.PUBLIC_EXPORTS_BUCKET_NAME, {
      public: true,
      allowedMimeTypes: ["application/zip"],
    });
    console.log(`Created bucket "${process.env.PUBLIC_EXPORTS_BUCKET_NAME}"`);
  }

  // Generate export archive
  const zip = new JSZip();

  const eventsCsv = generateCsv(
    await db
      .select({
        ...eventsPublicCols,
        rule: eventsTable.rule,
        createdAt: eventsTable.createdAt,
        updatedAt: eventsTable.updatedAt,
      })
      .from(eventsTable),
  );
  zip.file("events.csv", eventsCsv);

  const personsCsv = generateCsv(
    await db
      .select({ ...personsPublicCols, createdAt: personsTable.createdAt, updatedAt: personsTable.updatedAt })
      .from(personsTable),
  );
  zip.file("persons.csv", personsCsv);

  const contestsFilter = notInArray(contestsTable.state, ["created", "removed"])
  const contestsCsv = generateCsv(
    await db
      .select({
        ...contestsPublicCols,
        schedule: contestsTable.schedule,
        createdAt: contestsTable.createdAt,
        updatedAt: contestsTable.updatedAt,
      })
      .from(contestsTable)
      .where(contestsFilter),
  );
  zip.file("contests.csv", contestsCsv);

  const roundsCsv = generateCsv(
    await db
      .select({ ...roundsPublicCols, createdAt: roundsTable.createdAt, updatedAt: roundsTable.updatedAt })
      .from(roundsTable)
      .leftJoin(contestsTable, eq(roundsTable.competitionId, contestsTable.competitionId))
      .where(contestsFilter),
  );
  zip.file("rounds.csv", roundsCsv);

  const resultsCsv = generateCsv(
    await db
      .select({ ...resultsPublicCols, createdAt: resultsTable.createdAt, updatedAt: resultsTable.updatedAt })
      .from(resultsTable)
  );
  zip.file("results.csv", resultsCsv);

  const blob = await zip.generateAsync({ type: "blob" });

  // Save export archive in Supabase storage
  const { error: error2 } = await storageClient
    .from(process.env.PUBLIC_EXPORTS_BUCKET_NAME)
    .upload(`export_${format(new Date(), "yyyy-MM-dd_HH-mm-ss")}.zip`, blob);
  if (error2) return Response.json({ error: error2.message }, { status: 500 });

  return Response.json({}, { status: 200 });
}
