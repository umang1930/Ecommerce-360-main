import { createFileRoute } from "@tanstack/react-router";
import { getSessionResponse } from "@/lib/dashboard/google-auth.server";

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => getSessionResponse(request),
    },
  },
});
