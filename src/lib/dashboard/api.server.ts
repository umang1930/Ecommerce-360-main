import type { CatalogProduct, OrderFact } from "./demo-source";
import { loadDashboardOrders } from "./synced-orders.server";
import { canonicalFlipkartSku } from "./brands";
import {
  addDays,
  todayIST,
  eachDay,
  formatDayLabel,
  formatRangeLabel,
  previousRange,
  resolveRange,
  type DateRange,
} from "./dates";
import { safeDivide } from "./format";
import type {
  DashboardException,
  DashboardData,
  DashboardFilters,
  MarketplacePerformance,
  MetricTotals,
  SalesTrendPoint,
  TopProduct,
} from "./types";

function matches(fact: OrderFact, filters: DashboardFilters, range: DateRange) {
  if (fact.date < range.start || fact.date > range.end) return false;
  if (filters.brand !== "all" && fact.brand !== filters.brand) return false;
  if (filters.marketplace !== "all" && fact.marketplace !== filters.marketplace) return false;
  if (filters.product !== "all" && fact.sku !== filters.product) return false;
  return true;
}

function totals(facts: OrderFact[]): MetricTotals {
  const orders =
    new Set(facts.filter((fact) => fact.orderId).map((fact) => fact.orderId)).size +
    facts.filter((fact) => !fact.orderId).reduce((sum, f) => sum + f.orders, 0);
  const grossSales = facts.reduce((sum, f) => sum + f.grossSales, 0);
  const unitsSold = facts.reduce((sum, f) => sum + f.unitsSold, 0);
  return { orders, grossSales, unitsSold, averageOrderValue: safeDivide(grossSales, orders) };
}

function buildTrend(facts: OrderFact[], range: DateRange): SalesTrendPoint[] {
  const byDate = new Map<string, SalesTrendPoint>();
  const orderIdsByDate = new Map<string, Set<string>>();
  for (const date of eachDay(range.start, range.end)) {
    byDate.set(date, {
      date,
      label: formatDayLabel(date),
      grossSales: 0,
      orders: 0,
      unitsSold: 0,
    });
  }
  for (const fact of facts) {
    const point = byDate.get(fact.date);
    if (!point) continue;
    point.grossSales += fact.grossSales;
    if (fact.orderId) {
      const ids = orderIdsByDate.get(fact.date) ?? new Set<string>();
      ids.add(fact.orderId);
      orderIdsByDate.set(fact.date, ids);
      point.orders = ids.size;
    } else point.orders += fact.orders;
    point.unitsSold += fact.unitsSold;
  }
  return [...byDate.values()];
}

function buildMarketplaces(facts: OrderFact[]): MarketplacePerformance[] {
  const totalSales = facts.reduce((sum, f) => sum + f.grossSales, 0);
  const map = new Map<string, MarketplacePerformance>();
  const orderIds = new Map<string, Set<string>>();
  for (const fact of facts) {
    const entry = map.get(fact.marketplace) ?? {
      marketplace: fact.marketplace,
      grossSales: 0,
      orders: 0,
      unitsSold: 0,
      share: 0,
    };
    entry.grossSales += fact.grossSales;
    if (fact.orderId) {
      const ids = orderIds.get(fact.marketplace) ?? new Set<string>();
      ids.add(fact.orderId);
      orderIds.set(fact.marketplace, ids);
      entry.orders = ids.size;
    } else entry.orders += fact.orders;
    entry.unitsSold += fact.unitsSold;
    map.set(fact.marketplace, entry);
  }
  return [...map.values()]
    .map((entry) => ({
      ...entry,
      share: totalSales ? (entry.grossSales / totalSales) * 100 : 0,
    }))
    .sort((a, b) => b.grossSales - a.grossSales);
}

function buildTopProducts(facts: OrderFact[], catalog: CatalogProduct[]): TopProduct[] {
  const totalSales = facts.reduce((sum, f) => sum + f.grossSales, 0);
  const map = new Map<string, TopProduct>();
  for (const fact of facts) {
    const meta = catalog.find((p) => p.sku === fact.sku);
    if (!meta) continue;
    const entry = map.get(fact.sku) ?? {
      sku: meta.sku,
      name: meta.name,
      brand: meta.brand,
      orders: 0,
      unitsSold: 0,
      grossSales: 0,
      contribution: 0,
    };
    entry.orders += fact.orders;
    entry.unitsSold += fact.unitsSold;
    entry.grossSales += fact.grossSales;
    map.set(fact.sku, entry);
  }
  return [...map.values()].map((entry) => ({
    ...entry,
    contribution: totalSales ? (entry.grossSales / totalSales) * 100 : 0,
  }));
}

