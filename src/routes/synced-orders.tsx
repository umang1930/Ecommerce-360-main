import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { useAuth } from "@/hooks/useAuth";
import { getSyncedOrders } from "@/lib/dashboard/synced-orders";

type MarketplaceFilter = "all" | "Amazon" | "Flipkart";
type SellerFilter = "all" | "claspo" | "monkeyman";

export const Route = createFileRoute("/synced-orders")({ component: SyncedOrdersPage });

function SyncedOrdersPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [marketplace, setMarketplace] = useState<MarketplaceFilter>("all");
  const [seller, setSeller] = useState<SellerFilter>("all");
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["synced-orders", page, marketplace, seller, search],
    queryFn: () => getSyncedOrders({ data: { page, pageSize: 50, marketplace, seller, search } }),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) window.location.assign("/login");
  }, [isLoading, isAuthenticated]);

  if (isLoading || !isAuthenticated) return null;
  const data = query.data;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 50));
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader title="Synced Orders" subtitle="Orders saved by the daily marketplace sync. Records expire 30 days after the order date." />
        <main className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <label className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input aria-label="Search synced orders" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search order, SKU, or product" className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" />
              </label>
              <select aria-label="Marketplace" value={marketplace} onChange={(event) => { setMarketplace(event.target.value as MarketplaceFilter); setPage(1); }} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">All marketplaces</option><option value="Amazon">Amazon</option><option value="Flipkart">Flipkart</option>
              </select>
              <select aria-label="Seller brand" value={seller} onChange={(event) => { setSeller(event.target.value as SellerFilter); setPage(1); }} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">All brands</option><option value="claspo">CLASPO</option><option value="monkeyman">MONKEYMAN</option>
              </select>
            </div>
            {data?.lastRuns?.some((run) => run.finishedAt) ? <p className="mt-3 text-xs text-muted-foreground">Latest sync: {new Date(data.lastRuns.map((run) => run.finishedAt).filter(Boolean).sort().at(-1)!).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p> : null}
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            {query.isError ? <p className="p-6 text-sm text-destructive">Could not load saved orders. Check the server output for database connection details.</p> : null}
            {query.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading saved orders…</p> : null}
            {!query.isLoading && !query.isError && data?.orders.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No synced orders found. The daily sync runs at 9:00 AM India time.</p> : null}
            {data?.orders.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Marketplace", "Brand", "Order date", "Order ID", "SKU / Product", "Status", "Qty", "Total"].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">{data.orders.map((order) => <tr key={order.id} className="hover:bg-muted/20">
                <td className="px-4 py-3">{order.marketplace}</td><td className="px-4 py-3 font-medium">{order.seller.toUpperCase()}</td>
                <td className="px-4 py-3 whitespace-nowrap">{new Date(order.orderDate).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                <td className="px-4 py-3 font-mono text-xs">{order.orderId}</td><td className="px-4 py-3"><div>{order.title}</div><div className="text-xs text-muted-foreground">{order.sku}</div></td>
                <td className="px-4 py-3">{order.status}</td><td className="px-4 py-3">{order.quantity}</td><td className="px-4 py-3 whitespace-nowrap">{order.currency} {Number(order.totalPrice).toLocaleString("en-IN")}</td>
              </tr>)}</tbody>
            </table></div> : null}
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground"><span>{data?.total ?? 0} saved orders</span><div className="flex items-center gap-3"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border border-input px-3 py-1 disabled:opacity-40">Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded border border-input px-3 py-1 disabled:opacity-40">Next</button></div></div>
          </section>
        </main>
      </div>
    </div>
  );
}
