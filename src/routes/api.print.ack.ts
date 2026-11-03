import { createFileRoute } from "@tanstack/react-router";
import { getDashboardSession } from "@/lib/dashboard/google-auth.server";
import { acknowledgePrintJob } from "@/lib/print/storage.server";

export const Route = createFileRoute("/api/print/ack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = getDashboardSession(request);
        if (!user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        try {
          const body = (await request.json()) as { jobId?: unknown };
          if (typeof body.jobId !== "string" || !body.jobId) {
            return Response.json({ error: "Missing or invalid jobId" }, { status: 400 });
          }

          const success = await acknowledgePrintJob(body.jobId, user.email);
          return Response.json({ success });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Acknowledgment failed." },
            { status: 500 },
          );
        }
      },
    },
  },
});