export async function fetchDashboardDataOnServer(
  filters: DashboardFilters,
  includePreviousPeriod = true,
): Promise<DashboardData> {
  const range = resolveRange(filters);
  const prev = previousRange(range);
  const retentionStart = addDays(todayIST(), -29);
  const fetchStart = includePreviousPeriod && prev.start >= retentionStart ? prev.start : range.start;
  const orders = await loadDashboardOrders({
    start: fetchStart < retentionStart ? retentionStart : fetchStart,
    end: range.end,
    brand: filters.brand,
    marketplace: filters.marketplace,
  });
  const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const skuFor = (order: (typeof orders)[number]) => order.marketplace === "Flipkart"
    ? canonicalFlipkartSku(order.sku, order.title) || order.orderItemId
    : order.sku || order.title;
  const dateFor = (order: (typeof orders)[number]) => dayFormatter.format(new Date(order.orderDate));
  const facts: OrderFact[] = orders.map((order) => ({
    // Order IDs are unique within a seller account and marketplace.
    orderId: `${order.marketplace}:${order.seller}:${order.orderId}`,
    date: dateFor(order),
    brand: order.seller === "monkeyman" ? "MONKEYMAN" : "CLASPO",
    marketplace: order.marketplace,
    sku: skuFor(order),
    orders: 1,
    unitsSold: order.quantity,
    grossSales: order.totalPrice,
  }));
  const catalog: CatalogProduct[] = [...new Map(orders.map((order) => {
    const sku = skuFor(order);
    return [sku, {
      sku, name: order.title || sku,
      brand: order.seller === "monkeyman" ? "MONKEYMAN" : "CLASPO",
      price: order.quantity ? order.totalPrice / order.quantity : 0, weight: 1,
    }] as const;
  })).values()];
  const current = facts.filter((fact) => matches(fact, filters, range));
  const previous = facts.filter((fact) => matches(fact, filters, prev));
  const previousPeriodAvailable = includePreviousPeriod && prev.start >= retentionStart;
  const exceptions: DashboardException[] = [];
  if (range.start < retentionStart || !previousPeriodAvailable) {
    exceptions.push({
      id: "database-retention", title: "30-day database history",
      description: "Only the last 30 calendar days of retained synced orders are available. Comparisons outside that window are unavailable.",
      severity: "warning",
    });
  }
  if (orders.length === 0) {
    exceptions.push({
      id: "database-no-orders", title: "No synced orders found",
      description: "No saved orders match this date range, brand and marketplace. Run Sync Orders to refresh the database.",
      severity: "warning",
    });
  }
  const selected = orders.filter((order) =>
    dateFor(order) >= range.start && dateFor(order) <= range.end &&
    (filters.product === "all" || skuFor(order) === filters.product),
  );
  const flipkartOrders: DashboardData["flipkartOrders"] = selected
    .filter((order) => order.marketplace === "Flipkart")
    .map((order) => ({
      brand: order.seller === "monkeyman" ? "MONKEYMAN" : "CLASPO",
      orderId: order.orderId, orderItemId: order.orderItemId,
      shipmentId: "", status: order.status, title: order.title, sku: order.sku,
      quantity: order.quantity, customerPrice: order.totalPrice,
      orderDate: order.orderDate, dispatchByDate: order.dispatchByDate,
    }));
  return {
    metrics: { ...totals(current), previousPeriod: totals(previous), previousPeriodAvailable },
    trend: buildTrend(current, range),
    marketplaces: buildMarketplaces(current),
    topProducts: buildTopProducts(current, catalog),
    exceptions,
    rangeLabel: `${formatRangeLabel(range)} · ${filters.marketplace === "all" ? "Amazon + Flipkart" : filters.marketplace}`,
    catalog: catalog.map(({ sku, name, brand }) => ({ sku, name, brand })),
    sourceLabel: "Synced orders database · Last 30 days",
    flipkartOrders,
    deliveredFlipkartOrders: flipkartOrders.filter((order) => order.status.trim().toUpperCase() === "DELIVERED"),
    amazonOrders: selected.filter((order) => order.marketplace === "Amazon").map((order) => ({
      brand: order.seller === "monkeyman" ? "MONKEYMAN" : "CLASPO",
      orderId: order.orderId, orderItemId: order.orderItemId,
      status: order.status, title: order.title, sku: order.sku,
      quantity: order.quantity, itemPrice: order.totalPrice,
      orderDate: order.orderDate, currency: order.currency,
    })),
  };
}
