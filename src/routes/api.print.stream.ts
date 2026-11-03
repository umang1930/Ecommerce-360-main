import { createFileRoute } from "@tanstack/react-router";
import { getDashboardSession } from "@/lib/dashboard/google-auth.server";
import { getPrintJobsForUser } from "@/lib/print/storage.server";
import { printJobEventBus } from "@/lib/print/event-bus.server";
import type { PrintJob } from "@/lib/print/types";

export const Route = createFileRoute("/api/print/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = getDashboardSession(request);
        if (!user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const encoder = new TextEncoder();
        const userId = user.email;

        const stream = new ReadableStream({
          start(controller) {
            let isClosed = false;

            const sendEvent = (event: string, data: unknown) => {
              if (isClosed) return;
              try {
                const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(message));
              } catch {
                isClosed = true;
              }
            };

            // Send initial connection event
            sendEvent("connected", { userId, timestamp: new Date().toISOString() });

            // Send unacknowledged completed/failed jobs and active jobs so user gets caught up
            void getPrintJobsForUser(userId).then((jobs) => {
              if (!isClosed && jobs.length > 0) {
                sendEvent("initial-jobs", jobs.slice(0, 10));
              }
            });

            // Subscribe to real-time updates for this user only
            const unsubscribe = printJobEventBus.subscribeUser(userId, (job: PrintJob) => {
              sendEvent("job-update", job);
            });

            // Keep-alive heartbeat ping every 15 seconds
            const pingInterval = setInterval(() => {
              if (isClosed) {
                clearInterval(pingInterval);
                return;
              }
              try {
                controller.enqueue(encoder.encode(": ping\n\n"));
              } catch {
                isClosed = true;
                clearInterval(pingInterval);
                unsubscribe();
              }
            }, 15000);

            // Handle client abort / disconnect
            request.signal.addEventListener("abort", () => {
              isClosed = true;
              clearInterval(pingInterval);
              unsubscribe();
              try {
                controller.close();
              } catch {
                // Ignore if already closed
              }
            });
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
