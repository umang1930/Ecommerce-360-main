import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { fetchAmazonReturns } from "@/lib/dashboard/amazon-returns";
import { resolveRange } from "@/lib/dashboard/dates";
import { useDashboard } from "@/lib/dashboard/filters-context";
import { productImageFor } from "@/lib/dashboard/product-image";
import { shortProductLabel } from "@/lib/dashboard/product-label";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { BrandLoader } from "./BrandLoader";

function dateLabel(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const AMAZON_RETURN_REASON_DESCRIPTIONS: Record<string, string> = {
  "CR-UNWANTED_ITEM": "The customer no longer needs or wants the item.",
  "CR-DEFECTIVE": "The item was reported as defective.",
  "UND-UNKNOWN": "Unknown reason for an undelivered return; this code does not identify the specific cause.",
};

function describeReturnReason(value: string) {
  const description = AMAZON_RETURN_REASON_DESCRIPTIONS[value.trim().toUpperCase()];
  return description ? `${value} — ${description}` : value;
}

export function AmazonReturns() {
  const { filters } = useDashboard();
  const range = resolveRange(filters);
  const returnsQuery = useQuery({
    queryKey: ["amazon-returns", filters.brand, range.start, range.end],
    queryFn: async () => {
      const sellers = filters.brand === "CLASPO" ? ["claspo"] as const
        : filters.brand === "MONKEYMAN" ? ["monkeyman"] as const
          : ["claspo", "monkeyman"] as const;
      return Promise.all(sellers.map((seller) => fetchAmazonReturns({
        data: { seller, fromDate: range.start, toDate: range.end },
      })));
    },
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    enabled: filters.marketplace !== "Flipkart",
  });

  const results = returnsQuery.data ?? [];
  const returns = results.flatMap((result) => result.returns)
    .sort((a, b) => (b.createdDate || b.orderDate).localeCompare(a.createdDate || a.orderDate));
  const messages = results.map((result) => result.message).filter((message): message is string => Boolean(message));
  const notConfigured = results.length > 0 && results.every((result) => !result.configured);

  useEffect(() => {
    if (returnsQuery.isError) {
      console.error("[Amazon Returns Trace] Request failed", returnsQuery.error);
      return;
    }
    const trace = (returnsQuery.data ?? []).flatMap((result) => result.trace.map((entry) => ({ ...entry, seller: result.seller })))
      .sort((a, b) => a.at.localeCompare(b.at));
    if (trace.length === 0) return;

    console.groupCollapsed(`[Amazon Returns Trace] ${trace.length} events`);
    for (const entry of trace) {
      const log = entry.level === "error" ? console.error : console.info;
      log(`[${entry.seller}] ${new Date(entry.at).toLocaleTimeString()} ${entry.message}`);
    }
    console.groupEnd();
  }, [returnsQuery.data, returnsQuery.error, returnsQuery.isError]);

  if (filters.marketplace === "Flipkart") return null;

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between sm:px-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Amazon Returns</h2>
          <p className="mt-1 text-xs text-muted-foreground">Claspo and Monkeyman Amazon.in returns · {range.start} – {range.end}</p>
        </div>
        <div className="flex w-full items-center justify-between gap-3 min-[480px]:w-auto min-[480px]:justify-end">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{returns.length} items</span>
          <button type="button" onClick={() => void returnsQuery.refetch()} disabled={returnsQuery.isFetching} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground hover:bg-muted disabled:opacity-50">
            {returnsQuery.isFetching ? <BrandLoader compact message="Refreshing" /> : <><RefreshCw className="h-4 w-4" />Refresh</>}
          </button>
        </div>
      </div>
      {returnsQuery.isPending ? (
        <BrandLoader message="Loading Amazon returns…" />
      ) : returnsQuery.isError ? (
        <div className="space-y-3 px-5 py-8">
          <p className="text-sm text-destructive">{returnsQuery.error instanceof Error ? returnsQuery.error.message : "Could not load Amazon returns."}</p>
          <button type="button" onClick={() => void returnsQuery.refetch()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Try again</button>
        </div>
      ) : notConfigured ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">Configure both seller Amazon credentials in the server environment to show returns. The supplied report IDs are defaults and can be overridden with the report ID variables.</p>
      ) : (
        <>
          {messages.length > 0 ? <div className="space-y-1 border-b border-border px-5 py-3 text-sm text-destructive">{messages.map((message, index) => <p key={`${message}-${index}`}>{message}</p>)}</div> : null}
          {returns.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground">{results.some((result) => result.status === "IN_QUEUE" || result.status === "IN_PROGRESS") ? "Amazon is still processing a returns report. Refresh to check again." : "No Amazon returns found for this date range."}</p>
          ) : (
            <>
            <div className="divide-y divide-border sm:hidden">
              {returns.slice(0, 100).map((item, index) => (
                <article key={`mobile-${item.brand}-${item.returnId}-${item.orderItemId}-${index}`} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-sm font-semibold">{item.brand}</p><p className="mt-0.5 break-all text-xs text-muted-foreground">Return {item.returnId || "—"} · Order item {item.orderItemId || "—"}</p></div>
                    <OrderStatusBadge status={item.status} />
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    {productImageFor({ name: item.productName, sku: item.sku }) ? (
                      <img src={productImageFor({ name: item.productName, sku: item.sku })!} alt="" className="size-12 shrink-0 rounded object-contain" />
                    ) : null}
                    <p className="min-w-0 text-sm">{productImageFor({ name: item.productName, sku: item.sku }) ? shortProductLabel({ name: item.productName, sku: item.sku }) : item.productName || "—"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div><span className="text-muted-foreground">Type</span><p className="mt-0.5 capitalize">{item.source.replace("_", " ")}</p></div>
                    <div><span className="text-muted-foreground">Quantity</span><p className="mt-0.5">{item.quantity || "—"}</p></div>
                    <div><span className="text-muted-foreground">SKU</span><p className="mt-0.5 break-all">{item.sku || "—"}</p></div>
                    <div><span className="text-muted-foreground">ASIN</span><p className="mt-0.5 break-all">{item.asin || "—"}</p></div>
                    <div><span className="text-muted-foreground">Tracking</span><p className="mt-0.5 break-all">{item.trackingId || "—"}</p></div>
                    <div><span className="text-muted-foreground">Created</span><p className="mt-0.5">{dateLabel(item.createdDate || item.orderDate)}</p></div>
                    <div><span className="text-muted-foreground">Expected</span><p className="mt-0.5">{dateLabel(item.expectedDate)}</p></div>
                  </div>
                  {item.reason || item.subReason ? <p className="break-words text-xs"><span className="text-muted-foreground">Reason · </span>{[item.reason, item.subReason].filter(Boolean).map(describeReturnReason).join(" · ")}</p> : null}
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[1150px] text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>{["Brand", "Return ID", "Order item", "Type", "Product", "SKU", "ASIN", "Status", "Reason", "Qty", "Tracking", "Created", "Expected"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {returns.slice(0, 100).map((item, index) => (
                    <tr key={`${item.brand}-${item.returnId}-${item.orderItemId}-${index}`} className="text-foreground">
                      <td className="px-4 py-3">{item.brand}</td>
                      <td className="px-4 py-3 font-medium">{item.returnId || "—"}</td>
                      <td className="px-4 py-3">{item.orderItemId || "—"}</td>
                      <td className="px-4 py-3 capitalize">{item.source.replace("_", " ")}</td>
                      <td className="px-4 py-3" title={item.productName}>
                        {productImageFor({ name: item.productName, sku: item.sku }) ? (
                          <span className="flex min-w-40 items-center gap-2">
                            <img src={productImageFor({ name: item.productName, sku: item.sku })!} alt="" className="size-12 shrink-0 rounded object-contain" />
                            <span className="max-w-48">{shortProductLabel({ name: item.productName, sku: item.sku })}</span>
                          </span>
                        ) : item.productName || "—"}
                      </td>
                      <td className="px-4 py-3">{item.sku || "—"}</td>
                      <td className="px-4 py-3">{item.asin || "—"}</td>
                      <td className="px-4 py-3"><OrderStatusBadge status={item.status} /></td>
                      <td className="px-4 py-3">{[item.reason, item.subReason].filter(Boolean).map(describeReturnReason).join(" · ") || "—"}</td>
                      <td className="px-4 py-3">{item.quantity || "—"}</td>
                      <td className="px-4 py-3">{item.trackingId || "—"}</td>
                      <td className="px-4 py-3">{dateLabel(item.createdDate || item.orderDate)}</td>
                      <td className="px-4 py-3">{dateLabel(item.expectedDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {returns.length > 100 ? <p className="px-5 py-3 text-xs text-muted-foreground">Showing the latest 100 returns.</p> : null}
            </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
