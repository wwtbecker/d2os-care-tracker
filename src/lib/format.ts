export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Days between two dates (date-only ISO strings or timestamps). */
export function daysBetween(a: string, b: string): number {
  const da = new Date(a.length === 10 ? `${a}T00:00:00Z` : a).getTime();
  const db = new Date(b.length === 10 ? `${b}T00:00:00Z` : b).getTime();
  return Math.round((db - da) / 86_400_000);
}

export function isOverdue(dateISO: string | null | undefined): boolean {
  if (!dateISO) return false;
  return dateISO.slice(0, 10) <= todayISO();
}
