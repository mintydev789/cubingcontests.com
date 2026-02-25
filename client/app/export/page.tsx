import Markdown from "react-markdown";
import LoadingError from "~/app/components/UI/LoadingError";
import { PUBLIC_EXPORTS_FORMAT_VERSIONS, PUBLIC_EXPORTS_README } from "~/helpers/constants";
import { LatestPublicExportDetailsValidator } from "~/helpers/validators/LatestPublicExportDetails";

export const dynamic = "force-dynamic";

async function ExportPage() {
  if (process.env.NEXT_PUBLIC_EXPORTS_TO_KEEP === "0")
    return <p className="fs-4 mx-3 mt-5 text-center">Public exports are disabled</p>;

  const exportApiUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/export/${PUBLIC_EXPORTS_FORMAT_VERSIONS.at(-1)}/csv`;
  const res = await fetch(`${exportApiUrl}?metadataOnly=true`);
  if (!res.ok) return <LoadingError loadingEntity="the latest public export" />;

  const latestExportDetails = LatestPublicExportDetailsValidator.safeParse(await res.json());
  if (!latestExportDetails.success) return <LoadingError loadingEntity="the latest public export" />;
  const { publicUrl, fileName, exportDate } = latestExportDetails.data;

  return (
    <section className="px-3">
      <h2 className="mb-4 text-center">Public Exports</h2>

      <p>
        Here you can find the latest public exports of {process.env.NEXT_PUBLIC_PROJECT_NAME} data. The exports include
        CSV files for contests, rounds, results, events and persons. The exports also include a <code>README.md</code>{" "}
        file and a <code>metadata.json</code> file.
      </p>

      <p>
        <strong>CSV archive</strong>:{" "}
        <a href={publicUrl} download={fileName} className="me-2">
          {fileName}
        </a>
        (
        <a href={exportApiUrl} download={fileName}>
          permalink
        </a>
        )
      </p>

      <p>
        To always get the latest export for the specified export format version, use the permalink. To only get the
        metadata, add <code>?metadataOnly=true</code> to the permalink URL. Then it will return the export date and the
        download URL for the latest export.
      </p>

      <p>
        <strong>Date of last export</strong>: {new Date(exportDate).toLocaleDateString()}
      </p>

      <div className="mt-5">
        <Markdown>{PUBLIC_EXPORTS_README}</Markdown>
      </div>
    </section>
  );
}

export default ExportPage;
