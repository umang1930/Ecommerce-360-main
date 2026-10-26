import { Bell, CheckCircle2, ChevronDown, Menu, RefreshCw, TriangleAlert, LogOut, User } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarContent } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useOptionalDashboard } from "@/lib/dashboard/filters-context";

export function DashboardHeader({
  title = "Dashboard",
  subtitle = "Your ecommerce business at a glance",
}: {
  title?: string;
  subtitle?: string;
} = {}) {
  const { user, logout } = useAuth();
  const dashboard = useOptionalDashboard();
  const exceptions = dashboard?.data?.exceptions ?? [];
  const needsAttention = dashboard?.isError || exceptions.some((exception) => exception.severity === "critical" || exception.severity === "warning");

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 border-none p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
            {title}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label="Data sync notifications">
                <Bell className="size-5 text-muted-foreground" />
                {needsAttention ? <span className="absolute right-2 top-2 size-2 rounded-full bg-destructive" /> : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Live dashboard data</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {dashboard?.data?.rangeLabel ?? "Current dashboard filters"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Refresh sync status"
                  disabled={!dashboard || dashboard.isLoading}
                  onClick={() => dashboard?.refetch()}
                >
                  <RefreshCw className={`size-4 ${dashboard?.isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <DropdownMenuSeparator />
              {!dashboard ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">Open the Dashboard to view saved order data.</p>
              ) : dashboard.isLoading && !dashboard.data ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">Loading live marketplace data…</p>
              ) : dashboard.isError ? (
                <div className="px-4 py-4">
                  <p className="text-sm text-destructive">{dashboard.errorMessage || "The dashboard database request failed."}</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={dashboard.refetch}>Try again</Button>
                </div>
              ) : !dashboard.data ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">No saved dashboard data loaded yet.</p>
              ) : (
                <div className="max-h-80 space-y-3 overflow-y-auto px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    {exceptions.length > 0
                      ? <><TriangleAlert className="size-4 text-amber-600" /><span className="font-medium">Loaded with {exceptions.length} warning{exceptions.length === 1 ? "" : "s"}</span></>
                      : <><CheckCircle2 className="size-4 text-emerald-600" /><span className="font-medium">Saved order data loaded successfully</span></>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Source: {dashboard.data.sourceLabel || "Synced orders database"}
                  </p>
                  {exceptions.map((exception) => (
                    <div key={exception.id} className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5">
                      <p className="text-xs font-semibold text-foreground">{exception.title}</p>
                      <p className="mt-1 break-words text-xs text-muted-foreground">{exception.description}</p>
                    </div>
                  ))}
                </div>
              )}
              <DropdownMenuSeparator />
              <p className="px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                Dashboard orders come from the synced orders database and follow the selected filters. Run Sync Orders to refresh saved data.
              </p>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground uppercase">
                  {user?.name?.substring(0, 2).toUpperCase() || "US"}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-medium text-foreground">{user?.name || "User"}</span>
                  <span className="block text-xs text-muted-foreground">{user?.role || "Founder"}</span>
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <User className="mr-2 size-4" />
                <span>Profile Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={logout}>
                <LogOut className="mr-2 size-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
