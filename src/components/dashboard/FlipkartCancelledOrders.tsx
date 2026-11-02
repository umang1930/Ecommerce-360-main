import { useEffect, useState } from "react";
import { useDashboard } from "@/lib/dashboard/filters-context";
import { canonicalFlipkartSku } from "@/lib/dashboard/brands";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { ORDERS_PAGE_SIZE, OrdersPagination } from "./OrdersPagination";

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function FlipkartCancelledOrders() {
  const { data, filters } = useDashboard();
  const [page, setPage] = useState(1);
  const isCancelled = (status: string) => /cancel/i.test(status.trim().replaceAll(/[_-]+/g, " "));
  const orders = [
    ...(filters.marketplace !== "Amazon"
      ? (data?.flipkartOrders ?? [])
          .filter((order) => isCancelled(order.status))
          .filter((order) => filters.product === "all" || canonicalFlipkartSku(order.sku, order.title) === filters.product)
          .map((order) => ({ ...order, marketplace: "Flipkart", currency: "INR", price: order.customerPrice }))
      : []),
    ...(filters.marketplace !== "Flipkart"
      ? (data?.amazonOrders ?? [])
          .filter((order) => isCancelled(order.status))
          .map((order) => ({ ...order, marketplace: "Amazon", shipmentId: "", dispatchByDate: null, price: order.itemPrice }))
      : []),
  ].sort((a, b) => (b.orderDate || "").localeCompare(a.orderDate || ""));
  const uniqueOrderCount = new Set(orders.map((order) => order.orderId || order.orderItemId).filter(Boolean)).size;
  const pageCount = Math.max(1, Math.ceil(orders.length / ORDERS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  useEffect(() => setPage(1), [filters.brand, filters.product, filters.period, filters.startDate, filters.endDate]);
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);

  const visibleOrders = orders.slice((currentPage - 1) * ORDERS_PAGE_SIZE, currentPage * ORDERS_PAGE_SIZE);

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Cancelled Orders</h2>
          <p className="mt-1 text-xs text-muted-foreground">Amazon and Flipkart · cancelled status · selected marketplace, brand, product and date range</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {uniqueOrderCount} orders · {orders.length} items
        </span>
      </div>
      {orders.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">No cancelled Flipkart orders found for the selected filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{["Marketplace", "Order / Item", "Product", "Brand", "Status", "Qty", "Item price", "Order date", "Dispatch by"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleOrders.map((order, index) => (
                <tr key={`${order.orderItemId}-${index}`} className="text-foreground">
                  <td className="px-4 py-3">{order.marketplace}</td>
                  <td className="px-4 py-3"><div className="font-medium">{order.orderId || "—"}</div><div className="text-xs text-muted-foreground">Item {order.orderItemId || "—"} · Shipment {order.shipmentId || "—"}</div></td>
                  <td className="max-w-48 truncate px-4 py-3">{order.title}<div className="text-xs text-muted-foreground">SKU {order.sku || "—"}</div></td>
                  <td className="px-4 py-3">{order.brand}</td>
                  <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                  <td className="px-4 py-3">{order.quantity}</td>
                  <td className="px-4 py-3">{new Intl.NumberFormat("en-IN", { style: "currency", currency: order.currency || "INR", maximumFractionDigits: 0 }).format(order.price)}</td>
                  <td className="px-4 py-3">{dateLabel(order.orderDate)}</td>
                  <td className="px-4 py-3">{dateLabel(order.dispatchByDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <OrdersPagination page={currentPage} totalItems={orders.length} onPageChange={setPage} />
        </div>
      )}
    </section>
  );
}
