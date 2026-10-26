import type { Brand, Marketplace } from "./types";
import { addDays, eachDay, todayIST } from "./dates";

export interface OrderFact {
  orderId?: string;
  date: string;
  brand: Brand;
  marketplace: Marketplace;
  sku: string;
  orders: number;
  unitsSold: number;
  grossSales: number;
}

export interface CatalogProduct {
  sku: string;
  name: string;
  brand: Brand;
  price: number;
  weight: number; // relative demand
}

export const CATALOG: CatalogProduct[] = [
  { sku: "MICROFIBRE-CLOTHES", name: "MICROFIBRE CLOTHES", brand: "CLASPO", price: 299, weight: 1 },
  { sku: "VACUUME-BAG", name: "VACCUME BAG", brand: "CLASPO", price: 699, weight: 0.82 },
  { sku: "ADHESHIVE-HOOK", name: "ADHESHIVE HOOK", brand: "CLASPO", price: 249, weight: 0.74 },
  { sku: "SCREW", name: "SCREW", brand: "CLASPO", price: 149, weight: 0.63 },
  { sku: "RAMPAGE", name: "RAMPAGE", brand: "MONKEYMAN", price: 1999, weight: 1 },
  { sku: "BELLA-ROSE-GOLD", name: "BELLA ROSE GOLD", brand: "MONKEYMAN", price: 3890, weight: 0.8 },
  { sku: "BELLA-BLACK", name: "BELLA BLACK", brand: "MONKEYMAN", price: 3550, weight: 0.92 },
];

const MARKETPLACES: Marketplace[] = ["Amazon", "Flipkart"];
const MARKETPLACE_SHARE: Record<Marketplace, number> = { Amazon: 0.65, Flipkart: 0.35 };

/** Deterministic pseudo-random in [0,1) from a string seed. */
function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

let cache: OrderFact[] | null = null;

/** Demo fact table: last 120 days of daily order rows. Replace with API later. */
export function getFacts(): OrderFact[] {
  if (cache) return cache;
  const today = todayIST();
  const days = eachDay(addDays(today, -119), today);
  const facts: OrderFact[] = [];

  days.forEach((date, index) => {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekendLift = weekday === 0 || weekday === 6 ? 1.22 : 1;
    const growth = 1 + index * 0.0035;

    for (const product of CATALOG) {
      for (const marketplace of MARKETPLACES) {
        const noise = 0.7 + seeded(`${date}|${product.sku}|${marketplace}`) * 0.7;
        const base = 26 * product.weight * MARKETPLACE_SHARE[marketplace];
        const orders = Math.max(0, Math.round(base * weekendLift * growth * noise));
        if (orders === 0) continue;
        const unitsPerOrder =
          1 + (seeded(`u|${date}|${product.sku}|${marketplace}`) > 0.55 ? 1 : 0);
        const unitsSold = orders * unitsPerOrder;
        const discount = 0.88 + seeded(`d|${date}|${product.sku}`) * 0.16;
        facts.push({
          date,
          brand: product.brand,
          marketplace,
          sku: product.sku,
          orders,
          unitsSold,
          grossSales: Math.round(unitsSold * product.price * discount),
        });
      }
    }
  });

  cache = facts;
  return facts;
}
