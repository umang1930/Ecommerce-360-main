type ProductLabelInput = { name: string; sku?: string };

function packLabel(name: string) {
  const match = name.match(/\bpack\s+of\s+(\d+)\b/i) ?? name.match(/\b(\d+)\s*(?:pcs|pieces)\b/i);
  return match ? ` · Pack ${match[1]}` : "";
}

function colorLabel(name: string) {
  const knownColors = ["Rose Gold", "Black", "Pink", "Gold", "White", "Grey", "Gray", "Blue", "Green"];
  const colors = knownColors.filter((color) => new RegExp(`\\b${color}\\b`, "i").test(name));
  return colors.length ? ` · ${[...new Set(colors.map((color) => color === "Gray" ? "Grey" : color))].join(" / ")}` : "";
}

/** Short, mobile-friendly selector label while retaining the source title for details. */
export function shortProductLabel({ name, sku }: ProductLabelInput) {
  const cleanName = name.trim().replace(/^(?:CLASPO|MONKEYMAN)\s+/i, "").replace(/\s+/g, " ");
  const normalized = cleanName.toLowerCase();
  const normalizedSku = (sku ?? "").toLowerCase();
  const pack = packLabel(cleanName);

  if (/mm-rmpg/.test(normalizedSku)) return "ApeWatch Rampage";
  if (/mm-bella-blk/.test(normalizedSku)) return "ApeWatch Bella · Black";
  if (/mm-bella-rg/.test(normalizedSku)) return "ApeWatch Bella · Rose Gold";
  if (/cl-vb|vb-\d/.test(normalizedSku)) return "Vacuum Storage Bags";
  if (/cl-mfc|mfc-/.test(normalizedSku)) return "Microfiber Cloth";
  if (/hk[-_]screw/.test(normalizedSku)) return "Adhesive Screw Wall Hook";
  const hookPack = normalizedSku.match(/hk[-_]hang.*p(\d+)/);
  if (hookPack) return `Adhesive Wall Hooks · Pack ${hookPack[1]}`;

  if (/apewatch.*bella|bella.*smartwatch/.test(normalized)) return `ApeWatch Bella${colorLabel(cleanName)}`;
  if (/apewatch.*rampage|rampage.*smartwatch/.test(normalized)) return `ApeWatch Rampage${colorLabel(cleanName)}`;
  if (/screw/.test(normalized) && /wall|hook/.test(normalized)) return `Adhesive Screw Wall Hook${pack}`;
  if (/wall\s*hooks?|adhesive\s+hooks?|hook\s+wall\s+hanger/.test(normalized)) return `Adhesive Wall Hooks${pack}`;
  if (/vacuum|vacume|vaccume/.test(normalized) && /bag/.test(normalized)) return `Vacuum Storage Bags${pack}`;
  if (/microfiber|microfibre|cleaning cloth/.test(normalized)) {
    const size = cleanName.match(/\b(\d{2})\s*[x×]\s*(\d{2})\s*cm\b/i);
    return `Microfiber Cloth${size ? ` · ${size[1]}×${size[2]} cm` : ""}${pack}`;
  }

  const firstPhrase = cleanName.split("|")[0]?.trim() || cleanName;
  if (!firstPhrase || firstPhrase === "-") return sku || "Other product";
  return firstPhrase.length > 38 ? `${firstPhrase.slice(0, 35).trimEnd()}…` : firstPhrase;
}
