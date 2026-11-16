import { useEffect, useState } from "react";
import { useDashboard } from "@/lib/dashboard/filters-context";
import { canonicalFlipkartSku } from "@/lib/dashboard/brands";
import { productImageFor } from "@/lib/dashboard/product-image";
import { shortProductLabel } from "@/lib/dashboard/product-label";
import type { DashboardData } from "@/lib/dashboard/types";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { ORDERS_PAGE_SIZE, OrdersPagination } from "./OrdersPagination";

type FlipkartCancelledOrder = DashboardData["flipkartOrders"][number] & { marketplace: "Flipkart"; currency: string; price: number };
type AmazonCancelledOrder = DashboardData["amazonOrders"][number] & { marketplace: "Amazon"; shipmentId: string; dispatchByDate: null; price: number };
type CancelledOrder = FlipkartCancelledOrder | AmazonCancelledOrder;

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function orderPrice(order: CancelledOrder) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: order.currency || "INR", maximumFractionDigits: 0 }).format(order.price);
}

function CancelledOrdersSection({ title, orders, resetKey }: { title: string; orders: CancelledOrder[]; resetKey: string }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [resetKey]);
  const pageCount = Math.max(1, Math.ceil(orders.length / ORDERS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleOrders = orders.slice((currentPage - 1) * ORDERS_PAGE_SIZE, currentPage * ORDERS_PAGE_SIZE);
  useEffect(() => { if (page !== currentPage) setPage(currentPage); }, [page, currentPage]);
  const uniqueOrderCount = new Set(orders.map((order) => order.orderId || order.orderItemId).filter(Boolean)).size;

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-4 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between sm:px-5">
        <div><h2 className="text-base font-semibold text-foreground">{title}</h2><p className="mt-1 text-xs text-muted-foreground">Cancelled status · selected brand, product and date range</p></div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{uniqueOrderCount} orders · {orders.length} items</span>
      </div>
      {orders.length === 0 ? <p className="px-5 py-8 text-sm text-muted-foreground">No cancelled orders found for the selected filters.</p> : (
        <>
          <div className="divide-y divide-border sm:hidden">
            {visibleOrders.map((order, index) => (
              <article key={`mobile-${order.orderItemId}-${index}`} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-all text-sm font-semibold">{order.orderId || "—"}</p><p className="mt-0.5 break-all text-xs text-muted-foreground">Item {order.orderItemId || "—"}</p></div><OrderStatusBadge status={order.status} /></div>
                <div className="flex min-w-0 items-center gap-3">{productImageFor(order) ? <img src={productImageFor(order)!} alt="" className="size-12 shrink-0 rounded object-contain" /> : null}<p className="min-w-0 text-sm">{productImageFor(order) ? shortProductLabel({ name: order.title, sku: order.sku }) : order.title}</p></div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div><span className="text-muted-foreground">Brand</span><p className="mt-0.5">{order.brand}</p></div><div><span className="text-muted-foreground">Quantity</span><p className="mt-0.5">{order.quantity}</p></div>
                  <div><span className="text-muted-foreground">Item price</span><p className="mt-0.5">{orderPrice(order)}</p></div><div><span className="text-muted-foreground">Order date</span><p className="mt-0.5">{dateLabel(order.orderDate)}</p></div>
                  <div><span className="text-muted-foreground">Dispatch by</span><p className="mt-0.5">{dateLabel(order.dispatchByDate)}</p></div>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Order / Item", "Product", "Brand", "Status", "Qty", "Item price", "Order date", "Dispatch by"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {visibleOrders.map((order, index) => (
                  <tr key={`${order.orderItemId}-${index}`} className="text-foreground">
                    <td className="px-4 py-3"><div className="font-medium">{order.orderId || "—"}</div><div className="text-xs text-muted-foreground">Item {order.orderItemId || "—"} · Shipment {order.shipmentId || "—"}</div></td>
                    <td className="px-4 py-3">{productImageFor(order) ? <span className="flex min-w-40 items-center gap-2"><img src={productImageFor(order)!} alt="" className="size-12 shrink-0 rounded object-contain" /><span className="block max-w-48 truncate">{shortProductLabel({ name: order.title, sku: order.sku })}</span></span> : <span className="block max-w-48 truncate">{order.title}</span>}</td>
                    <td className="px-4 py-3">{order.brand}</td><td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td><td className="px-4 py-3">{order.quantity}</td><td className="px-4 py-3">{orderPrice(order)}</td><td className="px-4 py-3">{dateLabel(order.orderDate)}</td><td className="px-4 py-3">{dateLabel(order.dispatchByDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <OrdersPagination page={currentPage} totalItems={orders.length} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}

export function FlipkartCancelledOrders() {
  const { data, filters } = useDashboard();
  const isCancelled = (status: string) => /cancel/i.test(status.trim().replaceAll(/[_-]+/g, " "));
  const flipkartOrders: FlipkartCancelledOrder[] = filters.marketplace !== "Amazon"
    ? (data?.flipkartOrders ?? []).filter((order) => isCancelled(order.status))
      .filter((order) => (filters.brand === "all" || order.brand === filters.brand) && (filters.product === "all" || canonicalFlipkartSku(order.sku, order.title) === filters.product))
      .map((order) => ({ ...order, marketplace: "Flipkart", currency: "INR", price: order.customerPrice })) : [];
  const amazonOrders: AmazonCancelledOrder[] = filters.marketplace !== "Flipkart"
    ? (data?.amazonOrders ?? []).filter((order) => isCancelled(order.status))
      .filter((order) => (filters.brand === "all" || order.brand === filters.brand) && (filters.product === "all" || order.sku === filters.product || (!order.sku && order.title === filters.product)))
      .map((order) => ({ ...order, marketplace: "Amazon", shipmentId: "", dispatchByDate: null, price: order.itemPrice })) : [];
  const resetKey = [filters.brand, filters.product, filters.period, filters.startDate, filters.endDate].join(":");

  return <div className="space-y-5">
    {filters.marketplace !== "Flipkart" ? <CancelledOrdersSection title="Amazon Cancelled Orders" orders={amazonOrders} resetKey={resetKey} /> : null}
    {filters.marketplace !== "Amazon" ? <CancelledOrdersSection title="Flipkart Cancelled Orders" orders={flipkartOrders} resetKey={resetKey} /> : null}
  </div>;
}
