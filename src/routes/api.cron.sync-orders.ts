import { createFileRoute } from "@tanstack/react-router";
import { runDailyOrderSync } from "@/lib/dashboard/synced-orders.server";

export const Route = createFileRoute("/api/cron/sync-orders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        const host = new URL(request.url).hostname;
        const localDevelopment = process.env["NODE_ENV"] !== "production" && ["localhost", "127.0.0.1"].includes(host);
        if (!localDevelopment && (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        try {
          const result = await runDailyOrderSync();
          return Response.json(result, { status: result.errors.length ? 502 : 200 });
        } catch (error) {
          console.error("Daily synced-orders job failed", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Order sync failed." },
            { status: 500 },
          );
        }
      },
    },
  },
});
