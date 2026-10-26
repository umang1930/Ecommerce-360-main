import {
  LayoutDashboard,
  PackageSearch,
  ScanBarcode,
  Link2,
  Scale,
  ScrollText,
  Download,
  Settings,
  ShieldCheck,
  Database,
} from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Product Performance", icon: PackageSearch },
  { label: "Product Detail", icon: ScanBarcode },
  { label: "SKU Mapping", icon: Link2 },
  { label: "Reconciliation", icon: Scale },
  { label: "Audit Log", icon: ScrollText },
];

export function SidebarContent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold">
          E
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-sidebar-accent-foreground">Ecommerce 360</p>
          <p className="text-xs text-sidebar-foreground/60">Command Center</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ label, icon: Icon }) => {
          const active = label === "Dashboard" && pathname === "/";
          const className = cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
            active
              ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          );
          if (label === "Dashboard" || label === "SKU Mapping" || label === "Product Performance") {
            const to = label === "Dashboard" ? "/" : label === "SKU Mapping" ? "/sku-mapping" : "/product-performance";
            const isActive = label === "Dashboard"
              ? active
              : label === "SKU Mapping"
                ? pathname === "/sku-mapping"
                : pathname === "/product-performance";
            return (
              <Link
                key={label}
                to={to}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            );
          }
          return (
          <button
            key={label}
            type="button"
            className={className}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
          );
        })}
        <Link
          to="/download-history"
          aria-current={pathname === "/download-history" ? "page" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
            pathname === "/download-history"
              ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          )}
        >
          <Download className="size-4 shrink-0" />
          <span className="truncate">Download History</span>
        </Link>
        <Link
          to="/synced-orders"
          aria-current={pathname === "/synced-orders" ? "page" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
            pathname === "/synced-orders"
              ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          )}
        >
          <Database className="size-4 shrink-0" />
          <span className="truncate">Synced Orders</span>
        </Link>
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <Settings className="size-4" />
          Settings
        </button>
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <ShieldCheck className="size-4 text-sidebar-primary" />
          <div className="leading-tight">
            <p className="text-sm font-medium text-sidebar-accent-foreground">Admin Profile</p>
            <p className="text-xs text-sidebar-foreground/55">Full access</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border lg:block">
      <div className="sticky top-0 h-screen">
        <SidebarContent />
      </div>
    </aside>
  );
}
