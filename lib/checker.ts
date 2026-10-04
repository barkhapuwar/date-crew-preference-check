import type { CheckResult, CheckStatus, Client, FieldKey, FieldValue, Finding, LearnedEntry, Preference, Profile } from "./types";
import { FIELD_LABEL } from "./taxonomy";

// A learned preference becomes active after this many rejections for the same reason (a guess, to be tuned from data).
export const LEARNED_THRESHOLD = 2;

// How close a value must be to a rejected value to count as "similar" for numeric fields.
const TOLERANCE: Partial<Record<FieldKey, number>> = { age: 3, heightCm: 4 };

export function valueOf(profile: Profile, field: FieldKey): FieldValue {
  return profile[field];
}

export function formatValue(field: FieldKey, value: FieldValue): string {
  if (value === null) return "not stated";
  return field === "heightCm" ? `${value} cm` : String(value);
}

export function describePreference(p: Preference): string {
  const label = FIELD_LABEL[p.field];
  if (p.allowed) return `${label}: ${p.allowed.join(" or ")}`;
  const unit = p.field === "heightCm" ? " cm" : "";
  if (p.min !== undefined && p.max !== undefined) return `${label}: ${p.min}–${p.max}${unit}`;
  if (p.min !== undefined) return `${label}: at least ${p.min}${unit}`;
  return `${label}: at most ${p.max}${unit}`;
}

export function violates(p: Preference, value: FieldValue): boolean {
  if (value === null) return false;
  if (p.allowed) return !p.allowed.includes(String(value));
  const n = Number(value);
  if (p.min !== undefined && n < p.min) return true;
  if (p.max !== undefined && n > p.max) return true;
  return false;
}

function isSimilar(field: FieldKey, candidate: FieldValue, rejected: FieldValue): boolean {
  if (candidate === null || rejected === null) return false;
  const tol = TOLERANCE[field];
  if (tol !== undefined) return Math.abs(Number(candidate) - Number(rejected)) <= tol;
  return candidate === rejected;
}

export function activeLearned(entries: LearnedEntry[]): Map<string, LearnedEntry[]> {
  const byTag = new Map<string, LearnedEntry[]>();
  for (const e of entries) byTag.set(e.tag, [...(byTag.get(e.tag) ?? []), e]);
  for (const [tag, list] of byTag) if (list.length < LEARNED_THRESHOLD) byTag.delete(tag);
  return byTag;
}

export function checkProfile(client: Client, profile: Profile, learned: LearnedEntry[] = []): CheckResult {
  const findings: Finding[] = [];
  const first = client.name.split(" ")[0];

  for (const pref of client.preferences) {
    const label = FIELD_LABEL[pref.field];
    const value = valueOf(profile, pref.field);
    if (value === null) {
      findings.push({
        status: "cant_check",
        field: pref.field,
        source: pref.tier,
        message: `${label} is not stated on the profile, so ${first}'s ${pref.tier === "hard" ? "deal breaker" : "preference"} (${describePreference(pref)}) could not be verified.`,
      });
      continue;
    }
    if (violates(pref, value)) {
      findings.push({
        status: pref.tier === "hard" ? "block" : "warn",
        field: pref.field,
        source: pref.tier,
        message:
          pref.tier === "hard"
            ? `Deal breaker (${describePreference(pref)}). Profile: ${formatValue(pref.field, value)}.`
            : `Preference (${describePreference(pref)}). Profile: ${formatValue(pref.field, value)}.`,
      });
    }
  }

  for (const [, entries] of activeLearned(learned)) {
    const field = entries[0].field;
    if (findings.some((f) => f.field === field && (f.status === "block" || f.status === "warn"))) continue;
    const value = profile[field];
    if (entries.some((e) => isSimilar(field, value, e.value))) {
      const seen = entries.map((e) => formatValue(field, e.value)).join(", ");
      findings.push({
        status: "warn",
        field,
        source: "learned",
        message: `Learned from ${entries.length} earlier rejections for ${FIELD_LABEL[field].toLowerCase()} (${seen}). Profile: ${formatValue(field, value)}.`,
      });
    }
  }

  for (const note of client.notes) {
    findings.push({ status: "note", source: "note", message: `Mentioned by ${first}: "${note}". Not checked automatically.` });
  }

  const status: CheckStatus = findings.some((f) => f.status === "block")
    ? "block"
    : findings.some((f) => f.status === "warn")
      ? "warn"
      : "pass";
  return { status, findings };
}
