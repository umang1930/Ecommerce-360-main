import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDashboard } from "@/lib/dashboard/filters-context";
import { formatCurrency, formatCurrencyFull, formatNumber } from "@/lib/dashboard/format";
import type { TopProduct } from "@/lib/dashboard/types";
import { EmptyState, SectionHeading } from "./StateBlocks";
import { BrandLoader } from "./BrandLoader";

type Metric = "sales" | "orders" | "units";

const METRICS: { key: Metric; label: string }[] = [
  { key: "sales", label: "Sales" },
  { key: "orders", label: "Orders" },
  { key: "units", label: "Units" },
];

const VALUE_FIELD: Record<Metric, "grossSales" | "orders" | "unitsSold"> = {
  sales: "grossSales",
  orders: "orders",
  units: "unitsSold",
};

function ProductTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: { payload?: TopProduct }[];
  metric: Metric;
}) {
  const product = payload?.[0]?.payload;
  if (!active || !product) return null;

  const value = product[VALUE_FIELD[metric]] as number;
  const formatted = metric === "sales" ? formatCurrencyFull(value) : formatNumber(value);
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-[var(--shadow-card)]">
      <p className="font-semibold text-foreground">{product.name}</p>
      <p className="mt-1 text-muted-foreground">{metric === "sales" ? "Gross sales" : metric === "orders" ? "Orders" : "Units sold"}: {formatted}</p>
    </div>
  );
}

export function ProductPerformanceChart() {
  const { data, isLoading } = useDashboard();
  const [metric, setMetric] = useState<Metric>("sales");
  const field = VALUE_FIELD[metric];
  const products = [...(data?.topProducts ?? [])]
    .filter((product) => product[field] > 0)
    .sort((a, b) => b[field] - a[field])
    .slice(0, 8)
    .reverse();

  return (
    <section className="card-surface p-5">
      <SectionHeading
        title="Product Performance"
        subtitle={`Top products · ${data?.rangeLabel || "selected filters"}`}
        action={
          <div className="flex rounded-lg border border-border bg-secondary/60 p-0.5" aria-label="Product performance metric">
            {METRICS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setMetric(item.key)}
                aria-pressed={metric === item.key}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${metric === item.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="mt-4 h-[240px]">
        {isLoading || !data ? (
          <BrandLoader message="Loading product performance…" className="h-full min-h-0 py-2" />
        ) : products.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={products} layout="vertical" margin={{ top: 2, right: 12, left: 4, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                tickFormatter={(value: number) => metric === "sales" ? formatCurrency(value) : formatNumber(value)}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={116}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                tickFormatter={(value: string) => value.length > 18 ? `${value.slice(0, 17)}…` : value}
              />
              <Tooltip content={<ProductTooltip metric={metric} />} cursor={{ fill: "var(--color-muted)", opacity: 0.45 }} />
              <Bar dataKey={field} name={metric === "sales" ? "Gross sales" : metric === "orders" ? "Orders" : "Units sold"} fill="var(--color-chart-2)" radius={[0, 5, 5, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
