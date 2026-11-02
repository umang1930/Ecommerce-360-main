import { useEffect, useMemo, useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboard } from "@/lib/dashboard/filters-context";
import { resolveRange } from "@/lib/dashboard/dates";
import { DashboardExport } from "./DashboardExport";
import type { Brand, Marketplace, PeriodKey } from "@/lib/dashboard/types";
import { shortProductLabel } from "@/lib/dashboard/product-label";
import { BrandLoader } from "./BrandLoader";

const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex w-full min-w-0 flex-col gap-1.5 sm:min-w-[9.5rem] sm:flex-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export function GlobalFilters({ className = "" }: { className?: string }) {
  const { filters, setFilter, resetFilters, applyCustomRange, data, isUpdating } = useDashboard();
  const range = resolveRange(filters);
  const [start, setStart] = useState(range.start);
  const [end, setEnd] = useState(range.end);
  const brands = useMemo(
    () => [
      ...new Set([
        "CLASPO",
        "MONKEYMAN",
        ...(data?.catalog.map((product) => product.brand).filter((brand) => brand.trim().toUpperCase() !== "UNASSIGNED") ?? []),
      ]),
    ],
    [data?.catalog],
  );
  const visibleProducts = useMemo(
    () =>
      (data?.catalog ?? []).filter(
        (product) => filters.brand === "all" || product.brand === filters.brand,
      ),
    [data?.catalog, filters.brand],
  );

  useEffect(() => {
    if (filters.period === "custom") {
      setStart(filters.startDate ?? range.start);
      setEnd(filters.endDate ?? range.end);
    }
  }, [filters.period, filters.startDate, filters.endDate, range.start, range.end]);

  return (
    <section className={`card-surface mx-3 mt-3 p-3 sm:mx-6 sm:mt-5 sm:p-4 lg:mx-8 ${className}`}>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <SlidersHorizontal className="size-4 text-accent" />
        Filters
        {data?.rangeLabel ? (
          <span className="min-w-0 truncate text-xs font-normal text-muted-foreground" title={data.rangeLabel}>· {data.rangeLabel}</span>
        ) : null}
        <span className="inline-flex min-w-20 justify-end">
          {isUpdating ? <BrandLoader compact message="Updating…" /> : null}
        </span>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <Field label="Brand">
          <Select
            value={filters.brand}
            onValueChange={(v) => setFilter("brand", v as Brand | "all")}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Marketplace">
          <Select
            value={filters.marketplace}
            onValueChange={(v) => setFilter("marketplace", v as Marketplace | "all")}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Marketplaces</SelectItem>
              <SelectItem value="Amazon">Amazon</SelectItem>
              <SelectItem value="Flipkart">Flipkart</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Period">
          <Select
            value={filters.period}
            onValueChange={(v) => {
              const period = v as PeriodKey;
              setFilter("period", period);
              if (period === "last30") {
                const selectedRange = resolveRange({ ...filters, period });
                console.warn("[Dashboard period selected]", {
                  period,
                  startDate: selectedRange.start,
                  endDate: selectedRange.end,
                  timeZone: "Asia/Kolkata",
                });
              }
            }}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Product">
          <Select value={filters.product} onValueChange={(v) => setFilter("product", v)}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              className="w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]"
              position="popper"
              side="bottom"
              align="start"
              sideOffset={4}
              avoidCollisions={false}
            >
              <SelectItem value="all">All Products</SelectItem>
              {visibleProducts.map((p) => (
                <SelectItem key={p.sku} value={p.sku} className="max-w-full">
                  <span className="block w-full truncate" title={p.name}>
                    {shortProductLabel(p)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {filters.period === "custom" ? (
          <>
            <Field label="Start Date">
              <Input
                type="date"
                value={start}
                max={end}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="End Date">
              <Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
            </Field>
            <Button onClick={() => applyCustomRange(start, end)}>Apply</Button>
          </>
        ) : null}

        <Button variant="ghost" onClick={resetFilters} className="justify-start text-muted-foreground">
          <RotateCcw className="size-4" />
          Reset Filters
        </Button>
      </div>
      <DashboardExport />
    </section>
  );
}
