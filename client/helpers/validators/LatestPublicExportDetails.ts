import z from "zod";

export const LatestPublicExportDetailsValidator = z.strictObject({
  publicUrl: z.url(),
  fileName: z.string().nonempty(),
  exportDate: z.iso.datetime(),
});

export type LatestPublicExportDetailsDto = z.infer<typeof LatestPublicExportDetailsValidator>;
