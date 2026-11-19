import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeIndianRupee,
  Boxes,
  CircleHelp,
  Lightbulb,
  Megaphone,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { useEffect } from "react";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { BrandLoader } from "@/components/dashboard/BrandLoader";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

// Historical October 2026 values from the uploaded Flipkart reports.
const report = {
  generatedOn: "17 Nov 2026",
  estimatedNetSales: 203202,
  grossUnits: 755,
  returnedUnits: 150,
  rtoUnits: 88,
  netUnits: 605,
  adsExpense: 16570.36,
  marketplaceExpenses: 44856.9,
  projectedSettlement: 157612.09,
  alreadyPaid: 156253,
  pendingSettlement: 1359.09,
  inputTaxCredits: 24380.14,
  settlementReport: {
    netBankSettlement: 89651.76,
    adsWalletFees: 15922.31,
    gstOnAds: 14847.18,
    saleOrders: 662,
    returns: 75,
  },
};

const products = [
  { sku: "CL-VB-05-2026", netUnits: 491, netSales: 178782, expenses: 11678.84 },
  { sku: "cl-mfc-06-2026", netUnits: 103, netSales: 22603, expenses: 2322.49 },
  { sku: "hk-Hang-01-2026-P20", netUnits: 8, netSales: 1232, expenses: 57.42 },
  { sku: "Cl-MFC-072026-fl-kt", netUnits: 1, netSales: 242, expenses: 12.68 },
  { sku: "hk-Hang-01-2026-P15", netUnits: 1, netSales: 234, expenses: 10.91 },
  { sku: "hk-Hang-01-2026", netUnits: 1, netSales: 109, expenses: 5.08 },
];

const currency = (value: number, decimals = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

const percent = (value: number) => `${value.toFixed(1)}%`;

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  noteTone = "muted",
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof TrendingUp;
  noteTone?: "muted" | "orange";
}) {
  return (
    <article className="rounded-[1.35rem] border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary">
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-3 text-[1.8rem] font-semibold tracking-tight text-foreground sm:text-[2rem]">
        {value}
      </p>
      <p
        className={`mt-1 text-xs ${noteTone === "orange" ? "text-orange-700" : "text-muted-foreground"}`}
      >
        {note}
      </p>
    </article>
  );
}

function ReportValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function ProgressMetric({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums text-foreground">{currency(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

function Recommendation({
  label,
  title,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  title: string;
  detail: string;
  icon: typeof Lightbulb;
  tone: "amber" | "blue" | "slate";
}) {
  const styles = {
    amber: "border-amber-200 bg-amber-50/70",
    blue: "border-sky-200 bg-sky-50/60",
    slate: "border-border bg-secondary/40",
  };
  const iconStyles = {
    amber: "text-amber-700",
    blue: "text-primary",
    slate: "text-muted-foreground",
  };

  return (
    <article className={`rounded-2xl border p-4 ${styles[tone]}`}>
      <p
        className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${iconStyles[tone]}`}
      >
        <Icon className="size-4" /> {label}
      </p>
      <h3 className="mt-2 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{detail}</p>
    </article>
  );
}

function AnalyticsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) return <BrandLoader fullScreen message="Checking your sign-in…" />;
  if (!isAuthenticated) return null;

  const adShare = (report.adsExpense / report.estimatedNetSales) * 100;
  const returnRate = (report.returnedUnits / report.grossUnits) * 100;
  const topSkuShare = (products[0].netSales / report.estimatedNetSales) * 100;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader title="Analytics" subtitle="October stock, spend and revenue insights" />
        <main className="mx-auto w-full max-w-[1680px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
          <section className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary">
                Business performance · Flipkart
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                October insights
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                1–31 October 2026 · Flipkart order P&amp;L and settlement reports
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-xs text-muted-foreground shadow-sm">
              <span className="size-2 rounded-full bg-emerald-500" />
              Report generated {report.generatedOn}
            </span>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4" aria-label="October KPIs">
            <MetricCard
              label="Estimated net sales"
              value={currency(report.estimatedNetSales)}
              note={`${report.netUnits} net units · after returns and cancellations`}
              icon={BadgeIndianRupee}
            />
            <MetricCard
              label="Ad spend"
              value={currency(report.adsExpense)}
              note={`${percent(adShare)} of estimated net sales`}
              icon={Megaphone}
              noteTone="orange"
            />
            <MetricCard
              label="Returns & cancellations"
              value={`${report.returnedUnits} units`}
              note={`${percent(returnRate)} of ${report.grossUnits} gross units`}
              icon={RotateCcw}
              noteTone="orange"
            />
            <MetricCard
              label="Pending settlement"
              value={currency(report.pendingSettlement)}
              note={`${currency(report.pendingSettlement, 2)} reported as pending from Flipkart`}
              icon={ArrowDownRight}
            />
          </section>

          <section className="grid items-start gap-5 xl:grid-cols-[1.45fr_1fr]">
            <article className="rounded-[1.4rem] border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Revenue to settlement</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    How October sales flowed through marketplace costs
                  </p>
                </div>
                <TrendingUp className="mt-1 size-5 text-primary" />
              </div>

              <div className="mt-5 space-y-4">
                <ProgressMetric
                  label="Estimated net sales"
                  value={report.estimatedNetSales}
                  max={report.estimatedNetSales}
                  color="bg-primary"
                />
                <ProgressMetric
                  label="Marketplace expenses"
                  value={report.marketplaceExpenses}
                  max={report.estimatedNetSales}
                  color="bg-orange-500"
                />
                <ProgressMetric
                  label="Including advertising"
                  value={report.adsExpense}
                  max={report.estimatedNetSales}
                  color="bg-sky-600"
                />
                <ProgressMetric
                  label="Projected bank settlement"
                  value={report.projectedSettlement}
                  max={report.estimatedNetSales}
                  color="bg-emerald-600"
                />
              </div>

              <div className="mt-5 flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-border pt-4 text-sm">
                <p className="text-muted-foreground">
                  Already paid{" "}
                  <strong className="ml-2 text-foreground">{currency(report.alreadyPaid)}</strong>
                </p>
                <p className="text-muted-foreground">
                  Input tax credits{" "}
                  <strong className="ml-2 text-foreground">
                    {currency(report.inputTaxCredits)}
                  </strong>
                </p>
              </div>
              <div className="mt-4 grid gap-3 rounded-2xl bg-secondary/60 p-4 sm:grid-cols-3">
                <p className="text-xs text-muted-foreground sm:col-span-3">
                  Settlement report · payment-date view
                </p>
                <ReportValue
                  label="Net bank settlement"
                  value={currency(report.settlementReport.netBankSettlement)}
                />
                <ReportValue
                  label="Ads wallet fees"
                  value={currency(report.settlementReport.adsWalletFees)}
                />
                <ReportValue
                  label="Sales / returns"
                  value={`${report.settlementReport.saleOrders} / ${report.settlementReport.returns} orders`}
                />
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                The P&amp;L is grouped by order date; the Settlement report is grouped by payment
                duration. Their totals cover different date bases and should not be reconciled as
                the same-period revenue. Platform earnings exclude product cost and overhead, so
                they are not net profit.
              </p>
            </article>

            <article className="rounded-[1.4rem] border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Recommended next actions
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Prioritized from the October reports
                  </p>
                </div>
                <AlertCircle className="mt-1 size-5 text-orange-600" />
              </div>
              <div className="mt-5 space-y-3">
                <Recommendation
                  label="Stock risk · verify on-hand"
                  title="Check stock for the two leading SKUs"
                  detail={`${products[0].sku} sold ${products[0].netUnits} net units and ${products[1].sku} sold ${products[1].netUnits}. The reports contain no current stock or supplier lead-time data, so days of cover and reorder quantities cannot be calculated.`}
                  icon={Boxes}
                  tone="amber"
                />
                <Recommendation
                  label="Spend · review efficiency"
                  title="Review campaign return before adding budget"
                  detail={`The P&L records ${currency(report.adsExpense)} in ads; the settlement report shows ${currency(report.settlementReport.adsWalletFees)} in ads wallet fees plus ${currency(report.settlementReport.gstOnAds)} GST on ads fees. The reports use different date bases, so compare campaign attribution and wallet transactions before changing budgets.`}
                  icon={Megaphone}
                  tone="slate"
                />
                <Recommendation
                  label="Revenue · reduce concentration"
                  title="Investigate the return and cancellation mix"
                  detail={`${report.returnedUnits} of ${report.grossUnits} gross units were returned or cancelled. RTO accounted for ${report.rtoUnits} units; inspect delivery and listing issues. The top SKU contributed ${Math.round(topSkuShare)}% of net sales.`}
                  icon={PackageCheck}
                  tone="slate"
                />
              </div>
            </article>
          </section>

          <section className="rounded-[1.4rem] border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Product performance</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Net sales and units from the October SKU-level P&amp;L
                </p>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowUpRight className="size-4 text-emerald-600" /> Sales leader: {products[0].sku}
              </p>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">SKU</th>
                    <th className="pb-3 pr-4 text-right font-medium">Net units</th>
                    <th className="pb-3 pr-4 text-right font-medium">Net sales</th>
                    <th className="pb-3 text-right font-medium">Reported expenses</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => (
                    <tr key={product.sku} className="border-b border-border/70 last:border-0">
                      <td className="py-3 pr-4 font-medium text-foreground">
                        {product.sku}
                        {index === 0 ? (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-800">
                            Top seller
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">{product.netUnits}</td>
                      <td className="py-3 pr-4 text-right font-medium tabular-nums text-foreground">
                        {currency(product.netSales)}
                      </td>
                      <td className="py-3 text-right tabular-nums text-muted-foreground">
                        {currency(product.expenses)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
              <CircleHelp className="mt-0.5 size-4 shrink-0" /> Product costs and current inventory
              are not present in these reports. Add a SKU cost sheet and current stock report to
              calculate contribution after ads and days of stock cover.
            </p>
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-2 pb-2 text-xs text-muted-foreground">
            <span>Source: October Flipkart order P&amp;L and settlement reports</span>
            <span>Historical uploaded report data · Not live API data</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
