import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { ArrowUpRight, PackageSearch } from "lucide-react";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { useAuth } from "@/hooks/useAuth";
import { DashboardProvider, useDashboard } from "@/lib/dashboard/filters-context";
import { formatCurrency, formatNumber } from "@/lib/dashboard/format";
import { BrandLoader } from "@/components/dashboard/BrandLoader";

export const Route = createFileRoute("/product-detail")({ component: ProductDetailPage });

function ProductDetailContent() {
  const { data, isLoading, isError, errorMessage, refetch } = useDashboard();
  const products = useMemo(() => data?.topProducts ?? [], [data?.topProducts]);
  const bestSeller = [...products].sort((a, b) => b.unitsSold - a.unitsSold)[0];

  return (
    <>
      <GlobalFilters />
      <main className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Products", value: isLoading ? "—" : formatNumber(products.length) },
            { label: "Gross sales", value: isLoading ? "—" : formatCurrency(products.reduce((sum, p) => sum + p.grossSales, 0)) },
            { label: "Units sold", value: isLoading ? "—" : formatNumber(products.reduce((sum, p) => sum + p.unitsSold, 0)) },
            { label: "Best seller", value: isLoading ? "—" : bestSeller?.name ?? "—" },
          ].map((item) => (
            <div key={item.label} className="card-surface p-5">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground" title={item.value}>{item.value}</p>
              <p className="mt-2 text-xs text-muted-foreground">{item.label === "Best seller" ? "Most units in the selected period" : "Selected date range"}</p>
            </div>
          ))}
        </section>

        <section className="card-surface overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">Product catalogue details</h2>
            <p className="mt-1 text-xs text-muted-foreground">Sales and order performance by product · {data?.rangeLabel ?? "Selected date range"}</p>
          </div>
          {isLoading ? (
            <BrandLoader message="Loading product details…" />
          ) : isError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-6">
              <p className="text-sm text-destructive">{errorMessage || "Could not load product details."}</p>
              <button className="rounded-md border border-input px-3 py-2 text-sm" onClick={refetch}>Try again</button>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-12 text-center">
              <PackageSearch className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No product details available</p>
              <p className="mt-1 text-xs text-muted-foreground">Try another date range or marketplace.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>{["Product", "SKU", "Brand", "Gross sales", "Orders", "Units", "Share"].map((label) => <th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((product) => (
                    <tr key={`${product.brand}-${product.sku}`} className="hover:bg-muted/20">
                      <td className="px-5 py-4 font-medium text-foreground">{product.name}</td>
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{product.sku || "—"}</td>
                      <td className="px-5 py-4 text-muted-foreground">{product.brand || "—"}</td>
                      <td className="px-5 py-4 font-medium">{formatCurrency(product.grossSales)}</td>
                      <td className="px-5 py-4">{formatNumber(product.orders)}</td>
                      <td className="px-5 py-4">{formatNumber(product.unitsSold)}</td>
                      <td className="px-5 py-4"><span className="inline-flex items-center gap-1">{product.contribution.toFixed(1)}% <ArrowUpRight className="size-3 text-muted-foreground" /></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function ProductDetailPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);
  if (isLoading) return <BrandLoader fullScreen message="Checking your sign-in…" />;
  if (!isAuthenticated) return null;

  return (
    <DashboardProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader title="Product Detail" subtitle="Explore product sales, orders and catalogue performance" />
          <ProductDetailContent />
        </div>
      </div>
    </DashboardProvider>
  );
}
