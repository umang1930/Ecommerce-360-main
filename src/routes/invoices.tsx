import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { InvoiceCenter } from "@/components/dashboard/InvoiceCenter";
import { BrandLoader } from "@/components/dashboard/BrandLoader";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/invoices")({ component: InvoicesPage });

function InvoicesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) window.location.assign("/login?next=%2Finvoices");
  }, [isLoading, isAuthenticated]);

  if (isLoading) return <BrandLoader fullScreen message="Checking your sign-in…" />;
  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader title="Invoices" subtitle="Upload and manage supplier invoice files." />
        <main className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
          <InvoiceCenter />
        </main>
      </div>
    </div>
  );
}
