import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandLoader } from "./BrandLoader";
import { useDashboard } from "@/lib/dashboard/filters-context";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/dashboard/format";
import type { RankBy } from "@/lib/dashboard/types";
import { EmptyState, SectionHeading } from "./StateBlocks";

const RANK_FIELD: Record<RankBy, "grossSales" | "orders" | "unitsSold"> = {
  sales: "grossSales",
  orders: "orders",
  units: "unitsSold",
};

export function TopProducts() {
  const { data, isLoading } = useDashboard();
  const [rankBy, setRankBy] = useState<RankBy>("sales");

  const rows = useMemo(() => {
    const field = RANK_FIELD[rankBy];
    return [...(data?.topProducts ?? [])].sort((a, b) => b[field] - a[field]).slice(0, 8);
  }, [data?.topProducts, rankBy]);

  return (
    <section className="card-surface p-5 xl:col-span-2">
      <SectionHeading
        title="Top Products"
        subtitle="Best performers for the selected filters"
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Rank By</span>
            <Select value={rankBy} onValueChange={(v) => setRankBy(v as RankBy)}>
              <SelectTrigger className="h-9 w-[7.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="orders">Orders</SelectItem>
                <SelectItem value="units">Units</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {isLoading || !data ? (
        <BrandLoader message="Loading top products…" className="min-h-56" />
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mt-4 divide-y divide-border sm:hidden">
            {rows.map((row) => (
              <article key={row.sku} className="space-y-2 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium text-foreground" title={row.name}>{row.name}</p>
                    <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground" title={row.sku}>{row.sku}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatPercent(row.contribution)}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatNumber(row.orders)} orders</span><span>{formatNumber(row.unitsSold)} units</span><span className="font-semibold text-foreground">{formatCurrency(row.grossSales)}</span>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-4 hidden -mx-2 overflow-x-auto sm:block">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 pb-2 font-medium">Product</th>
                  <th className="px-2 pb-2 font-medium">SKU</th>
                  <th className="px-2 pb-2 text-right font-medium">Orders</th>
                  <th className="px-2 pb-2 text-right font-medium">Units</th>
                  <th className="px-2 pb-2 text-right font-medium">Gross Sales</th>
                  <th className="px-2 pb-2 text-right font-medium">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.sku}
                    className="border-t border-border transition-colors hover:bg-secondary/60"
                  >
                    <td className="px-2 py-3 font-medium text-foreground">{row.name}</td>
                    <td className="px-2 py-3 font-mono text-xs text-muted-foreground">{row.sku}</td>
                    <td className="px-2 py-3 text-right tnum">{formatNumber(row.orders)}</td>
                    <td className="px-2 py-3 text-right tnum">{formatNumber(row.unitsSold)}</td>
                    <td className="px-2 py-3 text-right font-semibold tnum">
                      {formatCurrency(row.grossSales)}
                    </td>
                    <td className="px-2 py-3 text-right tnum text-muted-foreground">
                      {formatPercent(row.contribution)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent transition-opacity hover:opacity-80"
          >
            View All
            <ArrowRight className="size-4" />
          </button>
        </>
      )}
    </section>
  );
}
