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
  const pack = packLabel(cleanName);

  if (/apewatch.*bella|bella.*smartwatch/.test(normalized)) return `ApeWatch Bella${colorLabel(cleanName)}`;
  if (/apewatch.*rampage|rampage.*smartwatch/.test(normalized)) return `ApeWatch Rampage${colorLabel(cleanName)}`;
  if (/wall hooks|adhesive hooks|hook wall hanger/.test(normalized)) return `Adhesive Wall Hooks${pack}`;
  if (/vacuum|vacume|vaccume/.test(normalized) && /bag/.test(normalized)) return `Vacuum Storage Bags${pack}`;
  if (/microfiber|microfibre|cleaning cloth/.test(normalized)) {
    const size = cleanName.match(/\b(\d{2})\s*[x×]\s*(\d{2})\s*cm\b/i);
    return `Microfiber Cloth${size ? ` · ${size[1]}×${size[2]} cm` : ""}${pack}`;
  }

  const firstPhrase = cleanName.split("|")[0]?.trim() || cleanName;
  if (!firstPhrase || firstPhrase === "-") return sku || "Other product";
  return firstPhrase.length > 38 ? `${firstPhrase.slice(0, 35).trimEnd()}…` : firstPhrase;
}
