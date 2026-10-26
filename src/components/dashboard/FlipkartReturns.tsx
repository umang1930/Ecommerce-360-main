import { RefreshCw } from "lucide-react";
import { resolveRange } from "@/lib/dashboard/dates";
import { useDashboard } from "@/lib/dashboard/filters-context";
import { useFlipkartReturns } from "@/lib/dashboard/use-flipkart-returns";
import { OrderStatusBadge } from "./OrderStatusBadge";

function dateLabel(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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
    .filter((item) => !expectedToday || (item.source === "courier_return" && item.shipmentStatus.toLowerCase() === "out_for_delivery"))
    .sort((a, b) => (b.createdDate || b.orderDate).localeCompare(a.createdDate || a.orderDate));
  const orderByItemId = new Map((data?.flipkartOrders ?? []).map((order) => [order.orderItemId, order]));

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{expectedToday ? "Flipkart Returns Expected Today" : "Flipkart Returns"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {expectedToday ? `Seller Hub view · Courier returns out for delivery · ${range.start}` : `Customer and courier returns · ${range.start} – ${range.end}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{returns.length} items</span>
          <button
            type="button"
            onClick={() => void returnsQuery.refetch()}
            disabled={returnsQuery.isFetching}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${returnsQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {returnsQuery.isPending ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">Loading Flipkart returns…</p>
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>{["Brand", "Return ID", "Order item", "Type", "Product", expectedToday ? "Shipment status" : "Status", "Reason", "Qty", "Tracking", "Created", "Expected"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {returns.slice(0, 100).map((item, index) => {
                    const order = orderByItemId.get(item.orderItemId);
                    return (
                      <tr key={`${item.returnId}-${item.orderItemId}-${index}`} className="text-foreground">
                        <td className="px-4 py-3">{item.brand}</td>
                        <td className="px-4 py-3 font-medium">{item.returnId || "—"}</td>
                        <td className="px-4 py-3">{item.orderItemId || "—"}</td>
                        <td className="px-4 py-3 capitalize">{item.source.replace("_", " ")}</td>
                        <td className="max-w-56 truncate px-4 py-3" title={order?.title}>{order?.title || "Product details unavailable"}</td>
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
          )}
        </>
      )}
    </section>
  );
}
