import { useEffect, useMemo, useState } from "react";
import { Search, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboard } from "@/lib/dashboard/filters-context";

interface MappingValue {
  masterSku: string;
  productName: string;
  updatedAt: string;
}

interface SkuRecord {
  key: string;
  marketplace: "Amazon" | "Flipkart";
  brand: string;
  sku: string;
  title: string;
  orderCount: number;
}

type MappingStore = Record<string, MappingValue>;

const STORAGE_KEY = "ecommerce360-sku-mappings";

function readMappings(): MappingStore {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as MappingStore : {};
  } catch {
    return {};
  }
}

export function SkuMapping() {
  const { data, isLoading, isError, errorMessage, refetch } = useDashboard();
  const [mappings, setMappings] = useState<MappingStore>({});
  const [drafts, setDrafts] = useState<Record<string, MappingValue>>({});
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [marketplaceFilter, setMarketplaceFilter] = useState("all");

  useEffect(() => {
    setMappings(readMappings());
  }, []);

  const records = useMemo(() => {
    const byKey = new Map<string, SkuRecord>();
    for (const order of data?.amazonOrders ?? []) {
      const sku = order.sku?.trim() ?? "";
      const title = order.title?.trim() || "Product title unavailable";
      const key = `Amazon::${sku || title}`;
      const current = byKey.get(key);
      byKey.set(key, {
        key,
        marketplace: "Amazon",
        brand: order.brand,
        sku,
        title,
        orderCount: (current?.orderCount ?? 0) + 1,
      });
    }
    for (const order of data?.flipkartOrders ?? []) {
      const sku = order.sku?.trim() ?? "";
      const title = order.title?.trim() || "Product title unavailable";
      const key = `Flipkart::${sku || title}`;
      const current = byKey.get(key);
      byKey.set(key, {
        key,
        marketplace: "Flipkart",
        brand: order.brand,
        sku,
        title,
        orderCount: (current?.orderCount ?? 0) + 1,
      });
    }
    return [...byKey.values()].sort((a, b) => a.marketplace.localeCompare(b.marketplace) || a.brand.localeCompare(b.brand) || a.sku.localeCompare(b.sku));
  }, [data?.amazonOrders, data?.flipkartOrders]);

  const brands = [...new Set(records.map((record) => record.brand))].sort();
  const filteredRecords = records.filter((record) => {
    const query = search.trim().toLowerCase();
    return (marketplaceFilter === "all" || record.marketplace === marketplaceFilter)
      && (brandFilter === "all" || record.brand === brandFilter)
      && (!query || `${record.sku} ${record.title} ${record.brand} ${record.marketplace}`.toLowerCase().includes(query));
  });
  const savedCount = records.filter((record) => mappings[record.key]?.masterSku.trim()).length;

  function edit(record: SkuRecord, field: "masterSku" | "productName", value: string) {
    const current = drafts[record.key] ?? mappings[record.key] ?? { masterSku: "", productName: "", updatedAt: "" };
    setDrafts((previous) => ({ ...previous, [record.key]: { ...current, [field]: value } }));
  }

  function save(record: SkuRecord) {
    const draft = drafts[record.key] ?? mappings[record.key] ?? { masterSku: "", productName: "", updatedAt: "" };
    const next = { ...mappings };
    if (!draft.masterSku.trim() && !draft.productName.trim()) {
      delete next[record.key];
    } else {
      next[record.key] = { ...draft, masterSku: draft.masterSku.trim(), productName: draft.productName.trim(), updatedAt: new Date().toISOString() };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setMappings(next);
    setDrafts((previous) => {
      const updated = { ...previous };
      delete updated[record.key];
      return updated;
    });
  }

  function reset(record: SkuRecord) {
    const next = { ...mappings };
    delete next[record.key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setMappings(next);
    setDrafts((previous) => {
      const updated = { ...previous };
      delete updated[record.key];
      return updated;
    });
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-surface p-5"><p className="text-sm text-muted-foreground">SKUs in loaded order data</p><p className="mt-2 text-2xl font-semibold text-foreground">{records.length}</p></div>
        <div className="card-surface p-5"><p className="text-sm text-muted-foreground">Mapped</p><p className="mt-2 text-2xl font-semibold text-foreground">{savedCount}</p></div>
        <div className="card-surface p-5"><p className="text-sm text-muted-foreground">Unmapped</p><p className="mt-2 text-2xl font-semibold text-foreground">{Math.max(0, records.length - savedCount)}</p></div>
      </div>

      <section className="card-surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Marketplace SKU mappings</h2>
            <p className="mt-1 text-xs text-muted-foreground">Map marketplace SKUs to a shared master SKU and product name. Mappings are saved in this browser.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SKU or product" aria-label="Search SKU mappings" />
            </div>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={marketplaceFilter} onChange={(event) => setMarketplaceFilter(event.target.value)} aria-label="Filter by marketplace">
              <option value="all">All marketplaces</option><option value="Amazon">Amazon</option><option value="Flipkart">Flipkart</option>
            </select>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground" value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)} aria-label="Filter by brand">
              <option value="all">All brands</option>{brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">Loading marketplace order data…</p>
        ) : isError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-6">
            <p className="text-sm text-destructive">{errorMessage || "Could not load order data."}</p>
            <Button variant="outline" onClick={refetch}>Retry</Button>
          </div>
        ) : records.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">No SKU data is available for the selected dashboard date range. Try a wider period.</p>
        ) : filteredRecords.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">No SKUs match your search or filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>{["Marketplace", "Brand", "Source SKU", "Source product", "Master SKU", "Mapped product", "Orders", "Action"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRecords.map((record) => {
                  const saved = mappings[record.key] ?? { masterSku: "", productName: "", updatedAt: "" };
                  const draft = drafts[record.key] ?? saved;
                  return (
                    <tr key={record.key} className="align-top text-foreground">
                      <td className="px-4 py-3">{record.marketplace}</td>
                      <td className="px-4 py-3">{record.brand}</td>
                      <td className="px-4 py-3 font-mono text-xs">{record.sku || "SKU unavailable"}</td>
                      <td className="max-w-56 truncate px-4 py-3" title={record.title}>{record.title}</td>
                      <td className="px-4 py-2"><Input value={draft.masterSku} disabled={!record.sku} onChange={(event) => edit(record, "masterSku", event.target.value)} placeholder="Enter master SKU" aria-label={`Master SKU for ${record.sku || record.title}`} /></td>
                      <td className="px-4 py-2"><Input value={draft.productName} disabled={!record.sku} onChange={(event) => edit(record, "productName", event.target.value)} placeholder="Enter mapped product" aria-label={`Mapped product for ${record.sku || record.title}`} /></td>
                      <td className="px-4 py-3">{record.orderCount}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => save(record)} disabled={!record.sku}><Save className="size-3.5" />Save</Button>
                          {saved.masterSku || saved.productName ? <Button size="sm" variant="ghost" onClick={() => reset(record)} aria-label={`Reset mapping for ${record.sku}`}><RotateCcw className="size-3.5" /></Button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
