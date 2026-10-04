import type { CheckResult, Profile } from "@/lib/types";

// Soft background / text pairs for monograms. Chosen from a hash so a person always gets the same colour.
const TINTS: [string, string][] = [
  ["#e8f2f0", "#253f3a"],
  ["#f9efe1", "#7d5115"],
  ["#cee2de", "#1b302b"],
  ["#f3f0ea", "#44403b"],
  ["#f3e4cf", "#633e0c"],
  ["#dfeae7", "#386058"],
];

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function initials(name: string): string {
  return name
    .replace(/\(.*\)/, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function Monogram({ name, seed, size = 40 }: { name: string; seed: string; size?: number }) {
  const [bg, fg] = TINTS[hash(seed) % TINTS.length];
  return (
    <span className="mono" aria-hidden="true" style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.38) }}>
      {initials(name)}
    </span>
  );
}

export type PillKind = "pass" | "warn" | "block" | "cant";

export function pillKind(result: CheckResult): PillKind {
  if (result.status === "pass" && result.findings.some((f) => f.status === "cant_check")) return "cant";
  return result.status;
}

const PILL_TEXT: Record<PillKind, string> = { pass: "Pass", warn: "Warn", block: "Block", cant: "Pass · incomplete" };

export function StatusPill({ kind }: { kind: PillKind }) {
  return <span className={`pill ${kind}`}>{PILL_TEXT[kind]}</span>;
}

export function ProfileRow({ profile, selected, onClick, right }: { profile: Profile; selected: boolean; onClick: () => void; right?: React.ReactNode }) {
  return (
    <button className={`row ${selected ? "on" : ""}`} aria-pressed={selected} onClick={onClick}>
      <Monogram name={profile.name} seed={profile.id} size={40} />
      <span className="who">
        <b>{profile.name}, {profile.age}</b>
        <span>{profile.profession} · {profile.city}</span>
      </span>
      {right}
    </button>
  );
}

// A pill that fills as a reason is seen again: partly filled while it is only logged, fully filled once it is applied to checks.
export function LearnedPill({ label, count, threshold }: { label: string; count: number; threshold: number }) {
  const pct = (Math.min(count, threshold) / threshold) * 100;
  const text = count >= threshold ? `${label}: ${count} rejections. Now applied to checks.` : `${label}: ${count} of ${threshold} rejections. Logged, not yet applied to checks.`;
  return (
    <span className="lpill" role="img" aria-label={text} title={text}>
      <span>{label}</span>
      <span className="lfill" style={{ width: `${pct}%` }} aria-hidden="true"><span>{label}</span></span>
    </span>
  );
}
