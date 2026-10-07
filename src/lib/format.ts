export const number = (n: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n);
export function compact(n: number) {
  if (Math.abs(n) >= 1e6) return `${number(n / 1e6)} млн`;
  if (Math.abs(n) >= 1e3) return `${number(n / 1e3)} тыс.`;
  return number(n);
}
export function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  let normalized = value
    .trim()
    .replace(/[₽$€%\s\u00a0]/g, "")
    .replace(/руб\.?$/i, "");
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized))
    normalized = normalized.replaceAll(",", "");
  else if (normalized.includes(",") && normalized.includes("."))
    normalized = normalized.replaceAll(".", "").replace(",", ".");
  else normalized = normalized.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
export function dateValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let iso = value.trim();
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(iso))
    iso = iso.split(".").reverse().join("-");
  if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(iso)) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== iso.slice(0, 10)
    ? null
    : iso.slice(0, 10);
}
export const dateLabel = (s: string) =>
  new Date(`${s}T12:00:00Z`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
