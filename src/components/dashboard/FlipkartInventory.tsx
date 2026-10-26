import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchClaspoFlipkartInventory,
  fetchMonkeymanFlipkartInventory,
} from "@/lib/dashboard/flipkart";
import type { FlipkartInventoryResult } from "@/lib/dashboard/flipkart-types";
import { formatNumber } from "@/lib/dashboard/format";

function money(value: number | undefined, currency = "INR") {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function ProductNameTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const words = (payload?.value ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > 22 && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill="var(--color-muted-foreground)" fontSize={10}>
        {lines.map((part, index) => (
          <tspan key={`${part}-${index}`} x={0} dy={index === 0 ? 12 : 13}>
            {part}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function InventoryListing({ result }: { result: FlipkartInventoryResult }) {
  if (result.unavailable) {
    return (
      <p className="border-b border-border px-5 py-5 text-sm text-muted-foreground">
        Flipkart could not find SKU {result.sku} in the Claspo listings.
      </p>
    );
  }

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="grid gap-4 border-b border-border p-5 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <p className="text-xs text-muted-foreground">Product</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {result.productTitle || "Flipkart listing"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">SKU {result.sku}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Listing status</p>
          <p className="mt-1 text-sm font-medium text-foreground">{result.listingStatus || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Selling price</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {result.sellingPrice == null
              ? "Not returned by Flipkart"
              : money(result.sellingPrice, result.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">MRP</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {money(result.mrp, result.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Orders to fulfill</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {result.ordersToBeFulfilled ?? "Not returned by Flipkart"}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {["Location", "Status", "Available stock"].map((label) => (
                <th key={label} className="px-5 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {result.locations.length ? (
              result.locations.map((location, index) => (
                <tr key={`${location.id}-${index}`} className="text-foreground">
                  <td className="px-5 py-3">{location.id}</td>
                  <td className="px-5 py-3">{location.status}</td>
                  <td className="px-5 py-3 font-medium">{location.inventory}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-5 py-4 text-muted-foreground" colSpan={3}>
                  No inventory locations returned.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {result.productUrl ? (
        <p className="border-t border-border px-5 py-3 text-xs">
          <a
            className="text-primary underline"
            href={result.productUrl}
            target="_blank"
            rel="noreferrer"
          >
            View Flipkart listing
          </a>
        </p>
      ) : null}
    </div>
  );
}

function InventoryComparison({ listings }: { listings: FlipkartInventoryResult[] }) {
  const availableListings = listings.filter((listing) => !listing.unavailable);
  const chartData = availableListings.map((listing) => ({
    productName: listing.productTitle || listing.sku,
    warehouseStock: null as number | null,
    flipkartStock: listing.locations.reduce((total, location) => total + location.inventory, 0),
    amazonStock: null as number | null,
  }));
  const flipkartTotal = chartData.reduce((total, item) => total + item.flipkartStock, 0);

  return (
    <div className="border-b border-border p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Stock by product and source</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Flipkart stock is live. Warehouse and Amazon inventory are not connected yet; blank values
          are not zero stock.
        </p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Warehouse</p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Not connected</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Flipkart available stock</p>
          <p className="mt-1 text-sm font-semibold text-foreground tnum">
            {formatNumber(flipkartTotal)} units
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Amazon</p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Not connected</p>
        </div>
      </div>

      {chartData.length ? (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="productName" tick={<ProductNameTick />} interval={0} height={72} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="warehouseStock"
                name="Warehouse"
                fill="var(--color-chart-1)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="flipkartStock"
                name="Flipkart"
                fill="var(--color-chart-2)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="amazonStock"
                name="Amazon"
                fill="var(--color-chart-3)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-8 text-sm text-muted-foreground">
          No Flipkart listing stock is available to chart.
        </p>
      )}
    </div>
  );
}

export function FlipkartInventory() {
  const inventoryQuery = useQuery({
    queryKey: [
      "flipkart-inventory",
      "CL-VB-05-2026",
      "cl-mfc-06-2026",
      "hk-Hang-01-2026",
      "MM-BELLA-RG",
      "MM-BELLA-BLK",
    ],
    queryFn: async () => {
      const [claspo, monkeyman] = await Promise.all([
        fetchClaspoFlipkartInventory(),
        fetchMonkeymanFlipkartInventory(),
      ]);
      return { claspo, monkeyman };
    },
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const result = inventoryQuery.data;
  const listings = [...(result?.claspo.listings ?? []), ...(result?.monkeyman.listings ?? [])];

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Inventory Overview</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Warehouse, Flipkart and Amazon stock by product
          </p>
        </div>
        <button
          type="button"
          onClick={() => void inventoryQuery.refetch()}
          disabled={inventoryQuery.isFetching}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${inventoryQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {inventoryQuery.isPending ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">Loading Flipkart inventory…</p>
      ) : inventoryQuery.isError ? (
        <p className="px-5 py-8 text-sm text-destructive">
          {inventoryQuery.error instanceof Error
            ? inventoryQuery.error.message
            : "Could not load inventory."}
        </p>
      ) : (
        <>
          {!result?.claspo.configured ? (
            <p className="border-b border-border px-5 py-3 text-sm text-muted-foreground">
              Claspo inventory requires Claspo Flipkart Seller API credentials on the server.
            </p>
          ) : null}
          {result?.claspo.error ? (
            <p className="border-b border-border px-5 py-3 text-sm text-destructive">
              Claspo: {result.claspo.error}
            </p>
          ) : null}
          {!result?.monkeyman.configured ? (
            <p className="border-b border-border px-5 py-3 text-sm text-muted-foreground">
              Monkeyman inventory requires Monkeyman Flipkart Seller API credentials on the server.
            </p>
          ) : null}
          {result?.monkeyman.error ? (
            <p className="border-b border-border px-5 py-3 text-sm text-destructive">
              Monkeyman: {result.monkeyman.error}
            </p>
          ) : null}
          <InventoryComparison listings={listings} />
          {listings.map((listing) => (
            <InventoryListing key={listing.sku} result={listing} />
          ))}
        </>
      )}
    </section>
  );
}
