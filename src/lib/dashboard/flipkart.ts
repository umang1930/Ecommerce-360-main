import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { FlipkartInventoryResponse, FlipkartReturnsResult } from "./flipkart-types";

const returnInputSchema = z.object({
  fromDate: z.string(),
  toDate: z.string(),
  seller: z.enum(["claspo", "monkeyman"]).optional(),
});

const upcomingInputSchema = z.object({
  seller: z.enum(["claspo", "monkeyman"]).optional(),
});

export const fetchClaspoFlipkartInventory = createServerFn({ method: "GET" })
  .handler(async (): Promise<FlipkartInventoryResponse> => {
    const { fetchClaspoFlipkartInventory: fetchOnServer } = await import("./flipkart-seller-api.server");
    return fetchOnServer();
  });

export const fetchMonkeymanFlipkartInventory = createServerFn({ method: "GET" })
  .handler(async (): Promise<FlipkartInventoryResponse> => {
    const { fetchMonkeymanFlipkartInventory: fetchOnServer } = await import("./flipkart-seller-api.server");
    return fetchOnServer();
  });

export const fetchFlipkartReturns = createServerFn({ method: "POST" })
  .validator(returnInputSchema)
  .handler(async ({ data }): Promise<FlipkartReturnsResult> => {
    const { fetchFlipkartReturns: fetchOnServer } = await import("./flipkart-seller-api.server");
    return fetchOnServer({ data });
  });

export const fetchFlipkartDeliveredOrders = createServerFn({ method: "POST" })
  .validator(returnInputSchema)
  .handler(async ({ data }): Promise<import("./flipkart-seller-api.server").FlipkartDeliveredOrdersResult> => {
    const { fetchFlipkartDeliveredOrders: fetchOnServer } = await import("./flipkart-seller-api.server");
    return fetchOnServer({ data });
  });

export const fetchFlipkartUpcomingOrders = createServerFn({ method: "POST" })
  .validator(upcomingInputSchema)
  .handler(async ({ data }): Promise<import("./flipkart-seller-api.server").FlipkartUpcomingOrdersResult> => {
    const { fetchFlipkartUpcomingOrders: fetchOnServer } = await import("./flipkart-seller-api.server");
    return fetchOnServer({ data });
  });
