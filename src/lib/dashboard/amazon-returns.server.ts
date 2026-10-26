import { gunzipSync } from "node:zlib";
import { getAmazonReportResource, getOrCreateAmazonReturnsReport } from "./amazon-sp-api.server";

type Seller = "claspo" | "monkeyman";

export interface AmazonReturnItem {
  brand: "CLASPO" | "MONKEYMAN";
  returnId: string;
  orderItemId: string;
  source: "amazon_return";
  status: string;
  action: string;
  reason: string;
  subReason: string;
  quantity: number;
  trackingId: string;
  shipmentId: string;
  courierName: string;
  orderDate: string;
  createdDate: string;
  updatedDate: string;
  expectedDate: string;
  completionDate: string;
  productName: string;
  sku: string;
  asin: string;
}

export interface AmazonReturnsResult {
  seller: Seller;
  configured: boolean;
  returns: AmazonReturnItem[];
  status: string;
  message?: string;
  trace: { at: string; level: "info" | "error"; message: string }[];
}

function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (quoted && char === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
    else if (char === '"' && field.length === 0) quoted = !quoted;
    else if (char === "\t" && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function parseReturns(text: string, seller: Seller): AmazonReturnItem[] {
  const rows = parseTsv(text);
  const headers = rows[0]?.map((header) => header.trim().toLowerCase().replace(/[_-]+/g, " ")) ?? [];
  const aliases = {
    returnId: ["amazon rma id", "rma id", "rma number", "return id", "license plate number"],
    orderItemId: ["order item id", "item id"],
    status: ["return request status", "return status", "status"],
    action: ["resolution", "return action", "detailed disposition"],
    reason: ["return reason", "reason"],
    subReason: ["sub reason", "detailed reason", "customer comments"],
    quantity: ["return quantity", "quantity", "qty"],
    trackingId: ["tracking id", "tracking number", "return tracking id"],
    shipmentId: ["shipment id", "fulfillment center id"],
    courierName: ["return carrier", "carrier", "courier name"],
    orderDate: ["order date"],
    createdDate: ["return request date", "return date", "request date"],
    updatedDate: ["last updated date", "updated date"],
    expectedDate: ["expected delivery date", "expected date"],
    completionDate: ["return delivery date", "completion date", "completed date"],
    productName: ["product name", "item name"],
    sku: ["merchant sku", "sku"],
    asin: ["asin"],
  } as const;
  const indexes = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, headers.findIndex((header) => names.some((name) => name === header))])) as Record<keyof typeof aliases, number>;
  const brand = seller === "claspo" ? "CLASPO" : "MONKEYMAN";
  return rows.slice(1).filter((cells) => cells.some((cell) => cell.trim())).map((cells) => {
    const value = (key: keyof typeof aliases) => indexes[key] < 0 ? "" : (cells[indexes[key]] ?? "").trim();
    const quantity = Number(value("quantity"));
    return {
      brand, returnId: value("returnId"), orderItemId: value("orderItemId"), source: "amazon_return",
      status: value("status") || "Unknown", action: value("action"), reason: value("reason"),
      subReason: value("subReason"), quantity: Number.isFinite(quantity) ? quantity : 0,
      trackingId: value("trackingId"), shipmentId: value("shipmentId"), courierName: value("courierName"),
      orderDate: value("orderDate"), createdDate: value("createdDate"), updatedDate: value("updatedDate"),
      expectedDate: value("expectedDate"), completionDate: value("completionDate"),
      productName: value("productName"), sku: value("sku"), asin: value("asin"),
    };
  });
}

function payloadOf(result: Record<string, unknown>) {
  const payload = result["payload"];
  return payload && typeof payload === "object" ? payload as Record<string, unknown> : result;
}

function inRange(value: string, fromDate: string, toDate: string) {
  if (!value) return true;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return true;
  const date = new Date(timestamp).toISOString().slice(0, 10);
  return date >= fromDate && date <= toDate;
}

