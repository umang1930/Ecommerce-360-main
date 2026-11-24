import type { InvoiceExtraction } from "./invoice-ocr";

const LEGACY_DATABASE_NAME = "ecommerce360-uploaded-pdfs";
const LEGACY_STORE_NAME = "pdfs";
let migration: Promise<void> | undefined;

export interface UploadedPdf {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  type: string;
  category: "pdf" | "invoice";
  invoiceData?: InvoiceExtraction;
  file?: Blob;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error ?? `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export async function saveUploadedPdfs(files: File[]): Promise<void> {
  for (const file of files) await uploadFile(file, "pdf");
}

export async function listUploadedPdfs(): Promise<UploadedPdf[]> {
  await migrateLegacyFiles();
  return api<UploadedPdf[]>("/api/invoices?category=pdf");
}

export async function saveInvoices(files: File[], extracted: InvoiceExtraction[]): Promise<void> {
  for (const [index, file] of files.entries()) {
    await uploadFile(file, "invoice", extracted[index]);
  }
}

export async function listInvoices(): Promise<UploadedPdf[]> {
  await migrateLegacyFiles();
  return api<UploadedPdf[]>("/api/invoices?category=invoice");
}

async function uploadFile(file: File, category: "pdf" | "invoice", invoiceData?: InvoiceExtraction, id?: string) {
  const form = new FormData();
  form.set("file", file);
  form.set("category", category);
  if (id) form.set("id", id);
  if (invoiceData) form.set("invoiceData", JSON.stringify(invoiceData));
  await api<{ id: string }>("/api/invoices", { method: "POST", body: form });
}

async function migrateLegacyFiles() {
  migration ??= (async () => {
    if (typeof indexedDB === "undefined") return;
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(LEGACY_DATABASE_NAME, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not read existing local invoice files."));
    });
    try {
      if (!database.objectStoreNames.contains(LEGACY_STORE_NAME)) return;
      const files = await new Promise<UploadedPdf[]>((resolve, reject) => {
        const request = database.transaction(LEGACY_STORE_NAME, "readonly").objectStore(LEGACY_STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result as UploadedPdf[]);
        request.onerror = () => reject(request.error ?? new Error("Could not read existing local invoice files."));
      });
      for (const stored of files) {
        const category = stored.category ?? "pdf";
        const blob = stored.file;
        if (!(blob instanceof Blob)) throw new Error(`The saved file “${stored.name}” is unreadable. It remains in this browser.`);
        const file = new File([blob], stored.name, { type: blob.type || stored.type || "application/pdf" });
        await uploadFile(file, category, stored.invoiceData, stored.id);
        await new Promise<void>((resolve, reject) => {
          const request = database.transaction(LEGACY_STORE_NAME, "readwrite").objectStore(LEGACY_STORE_NAME).delete(stored.id);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error ?? new Error("Could not finish moving local invoice files."));
        });
      }
    } finally {
      database.close();
    }
  })().catch((error) => { migration = undefined; throw error; });
  await migration;
}

export async function updateInvoiceExtraction(id: string, invoiceData: InvoiceExtraction): Promise<void> {
  await api<{ ok: true }>("/api/invoices", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, invoiceData }),
  });
}

export async function getUploadedPdf(id: string): Promise<Blob> {
  const response = await fetch(`/api/invoices?file=${encodeURIComponent(id)}`, { credentials: "same-origin" });
  if (!response.ok) throw new Error("Could not retrieve this invoice file.");
  return response.blob();
}

export async function deleteUploadedPdf(id: string): Promise<void> {
  await api<{ ok: true }>(`/api/invoices?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
