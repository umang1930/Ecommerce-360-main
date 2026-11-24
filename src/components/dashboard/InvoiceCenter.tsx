import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  FileImage,
  FileScan,
  FileText,
  RotateCcw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deleteUploadedPdf,
  getUploadedPdf,
  listInvoices,
  saveInvoices,
  updateInvoiceExtraction,
  type UploadedPdf,
} from "@/lib/dashboard/uploaded-pdfs";
import {
  getInvoicePriority,
  priorityOrder,
  type InvoicePriority,
} from "@/lib/dashboard/invoice-ocr";
import { BrandLoader } from "./BrandLoader";

const MAX_INVOICE_BYTES = 15 * 1024 * 1024;
const HIGH_AMOUNT_THRESHOLD_KEY = "invoice-high-amount-threshold";
const DEFAULT_HIGH_AMOUNT_THRESHOLD = 10_000;

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function InvoiceCenter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [invoices, setInvoices] = useState<UploadedPdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [amountThreshold, setAmountThreshold] = useState(DEFAULT_HIGH_AMOUNT_THRESHOLD);

  const refresh = useCallback(async () => {
    try {
      setInvoices(await listInvoices());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load invoices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedThreshold = Number(window.localStorage.getItem(HIGH_AMOUNT_THRESHOLD_KEY));
    if (Number.isFinite(savedThreshold) && savedThreshold > 0) setAmountThreshold(savedThreshold);
    void refresh();
  }, [refresh]);

  function updateAmountThreshold(value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setAmountThreshold(parsed);
    window.localStorage.setItem(HIGH_AMOUNT_THRESHOLD_KEY, String(parsed));
  }

  const prioritizedInvoices = useMemo(
    () =>
      [...invoices].sort((left, right) => {
        const leftPriority = getInvoicePriority(left.invoiceData, amountThreshold);
        const rightPriority = getInvoicePriority(right.invoiceData, amountThreshold);
        const priorityDifference = priorityOrder(leftPriority) - priorityOrder(rightPriority);
        if (priorityDifference !== 0) return priorityDifference;
        if (left.invoiceData?.dueDate && right.invoiceData?.dueDate) {
          const dueDateDifference = left.invoiceData.dueDate.localeCompare(
            right.invoiceData.dueDate,
          );
          if (dueDateDifference !== 0) return dueDateDifference;
        }
        if (leftPriority === "high-amount")
          return (right.invoiceData?.amount ?? 0) - (left.invoiceData?.amount ?? 0);
        if (left.invoiceData?.invoiceDate && right.invoiceData?.invoiceDate) {
          const invoiceDateDifference = left.invoiceData.invoiceDate.localeCompare(
            right.invoiceData.invoiceDate,
          );
          if (invoiceDateDifference !== 0) return invoiceDateDifference;
        }
        return right.uploadedAt.localeCompare(left.uploadedAt);
      }),
    [invoices, amountThreshold],
  );

  async function upload(selected: FileList | null) {
    const files = Array.from(selected ?? []);
    if (!files.length) return;
    setError("");
    setMessage("");

    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isImage = file.type.startsWith("image/");
      if ((!isPdf && !isImage) || file.size > MAX_INVOICE_BYTES) {
        rejected.push(file.name);
        continue;
      }
      if (isPdf && !(await file.slice(0, 5).text()).startsWith("%PDF-")) {
        rejected.push(file.name);
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length) {
      setBusy(true);
      setOcrProgress("Uploading invoice files for shared server reading…");
      try {
        await saveInvoices(accepted, (name) => setOcrProgress(`Reading ${name} on the server…`));
        await refresh();
        setMessage(`${accepted.length} invoice file${accepted.length === 1 ? "" : "s"} uploaded and processed. Check the priority list for any that need review.`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save the selected invoices.");
      } finally {
        setBusy(false);
        setOcrProgress("");
      }
    }
    if (rejected.length)
      setError(
        `Unsupported or invalid file${rejected.length === 1 ? "" : "s"}: ${rejected.join(", ")}`,
      );
    if (inputRef.current) inputRef.current.value = "";
  }

  async function openFile(invoice: UploadedPdf, download = false) {
    try {
      const file = await getUploadedPdf(invoice.id);
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      if (download) link.download = invoice.name;
      else {
        link.target = "_blank";
        link.rel = "noreferrer";
      }
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open this invoice.");
    }
  }

  async function retryReading(invoice: UploadedPdf) {
    setBusy(true);
    setError("");
    setMessage("");
    setOcrProgress(`Retrying ${invoice.name}…`);
    try {
      await updateInvoiceExtraction(invoice.id);
      await refresh();
      setMessage("Invoice reading finished. Check the updated details and review status.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this invoice.");
    } finally {
      setBusy(false);
      setOcrProgress("");
    }
  }

  async function remove(id: string) {
    try {
      await deleteUploadedPdf(id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this invoice.");
    }
  }

  const priorityLabels: Record<InvoicePriority, string> = {
    "vendor-priority": "P1 · U K Packaging",
    overdue: "Overdue",
    "due-soon": "Due soon",
    "high-amount": "High amount",
    "needs-review": "Needs review",
    upcoming: "Upcoming",
    paid: "Paid",
  };
  const priorityClasses: Record<InvoicePriority, string> = {
    "vendor-priority": "border-violet-200 bg-violet-50 text-violet-800",
    overdue: "border-red-200 bg-red-50 text-red-700",
    "due-soon": "border-orange-200 bg-orange-50 text-orange-700",
    "high-amount": "border-blue-200 bg-blue-50 text-blue-800",
    "needs-review": "border-amber-200 bg-amber-50 text-amber-800",
    upcoming: "border-slate-200 bg-slate-50 text-slate-700",
    paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="space-y-5">
      <section className="card-surface overflow-hidden">
        <div className="border-b border-border bg-gradient-to-r from-primary/[0.08] via-background to-secondary/50 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <FileScan className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Invoice inbox
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Upload supplier invoices to extract payment details and organize them by priority.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 lg:p-7">
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*,.pdf"
              multiple
              className="sr-only"
              aria-label="Choose invoice PDFs or images"
              onChange={(event) => void upload(event.target.files)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="group flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/25 bg-primary/[0.025] px-5 py-7 text-center transition-all hover:border-primary/50 hover:bg-primary/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-wait"
            >
              <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-background text-primary shadow-sm transition-transform group-hover:-translate-y-0.5">
                <UploadCloud className="size-6" />
              </span>
              <span className="text-sm font-semibold text-foreground">
                {busy ? "Reading invoice files…" : "Choose invoice files"}
              </span>
              <span className="mt-1 text-sm text-muted-foreground">
                Select PDFs or images from your device
              </span>
              <span className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm">
                Browse files
              </span>
            </button>
            {message ? (
              <p role="status" className="mt-3 text-sm text-emerald-700">
                {message}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {ocrProgress ? (
              <p role="status" className="mt-3 text-xs font-medium text-primary">
                {ocrProgress}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card-surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Invoice priority list</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Priority: U K Packaging first, then due date, high amount, review, upcoming, and paid
              · {invoices.length} files
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted-foreground">
              High amount from
              <span className="mt-1 flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
                ₹
                <input
                  aria-label="High amount priority threshold in rupees"
                  className="w-24 bg-transparent outline-none"
                  type="number"
                  min="0"
                  value={amountThreshold}
                  onChange={(event) => updateAmountThreshold(event.target.value)}
                />
              </span>
            </label>
            <Button type="button" variant="outline" onClick={() => void refresh()}>
              Refresh
            </Button>
          </div>
        </div>
        {loading ? (
          <BrandLoader message="Loading invoice files…" />
        ) : invoices.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <FileText className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium text-foreground">No invoices uploaded yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a PDF or image above to add the first invoice.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {prioritizedInvoices.map((invoice) => {
              const image = invoice.type.startsWith("image/");
              const Icon = image ? FileImage : FileText;
              const priority = getInvoicePriority(invoice.invoiceData, amountThreshold);
              const compactVendor = invoice.invoiceData?.vendorName?.replace(/[^A-Za-z]/g, "").toLowerCase();
              const vendorName = compactVendor === "originalforrecipient" ? null : invoice.invoiceData?.vendorName;
              const hasPaymentDetails = Boolean(
                vendorName || invoice.invoiceData?.vendorGstin || invoice.invoiceData?.bankName ||
                invoice.invoiceData?.accountHolder || invoice.invoiceData?.bankAccountNumber || invoice.invoiceData?.ifsc,
              );
              return (
                <li key={invoice.id} className="px-5 py-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className="break-words text-sm font-semibold leading-5 text-foreground"
                          title={invoice.name}
                        >
                          {invoice.name}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            Due date:{" "}
                            {invoice.invoiceData?.dueDate
                              ? new Date(
                                  `${invoice.invoiceData.dueDate}T00:00:00`,
                                ).toLocaleDateString("en-IN")
                              : "Not found"}
                          </span>
                          <span>
                            Invoice date:{" "}
                            {invoice.invoiceData?.invoiceDate
                              ? new Date(
                                  `${invoice.invoiceData.invoiceDate}T00:00:00`,
                                ).toLocaleDateString("en-IN")
                              : "Not found"}
                          </span>
                          <span>
                            Amount:{" "}
                            {invoice.invoiceData?.amount !== null &&
                            invoice.invoiceData?.amount !== undefined
                              ? formatMoney(invoice.invoiceData.amount)
                              : "Not found"}
                          </span>
                          <span>File: {formatSize(invoice.size)}</span>
                          <span>Uploaded: {formatDate(invoice.uploadedAt)}</span>
                        </div>
                        {vendorName ? (
                          <p className="mt-1.5 text-xs font-medium text-foreground/80">
                            Vendor:{" "}
                            <span className="font-semibold">{vendorName}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priorityClasses[priority]}`}
                      >
                        {priorityLabels[priority]}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openFile(invoice)}
                        aria-label={`Open ${invoice.name}`}
                      >
                        <ExternalLink className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openFile(invoice, true)}
                        aria-label={`Download ${invoice.name}`}
                      >
                        <Download className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void remove(invoice.id)}
                        aria-label={`Delete ${invoice.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                      {invoice.invoiceData?.extraction !== "complete" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void retryReading(invoice)}
                          aria-label={`Retry reading ${invoice.name}`}
                        >
                          <RotateCcw className="size-4" />
                          <span className="sr-only">Retry reading</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl border border-border bg-muted/30 px-3 py-3 sm:px-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Vendor and payment details
                    </p>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-6">
                      {[
                        ["Vendor", vendorName],
                        ["GSTIN", invoice.invoiceData?.vendorGstin],
                        ["Bank", invoice.invoiceData?.bankName],
                        ["Account holder", invoice.invoiceData?.accountHolder],
                        ["Account number", invoice.invoiceData?.bankAccountNumber],
                        ["IFSC", invoice.invoiceData?.ifsc],
                      ]
                        .filter(([, value]) => Boolean(value))
                        .map(([label, value]) => (
                          <div key={label} className="min-w-0">
                            <dt className="text-[11px] text-muted-foreground">{label}</dt>
                            <dd className="mt-0.5 break-words text-xs font-medium text-foreground">
                              {value}
                            </dd>
                          </div>
                        ))}
                      {!hasPaymentDetails ? (
                        <p className="col-span-full text-xs text-muted-foreground">
                          Vendor and payment details have not been extracted yet.
                        </p>
                      ) : null}
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
