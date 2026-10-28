import { z } from "zod";
import type { FlipkartInventoryResponse, FlipkartInventoryResult, FlipkartReturnsResult, FlipkartReturn } from "./flipkart-types";

const inputSchema = z.object({
  fromDate: z.string(),
  toDate: z.string(),
  seller: z.enum(["claspo", "monkeyman"]).optional(),
});

const upcomingInputSchema = z.object({
  seller: z.enum(["claspo", "monkeyman"]).optional(),
});

export interface FlipkartOrder {
  orderId: string;
  orderItemId: string;
  shipmentId: string;
  status: string;
  title: string;
  sku: string;
  quantity: number;
  customerPrice: number;
  orderDate: string;
  dispatchByDate: string | null;
  brand?: "CLASPO" | "MONKEYMAN";
}

export interface FlipkartOrdersResult {
  configured: boolean;
  orders: FlipkartOrder[];
  message?: string;
  warning?: string;
}

export interface FlipkartDeliveredOrdersResult {
  configured: boolean;
  orders: FlipkartOrder[];
  message?: string;
  warning?: string;
}

export interface FlipkartUpcomingOrder {
  orderId: string;
  orderItemId: string;
  shipmentId: string;
  status: string;
  title: string;
  sku: string;
  quantity: number;
  orderDate: string;
  dispatchAfterDate: string | null;
  dispatchByDate: string | null;
  hold: boolean;
  brand: "CLASPO" | "MONKEYMAN";
}

export interface FlipkartUpcomingOrdersResult {
  configured: boolean;
  orders: FlipkartUpcomingOrder[];
  message?: string;
  warning?: string;
}

type Config = { appId: string; appSecret: string; refreshToken?: string; endpoint: string };
function getConfig(seller: "claspo" | "monkeyman" = "claspo"): Config | null {
  const prefix = seller === "monkeyman" ? "FLIPKART_MONKEYMAN" : "FLIPKART";
  const appId = process.env[`${prefix}_APP_ID`];
  const appSecret = process.env[`${prefix}_APP_SECRET`];
  const refreshToken = process.env[`${prefix}_REFRESH_TOKEN`];
  if (!appId || !appSecret) return null;
  return {
    appId,
    appSecret,
    ...(refreshToken ? { refreshToken } : {}),
    endpoint: process.env[`${prefix}_API_ENDPOINT`] ?? "https://api.flipkart.net/sellers/v2/orders/search",
  };
}

function getOrdersUrl(endpoint: string) {
  const url = new URL(endpoint);
  // Accept either the API host or a full endpoint URL. Always call the
  // documented v2 search route so a stale/custom path cannot cause a 404.
  url.pathname = "/sellers/v2/orders/search";
  url.search = "";
  return url;
}

function getListingUrl(endpoint: string, skus: string[]) {
  const url = getOrdersUrl(endpoint);
  url.pathname = `/sellers/listings/v3/${encodeURIComponent(skus.join(","))}`;
  url.search = "";
  return url;
}

async function getAccessToken(config: Config) {
  const apiUrl = getOrdersUrl(config.endpoint);
  const url = new URL("/oauth-service/oauth/token", apiUrl.origin);
  url.searchParams.set("grant_type", config.refreshToken ? "refresh_token" : "client_credentials");
  if (config.refreshToken) url.searchParams.set("refresh_token", config.refreshToken);
  else url.searchParams.set("scope", "Seller_Api");
  const credentials = btoa(`${config.appId}:${config.appSecret}`);
  const response = await fetch(url, { headers: { Authorization: `Basic ${credentials}` } });
  if (!response.ok) {
    const details = (await response.text()).replace(/\s+/g, " ").slice(0, 240);
    throw new Error(`token request failed (${response.status})${details ? `: ${details}` : "."}`);
  }
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new Error("Flipkart did not return an access token.");
  return payload.access_token;
}

