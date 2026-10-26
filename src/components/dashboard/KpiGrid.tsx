import {
  ArrowDownRight,
  ArrowUpRight,
  CircleCheck,
  Download,
  IndianRupee,
  Package,
  Receipt,
  ShoppingCart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/lib/dashboard/filters-context";
import { formatCurrency, formatNumber, percentChange } from "@/lib/dashboard/format";
import { canonicalFlipkartSku } from "@/lib/dashboard/brands";
import type { DashboardData } from "@/lib/dashboard/types";

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  change: number | null | undefined;
  support: string;
  action?: { label: string; onClick: () => void };
}

function KpiCard({ icon: Icon, label, value, change, support, action }: KpiCardProps) {
  const positive = (change ?? 0) >= 0;
  return (
    <div className="card-surface group p-5 transition-shadow hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-primary">
            <Icon className="size-4" />
          </span>
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            aria-label={action.label}
            title={action.label}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Download className="size-4" />
          </button>
        ) : null}
      </div>

      <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground tnum">{value}</p>

      <div className="mt-3 flex items-center gap-2 text-xs">
        {change === undefined ? (
          <span className="text-muted-foreground">Current selected range</span>
        ) : change === null ? (
          <>
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">N/A</span>
            <span className="text-muted-foreground">vs previous period</span>
          </>
        ) : (
          <>
            <span
              className={cn(
                "flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold tnum",
                positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(change).toFixed(1)}%
            </span>
            <span className="text-muted-foreground">vs previous period</span>
          </>
        )}
      </div>

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{support}</p>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="card-surface space-y-4 p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

function downloadCompletedOrderIds(orders: DashboardData["deliveredFlipkartOrders"]) {
  const rows = [
    ["Order ID", "Order Item ID", "Shipment ID", "Status", "Brand", "SKU", "Product", "Order Date"],
    ...orders.map((order) => [
      order.orderId,
      order.orderItemId,
      order.shipmentId,
      order.status,
      order.brand,
      order.sku,
      order.title,
      order.orderDate,
    ]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "flipkart-completed-orders.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function KpiGrid() {
  const { data, filters, isLoading } = useDashboard();
  const showCompletedOrders = filters.marketplace !== "Amazon";
  if (isLoading || !data) {
    return (
      <div className={`grid gap-4 sm:grid-cols-2 ${showCompletedOrders ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
        {Array.from({ length: showCompletedOrders ? 5 : 4 }, (_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    );
  }

  const { metrics } = data;
  const prev = metrics.previousPeriod;
  const completedOrderRows = data.deliveredFlipkartOrders
    .filter((order) =>
      order.status.trim().toUpperCase() === "DELIVERED" &&
      (filters.brand === "all" || order.brand === filters.brand) &&
      (filters.product === "all" || canonicalFlipkartSku(order.sku, order.title) === filters.product),
    )
    .reduce((unique, order) => {
      const id = order.orderId || order.orderItemId;
      if (id && !unique.has(id)) unique.set(id, order);
      return unique;
    }, new Map<string, (typeof data.deliveredFlipkartOrders)[number]>());
  const completedFlipkartOrders = completedOrderRows.size;
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${showCompletedOrders ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
      <KpiCard
        icon={ShoppingCart}
        label="Orders"
        value={formatNumber(metrics.orders)}
        change={undefined}
        support="Unique orders in selected date range · All statuses"
      />
      <KpiCard
        icon={IndianRupee}
        label="Gross Sales"
        value={formatCurrency(metrics.grossSales)}
        change={metrics.previousPeriodAvailable === false ? null : percentChange(metrics.grossSales, prev.grossSales)}
        support="Order-item value for the selected date range"
      />
      <KpiCard
        icon={Package}
        label="Units Sold"
        value={formatNumber(metrics.unitsSold)}
        change={metrics.previousPeriodAvailable === false ? null : percentChange(metrics.unitsSold, prev.unitsSold)}
        support="Total quantity for the selected date range"
      />
      <KpiCard
        icon={Receipt}
        label="Average Order Value"
        value={metrics.averageOrderValue === null ? "N/A" : formatCurrency(metrics.averageOrderValue)}
        change={
          metrics.previousPeriodAvailable === false || metrics.averageOrderValue === null || prev.averageOrderValue === null
            ? null
            : percentChange(metrics.averageOrderValue, prev.averageOrderValue)
        }
        support="Gross sales ÷ unique orders"
      />
      {showCompletedOrders ? (
        <KpiCard
          icon={CircleCheck}
          label="Completed Orders"
          value={formatNumber(completedFlipkartOrders)}
          change={undefined}
          support="Flipkart · DELIVERED status"
          action={{
            label: "Download filtered delivered order IDs as CSV",
            onClick: () => downloadCompletedOrderIds([...completedOrderRows.values()]),
          }}
        />
      ) : null}
    </div>
  );
}
