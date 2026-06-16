export { cn } from "sharedcorelib/ui/cn";

/** Local 'YYYY-MM-DD' — the day boundary used for tasks, water, reminders, tiers. */
export function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Minutes-from-midnight → 'HH:MM'. */
export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 'HH:MM' → minutes-from-midnight (0 on bad input). */
export function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  if (Number.isNaN(h)) return 0;
  return (h ?? 0) * 60 + (m ?? 0);
}