async function fetchFlipkartInventory(seller: "claspo" | "monkeyman", skus: string[]): Promise<FlipkartInventoryResponse> {
  const config = getConfig(seller);
  if (!config) return { configured: false, listings: [] };
  try {
    const token = await getAccessToken(config);
    const response = await fetch(getListingUrl(config.endpoint, skus), {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const details = (await response.text()).replace(/\s+/g, " ").slice(0, 240);
      throw new Error(`Flipkart Listings API request failed (${response.status})${details ? `: ${details}` : ""}`);
    }
    const payload = await response.json() as {
        available?: Record<string, {
          product_title?: string;
          product_url?: string;
          listing_status?: string;
          price?: {
            mrp?: number;
            flipkart_selling_price?: number;
            selling_price?: number;
            sellingPrice?: number;
            currency?: string;
          };
          locations?: { id?: string; status?: string; inventory?: number }[];
          orders_to_be_fulfilled?: number;
          ordersToBeFulfilled?: number;
        }> & { orders_to_be_fulfilled?: number; ordersToBeFulfilled?: number };
        unavailable?: string[];
        orders_to_be_fulfilled?: number;
        ordersToBeFulfilled?: number;
    };
    const listings = skus.map((sku): FlipkartInventoryResult => {
        const listing = payload.available?.[sku];
        const sellingPrice = listing?.price?.flipkart_selling_price
          ?? listing?.price?.selling_price
          ?? listing?.price?.sellingPrice;
        const ordersToBeFulfilled = payload.available?.orders_to_be_fulfilled
          ?? payload.available?.ordersToBeFulfilled
          ?? listing?.orders_to_be_fulfilled
          ?? listing?.ordersToBeFulfilled
          ?? payload.orders_to_be_fulfilled
          ?? payload.ordersToBeFulfilled;
        return {
          configured: true,
          sku,
          ...(listing?.product_title ? { productTitle: listing.product_title } : {}),
          ...(listing?.listing_status ? { listingStatus: listing.listing_status } : {}),
          ...(listing?.price?.mrp != null ? { mrp: listing.price.mrp } : {}),
          ...(sellingPrice != null ? { sellingPrice } : {}),
          ...(listing?.price?.currency ? { currency: listing.price.currency } : {}),
          locations: (listing?.locations ?? []).map((location) => ({
            id: location.id ?? "—",
            status: location.status ?? "UNKNOWN",
            inventory: Number(location.inventory ?? 0),
          })),
          ...(ordersToBeFulfilled != null ? { ordersToBeFulfilled } : {}),
          ...(listing?.product_url ? { productUrl: listing.product_url } : {}),
          unavailable: !listing || (payload.unavailable ?? []).includes(sku),
        };
    });
    return { configured: true, listings };
  } catch (error) {
    return {
      configured: true,
      listings: [],
      error: error instanceof Error ? error.message : "Flipkart inventory request failed.",
    };
  }
}

/** Fetch the Claspo product listings and stock using the read-only Listings API. */
export async function fetchClaspoFlipkartInventory(): Promise<FlipkartInventoryResponse> {
  return fetchFlipkartInventory("claspo", ["CL-VB-05-2026", "cl-mfc-06-2026", "hk-Hang-01-2026"]);
}

/** Fetch the Monkeyman product listing and stock using the read-only Listings API. */
export async function fetchMonkeymanFlipkartInventory(): Promise<FlipkartInventoryResponse> {
  return fetchFlipkartInventory("monkeyman", ["MM-BELLA-RG", "MM-BELLA-BLK"]);
}

type ApiItem = {
  orderId?: string; orderItemId?: string; shipmentId?: string; status?: string; title?: string;
  productTitle?: string; sku?: string; quantity?: number; orderDate?: string; dispatchByDate?: string;
  priceComponents?: { customerPrice?: number; totalPrice?: number; sellingPrice?: number };
};
type SearchResponse = { orderItems?: ApiItem[]; nextPageURL?: string; nextPageUrl?: string; hasMore?: boolean };

type ReturnApiItem = Partial<FlipkartReturn> & {
  returnId?: string;
  orderItemId?: string;
  source?: string;
  status?: string;
  returnStatus?: string;
  shipmentStatus?: string;
  quantity?: number;
};
type ReturnApiResponse = {
  returnItems?: ReturnApiItem[];
  nextUrl?: string;
  nextURL?: string;
  hasMore?: boolean;
  status?: string;
};

async function searchReturns(
  config: Config,
  token: string,
  seller: "claspo" | "monkeyman",
  source: FlipkartReturn["source"],
  fromDate: string,
  toDate: string,
): Promise<FlipkartReturn[]> {
  const apiUrl = getOrdersUrl(config.endpoint);
  const firstUrl = new URL("/sellers/v2/returns", apiUrl.origin);
  firstUrl.searchParams.set("source", source);
  firstUrl.searchParams.set("createdAfter", fromDate);
  firstUrl.searchParams.set("createdBefore", toDate);
  const items: FlipkartReturn[] = [];
  let nextUrl: string | undefined;

  for (let page = 0; page < 25; page += 1) {
    const url = nextUrl ? new URL(nextUrl, firstUrl.origin) : firstUrl;
    if (url.origin !== firstUrl.origin) throw new Error("Flipkart returned a returns pagination URL outside its API host.");
    // Some Seller API pagination URLs omit the `/sellers/v2` prefix.
    if (nextUrl && url.pathname.startsWith("/returns/")) {
      url.pathname = `/sellers/v2${url.pathname}`;
    }
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const details = (await response.text()).replace(/\s+/g, " ").slice(0, 240);
      throw new Error(`Flipkart ${source.replace("_", " ")} API request failed (${response.status})${details ? `: ${details}` : ""}`);
    }
    const data = await response.json() as ReturnApiResponse;
    items.push(...(data.returnItems ?? []).map((item) => ({
      brand: seller === "monkeyman" ? "MONKEYMAN" as const : "CLASPO" as const,
      returnId: item.returnId ?? "",
      orderItemId: item.orderItemId ?? "",
      source,
      status: item.status ?? item.returnStatus ?? data.status ?? "UNKNOWN",
      shipmentStatus: item.shipmentStatus ?? "",
      action: item.action ?? "",
      reason: item.reason ?? "",
      subReason: item.subReason ?? "",
      quantity: Number(item.quantity ?? 0),
      trackingId: item.trackingId ?? "",
      shipmentId: item.shipmentId ?? "",
      courierName: item.courierName ?? "",
      orderDate: item.orderDate ?? "",
      createdDate: item.createdDate ?? "",
      updatedDate: item.updatedDate ?? "",
      expectedDate: item.expectedDate ?? "",
      completionDate: item.completionDate ?? "",
    })));
    nextUrl = data.nextUrl ?? data.nextURL;
    if (!nextUrl || data.hasMore === false) break;
  }
  return items;
}

