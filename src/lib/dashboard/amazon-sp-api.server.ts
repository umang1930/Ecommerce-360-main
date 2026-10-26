import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  createdAfter: z.string().datetime({ offset: true }),
  createdBefore: z.string().datetime({ offset: true }),
  seller: z.enum(["claspo", "monkeyman"]).optional(),
});

export interface AmazonOrderItem {
  orderId: string;
  orderItemId: string;
  status: string;
  title: string;
  sku: string;
  quantity: number;
  itemPrice: number;
  orderDate: string;
  currency: string;
  brand: "CLASPO" | "MONKEYMAN";
}

export interface AmazonOrdersResult {
  configured: boolean;
  orders: AmazonOrderItem[];
  message?: string;
}

type AmazonConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessKey: string;
  secretKey: string;
  sessionToken?: string;
  endpoint: string;
  region: string;
  marketplaceId: string;
};

const PRODUCTION_ENDPOINT = "https://sellingpartnerapi-eu.amazon.com";
const DEFAULT_REGION = "eu-west-1";
const DEFAULT_MARKETPLACE = "A21TJRUUN4KGV"; // Amazon.in

type AmazonSeller = "claspo" | "monkeyman";
const pendingReturnsReports = new Map<string, { reportId: string; createdAt: number }>();

function getConfig(seller: AmazonSeller): AmazonConfig | null {
  const prefix = seller === "monkeyman" ? "AMAZON_SP_API_MONKEYMAN" : "AMAZON_SP_API";
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  const refreshToken = process.env[`${prefix}_REFRESH_TOKEN`];
  const accessKey = process.env[`${prefix}_AWS_ACCESS_KEY_ID`];
  const secretKey = process.env[`${prefix}_AWS_SECRET_ACCESS_KEY`];
  const sessionToken = process.env[`${prefix}_AWS_SESSION_TOKEN`];
  if (![clientId, clientSecret, refreshToken, accessKey, secretKey].every(Boolean)) return null;

  const endpoint = process.env[`${prefix}_ENDPOINT`] ?? PRODUCTION_ENDPOINT;
  if (!endpoint.startsWith("https://") || new URL(endpoint).hostname.includes("sandbox")) {
    throw new Error("Amazon SP-API must use a production HTTPS endpoint.");
  }
  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    refreshToken: refreshToken!,
    accessKey: accessKey!,
    secretKey: secretKey!,
    ...(sessionToken ? { sessionToken } : {}),
    endpoint,
    region:
      process.env[`${prefix}_AWS_REGION`] ??
      process.env["AMAZON_SP_API_AWS_REGION"] ??
      DEFAULT_REGION,
    marketplaceId:
      process.env[`${prefix}_MARKETPLACE_ID`] ??
      process.env["AMAZON_SP_API_MARKETPLACE_ID"] ??
      DEFAULT_MARKETPLACE,
  };
}

const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const sha256 = async (value: string) =>
  hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
const hmac = async (key: string | Uint8Array, value: string) =>
  new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await crypto.subtle.importKey(
        "raw",
        typeof key === "string" ? encoder.encode(key) : Uint8Array.from(key).buffer,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      ),
      encoder.encode(value),
    ),
  );
