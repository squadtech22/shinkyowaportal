// Vehicle features, stored in stocks.features as a JSON array. Vehicles added
// in the admin panel store { name, value } pairs typed by the user (e.g.
// "Seats" / "7"); older vehicles store keys such as "power_steering".

export type Feature = { name: string; value: string };

const keyLabel = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function parseFeatures(text: string | null | undefined): Feature[] {
  if (!text) return [];
  let list: unknown;
  try {
    list = JSON.parse(text);
  } catch {
    // Comma-separated text from very old rows.
    list = text.split(",").map((s) => s.trim().replace(/^[["]+|[\]"]+$/g, ""));
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((item): Feature | null => {
      if (typeof item === "string") return item ? { name: keyLabel(item), value: "" } : null;
      if (item && typeof item === "object" && "name" in item) {
        const f = item as { name?: unknown; value?: unknown };
        return { name: String(f.name ?? "").trim(), value: String(f.value ?? "").trim() };
      }
      return null;
    })
    .filter((f): f is Feature => Boolean(f?.name));
}

/** "Seats: 7", or just the name when there is no value. */
export const featureText = (f: Feature) => (f.value ? `${f.name}: ${f.value}` : f.name);