async function searchOrders(config: Config, token: string, fromDate: string, toDate: string, seller: "claspo" | "monkeyman"): Promise<{ orders: FlipkartOrder[]; warning?: string }> {
  const firstUrl = getOrdersUrl(config.endpoint);
  const orders: FlipkartOrder[] = [];
  let nextUrl: string | undefined;
  for (let page = 0; page < 250; page += 1) {
    const url = nextUrl ? new URL(nextUrl, firstUrl.origin) : firstUrl;
    if (url.origin !== firstUrl.origin) throw new Error("Flipkart returned a pagination URL outside its API host.");
    // The v2 API currently returns nextPageUrl as `/orders/search/...`,
    // omitting the `/sellers/v2` prefix needed by the actual route.
    if (nextUrl && url.pathname.startsWith("/orders/search/")) {
      url.pathname = `/sellers/v2${url.pathname}`;
    }
    const requestInit: RequestInit = nextUrl ? {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    } : {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filter: { orderDate: { fromDate, toDate } },
        pagination: { pageSize: 20 },
        sort: { field: "orderDate", order: "desc" },
      }),
    };
    let response: Response | undefined;
    // Flipkart occasionally returns a transient 5xx for continuation URLs.
    // Retry the same page twice before giving up.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(url, requestInit);
      if (response.ok || response.status < 500 || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
    if (!response) throw new Error("Flipkart Orders API request could not be completed.");
    if (!response.ok) {
      const details = (await response.text()).replace(/\s+/g, " ").slice(0, 240);
      const description = `Flipkart Orders API request failed (${response.status})${details ? `: ${details}` : ""}`;
      // Keep usable results from earlier pages when a continuation fails.
      // Never return the opaque pagination cursor to the browser.
      if (nextUrl && orders.length > 0) {
        return {
          orders,
          warning: `Showing the first ${orders.length} Flipkart orders. Page ${page + 1} could not be loaded after retries (HTTP ${response.status}).`,
        };
      }
      throw new Error(description);
    }
    const data = await response.json() as SearchResponse;
    orders.push(...(data.orderItems ?? []).map((item) => ({
      orderId: item.orderId ?? "",
      orderItemId: item.orderItemId ?? "",
      shipmentId: item.shipmentId ?? "",
      status: item.status ?? "UNKNOWN",
      title: item.title ?? item.productTitle ?? item.sku ?? "Flipkart product",
      sku: item.sku ?? "",
      quantity: item.quantity ?? 1,
      customerPrice: Number(item.priceComponents?.customerPrice ?? item.priceComponents?.totalPrice ?? item.priceComponents?.sellingPrice ?? 0),
      orderDate: item.orderDate ?? "",
      dispatchByDate: item.dispatchByDate ?? null,
      brand: seller === "monkeyman" ? "MONKEYMAN" as const : "CLASPO" as const,
    })));
    nextUrl = data.nextPageURL ?? data.nextPageUrl;
    if (!nextUrl || data.hasMore === false) break;
    if (page === 249) {
      return {
        orders,
        warning: `Flipkart returned more than 250 pages of order items. Showing the first ${orders.length} items; the selected range may be incomplete.`,
      };
    }
  }
  return { orders };
}

