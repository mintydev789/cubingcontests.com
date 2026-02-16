import { StorageClient } from "@supabase/storage-js";
import type { NextRequest } from "next/server";

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
      allowedMimeTypes: ["application/gzip"],
    });
    console.log(`Created bucket "${process.env.PUBLIC_EXPORTS_BUCKET_NAME}"`);
  }

  // await storageClient.from(process.env.PUBLIC_BUCKET_NAME).upload("avatar.png", file);

  return Response.json({}, { status: 200 });
}
