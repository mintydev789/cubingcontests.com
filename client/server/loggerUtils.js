import { defaultPreparePayload } from "pino-logflare";

// RESTART THE DEV ENVIRONMENT AFTER EDITING THIS FILE!

export const handlePayload = (events, meta) => {
  // The `meta` arg contains cleaned information of raw payload.
  // You can add in top-level keys via this callback, or completely disable `metadata` key nesting by passing the payload as is, as shown below.
  const item = defaultPreparePayload(events, meta);

  item.appname = "recordranks";
  item.metadata = { project_ref: "default", rr_code: meta.cleanedPayload.rrCode };

  if (meta.cleanedPayload.rrMetadata) {
    for (const [key, value] of Object.entries(meta.cleanedPayload.rrMetadata)) {
      item.metadata[`rr_${key}`] = value;
    }
  }

  return item;
};