async function searchDeliveredOrders(
  config: Config,
  token: string,
  fromDate: string,
  toDate: string,
  seller: "claspo" | "monkeyman",
): Promise<{ orders: FlipkartOrder[]; warning?: string }> {
  const apiUrl = getOrdersUrl(config.endpoint);
  const firstUrl = new URL("/sellers/v3/shipments/filter/", apiUrl.origin);
  const orders: FlipkartOrder[] = [];
  const warnings: string[] = [];

  // Flipkart requires post-dispatch searches to be split by shipment type.
  for (const shipmentType of ["NORMAL", "SELF"]) {
    let nextUrl: string | undefined;
    for (let page = 0; page < 250; page += 1) {
      const url = nextUrl ? new URL(nextUrl, firstUrl.origin) : firstUrl;
      if (url.origin !== firstUrl.origin) {
        throw new Error("Flipkart returned a shipment pagination URL outside its API host.");
      }
      if (nextUrl && url.pathname.startsWith("/v3/shipments/filter")) {
        url.pathname = `/sellers${url.pathname}`;
      }
      const requestInit: RequestInit = nextUrl
        ? { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
        : {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              filter: {
                type: "postDispatch",
                states: ["DELIVERED"],
                shipmentTypes: [shipmentType],
                orderDate: { from: fromDate, to: toDate },
              },
              pagination: { pageSize: 20 },
              sort: { field: "orderDate", order: "desc" },
            }),
          };
      let response: Response | undefined;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await fetch(url, requestInit);
        if (response.ok || (response.status < 500 && response.status !== 429) || attempt === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
      if (!response) throw new Error("Flipkart delivered shipments request could not be completed.");
      if (!response.ok) {
        const details = (await response.text()).replace(/\s+/g, " ").slice(0, 240);
        const description = `Flipkart delivered shipments request failed (${response.status})${details ? `: ${details}` : ""}`;
        if (orders.length > 0) {
          warnings.push(`Loaded ${orders.length} delivered orders, but ${shipmentType} page ${page + 1} failed after retries (HTTP ${response.status}).`);
          break;
        }
        throw new Error(description);
      }
      const data = (await response.json()) as {
        shipments?: {
          shipmentId?: string;
          dispatchByDate?: string;
          orderItems?: {
            orderId?: string;
            orderItemId?: string;
            status?: string;
            title?: string;
            sku?: string;
            quantity?: number;
            orderDate?: string;
            priceComponents?: { customerPrice?: number; totalPrice?: number; sellingPrice?: number };
          }[];
        }[];
        nextPageUrl?: string;
        hasMore?: boolean;
      };
      for (const shipment of data.shipments ?? []) {
        for (const item of shipment.orderItems ?? []) {
          if (item.status?.toUpperCase() !== "DELIVERED") continue;
          orders.push({
            orderId: item.orderId ?? "",
            orderItemId: item.orderItemId ?? "",
            shipmentId: shipment.shipmentId ?? "",
            status: item.status,
            title: item.title ?? item.sku ?? "Flipkart product",
            sku: item.sku ?? "",
            quantity: item.quantity ?? 1,
            customerPrice: Number(item.priceComponents?.customerPrice ?? item.priceComponents?.totalPrice ?? item.priceComponents?.sellingPrice ?? 0),
            orderDate: item.orderDate ?? "",
            dispatchByDate: shipment.dispatchByDate ?? null,
            brand: seller === "monkeyman" ? "MONKEYMAN" : "CLASPO",
          });
        }
      }
      nextUrl = data.nextPageUrl;
      if (!nextUrl || data.hasMore === false) break;
      if (page === 249) warnings.push(`Flipkart returned more than 250 pages of ${shipmentType} delivered shipments.`);
    }
  }
  return { orders, ...(warnings.length ? { warning: warnings.join(" ") } : {}) };
}

