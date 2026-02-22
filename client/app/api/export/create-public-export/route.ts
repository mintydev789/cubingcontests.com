import { StorageClient } from "@supabase/storage-js";
import { format } from "date-fns";
import { eq, notInArray } from "drizzle-orm";
import JSZip from "jszip";
import type { NextRequest } from "next/server";
import { PUBLIC_EXPORTS_FORMAT_VERSIONS, PUBLIC_EXPORTS_README } from "~/helpers/constants.ts";
import { generateCsv } from "~/helpers/utilityFunctions.ts";
import { db } from "~/server/db/provider.ts";
import { contestsPublicCols, contestsTable } from "~/server/db/schema/contests.ts";
import { eventsPublicCols, eventsTable } from "~/server/db/schema/events.ts";
import { personsPublicCols, personsTable } from "~/server/db/schema/persons.ts";
import { resultsPublicCols, resultsTable } from "~/server/db/schema/results.ts";
import { roundsPublicCols, roundsTable } from "~/server/db/schema/rounds.ts";

export async function POST(req: NextRequest) {
  if (!process.env.SERVICE_ROLE_KEY) {
    console.error("SERVICE_ROLE_KEY environment variable not set!");
    return new Response("Internal Server Error", { status: 500 });
  }
  if (!process.env.SUPABASE_STORAGE_URL) {
    console.error("SUPABASE_STORAGE_URL environment variable not set!");
    return new Response("Internal Server Error", { status: 500 });
  }
  if (!process.env.PUBLIC_EXPORTS_BUCKET_NAME) {
    console.error("PUBLIC_EXPORTS_BUCKET_NAME environment variable not set!");
    return new Response("Internal Server Error", { status: 500 });
  }
  if (!process.env.NEXT_PUBLIC_EXPORTS_TO_KEEP) {
    console.error("NEXT_PUBLIC_EXPORTS_TO_KEEP environment variable not set!");
    return new Response("Internal Server Error", { status: 500 });
  }
  if (!process.env.NEXT_PUBLIC_PROJECT_NAME) {
    console.error("NEXT_PUBLIC_PROJECT_NAME environment variable not set!");
    return new Response("Internal Server Error", { status: 500 });
  }

  if (process.env.NEXT_PUBLIC_EXPORTS_TO_KEEP === "0")
    return new Response("NEXT_PUBLIC_EXPORTS_TO_KEEP is set to 0", { status: 500 });

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token || token !== process.env.SERVICE_ROLE_KEY) return new Response("Unauthorized", { status: 401 });

  const storageClient = new StorageClient(process.env.SUPABASE_STORAGE_URL, {
    apikey: process.env.SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SERVICE_ROLE_KEY}`,
  });
  const { data, error } = await storageClient.listBuckets();
  if (error) return new Response(`Error while fetching list of buckets: ${error.message}`, { status: 500 });

  const exportFormatVersion = PUBLIC_EXPORTS_FORMAT_VERSIONS.at(-1);
  let existingExports: string[] | undefined;

  if (data.some((bucket) => bucket.name === process.env.PUBLIC_EXPORTS_BUCKET_NAME)) {
    // Get contents of the directory with the exports for the given version, to delete the oldest archives
    // at the end (it's assumed the files are returned already sorted by date)
    const { data, error } = await storageClient.from(process.env.PUBLIC_EXPORTS_BUCKET_NAME).list(exportFormatVersion);
    if (error) return new Response(`Error while fetching list of export files: ${error.message}`, { status: 500 });

    if (data.length > 0) existingExports = data.map((file) => `${exportFormatVersion}/${file.name}`);
  } else {
    // Create bucket for public exports
    await storageClient.createBucket(process.env.PUBLIC_EXPORTS_BUCKET_NAME, {
      public: true,
      allowedMimeTypes: ["application/zip"],
    });
    console.log(`Created bucket "${process.env.PUBLIC_EXPORTS_BUCKET_NAME}"`);
  }

  // Generate export archive
  const zip = new JSZip();
  const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");

  zip.file(
    "metadata.json",
    JSON.stringify(
      {
        export_format_version: exportFormatVersion,
        export_date: timestamp.split("_").at(0),
      },
      null,
      2,
    ),
  );

  zip.file("README.md", PUBLIC_EXPORTS_README);

  const eventsCsv = generateCsv(
    await db
      .select({
        ...eventsPublicCols,
        rule: eventsTable.rule,
        createdAt: eventsTable.createdAt,
        updatedAt: eventsTable.updatedAt,
      })
      .from(eventsTable)
      .orderBy(eventsTable.id),
  );
  zip.file("export_events.csv", eventsCsv);

  const personsCsv = generateCsv(
    await db
      .select({ ...personsPublicCols, createdAt: personsTable.createdAt, updatedAt: personsTable.updatedAt })
      .from(personsTable)
      .orderBy(personsTable.id),
  );
  zip.file("export_persons.csv", personsCsv);

  const contestsFilter = notInArray(contestsTable.state, ["created", "removed"]);
  const contestsCsv = generateCsv(
    await db
      .select({
        ...contestsPublicCols,
        schedule: contestsTable.schedule,
        createdAt: contestsTable.createdAt,
        updatedAt: contestsTable.updatedAt,
      })
      .from(contestsTable)
      .where(contestsFilter)
      .orderBy(contestsTable.id),
  );
  zip.file("export_contests.csv", contestsCsv);

  const roundsCsv = generateCsv(
    await db
      .select({ ...roundsPublicCols, createdAt: roundsTable.createdAt, updatedAt: roundsTable.updatedAt })
      .from(roundsTable)
      .leftJoin(contestsTable, eq(roundsTable.competitionId, contestsTable.competitionId))
      .where(contestsFilter)
      .orderBy(roundsTable.id),
  );
  zip.file("export_rounds.csv", roundsCsv);

  const resultsCsv = generateCsv(
    await db
      .select({ ...resultsPublicCols, createdAt: resultsTable.createdAt, updatedAt: resultsTable.updatedAt })
      .from(resultsTable)
      .orderBy(resultsTable.id),
  );
  zip.file("export_results.csv", resultsCsv);

  const blob = await zip.generateAsync({ type: "blob" });

  // Save export archive in Supabase storage
  const cleanProjectName = process.env.NEXT_PUBLIC_PROJECT_NAME.replace(/[^a-zA-Z0-9]/g, "");
  const filePath = `${exportFormatVersion}/${cleanProjectName}_export_${exportFormatVersion}_${timestamp}.zip`;

  const { error: error2 } = await storageClient.from(process.env.PUBLIC_EXPORTS_BUCKET_NAME).upload(filePath, blob);
  if (error2) return new Response(`Error while uploading file: ${error2.message}`, { status: 500 });

  // Delete oldest export(s)
  const exportsToKeep = parseInt(process.env.NEXT_PUBLIC_EXPORTS_TO_KEEP, 10);
  if (existingExports && existingExports.length + 1 > exportsToKeep) {
    const { error } = await storageClient
      .from(process.env.PUBLIC_EXPORTS_BUCKET_NAME)
      .remove(existingExports.slice(0, existingExports.length + 1 - exportsToKeep));
    if (error) return new Response(`Error while deleting oldest archive: ${error.message}`, { status: 500 });
  }

  return Response.json({}, { status: 200 });
}
