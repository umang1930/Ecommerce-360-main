import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useDashboard } from "@/lib/dashboard/filters-context";
import { todayIST } from "@/lib/dashboard/dates";
import { canonicalFlipkartSku } from "@/lib/dashboard/brands";
import { fetchFlipkartUpcomingOrders } from "@/lib/dashboard/flipkart";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { ORDERS_PAGE_SIZE, OrdersPagination } from "./OrdersPagination";

function dispatchDay(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

export function FlipkartToAcceptOrders() {
  const { filters } = useDashboard();
  const [page, setPage] = useState(1);
  const today = todayIST();
  const ordersQuery = useQuery({
    queryKey: ["flipkart-upcoming-orders", filters.brand, filters.product, today],
    enabled: filters.marketplace === "Flipkart",
    queryFn: async () => {
      const sellers: ("claspo" | "monkeyman")[] =
        filters.brand === "CLASPO"
          ? ["claspo"]
          : filters.brand === "MONKEYMAN"
            ? ["monkeyman"]
            : ["claspo", "monkeyman"];
      const results = await Promise.all(
        sellers.map((seller) => fetchFlipkartUpcomingOrders({ data: { seller } })),
      );
      return {
        configured: results.some((result) => result.configured),
        orders: results.flatMap((result) => result.orders),
        messages: results.flatMap((result, index) => [
          ...(!result.configured
            ? [
                `${sellers[index] === "monkeyman" ? "Monkeyman" : "Claspo"} Flipkart Seller API is not configured; those orders are omitted.`,
              ]
            : []),
          ...(result.message ? [result.message] : []),
        ]),
        warnings: results
          .map((result, index) =>
            result.warning
              ? `${sellers[index] === "monkeyman" ? "Monkeyman" : "Claspo"}: ${result.warning}`
              : undefined,
          )
          .filter((warning): warning is string => Boolean(warning)),
      };
    },
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const orders = [
    ...new Map(
      (ordersQuery.data?.orders ?? [])
        .filter(
          (order) =>
            dispatchDay(order.dispatchAfterDate) === today &&
            (filters.product === "all" ||
              canonicalFlipkartSku(order.sku, order.title) === filters.product),
        )
        .map(
          (order) => [order.orderItemId || `${order.orderId}-${order.shipmentId}`, order] as const,
        ),
    ).values(),
  ].sort((a, b) => (a.dispatchAfterDate ?? "").localeCompare(b.dispatchAfterDate ?? ""));
  const uniqueOrderCount = new Set(
    orders.map((order) => order.orderId || order.orderItemId).filter(Boolean),
  ).size;
  const pageCount = Math.max(1, Math.ceil(orders.length / ORDERS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  useEffect(() => setPage(1), [filters.brand, filters.product]);
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);

  const visibleOrders = orders.slice(
    (currentPage - 1) * ORDERS_PAGE_SIZE,
    currentPage * ORDERS_PAGE_SIZE,
  );

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Flipkart To Accept Orders</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Dispatch After is today · Seller Hub To Accept matching by dispatch date
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!ordersQuery.isPending && !ordersQuery.isError ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {uniqueOrderCount} orders · {orders.length} items
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void ordersQuery.refetch()}
            disabled={ordersQuery.isFetching}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${ordersQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {ordersQuery.isPending ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          Loading Flipkart To Accept orders…
        </p>
      ) : ordersQuery.isError ? (
        <p className="px-5 py-8 text-sm text-destructive">
          {ordersQuery.error instanceof Error
            ? ordersQuery.error.message
            : "Could not load To Accept orders."}
        </p>
      ) : !ordersQuery.data?.configured ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          Connect Flipkart Seller API credentials on the server to show To Accept orders.
        </p>
      ) : (
        <>
          {ordersQuery.data.messages.map((message, index) => (
            <p
              key={`message-${index}`}
              className="border-b border-border px-5 py-3 text-sm text-destructive"
            >
              {message}
            </p>
          ))}
          {ordersQuery.data.warnings.map((warning, index) => (
            <p
              key={`warning-${index}`}
              className="border-b border-border px-5 py-3 text-sm text-amber-700"
            >
              {warning}
            </p>
          ))}
          {orders.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              No Flipkart orders with today’s dispatch date found for the selected filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {[
                      "Order / Item",
                      "Product",
                      "Brand",
                      "Status",
                      "Qty",
                      "Order date",
                      "Dispatch after",
                      "Dispatch by",
                      "On hold",
                    ].map((label) => (
                      <th key={label} className="px-4 py-3 font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleOrders.map((order, index) => (
                    <tr key={`${order.orderItemId}-${index}`} className="text-foreground">
                      <td className="px-4 py-3">
                        <div className="font-medium">{order.orderId || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          Item {order.orderItemId || "—"} · Shipment {order.shipmentId || "—"}
                        </div>
                      </td>
                      <td className="max-w-56 truncate px-4 py-3">
                        {order.title}
                        <div className="text-xs text-muted-foreground">SKU {order.sku || "—"}</div>
                      </td>
                      <td className="px-4 py-3">{order.brand}</td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3">{order.quantity}</td>
                      <td className="px-4 py-3">{dateLabel(order.orderDate)}</td>
                      <td className="px-4 py-3">{dateLabel(order.dispatchAfterDate)}</td>
                      <td className="px-4 py-3">{dateLabel(order.dispatchByDate)}</td>
                      <td className="px-4 py-3">{order.hold ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <OrdersPagination
                page={currentPage}
                totalItems={orders.length}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
