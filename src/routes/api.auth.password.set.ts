import { createFileRoute } from "@tanstack/react-router";
import { setDashboardPasswordResponse } from "@/lib/dashboard/password-auth.server";

export const Route = createFileRoute("/api/auth/password/set")({
  server: {
    handlers: {
      POST: async ({ request }) => setDashboardPasswordResponse(request),
    },
  },
});
