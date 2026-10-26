import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  seller: z.enum(["claspo", "monkeyman"]),
  fromDate: z.string().date(),
  toDate: z.string().date(),
});

export const fetchAmazonReturns = createServerFn({ method: "POST" })
  .validator(inputSchema)
  .handler(async ({ data }) => {
    const { fetchAmazonReturns: fetchOnServer } = await import("./amazon-returns.server");
    return fetchOnServer(data);
  });
