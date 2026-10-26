export interface FlipkartInventoryResult {
  configured: boolean;
  sku: string;
  productTitle?: string;
  listingStatus?: string;
  mrp?: number;
  sellingPrice?: number;
  currency?: string;
  locations: { id: string; status: string; inventory: number }[];
  ordersToBeFulfilled?: number;
  productUrl?: string;
  unavailable: boolean;
  error?: string;
}

export interface FlipkartInventoryResponse {
  configured: boolean;
  listings: FlipkartInventoryResult[];
  error?: string;
}

export interface FlipkartReturn {
  brand: "CLASPO" | "MONKEYMAN";
  returnId: string;
  orderItemId: string;
  source: "customer_return" | "courier_return";
  status: string;
  action: string;
  reason: string;
  subReason: string;
  quantity: number;
  trackingId: string;
  shipmentId: string;
  courierName: string;
  orderDate: string;
  createdDate: string;
  updatedDate: string;
  expectedDate: string;
  completionDate: string;
}

export interface FlipkartReturnsResult {
  configured: boolean;
  customerReturns: FlipkartReturn[];
  courierReturns: FlipkartReturn[];
  customerError?: string;
  courierError?: string;
}
