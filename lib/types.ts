export type FieldKey =
  | "age"
  | "heightCm"
  | "city"
  | "religion"
  | "diet"
  | "smoking"
  | "drinking"
  | "children"
  | "maritalStatus"
  | "education";

export type FieldValue = string | number | null;

export type Profile = {
  id: string;
  name: string;
  gender: "F" | "M";
  profession: string;
  // null means the profile has no data for that field ("can't check")
  age: number | null;
  heightCm: number | null;
  city: string | null;
  religion: string | null;
  diet: string | null;
  smoking: string | null;
  drinking: string | null;
  children: string | null;
  maritalStatus: string | null;
  education: string | null;
};

export type Preference = {
  field: FieldKey;
  tier: "hard" | "soft";
  // categorical: candidate value must be in `allowed`; numeric: candidate must be within min/max
  allowed?: string[];
  min?: number;
  max?: number;
};

export type Client = {
  id: string;
  name: string;
  age: number;
  gender: "F" | "M";
  city: string;
  preferences: Preference[];
  // Free-text preferences that do not map to a field. Shown to the matchmaker, never enforced.
  notes: string[];
};

export type Matchmaker = "A" | "B" | "C" | "D";

export type Stage = "contact" | "conversation" | "meeting_fixed" | "completed";

export type Share = {
  id: number;
  day: number;
  clientId: string;
  profileId: string;
  matchmaker: Matchmaker;
  outcome: "accepted" | "rejected";
  rejectionText?: string;
  tags?: string[];
  // true when the rejection reason matches something the client had already stated
  avoidable?: boolean;
  // furthest stage reached after acceptance (null = stopped at acceptance)
  stage?: Stage | null;
};

export type CheckStatus = "pass" | "warn" | "block";

export type Finding = {
  status: "warn" | "block" | "cant_check" | "note";
  field?: FieldKey;
  source: "hard" | "soft" | "learned" | "note";
  message: string;
};

export type CheckResult = {
  status: CheckStatus;
  findings: Finding[];
};

export type LearnedEntry = {
  tag: string;
  field: FieldKey;
  // value of the rejected profile for that field, at the time of rejection
  value: FieldValue;
  profileId: string;
};
