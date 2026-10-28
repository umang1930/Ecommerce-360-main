import { createFileRoute } from "@tanstack/react-router";
import { logoutResponse } from "@/lib/dashboard/google-auth.server";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && new URL(origin).host !== new URL(request.url).host) {
          return Response.json({ error: "Invalid request origin." }, { status: 403 });
        }
        return logoutResponse(request);
      },
    },
  },
});