async function searchUpcomingOrders(
  config: Config,
  token: string,
  seller: "claspo" | "monkeyman",
): Promise<{ orders: FlipkartUpcomingOrder[]; warning?: string }> {
  const apiUrl = getOrdersUrl(config.endpoint);
  const firstUrl = new URL("/sellers/v3/shipments/filter/", apiUrl.origin);
  const orders: FlipkartUpcomingOrder[] = [];
  let nextUrl: string | undefined;
  const maxPages = 250;
  const seenPageUrls = new Set<string>();
  const seenPageSignatures = new Set<string>();
  const seenOrderItems = new Set<string>();
  let paginationStalled = false;
  let pageLimitReached = false;

  for (let page = 0; page < maxPages; page += 1) {
    const url = nextUrl ? new URL(nextUrl, firstUrl.origin) : firstUrl;
    if (url.origin !== firstUrl.origin) throw new Error("Flipkart returned an upcoming-shipment pagination URL outside its API host.");
    if (nextUrl && url.pathname.startsWith("/v3/shipments/filter")) {
      url.pathname = `/sellers${url.pathname}`;
    }
    const pageUrl = url.toString();
    if (seenPageUrls.has(pageUrl)) {
      paginationStalled = true;
      break;
    }
    seenPageUrls.add(pageUrl);
    const requestInit: RequestInit = nextUrl
      ? { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      : {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            filter: {
              type: "preDispatch",
              states: ["APPROVED", "PACKING_IN_PROGRESS", "PACKED", "FORM_FAILED", "READY_TO_DISPATCH"],
              hold: false,
            },
            pagination: { pageSize: 20 },
            sort: { field: "dispatchByDate", order: "asc" },
          }),
        };
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(url, requestInit);
      if (response.ok || (response.status < 500 && response.status !== 429) || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
    if (!response) throw new Error("Flipkart upcoming-shipment request could not be completed.");
    if (!response.ok) {
      const details = (await response.text()).replace(/\s+/g, " ").slice(0, 240);
      const message = `Flipkart upcoming-shipment request failed (${response.status})${details ? `: ${details}` : ""}`;
      if (nextUrl && orders.length > 0) {
        return { orders, warning: `Loaded the first ${orders.length} upcoming order items; page ${page + 1} failed after retries (HTTP ${response.status}).` };
      }
      throw new Error(message);
    }
    const data = (await response.json()) as {
      shipments?: {
        shipmentId?: string;
        status?: string;
        dispatchAfterDate?: string;
        dispatchByDate?: string;
        hold?: boolean;
        orderItems?: {
          orderId?: string;
          orderItemId?: string;
          status?: string;
          title?: string;
          sku?: string;
          quantity?: number;
          orderDate?: string;
        }[];
      }[];
      nextPageUrl?: string;
      hasMore?: boolean;
    };
    const pageOrders: FlipkartUpcomingOrder[] = [];
    for (const shipment of data.shipments ?? []) {
      for (const item of shipment.orderItems ?? []) {
        pageOrders.push({
          orderId: item.orderId ?? "",
          orderItemId: item.orderItemId ?? "",
          shipmentId: shipment.shipmentId ?? "",
          status: item.status ?? shipment.status ?? "UNKNOWN",
          title: item.title ?? item.sku ?? "Flipkart product",
          sku: item.sku ?? "",
          quantity: item.quantity ?? 1,
          orderDate: item.orderDate ?? "",
          dispatchAfterDate: shipment.dispatchAfterDate ?? null,
          dispatchByDate: shipment.dispatchByDate ?? null,
          hold: shipment.hold ?? false,
          brand: seller === "monkeyman" ? "MONKEYMAN" : "CLASPO",
        });
      }
    }
    const pageSignature = pageOrders
      .map((order) => order.orderItemId || `${order.orderId}-${order.shipmentId}`)
      .sort()
      .join("|");
    if (pageSignature && seenPageSignatures.has(pageSignature)) {
      paginationStalled = true;
      break;
    }
    if (pageSignature) seenPageSignatures.add(pageSignature);
    let addedOrders = 0;
    for (const order of pageOrders) {
      const itemKey = order.orderItemId || `${order.orderId}-${order.shipmentId}-${order.sku}`;
      if (!itemKey || seenOrderItems.has(itemKey)) continue;
      seenOrderItems.add(itemKey);
      orders.push(order);
      addedOrders += 1;
    }
    nextUrl = data.nextPageUrl;
    if (!nextUrl || data.hasMore === false) break;
    if (page > 0 && addedOrders === 0) {
      paginationStalled = true;
      break;
    }
    if (page === maxPages - 1) {
      pageLimitReached = true;
      break;
    }
  }

  return {
    orders,
    ...(pageLimitReached
      ? { warning: `Flipkart upcoming orders reached the ${maxPages}-page retrieval limit; results may be incomplete.` }
      : paginationStalled
        ? { warning: "Flipkart upcoming-order pagination stopped because the API repeated a page or returned no new order items; results may be incomplete." }
        : {}),
  };
}

