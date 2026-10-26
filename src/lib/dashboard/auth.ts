import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const verifyDashboardLogin = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string(), password: z.string() }))
  .handler(({ data }) => {
    const configuredEmail = process.env["DASHBOARD_ADMIN_EMAIL"];
    const configuredPassword = process.env["DASHBOARD_ADMIN_PASSWORD"];
    if (!configuredEmail || !configuredPassword) return false;

    return (
      data.email.trim().toLowerCase() === configuredEmail.trim().toLowerCase() &&
      data.password === configuredPassword
    );
  });
