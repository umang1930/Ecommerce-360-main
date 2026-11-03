import { createFileRoute } from "@tanstack/react-router";
import { getDashboardSession } from "@/lib/dashboard/google-auth.server";
import { getPrintJob, updatePrintJobStatus } from "@/lib/print/storage.server";
import { verifyPrinterJobStatus } from "@/lib/print/cloud-printer.server";

export const Route = createFileRoute("/api/print/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = getDashboardSession(request);
        if (!user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const jobId = url.searchParams.get("jobId");

        if (!jobId) {
          return Response.json({ error: "Missing jobId parameter" }, { status: 400 });
        }

        const job = await getPrintJob(jobId);
        if (!job) {
          return Response.json({ error: "Print job not found" }, { status: 404 });
        }

        // Strict isolation: ensure the user can only inspect their own print jobs
        if (job.userId !== user.email) {
          return Response.json({ error: "Access denied to this print job" }, { status: 403 });
        }

        // If the job is currently processing or queued, perform a fresh check
        if ((job.status === "PROCESSING" || job.status === "QUEUED") && job.providerJobId) {
          try {
            const check = await verifyPrinterJobStatus(job);
            if (check.status !== job.status) {
              const updated = await updatePrintJobStatus(job.jobId, {
                status: check.status,
                finalResult: check.finalResult,
                errorInfo: check.errorInfo,
              });
              if (updated) {
                return Response.json({ job: updated });
              }
            }
          } catch (err) {
            console.warn(`[Print Status Check] Live check failed for ${jobId}:`, err);
          }
        }

        return Response.json({ job });
      },
    },
  },
});
