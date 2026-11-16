type ProductImageInput = { name?: string; title?: string; sku?: string };

/** Return the matching local product image for known dashboard products. */
export function productImageFor({ name, title, sku = "" }: ProductImageInput) {
  const product = `${name ?? title ?? ""} ${sku}`.toLowerCase();

  if (/apewatch.*rampage|rampage.*smartwatch|mm-rmpg/.test(product)) return "/apewatch-rampage-black.png";
  if ((/apewatch.*bella|bella.*smartwatch|mm-bella/.test(product)) && (/\bblack\b|mm-bella-blk/.test(product))) return "/apewatch-bella-black.png";
  if (/apewatch.*bella|bella.*smartwatch|mm-bella/.test(product)) return "/apewatch-bella.png";
  if (/microfib(?:er|re)|cleaning cloth|cl-mfc|mfc-/.test(product)) return "/microfiber-cloth.png";
  if ((/screw/.test(product) && /wall|hook/.test(product)) || /hk[-_]screw/.test(product)) return "/adhesive-screw-wall-hook.png";
  if (/wall\s*hooks?|adhesive\s+hooks?|hook\s+wall\s+hanger|hk[-_]hang/.test(product)) return "/adhesive-wall-hooks.png";
  if (/vacuum|vacume|vaccume|cl-vb|vb-\d/.test(product)) return "/vacuum-storage-bags.png";

  return null;
}
