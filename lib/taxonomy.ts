import type { FieldKey } from "./types";

export type Reason = {
  id: string;
  label: string;
  // set when the reason maps to a profile field the checker can compare
  field?: FieldKey;
};

// Fixed reason list. In production this would be built by clustering ~100 past rejections.
export const REASONS: Reason[] = [
  { id: "age", label: "Age", field: "age" },
  { id: "height", label: "Height", field: "heightCm" },
  { id: "location", label: "Location", field: "city" },
  { id: "religion", label: "Religion / community", field: "religion" },
  { id: "diet", label: "Diet", field: "diet" },
  { id: "smoking", label: "Smoking", field: "smoking" },
  { id: "drinking", label: "Drinking", field: "drinking" },
  { id: "children", label: "Children", field: "children" },
  { id: "marital_status", label: "Marital status", field: "maritalStatus" },
  { id: "education", label: "Education", field: "education" },
  { id: "looks", label: "Looks / photos" },
  { id: "no_spark", label: "No spark / chemistry" },
  { id: "other", label: "Other / needs review" },
];

export const REASON_BY_ID = Object.fromEntries(REASONS.map((r) => [r.id, r])) as Record<string, Reason>;

export const FIELD_LABEL: Record<FieldKey, string> = {
  age: "Age",
  heightCm: "Height",
  city: "Location",
  religion: "Religion",
  diet: "Diet",
  smoking: "Smoking",
  drinking: "Drinking",
  children: "Children",
  maritalStatus: "Marital status",
  education: "Education",
};

// Reasons that name a specific attribute. "no_spark", "looks" and "other" are too general to count as a repeat.
export function isSpecificReason(id: string): boolean {
  return !!REASON_BY_ID[id]?.field;
}
