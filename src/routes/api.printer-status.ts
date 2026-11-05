import { createFileRoute } from "@tanstack/react-router";
import { getDashboardSession } from "@/lib/dashboard/google-auth.server";

export const Route = createFileRoute("/api/printer-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!getDashboardSession(request)) {
          return Response.json({ message: "Unauthorized" }, { status: 401 });
        }

        const incomingUrl = new URL(request.url);
        const jobId = incomingUrl.searchParams.get("jobId")?.trim();
        if (!jobId || !/^[A-Za-z0-9_-]+$/.test(jobId)) {
          return Response.json({ message: "Invalid print job ID" }, { status: 400 });
        }

        const baseUrl = import.meta.env.VITE_PRINTER_AUTOMATION_URL?.trim().replace(/\/+$/, "");
        if (!baseUrl) {
          return Response.json({ message: "Printer app is not configured" }, { status: 503 });
        }

        let statusPath = `/api/print/jobs/${encodeURIComponent(jobId)}`;
        const suppliedStatusUrl = incomingUrl.searchParams.get("statusUrl");
        if (suppliedStatusUrl) {
          try {
            const parsedStatusUrl = new URL(suppliedStatusUrl, baseUrl);
            const lastSegment = decodeURIComponent(parsedStatusUrl.pathname.split("/").pop() ?? "");
            if (lastSegment === jobId && parsedStatusUrl.pathname.includes("/api/print/jobs/")) {
              statusPath = `${parsedStatusUrl.pathname}${parsedStatusUrl.search}`;
            }
          } catch {
            // Use the documented job-status endpoint if Printer Hub returned a malformed URL.
          }
        }

        try {
          const upstream = await fetch(`${baseUrl}${statusPath}`, {
            method: "GET",
            cache: "no-store",
          });
          return new Response(await upstream.arrayBuffer(), {
            status: upstream.status,
            headers: {
              "Content-Type": upstream.headers.get("content-type") ?? "application/json",
              "Cache-Control": "no-store",
            },
          });
        } catch {
          return Response.json(
            { message: "Printer status is temporarily unavailable" },
            { status: 502, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
