import { StorageClient } from "@supabase/storage-js";
import type { NextRequest } from "next/server";
import z from "zod";
import { PUBLIC_EXPORTS_FORMAT_VERSIONS } from "~/helpers/constants";
import type { LatestPublicExportDetailsDto } from "~/helpers/validators/LatestPublicExportDetails";

export async function GET(req: NextRequest, { params }: RouteContext<"/api/export/[version]/csv">) {
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

  const parsedParams = z.strictObject({ version: z.enum(PUBLIC_EXPORTS_FORMAT_VERSIONS) }).safeParse(await params);
  if (!parsedParams.success) return new Response(`Validation error: ${parsedParams.error}`, { status: 400 });
  const { version: exportFormatVersion } = parsedParams.data;
  const searchParams = req.nextUrl.searchParams;

  const storageClient = new StorageClient(process.env.SUPABASE_STORAGE_URL, {
    apikey: process.env.SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SERVICE_ROLE_KEY}`,
  });

  // Get contents of the directory with the exports for the given version
  const { data, error } = await storageClient.from(process.env.PUBLIC_EXPORTS_BUCKET_NAME).list(exportFormatVersion);
  if (error) return new Response(`Error while fetching list of export files: ${error.message}`, { status: 500 });
  if (data.length === 0) return new Response("No public exports have been generated yet", { status: 500 });
  const latestExport = data.at(-1)!;
  const filePath = `${exportFormatVersion}/${latestExport.name}`;

  if (searchParams.get("metadataOnly") === "true") {
    // Respond with the metadata of the latest export
    const {
      data: { publicUrl },
    } = await storageClient.from(process.env.PUBLIC_EXPORTS_BUCKET_NAME).getPublicUrl(filePath);

    return Response.json(
      {
        publicUrl,
        fileName: latestExport.name,
        exportDate: latestExport.created_at,
      } satisfies LatestPublicExportDetailsDto,
      { status: 200 },
    );
  } else {
    // Respond with the blob of the latest export
    const { data, error } = await storageClient.from(process.env.PUBLIC_EXPORTS_BUCKET_NAME).download(filePath);
    if (error) return new Response(`Error while fetching export file: ${error.message}`, { status: 500 });

    return new Response(data, { status: 200 });
  }
}
