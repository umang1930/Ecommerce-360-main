import { createFileRoute } from "@tanstack/react-router";
import { completeGoogleLogin } from "@/lib/dashboard/google-auth.server";

export const Route = createFileRoute("/api/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => completeGoogleLogin(request),
    },
  },
});
