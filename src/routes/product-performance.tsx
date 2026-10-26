import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { ProductPerformance } from "@/components/dashboard/ProductPerformance";
import { useAuth } from "@/hooks/useAuth";
import { DashboardProvider } from "@/lib/dashboard/filters-context";

export const Route = createFileRoute("/product-performance")({
  component: ProductPerformancePage,
});

function ProductPerformancePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || !isAuthenticated) return null;

  return (
    <DashboardProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader title="Product Performance" subtitle="Compare product sales and order activity" />
          <main className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
            <GlobalFilters className="!mx-0 !mt-0" />
            <ProductPerformance />
          </main>
        </div>
      </div>
    </DashboardProvider>
  );
}
