import type { FieldKey, Profile } from "./types";

export type Trait = { field: FieldKey; text: string };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Turns raw profile fields into the short phrases a profile card would show.
export function traitsOf(p: Profile): Trait[] {
  const out: Trait[] = [];
  if (p.religion) out.push({ field: "religion", text: p.religion });
  if (p.diet) out.push({ field: "diet", text: cap(p.diet) });
  if (p.smoking) out.push({ field: "smoking", text: p.smoking === "no" ? "Doesn't smoke" : p.smoking === "yes" ? "Smokes" : "Smokes occasionally" });
  if (p.drinking) out.push({ field: "drinking", text: p.drinking === "no" ? "Doesn't drink" : p.drinking === "social" ? "Drinks socially" : "Drinks regularly" });
  if (p.children) out.push({ field: "children", text: p.children === "wants" ? "Wants children" : p.children === "open" ? "Open to children" : "Doesn't want children" });
  if (p.maritalStatus) out.push({ field: "maritalStatus", text: cap(p.maritalStatus) });
  if (p.education) out.push({ field: "education", text: cap(p.education) });
  return out;
}
