export function canonicalBrand(value: string): string {
  const brand = value.trim();
  if (brand.toUpperCase() === "CP") return "CLASPO";
  if (brand.toUpperCase() === "MM") return "MONKEYMAN";
  return brand || "Unassigned";
}

export function inferFlipkartBrand(sku: string, title: string): string {
  const haystack = `${sku} ${title}`.toUpperCase();
  if (haystack.includes("CL-VB-05-2026") || haystack.includes("CLASPO")) return "CLASPO";
  if (haystack.includes("MONKEYMAN")) return "MONKEYMAN";
  return "Unassigned";
}

export function canonicalFlipkartSku(sku: string, title: string): string {
  const haystack = `${sku} ${title}`.toUpperCase();
  if (haystack.includes("CL-VB-05-2026") || haystack.includes("VACUUM STORAGE BAG") || haystack.includes("VACUUM BAG")) return "VACCUME-BAG";
  return sku;
}
