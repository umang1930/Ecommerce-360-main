import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDashboard } from "@/lib/dashboard/filters-context";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/dashboard/format";
import type { TopProduct } from "@/lib/dashboard/types";

type SortField = "grossSales" | "orders" | "unitsSold" | "contribution" | "name";

function SummaryCard({ label, value, note, compactValue = false }: { label: string; value: string; note: string; compactValue?: boolean }) {
  return (
    <div className="card-surface p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={compactValue ? "mt-2 line-clamp-2 min-h-14 text-lg font-semibold leading-7 tracking-tight text-foreground" : "mt-2 text-2xl font-semibold tracking-tight text-foreground"}
        title={compactValue ? value : undefined}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export function ProductPerformance() {
  const { data, isLoading, isError, errorMessage, refetch } = useDashboard();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("grossSales");
  const [descending, setDescending] = useState(true);

  const products = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = (data?.topProducts ?? []).filter((product) =>
      !query || `${product.name} ${product.sku} ${product.brand}`.toLowerCase().includes(query));
    return filtered.sort((a, b) => {
      const comparison = sortField === "name"
        ? a.name.localeCompare(b.name)
        : a[sortField] - b[sortField];
      return descending ? -comparison : comparison;
    });
  }, [data?.topProducts, search, sortField, descending]);

  const allProducts = data?.topProducts ?? [];
  const totalUnits = allProducts.reduce((sum, product) => sum + product.unitsSold, 0);
  const topProduct = [...allProducts].sort((a, b) => b.grossSales - a.grossSales)[0];

  function setSort(value: string) {
    const field = value as SortField;
    if (field === sortField) setDescending((value) => !value);
    else {
      setSortField(field);
      setDescending(field !== "name");
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Products sold" value={isLoading ? "—" : formatNumber(allProducts.length)} note="Distinct products in the selected range" />
        <SummaryCard label="Product sales" value={isLoading ? "—" : formatCurrency(allProducts.reduce((sum, product) => sum + product.grossSales, 0))} note="Gross sales across listed products" />
        <SummaryCard label="Units sold" value={isLoading ? "—" : formatNumber(totalUnits)} note="Units across listed products" />
        <SummaryCard label="Top product" value={isLoading ? "—" : topProduct?.name ?? "—"} note={topProduct ? `${formatCurrency(topProduct.grossSales)} gross sales` : "No product sales in this range"} compactValue />
      </section>

      <section className="card-surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Product performance</h2>
            <p className="mt-1 text-xs text-muted-foreground">{data?.rangeLabel || "Products in the selected dashboard range"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products or SKU" aria-label="Search products" />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Sort by
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={sortField} onChange={(event) => setSort(event.target.value)}>
                <option value="grossSales">Gross sales</option>
                <option value="orders">Orders</option>
                <option value="unitsSold">Units sold</option>
                <option value="contribution">Contribution</option>
                <option value="name">Product name</option>
              </select>
            </label>
          </div>
        </div>

        {isLoading ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">Loading product performance…</p>
        ) : isError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-6">
            <p className="text-sm text-destructive">{errorMessage || "Could not load product data."}</p>
            <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted" onClick={refetch}>Retry</button>
          </div>
        ) : products.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">{search ? "No products match your search." : "No product sales found for the selected filters."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[21%]" />
                <col className="w-[30%]" />
                <col className="w-[8%]" />
                <col className="w-[6%]" />
                <col className="w-[6%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>{["Product", "SKU", "Brand", "Orders", "Units sold", "Gross sales", "Contribution", "Avg. sale / order"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product: TopProduct) => (
                  <tr key={product.sku} className="text-foreground hover:bg-muted/30">
                    <td className="max-w-64 truncate px-4 py-3 font-medium" title={product.name}>{product.name}</td>
                    <td className="truncate px-4 py-3 font-mono text-xs text-muted-foreground" title={product.sku}>{product.sku}</td>
                    <td className="px-4 py-3">{product.brand}</td>
                    <td className="px-4 py-3">{formatNumber(product.orders)}</td>
                    <td className="px-4 py-3">{formatNumber(product.unitsSold)}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(product.grossSales)}</td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-28 items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, product.contribution))}%` }} /></div>
                        <span className="w-12 text-right text-xs tabular-nums">{formatPercent(product.contribution)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{product.orders ? formatCurrency(product.grossSales / product.orders) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
