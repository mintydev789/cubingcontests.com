import { StorageClient } from "@supabase/storage-js";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  if (!process.env.SERVICE_ROLE_KEY) {
    console.error("SERVICE_ROLE_KEY environment variable not set!");
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
  if (!process.env.PROD_HOSTNAME) {
    console.error("PROD_HOSTNAME environment variable not set!");
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token || token !== process.env.SERVICE_ROLE_KEY)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  throw new Error("NOT IMPLEMENTED!")

  // const storageClient = new StorageClient(`https://supabase.${process.env.PROD_HOSTNAME}/storage/v1`, {
  //   apikey: process.env.SERVICE_ROLE_KEY,
  //   Authorization: `Bearer ${process.env.SERVICE_ROLE_KEY}`,
  // });

  // // TO-DO: MAKE THIS USE ENV VAR FOR THE BUCKET!!!
  // // await storageClient.from("public_exports").upload("avatar.png", file);

  // return Response.json({}, { status: 200 });
}
