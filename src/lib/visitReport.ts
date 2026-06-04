/**
 * Doctor-visit summary — a self-contained printable HTML document for a profile,
 * rendered to PDF via the shared `printHtmlAsPdf`. Deterministic; advisory only.
 */
import { printHtmlAsPdf, escapeHtml } from "sharedcorelib/report";
import { getProfile } from "@/db/profiles";
import { listMedications } from "@/db/medications";
import { listBaseline } from "@/db/baseline";
import { latestMetrics } from "@/db/metrics";
import { listGoals } from "@/db/goals";
import { metricKind } from "@/lib/metricKinds";
import { ageFromDob, EMERGENCY_DISCLAIMER } from "@/lib/emergency";
import { localToday } from "@/lib/utils";

export interface VisitData {
  generatedOn: string;
  name: string;
  age: number | null;
  sex: string;
  bloodGroup: string | null;
  allergies: { label: string; severe: boolean }[];
  conditions: string[];
  meds: { drug: string; strength?: string | null; schedule?: string | null }[];
  vitals: { label: string; value: number; unit: string | null; date: string }[];
  goals: { title: string; target: number | null; unit: string | null; current: number | null }[];
  emergency?: { name?: string | null; phone?: string | null; email?: string | null };
}

function section(title: string, body: string): string {
  if (!body) return "";
  return `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

/** Pure: build the report HTML from structured data (testable, no DB). */
export function buildVisitReportHtml(d: VisitData): string {
  const list = (items: string[]) =>
    items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : `<p class="muted">None recorded</p>`;

  const allergies = list(
    d.allergies.map((a) => `${escapeHtml(a.label)}${a.severe ? ' <strong class="sev">(severe)</strong>' : ""}`),
  );
  const conditions = list(d.conditions.map(escapeHtml));
  const meds = list(
    d.meds.map(
      (m) => `${escapeHtml(m.drug)}${m.strength ? ` ${escapeHtml(m.strength)}` : ""}${m.schedule ? ` — ${escapeHtml(m.schedule)}` : ""}`,
    ),
  );
  const vitals = d.vitals.length
    ? `<table><thead><tr><th>Measure</th><th>Latest</th><th>Date</th></tr></thead><tbody>${d.vitals
        .map(
          (v) =>
            `<tr><td>${escapeHtml(v.label)}</td><td>${v.value}${v.unit ? " " + escapeHtml(v.unit) : ""}</td><td>${escapeHtml(v.date)}</td></tr>`,
        )
        .join("")}</tbody></table>`
    : `<p class="muted">None recorded</p>`;
  const goals = d.goals.length
    ? list(
        d.goals.map(
          (g) =>
            `${escapeHtml(g.title)}${g.target != null ? ` — target ${g.target}${g.unit ? escapeHtml(g.unit) : ""}` : ""}${g.current != null ? ` (now ${g.current}${g.unit ? escapeHtml(g.unit) : ""})` : ""}`,
        ),
      )
    : "";
  const emerg = d.emergency && (d.emergency.name || d.emergency.phone || d.emergency.email)
    ? `<p>${escapeHtml(d.emergency.name ?? "")} ${d.emergency.phone ? escapeHtml(d.emergency.phone) : ""} ${d.emergency.email ? escapeHtml(d.emergency.email) : ""}</p>`
    : "";

  const headerBits = [d.age != null ? `${d.age} yrs` : "", d.sex !== "unspecified" ? d.sex : "", d.bloodGroup ?? ""]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Visit summary — ${escapeHtml(d.name)}</title>
<style>
  body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:32px;max-width:720px}
  h1{font-size:22px;margin:0}
  .sub{color:#64748b;margin:2px 0 18px}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#0d9488;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin:18px 0 8px}
  ul{margin:0;padding-left:18px} li{margin:2px 0}
  table{width:100%;border-collapse:collapse} th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #eef2f6;font-size:13px}
  th{color:#64748b;font-weight:600}
  .muted{color:#94a3b8} .sev{color:#dc2626}
  footer{margin-top:24px;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;padding-top:8px}
</style></head><body>
  <h1>${escapeHtml(d.name)}</h1>
  <div class="sub">${headerBits || ""}${headerBits ? " · " : ""}Visit summary generated ${escapeHtml(d.generatedOn)}</div>
  ${section("Allergies", allergies)}
  ${section("Conditions", conditions)}
  ${section("Current medications", meds)}
  ${section("Recent vitals", vitals)}
  ${section("Goals", goals)}
  ${section("Emergency contact", emerg)}
  <footer>${escapeHtml(EMERGENCY_DISCLAIMER)}</footer>
</body></html>`;
}

/** Gather a profile's data and open the print-to-PDF dialog. */
export async function exportVisitReport(profileId: number): Promise<void> {
  const profile = await getProfile(profileId);
  if (!profile) return;
  const [meds, allergies, conditions, vitals, goals] = await Promise.all([
    listMedications(profileId),
    listBaseline(profileId, "allergy"),
    listBaseline(profileId, "condition"),
    latestMetrics(profileId),
    listGoals(profileId),
  ]);

  const html = buildVisitReportHtml({
    generatedOn: localToday(),
    name: profile.name,
    age: ageFromDob(profile.dob),
    sex: profile.sex,
    bloodGroup: profile.blood_group,
    allergies: allergies.map((a) => ({ label: a.label, severe: a.severity === "severe" })),
    conditions: conditions.map((c) => c.label),
    meds: meds.map((m) => ({ drug: m.drug, strength: m.strength, schedule: m.schedule })),
    vitals: vitals.map((v) => ({
      label: metricKind(v.kind)?.label ?? v.kind,
      value: v.value,
      unit: v.unit,
      date: v.taken_at.slice(0, 10),
    })),
    goals: goals.map((g) => ({
      title: g.title,
      target: g.target,
      unit: g.unit,
      current: vitals.find((v) => v.kind === g.metric_kind)?.value ?? null,
    })),
    emergency: {
      name: profile.emergency_contact,
      phone: profile.emergency_phone,
      email: profile.emergency_email,
    },
  });

  printHtmlAsPdf(html);
}
