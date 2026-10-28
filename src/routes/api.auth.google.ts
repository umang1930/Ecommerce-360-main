import { createFileRoute } from "@tanstack/react-router";
import { beginGoogleLogin } from "@/lib/dashboard/google-auth.server";

export const Route = createFileRoute("/api/auth/google")({
  server: {
    handlers: {
      GET: async ({ request }) => beginGoogleLogin(request),
    },
  },
});