const toAmzDate = (date: Date) => date.toISOString().replace(/[:-]|\.\d{3}/g, "");
const canonicalQuery = (parameters: Record<string, string>) =>
  Object.entries(parameters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

const tokenCache = new Map<string, { value: string; expiresAt: number }>();
async function getAccessToken(config: AmazonConfig): Promise<string> {
  const cacheKey = `${config.clientId}:${config.refreshToken}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  });
  if (!response.ok) {
    let lwaError = "";
    try {
      const errorPayload = (await response.json()) as { error?: string };
      lwaError = errorPayload.error ?? "";
    } catch {
      // Keep the dashboard message safe if Amazon returns a non-JSON error body.
    }
    if (lwaError === "invalid_client") {
      throw new Error(
        "Amazon rejected the LWA app credentials (invalid_client). Check that the client ID and client secret are the matching pair from the same production app.",
      );
    }
    if (lwaError === "invalid_grant") {
      throw new Error(
        "Amazon rejected the LWA refresh token (invalid_grant). Re-authorize the production app and replace AMAZON_SP_API_REFRESH_TOKEN with the newly issued token.",
      );
    }
    throw new Error(
      `Amazon LWA token request failed (${response.status}${lwaError ? `, ${lwaError}` : ""}).`,
    );
  }
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error("Amazon LWA did not return an access token.");
  tokenCache.set(cacheKey, {
    value: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  });
  return payload.access_token;
}

async function signedRequest(
  config: AmazonConfig,
  accessToken: string,
  method: "GET" | "POST",
  path: string,
  parameters: Record<string, string>,
  body?: string,
) {
  const url = new URL(config.endpoint);
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const query = canonicalQuery(parameters);
  const headers: Record<string, string> = {
    host: url.host,
    "user-agent": "Ecommerce360/1.0",
    "x-amz-access-token": accessToken,
    "x-amz-date": amzDate,
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (config.sessionToken) headers["x-amz-security-token"] = config.sessionToken;
  const signedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaders
    .map((key) => `${key}:${headers[key]?.trim() ?? ""}\n`)
    .join("");
  const canonicalRequest = [
    method,
    path,
    query,
    canonicalHeaders,
    signedHeaders.join(";"),
    await sha256(body ?? ""),
  ].join("\n");
  const scope = `${dateStamp}/${config.region}/execute-api/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256(canonicalRequest)].join(
    "\n",
  );
  const dateKey = await hmac(`AWS4${config.secretKey}`, dateStamp);
  const regionKey = await hmac(dateKey, config.region);
  const serviceKey = await hmac(regionKey, "execute-api");
  const signingKey = await hmac(serviceKey, "aws4_request");
  const signature = hex(
    await crypto.subtle.sign(
      "HMAC",
      await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, [
        "sign",
      ]),
      encoder.encode(stringToSign),
    ),
  );
  headers["authorization"] =
    `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`;
  const response = await fetch(`${url.origin}${path}${query ? `?${query}` : ""}`, {
    method,
    headers,
    ...(body !== undefined ? { body } : {}),
  });
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429) {
      let quotaMessage = "Amazon is rate-limiting this SP-API request.";
      try {
        const payload = JSON.parse(body) as { errors?: { code?: string; message?: string }[] };
        const error = payload.errors?.[0];
        if (error?.code === "QuotaExceeded") {
          quotaMessage =
            "Amazon SP-API quota is currently exceeded. Wait before retrying; repeated retries will not restore quota sooner.";
        }
      } catch {
        // Keep a safe generic message for non-JSON throttling responses.
      }
      throw new Error(quotaMessage);
    }
    const details = body.replace(/\s+/g, " ").slice(0, 240);
    throw new Error(
      `Amazon SP-API request failed (${response.status})${details ? `: ${details}` : ""}`,
    );
  }
  return response.json() as Promise<Record<string, unknown>>;
}

async function signedGet(
  config: AmazonConfig,
  accessToken: string,
  path: string,
  parameters: Record<string, string>,
) {
  return signedRequest(config, accessToken, "GET", path, parameters);
}

/** Fetches an existing Amazon Reports API resource using that seller's own credentials. */
export async function getAmazonReportResource(
  seller: AmazonSeller,
  resource: "reports" | "documents",
  resourceId: string,
): Promise<Record<string, unknown>> {
  const config = getConfig(seller);
  if (!config) throw new Error(`${seller === "claspo" ? "Claspo" : "Monkeyman"} Amazon SP-API is not configured on the server.`);
  const token = await getAccessToken(config);
  return signedGet(config, token, `/reports/2021-06-30/${resource}/${encodeURIComponent(resourceId)}`, {});
}

