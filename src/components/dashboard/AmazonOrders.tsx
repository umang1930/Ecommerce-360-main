import { useEffect, useState } from "react";
import { useDashboard } from "@/lib/dashboard/filters-context";
import { formatCurrency } from "@/lib/dashboard/format";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { ORDERS_PAGE_SIZE, OrdersPagination } from "./OrdersPagination";

function dateLabel(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function AmazonOrders() {
  const { data, filters } = useDashboard();
  const [page, setPage] = useState(1);
  const orders = [...(data?.amazonOrders ?? [])]
    .filter(
      (order) =>
        (filters.brand === "all" || order.brand === filters.brand) &&
        (filters.product === "all" ||
          order.sku === filters.product ||
          (!order.sku && order.title === filters.product)),
    )
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate));
  const pageCount = Math.max(1, Math.ceil(orders.length / ORDERS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  useEffect(() => setPage(1), [filters.brand, filters.product, filters.period, filters.startDate, filters.endDate]);
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);
  const visibleOrders = orders.slice((currentPage - 1) * ORDERS_PAGE_SIZE, currentPage * ORDERS_PAGE_SIZE);
  if (filters.marketplace !== "all" && filters.marketplace !== "Amazon") return null;

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Amazon Orders</h2>
          <p className="mt-1 text-xs text-muted-foreground">Amazon India order items · selected period</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {orders.length} items
        </span>
      </div>
      {orders.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          No Amazon orders found for this date range.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[740px] text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {[
                  "Amazon order",
                  "Product",
                  "Brand",
                  "Status",
                  "Qty",
                  "Item price",
                  "Order date",
                ].map((label) => (
                  <th key={label} className="px-4 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleOrders.map((order, index) => (
                <tr key={`${order.orderId}-${order.sku}-${index}`} className="text-foreground">
                  <td className="px-4 py-3 font-medium">{order.orderId}</td>
                  <td className="max-w-56 truncate px-4 py-3">{order.title}</td>
                  <td className="px-4 py-3">{order.brand}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3">{order.quantity}</td>
                  <td className="px-4 py-3">
                    {order.itemPrice ? formatCurrency(order.itemPrice) : "Pending"}
                  </td>
                  <td className="px-4 py-3">{dateLabel(order.orderDate)}</td>
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
