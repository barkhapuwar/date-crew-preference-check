import { activeLearned, checkProfile } from "./checker";
import { profiles } from "./data";
import type { CheckResult, Client, LearnedEntry, Profile } from "./types";

export type Candidate = { profile: Profile; result: CheckResult };

// A short, varied shortlist (5 profiles) so every outcome of the check can be seen at a glance:
// a deal breaker, a soft mismatch, a profile with missing data, and clean passes. Once the client has an active
// learned preference, one learned warning replaces a clean pass.
export function shortlistFor(client: Client, learned: LearnedEntry[], exclude: ReadonlySet<string> = new Set()): Candidate[] {
  const learnedActive = activeLearned(learned).size > 0;
  const buckets: Record<"block" | "warn" | "learned" | "cant" | "pass", Candidate[]> = { block: [], warn: [], learned: [], cant: [], pass: [] };
  const want = { block: 1, warn: 1, learned: learnedActive ? 1 : 0, cant: 1, pass: learnedActive ? 1 : 2 };
  for (const profile of profiles) {
    if (profile.gender === client.gender || exclude.has(profile.id)) continue;
    const result = checkProfile(client, profile, learned);
    const key =
      result.status === "pass"
        ? result.findings.some((f) => f.status === "cant_check") ? "cant" : "pass"
        : result.status === "warn" && result.findings.some((f) => f.source === "learned") ? "learned" : result.status;
    if (buckets[key].length < want[key]) buckets[key].push({ profile, result });
    if (Object.entries(want).every(([k, n]) => buckets[k as keyof typeof buckets].length >= n)) break;
  }
  return [...buckets.block, ...buckets.pass, ...buckets.warn, ...buckets.learned, ...buckets.cant];
}