/** Finds an existing return report matching this range, or requests a fresh one. */
export async function getOrCreateAmazonReturnsReport(
  seller: AmazonSeller,
  fromDate: string,
  toDate: string,
): Promise<Record<string, unknown>> {
  const config = getConfig(seller);
  if (!config) throw new Error(`${seller === "claspo" ? "Claspo" : "Monkeyman"} Amazon SP-API is not configured on the server.`);
  const cacheKey = `${seller}:${fromDate}:${toDate}`;
  const cached = pendingReturnsReports.get(cacheKey);
  if (cached && cached.createdAt > Date.now() - 5 * 60 * 1000) {
    return { reportId: cached.reportId, reportType: "GET_FLAT_FILE_RETURNS_DATA_BY_RETURN_DATE" };
  }
  const token = await getAccessToken(config);
  const path = "/reports/2021-06-30/reports";
  const reportType = "GET_FLAT_FILE_RETURNS_DATA_BY_RETURN_DATE";
  const query = {
    reportTypes: reportType,
    marketplaceIds: config.marketplaceId,
    pageSize: "100",
    createdSince: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const listedResult = await signedGet(config, token, path, query);
  const listedPayload = listedResult["payload"] && typeof listedResult["payload"] === "object"
    ? listedResult["payload"] as Record<string, unknown>
    : listedResult;
  const listed = listedPayload as {
    reports?: Record<string, unknown>[];
  };
  const localDate = (value: unknown) => {
    if (typeof value !== "string") return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(date);
  };
  const matching = (listed.reports ?? []).find((report) => {
    const status = String(report["processingStatus"]);
    const ageMs = Date.now() - Date.parse(String(report["createdTime"] ?? ""));
    const recent = ageMs >= 0 && ageMs < 15 * 60 * 1000;
    return report["reportType"] === reportType &&
    localDate(report["dataStartTime"]) === fromDate &&
    localDate(report["dataEndTime"]) === toDate &&
    (["IN_QUEUE", "IN_PROGRESS"].includes(status) ? ageMs < 12 * 60 * 60 * 1000 : status === "DONE" && recent);
  });
  if (matching && typeof matching["reportId"] === "string") {
    pendingReturnsReports.set(cacheKey, { reportId: matching["reportId"], createdAt: Date.now() });
    return matching;
  }

  const start = new Date(`${fromDate}T00:00:00+05:30`);
  const requestedEnd = new Date(`${toDate}T23:59:59.999+05:30`);
  const end = requestedEnd.getTime() > Date.now() ? new Date() : requestedEnd;
  if (Number.isNaN(start.getTime()) || Number.isNaN(requestedEnd.getTime()) || start > end) {
    throw new Error("Select a valid returns date range that does not start in the future.");
  }
  const body = JSON.stringify({
    reportType,
    marketplaceIds: [config.marketplaceId],
    dataStartTime: start.toISOString(),
    dataEndTime: end.toISOString(),
  });
  const created = await signedRequest(config, token, "POST", path, {}, body);
  const payload = created["payload"] && typeof created["payload"] === "object"
    ? created["payload"] as Record<string, unknown>
    : created;
  const reportId = payload["reportId"];
  if (typeof reportId !== "string" || !reportId) throw new Error("Amazon accepted no report ID for the returns report.");
  pendingReturnsReports.set(cacheKey, { reportId, createdAt: Date.now() });
  return { reportId, reportType, processingStatus: "IN_QUEUE" };
}

type AmazonOrder = {
  orderId?: string;
  createdTime?: string;
  fulfillment?: { fulfillmentStatus?: string };
  orderItems?: {
    orderItemId?: string;
    itemId?: string;
    product?: {
      sku?: string;
      title?: string;
      price?: { unitPrice?: { amount?: string; currencyCode?: string } };
    };
    quantityOrdered?: number;
    proceeds?: {
      breakdowns?: { type?: string; subtotal?: { amount?: string; currencyCode?: string } }[];
    };
  }[];
};

async function listOrders(
  config: AmazonConfig,
  createdAfter: string,
  createdBefore: string,
  seller: AmazonSeller,
): Promise<AmazonOrderItem[]> {
  const token = await getAccessToken(config);
  const orders: AmazonOrder[] = [];
  let paginationToken: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const result = (await signedGet(config, token, "/orders/2026-01-01/orders", {
      // Amazon requires the original filters to remain on paginated requests.
      createdAfter,
      createdBefore,
      ...(paginationToken ? { paginationToken } : {}),
      marketplaceIds: config.marketplaceId,
      maxResultsPerPage: "100",
      includedData: "PROCEEDS,FULFILLMENT",
    })) as { orders?: AmazonOrder[]; pagination?: { nextToken?: string } };
    orders.push(...(result.orders ?? []));
    paginationToken = result.pagination?.nextToken;
    if (!paginationToken) break;
  }
  return orders.flatMap((order) =>
    (order.orderItems ?? []).map((item, itemIndex) => {
      const proceeds = item.proceeds?.breakdowns?.find((part) => part.type === "ITEM")?.subtotal;
      const unitPrice = item.product?.price?.unitPrice;
      const quantity = item.quantityOrdered ?? 0;
      return {
        orderId: order.orderId ?? "",
        orderItemId: item.orderItemId ?? item.itemId ?? `${item.product?.sku ?? "item"}-${itemIndex}`,
        status: order.fulfillment?.fulfillmentStatus ?? "Unknown",
        title: item.product?.title ?? item.product?.sku ?? "Amazon product",
        sku: item.product?.sku ?? "",
        quantity,
        itemPrice: Number(proceeds?.amount ?? Number(unitPrice?.amount ?? 0) * quantity),
        orderDate: order.createdTime ?? "",
        currency: proceeds?.currencyCode ?? unitPrice?.currencyCode ?? "INR",
        brand: seller === "monkeyman" ? "MONKEYMAN" : "CLASPO",
      };
    }),
  );
}

/** Server-only: SP-API credentials never cross into the browser or Capacitor bundle. */
export const fetchAmazonOrders = createServerFn({ method: "POST" })
  .validator(inputSchema)
  .handler(async ({ data }): Promise<AmazonOrdersResult> => {
    try {
      const seller = data.seller ?? "claspo";
      const config = getConfig(seller);
      if (!config) return { configured: false, orders: [] };
      return {
        configured: true,
        orders: await listOrders(config, data.createdAfter, data.createdBefore, seller),
      };
    } catch (error) {
      return {
        configured: true,
        orders: [],
        message: error instanceof Error ? error.message : "Amazon Orders request failed.",
      };
    }
  });
