import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { getDashboardSession } from "./lib/dashboard/google-auth.server";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const authMiddleware = createMiddleware().server(async ({ next, request, pathname, handlerType }) => {
  const publicPath = pathname === "/login"
    || pathname.startsWith("/api/auth/")
    || pathname === "/api/cron/sync-orders";
  if (publicPath || getDashboardSession(request)) return next();

  if (handlerType === "serverFn") {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  return Response.redirect(new URL("/login", request.url), 302);
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware, authMiddleware],
}));