export async function fetchAmazonReturns(data: { seller: Seller; fromDate: string; toDate: string }): Promise<AmazonReturnsResult> {
  const trace: AmazonReturnsResult["trace"] = [];
  const log = (message: string, level: "info" | "error" = "info") => trace.push({ at: new Date().toISOString(), level, message });
  const result = (configured: boolean, returns: AmazonReturnItem[], status: string, message?: string): AmazonReturnsResult => ({
    seller: data.seller, configured, returns, status, ...(message ? { message } : {}), trace,
  });
  log(`Started report lookup for ${data.seller} (${data.fromDate} to ${data.toDate}).`);
  try {
    log("Looking for an Amazon returns report matching the selected range.");
    const availableReport = await getOrCreateAmazonReturnsReport(data.seller, data.fromDate, data.toDate);
    const reportId = String(availableReport["reportId"] ?? "");
    if (!reportId) throw new Error("Amazon did not return a report ID.");
    log(`Checking Amazon returns report ${reportId}.`);
    const report = payloadOf(await getAmazonReportResource(data.seller, "reports", reportId));
    const status = String(report["processingStatus"] ?? "UNKNOWN");
    log(`Amazon report status: ${status}.`);
    if (typeof report["reportType"] === "string") log(`Amazon report type: ${report["reportType"]}.`);
    if (status !== "DONE") {
      const message = status === "FATAL"
        ? "Amazon could not finish this returns report. Refresh to request a replacement report."
        : status === "CANCELLED"
          ? "Amazon cancelled this returns report. Refresh to request a replacement report."
          : undefined;
      if (message) log(message, "error");
      return result(true, [], status, message);
    }
    const documentId = String(report["reportDocumentId"] ?? "");
    if (!documentId) {
      log("Amazon completed the report without a document ID.", "error");
      return result(true, [], "ERROR", "Amazon completed the report without a document ID.");
    }
    log("Requesting report document metadata.");
    const document = payloadOf(await getAmazonReportResource(data.seller, "documents", documentId));
    const downloadUrl = String(document["url"] ?? "");
    const parsedUrl = new URL(downloadUrl);
    if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname.endsWith("amazonaws.com")) {
      log("Amazon returned an invalid secure report URL.", "error");
      return result(true, [], "ERROR", "Amazon returned an invalid secure report URL.");
    }
    log("Downloading the report document. The temporary download URL is hidden.");
    const response = await fetch(parsedUrl);
    if (!response.ok) {
      const message = `Amazon report download failed (${response.status}); refresh to request a new download URL.`;
      log(message, "error");
      return result(true, [], "ERROR", message);
    }
    log(`Report download succeeded (${response.status}).`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const text = document["compressionAlgorithm"] === "GZIP"
      ? gunzipSync(bytes).toString("utf8")
      : new TextDecoder().decode(bytes);
    log(document["compressionAlgorithm"] === "GZIP" ? "Decompressed the GZIP report." : "Read the uncompressed report.");
    const rows = parseTsv(text);
    const headers = rows[0]?.map((header) => header.trim()).filter(Boolean) ?? [];
    const dataRowCount = rows.slice(1).filter((row) => row.some((cell) => cell.trim())).length;
    log(`Report contains ${dataRowCount} non-empty data rows.`);
    log(`Report columns: ${headers.length > 0 ? headers.join(" | ") : "(no column headers detected)"}.`);
    const parsedReturns = parseReturns(text, data.seller);
    log(`Return parser mapped ${parsedReturns.length} rows before date filtering.`);
    const returns = parsedReturns.filter((item) => inRange(item.createdDate, data.fromDate, data.toDate));
    log(`${returns.length} return rows match the selected date range (${data.fromDate} to ${data.toDate}).`);
    return result(true, returns, status);
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/https?:\/\/\S+/gi, "[redacted URL]") : "Amazon returns request failed.";
    log(message, "error");
    return result(true, [], "ERROR", message);
  }
}
