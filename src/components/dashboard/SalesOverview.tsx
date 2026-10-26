import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/lib/dashboard/filters-context";
import { formatCurrency, formatCurrencyFull, formatNumber } from "@/lib/dashboard/format";
import type { MetricKey, SalesTrendPoint } from "@/lib/dashboard/types";
import { EmptyState, SectionHeading } from "./StateBlocks";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "sales", label: "Sales" },
  { key: "orders", label: "Orders" },
  { key: "units", label: "Units" },
];

const FIELD: Record<MetricKey, keyof SalesTrendPoint> = {
  sales: "grossSales",
  orders: "orders",
  units: "unitsSold",
};

function ChartTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as SalesTrendPoint;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-[var(--shadow-card)]">
      <p className="text-xs font-semibold text-foreground">{point.label}</p>
      <dl className="mt-1.5 space-y-0.5 text-xs">
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground">Gross Sales</dt>
          <dd className="font-medium tnum">{formatCurrencyFull(point.grossSales)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground">Orders</dt>
          <dd className="font-medium tnum">{formatNumber(point.orders)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground">Units</dt>
          <dd className="font-medium tnum">{formatNumber(point.unitsSold)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function SalesOverview() {
  const { data, isLoading } = useDashboard();
  const [metric, setMetric] = useState<MetricKey>("sales");

  const hasData = !!data && data.trend.some((p) => p[FIELD[metric]] > 0);
  const field = FIELD[metric];

  return (
    <section className="card-surface p-5">
      <SectionHeading
        title="Sales Overview"
        subtitle={`Daily ${metric === "sales" ? "gross sales" : metric} for selected period`}
        action={
          <div className="flex rounded-lg border border-border bg-secondary/60 p-0.5">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetric(m.key)}
                aria-pressed={metric === m.key}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  metric === m.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="mt-5 h-[320px]">
        {isLoading || !data ? (
          <Skeleton className="size-full rounded-xl" />
        ) : !hasData ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                minTickGap={16}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={64}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickFormatter={(value: number) =>
                  metric === "sales" ? formatCurrency(value) : formatNumber(value)
                }
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey={field as string}
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                fill="url(#salesFill)"
                animationDuration={400}
                dot={data.trend.length === 1 ? { r: 4 } : false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
