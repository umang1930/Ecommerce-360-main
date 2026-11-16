import { RefreshCw } from "lucide-react";
import { resolveRange } from "@/lib/dashboard/dates";
import { useDashboard } from "@/lib/dashboard/filters-context";
import { useFlipkartReturns } from "@/lib/dashboard/use-flipkart-returns";
import { productImageFor } from "@/lib/dashboard/product-image";
import { shortProductLabel } from "@/lib/dashboard/product-label";
import type { FlipkartReturn } from "@/lib/dashboard/flipkart-types";
import type { DashboardData } from "@/lib/dashboard/types";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { BrandLoader } from "./BrandLoader";

function dateLabel(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function normalizeOrderItemId(value: string) {
  return value.trim().toUpperCase();
}

function productForReturn(
  item: FlipkartReturn,
  order: DashboardData["flipkartOrders"][number] | undefined,
  productNamesBySku: Map<string, string>,
) {
  const sku = item.sku || order?.sku || "";
  const name = item.productName || order?.title || productNamesBySku.get(sku.toLowerCase()) || sku;
  const image = productImageFor({ name, sku });
  return {
    image,
    label: name ? image ? shortProductLabel({ name, sku }) : name : "Product details unavailable",
  };
}

export function FlipkartReturns() {
  const { filters, data } = useDashboard();
  const range = resolveRange(filters);
  const expectedToday = filters.period === "today";
  const returnsQuery = useFlipkartReturns(filters.brand, range.start, range.end, expectedToday);

  const result = returnsQuery.data;
  const returns = [
    ...(result?.customerReturns ?? []),
    ...(result?.courierReturns ?? []),
  ]
    .filter((item) => !expectedToday || (
      item.source === "courier_return" && item.shipmentStatus.toLowerCase() === "out_for_delivery"
    ))
    .sort((a, b) => (b.createdDate || b.orderDate).localeCompare(a.createdDate || a.orderDate));
  const orderByItemId = new Map((data?.flipkartOrders ?? []).map((order) => [normalizeOrderItemId(order.orderItemId), order]));
  const productNamesBySku = new Map((data?.catalog ?? []).map((product) => [product.sku.toLowerCase(), product.name]));

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between sm:px-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {expectedToday ? "Flipkart Returns Expected Today" : "Flipkart Returns"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {expectedToday
              ? `Seller Hub view · Courier returns out for delivery · ${range.start}`
              : `Customer and courier returns · ${range.start} – ${range.end}`}
          </p>
        </div>
        <div className="flex w-full items-center justify-between gap-3 min-[480px]:w-auto min-[480px]:justify-end">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{returns.length} items</span>
          <button
            type="button"
            onClick={() => void returnsQuery.refetch()}
            disabled={returnsQuery.isFetching}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground hover:bg-muted disabled:opacity-50"
          >
            {returnsQuery.isFetching ? <BrandLoader compact message="Refreshing" /> : <><RefreshCw className="h-4 w-4" />Refresh</>}
          </button>
        </div>
      </div>

      {returnsQuery.isPending ? (
        <BrandLoader message="Loading Flipkart returns…" />
      ) : returnsQuery.isError ? (
        <div className="space-y-3 px-5 py-8">
          <p className="text-sm text-destructive">{returnsQuery.error instanceof Error ? returnsQuery.error.message : "Could not load Flipkart returns."}</p>
          <button type="button" onClick={() => void returnsQuery.refetch()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Try again</button>
        </div>
      ) : !result?.configured ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">Add Flipkart Seller API credentials to the server environment to show returns.</p>
      ) : (
        <>
          {result.customerError || result.courierError ? (
            <div className="space-y-1 border-b border-border px-5 py-3 text-sm text-destructive">
              {result.customerError ? <p>Customer returns: {result.customerError}</p> : null}
              {result.courierError ? <p>Courier returns: {result.courierError}</p> : null}
            </div>
          ) : null}
          {returns.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground">No Flipkart returns found for this date range.</p>
          ) : (
            <>
            <div className="divide-y divide-border sm:hidden">
              {returns.slice(0, 100).map((item, index) => {
                const order = orderByItemId.get(normalizeOrderItemId(item.orderItemId));
                const product = productForReturn(item, order, productNamesBySku);
                return (
                  <article key={`mobile-${item.returnId}-${item.orderItemId}-${index}`} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="text-sm font-semibold">{item.brand}</p><p className="mt-0.5 break-all text-xs text-muted-foreground">Return {item.returnId || "—"} · Order item {item.orderItemId || "—"}</p></div>
                      <OrderStatusBadge status={expectedToday ? item.shipmentStatus : item.status} />
                    </div>
                    <div className="flex min-w-0 items-center gap-3">
                      {product.image ? <img src={product.image} alt="" className="size-12 shrink-0 rounded object-contain" /> : null}
                      <p className="min-w-0 text-sm">{product.label}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div><span className="text-muted-foreground">Type</span><p className="mt-0.5 capitalize">{item.source.replace("_", " ")}</p></div>
                      <div><span className="text-muted-foreground">Quantity</span><p className="mt-0.5">{item.quantity || "—"}</p></div>
                      <div><span className="text-muted-foreground">Tracking</span><p className="mt-0.5 break-all">{item.trackingId || "—"}</p></div>
                      <div><span className="text-muted-foreground">Created</span><p className="mt-0.5">{dateLabel(item.createdDate || item.orderDate)}</p></div>
                      <div><span className="text-muted-foreground">Expected</span><p className="mt-0.5">{dateLabel(item.expectedDate)}</p></div>
                    </div>
                    {item.reason || item.subReason ? <p className="break-words text-xs"><span className="text-muted-foreground">Reason · </span>{[item.reason, item.subReason].filter(Boolean).join(" · ")}</p> : null}
                  </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>{["Brand", "Return ID", "Order item", "Type", "Product", expectedToday ? "Shipment status" : "Status", "Reason", "Qty", "Tracking", "Created", "Expected"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {returns.slice(0, 100).map((item, index) => {
                    const order = orderByItemId.get(normalizeOrderItemId(item.orderItemId));
                    const product = productForReturn(item, order, productNamesBySku);
                    return (
                      <tr key={`${item.returnId}-${item.orderItemId}-${index}`} className="text-foreground">
                        <td className="px-4 py-3">{item.brand}</td>
                        <td className="px-4 py-3 font-medium">{item.returnId || "—"}</td>
                        <td className="px-4 py-3">{item.orderItemId || "—"}</td>
                        <td className="px-4 py-3 capitalize">{item.source.replace("_", " ")}</td>
                        <td className="px-4 py-3" title={order?.title}>
                          {product.image ? (
                            <span className="flex min-w-40 items-center gap-2">
                              <img src={product.image} alt="" className="size-12 shrink-0 rounded object-contain" />
                              <span className="max-w-48">{product.label}</span>
                            </span>
                          ) : product.label}
                        </td>
                        <td className="px-4 py-3"><OrderStatusBadge status={expectedToday ? item.shipmentStatus : item.status} /></td>
                        <td className="px-4 py-3">{[item.reason, item.subReason].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="px-4 py-3">{item.quantity || "—"}</td>
                        <td className="px-4 py-3">{item.trackingId || "—"}</td>
                        <td className="px-4 py-3">{dateLabel(item.createdDate || item.orderDate)}</td>
                        <td className="px-4 py-3">{dateLabel(item.expectedDate)}</td>
                      </tr>
                    );
                  })}
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
