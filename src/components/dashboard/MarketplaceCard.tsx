import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/lib/dashboard/filters-context";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/dashboard/format";
import { EmptyState, SectionHeading } from "./StateBlocks";

const COLORS = ["var(--color-chart-1)", "var(--color-chart-3)"];

export function MarketplaceCard() {
  const { data, isLoading } = useDashboard();
  const rows = data?.marketplaces ?? [];
  const total = rows.reduce((sum, r) => sum + r.grossSales, 0);

  return (
    <section className="card-surface p-5">
      <SectionHeading title="Marketplace Performance" subtitle="Share of gross sales" />

      {isLoading || !data ? (
        <div className="mt-5 space-y-4">
          <Skeleton className="mx-auto size-40 rounded-full" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : rows.length === 0 || total === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-4">
          <div className="relative mx-auto h-44 w-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="grossSales"
                  nameKey="marketplace"
                  innerRadius="66%"
                  outerRadius="100%"
                  paddingAngle={2}
                  stroke="none"
                  animationDuration={400}
                >
                  {rows.map((row, i) => (
                    <Cell key={row.marketplace} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="text-lg font-semibold tnum">{formatCurrency(total)}</span>
            </div>
          </div>

          <ul className="mt-5 space-y-3">
            {rows.map((row, i) => (
              <li key={row.marketplace} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    {row.marketplace}
                  </span>
                  <span className="text-sm font-semibold tnum">{formatPercent(row.share)}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    <p className="font-semibold text-foreground tnum">
                      {formatCurrency(row.grossSales)}
                    </p>
                    Sales
                  </div>
                  <div>
                    <p className="font-semibold text-foreground tnum">{formatNumber(row.orders)}</p>
                    Orders
                  </div>
                  <div>
                    <p className="font-semibold text-foreground tnum">
                      {formatNumber(row.unitsSold)}
                    </p>
                    Units
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
