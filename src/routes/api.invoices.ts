import { createFileRoute } from "@tanstack/react-router";
import {
  deleteStoredInvoice,
  listStoredInvoices,
  readStoredInvoice,
  saveStoredInvoice,
  updateStoredInvoice,
} from "@/lib/dashboard/invoice-storage.server";
import type { InvoiceExtraction } from "@/lib/dashboard/invoice-ocr";
import { extractInvoiceOnServer } from "@/lib/dashboard/invoice-ocr.server";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function errorResponse(error: unknown) {
  console.error("Invoice storage request failed", error);
  return Response.json({ error: error instanceof Error ? error.message : "Invoice storage request failed." }, { status: 500 });
}

export const Route = createFileRoute("/api/invoices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const fileId = url.searchParams.get("file");
          if (fileId) {
            const record = await readStoredInvoice(fileId);
            if (!record) return Response.json({ error: "Invoice not found." }, { status: 404 });
            const data = record["data"];
            const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
            const body = new ArrayBuffer(bytes.byteLength);
            new Uint8Array(body).set(bytes);
            const type = String(record["type"] ?? "application/octet-stream");
            const name = String(record["name"] ?? "invoice").replace(/[\r\n"\\]/g, "_");
            return new Response(body, { headers: {
              "content-type": type,
              "content-length": String(bytes.byteLength),
              "content-disposition": `inline; filename="${name}"; filename*=UTF-8''${encodeURIComponent(String(record["name"] ?? "invoice"))}`,
              "cache-control": "private, no-store",
              "x-content-type-options": "nosniff",
            } });
          }
          const category = url.searchParams.get("category");
          if (category !== "invoice" && category !== "pdf") return Response.json({ error: "Invalid file category." }, { status: 400 });
          return Response.json(await listStoredInvoices(category), { headers: { "cache-control": "private, no-store" } });
        } catch (error) { return errorResponse(error); }
      },
      POST: async ({ request }) => {
        if (!sameOrigin(request)) return Response.json({ error: "Cross-origin upload rejected." }, { status: 403 });
        try {
          const form = await request.formData();
          const file = form.get("file");
          const category = form.get("category");
          if (!(file instanceof File) || (category !== "invoice" && category !== "pdf")) {
            return Response.json({ error: "A file and valid category are required." }, { status: 400 });
          }
          if (file.size < 1 || file.size > 15 * 1024 * 1024) return Response.json({ error: "File must be smaller than 15 MB." }, { status: 413 });
          const rawType = file.type.toLowerCase();
          const isPdf = rawType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
          const isImage = rawType.startsWith("image/");
          if (!isPdf && !isImage) return Response.json({ error: "Only PDF and image files are supported." }, { status: 415 });
          const invoiceDataText = form.get("invoiceData");
          const requestedId = form.get("id");
          let invoiceData: InvoiceExtraction | undefined;
          if (typeof invoiceDataText === "string") {
            try { invoiceData = JSON.parse(invoiceDataText) as InvoiceExtraction; }
            catch { return Response.json({ error: "Invoice metadata is invalid." }, { status: 400 }); }
          }
          if (requestedId !== null && (typeof requestedId !== "string" || !/^[\w-]{1,80}$/.test(requestedId))) {
            return Response.json({ error: "Invalid file ID." }, { status: 400 });
          }
          const id = typeof requestedId === "string" ? requestedId : crypto.randomUUID();
          const type = isPdf ? "application/pdf" : rawType || "application/octet-stream";
          const bytes = new Uint8Array(await file.arrayBuffer());
          const isLegacyMigration = typeof requestedId === "string" && Boolean(invoiceData);
          if (category === "invoice" && !isLegacyMigration) {
            try {
              invoiceData = await extractInvoiceOnServer(bytes, type);
            } catch (error) {
              invoiceData = {
                dueDate: null,
                paid: false,
                extraction: "needs-review",
                reason: `Server reading failed: ${error instanceof Error ? error.message : "The invoice could not be processed."}`,
                recognizedText: "",
              };
            }
          }
          await saveStoredInvoice({ id, name: file.name, type,
            category, ...(invoiceData ? { invoiceData } : {}), bytes });
          return Response.json({ id, ...(invoiceData ? { invoiceData } : {}) }, { status: 201 });
        } catch (error) { return errorResponse(error); }
      },
      PATCH: async ({ request }) => {
        if (!sameOrigin(request)) return Response.json({ error: "Cross-origin update rejected." }, { status: 403 });
        try {
          const body = await request.json() as { id?: unknown; retry?: unknown; invoiceData?: unknown };
          if (typeof body.id !== "string") return Response.json({ error: "Invoice ID is required." }, { status: 400 });
          if (body.retry === true) {
            const record = await readStoredInvoice(body.id);
            if (!record) return Response.json({ error: "Invoice not found." }, { status: 404 });
            const data = record["data"];
            const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
            const invoiceData = await extractInvoiceOnServer(bytes, String(record["type"] ?? "application/pdf"));
            await updateStoredInvoice(body.id, invoiceData);
            return Response.json({ ok: true, invoiceData });
          }
          if (!body.invoiceData || typeof body.invoiceData !== "object") return Response.json({ error: "Invoice metadata is required." }, { status: 400 });
          await updateStoredInvoice(body.id, body.invoiceData as InvoiceExtraction);
          return Response.json({ ok: true });
        } catch (error) { return errorResponse(error); }
      },
      DELETE: async ({ request }) => {
        if (!sameOrigin(request)) return Response.json({ error: "Cross-origin delete rejected." }, { status: 403 });
        try {
          const id = new URL(request.url).searchParams.get("id");
          if (!id) return Response.json({ error: "Invoice ID is required." }, { status: 400 });
          await deleteStoredInvoice(id);
          return Response.json({ ok: true });
        } catch (error) { return errorResponse(error); }
      },
    },
  },
});
