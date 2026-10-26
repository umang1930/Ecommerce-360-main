export type Brand = string;
export type Marketplace = string;
export type PeriodKey = "today" | "yesterday" | "last7" | "last30" | "custom";
export type MetricKey = "sales" | "orders" | "units";
export type RankBy = MetricKey;

export interface DashboardFilters {
  brand: Brand | "all";
  marketplace: Marketplace | "all";
  period: PeriodKey;
  product: string; // sku or "all"
  startDate?: string; // ISO yyyy-MM-dd (custom)
  endDate?: string;
}

export interface MetricTotals {
  orders: number;
  grossSales: number;
  unitsSold: number;
  averageOrderValue: number | null;
}

export interface DashboardMetrics extends MetricTotals {
  previousPeriod: MetricTotals;
  previousPeriodAvailable?: boolean;
}

export interface SalesTrendPoint {
  date: string;
  label: string;
  grossSales: number;
  orders: number;
  unitsSold: number;
}

export interface MarketplacePerformance {
  marketplace: Marketplace;
  grossSales: number;
  orders: number;
  unitsSold: number;
  share: number;
}

export interface TopProduct {
  name: string;
  sku: string;
  brand: Brand;
  orders: number;
  unitsSold: number;
  grossSales: number;
  contribution: number;
}

export interface DashboardException {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "success";
}

export interface DashboardData {
  metrics: DashboardMetrics;
  trend: SalesTrendPoint[];
  marketplaces: MarketplacePerformance[];
  topProducts: TopProduct[];
  exceptions: DashboardException[];
  rangeLabel: string;
  catalog: { sku: string; name: string; brand: Brand }[];
  sourceLabel: string;
  flipkartOrders: {
    brand: "CLASPO" | "MONKEYMAN";
    orderId: string;
    orderItemId: string;
    shipmentId: string;
    status: string;
    title: string;
    sku: string;
    quantity: number;
    customerPrice: number;
    orderDate: string;
    dispatchByDate: string | null;
  }[];
  deliveredFlipkartOrders: {
    brand: "CLASPO" | "MONKEYMAN";
    orderId: string;
    orderItemId: string;
    shipmentId: string;
    status: string;
    title: string;
    sku: string;
    orderDate: string;
  }[];
  amazonOrders: {
    orderId: string;
    orderItemId: string;
    status: string;
    title: string;
    sku: string;
    quantity: number;
    itemPrice: number;
    orderDate: string;
    currency: string;
    brand: "CLASPO" | "MONKEYMAN";
  }[];
}
