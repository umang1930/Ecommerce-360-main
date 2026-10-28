import { createFileRoute } from "@tanstack/react-router";
import { passwordLoginResponse } from "@/lib/dashboard/password-auth.server";

export const Route = createFileRoute("/api/auth/password/login")({
  server: {
    handlers: {
      POST: async ({ request }) => passwordLoginResponse(request),
    },
  },
});