/** Server-only Flipkart Seller API access. Never expose seller credentials to the browser. */
export async function fetchFlipkartOrders(input: { data: unknown }): Promise<FlipkartOrdersResult> {
  const data = inputSchema.parse(input.data);
  const seller = data.seller ?? "claspo";
  const config = getConfig(seller);
  if (!config) return { configured: false, orders: [] };
  try {
    const token = await getAccessToken(config);
    const result = await searchOrders(config, token, data.fromDate, data.toDate, seller);
    return { configured: true, ...result };
  } catch (error) {
    const sellerName = seller === "monkeyman" ? "Monkeyman" : "Claspo";
    return { configured: true, orders: [], message: `${sellerName} Flipkart ${error instanceof Error ? error.message : "Orders API request failed."}` };
  }
}

/** Server-only delivered-order feed from Flipkart's v3 shipments API. */
export async function fetchFlipkartDeliveredOrders(input: { data: unknown }): Promise<FlipkartDeliveredOrdersResult> {
  const data = inputSchema.parse(input.data);
  const seller = data.seller ?? "claspo";
  const config = getConfig(seller);
  if (!config) return { configured: false, orders: [] };
  try {
    const token = await getAccessToken(config);
    return { configured: true, ...(await searchDeliveredOrders(config, token, data.fromDate, data.toDate, seller)) };
  } catch (error) {
    const sellerName = seller === "monkeyman" ? "Monkeyman" : "Claspo";
    return { configured: true, orders: [], message: `${sellerName} Flipkart ${error instanceof Error ? error.message : "Delivered shipments request failed."}` };
  }
}

/** Server-only Flipkart pre-dispatch orders for the Upcoming Orders dashboard tab. */
export async function fetchFlipkartUpcomingOrders(input: { data: unknown }): Promise<FlipkartUpcomingOrdersResult> {
  const data = upcomingInputSchema.parse(input.data);
  const seller = data.seller ?? "claspo";
  const config = getConfig(seller);
  if (!config) return { configured: false, orders: [] };
  try {
    const token = await getAccessToken(config);
    return { configured: true, ...(await searchUpcomingOrders(config, token, seller)) };
  } catch (error) {
    const sellerName = seller === "monkeyman" ? "Monkeyman" : "Claspo";
    return {
      configured: true,
      orders: [],
      message: `${sellerName} Flipkart upcoming orders ${error instanceof Error ? error.message : "request failed."}`,
    };
  }
}

/** Server-only Flipkart return feeds. Seller credentials are never sent to the browser. */
export async function fetchFlipkartReturns(input: { data: unknown }): Promise<FlipkartReturnsResult> {
  const data = inputSchema.parse(input.data);
  const config = getConfig(data.seller ?? "claspo");
  if (!config) return { configured: false, customerReturns: [], courierReturns: [] };
  try {
    const token = await getAccessToken(config);
    const [customer, courier] = await Promise.allSettled([
      searchReturns(config, token, data.seller ?? "claspo", "customer_return", data.fromDate, data.toDate),
      searchReturns(config, token, data.seller ?? "claspo", "courier_return", data.fromDate, data.toDate),
    ]);
    return {
      configured: true,
      customerReturns: customer.status === "fulfilled" ? customer.value : [],
      courierReturns: courier.status === "fulfilled" ? courier.value : [],
      ...(customer.status === "rejected" ? { customerError: customer.reason instanceof Error ? customer.reason.message : "Customer returns request failed." } : {}),
      ...(courier.status === "rejected" ? { courierError: courier.reason instanceof Error ? courier.reason.message : "Courier returns request failed." } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Flipkart returns API request failed.";
    return { configured: true, customerReturns: [], courierReturns: [], customerError: message, courierError: message };
  }
}
