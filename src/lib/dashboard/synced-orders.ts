import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const listInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
  marketplace: z.enum(["all", "Amazon", "Flipkart"]).default("all"),
  seller: z.enum(["all", "claspo", "monkeyman"]).default("all"),
  search: z.string().max(120).default(""),
});

export const getSyncedOrders = createServerFn({ method: "POST" })
  .validator(listInput)
  .handler(async ({ data }) => {
    const { listSyncedOrders } = await import("./synced-orders.server");
    return listSyncedOrders(data);
  });

