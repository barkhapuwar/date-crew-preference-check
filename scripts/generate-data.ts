// Generates SYNTHETIC data that mirrors the case numbers:
// 1,000 shares in 30 days, 310 accepted (31%), 690 rejected, 35% of rejections (about 241) for reasons
// the client had already stated. Matchmaker A accepts at 44%, B at 21%. Later funnel stages follow the case.
// Nothing here is real client data.
import { writeFileSync } from "node:fs";
import { checkProfile } from "../lib/checker";
import { REASONS } from "../lib/taxonomy";
import type { Client, FieldKey, Matchmaker, Preference, Profile, Share, Stage } from "../lib/types";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261003);
const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
const chance = (p: number) => rnd() < p;
function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function weighted<T>(items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[items.length - 1][0];
}

const CITIES = ["Mumbai", "Delhi", "Bangalore", "Pune", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad"];
const RELIGIONS = ["Hindu", "Muslim", "Sikh", "Christian", "Jain"];
const F_NAMES = ["Ananya", "Diya", "Meera", "Isha", "Kavya", "Riya", "Tara", "Nisha", "Sana", "Pooja", "Neha", "Aditi", "Simran", "Zoya", "Ira", "Lakshmi", "Maya", "Rhea", "Sneha", "Tanvi"];
const M_NAMES = ["Aarav", "Vihaan", "Arjun", "Kabir", "Rohan", "Dev", "Imran", "Karan", "Nikhil", "Rahul", "Siddharth", "Yash", "Aman", "Harsh", "Ishaan", "Manav", "Rishi", "Sameer", "Tushar", "Varun"];
const SURNAMES = ["S.", "K.", "M.", "R.", "P.", "D.", "N.", "G.", "T.", "B."];
const JOBS = ["Software engineer", "Doctor", "Chartered accountant", "Designer", "Teacher", "Consultant", "Entrepreneur", "Lawyer", "Product manager", "Architect"];

function maybeNull<T>(v: T, p = 0.1): T | null {
  return chance(p) ? null : v;
}

// ---- profiles ----
const profiles: Profile[] = [];
for (let i = 0; i < 1600; i++) {
  const gender = i % 2 === 0 ? "F" : "M";
  const first = gender === "F" ? F_NAMES[Math.floor(i / 2) % F_NAMES.length] : M_NAMES[Math.floor(i / 2) % M_NAMES.length];
  profiles.push({
    id: `P${String(i + 1).padStart(4, "0")}`,
    name: `${first} ${pick(SURNAMES)}`,
    gender,
    profession: pick(JOBS),
    age: gender === "F" ? 24 + Math.floor(rnd() * 14) : 26 + Math.floor(rnd() * 15),
    heightCm: gender === "F" ? 152 + Math.floor(rnd() * 28) : 163 + Math.floor(rnd() * 28),
    city: pick(CITIES),
    religion: maybeNull(weighted<string>([["Hindu", 55], ["Muslim", 15], ["Sikh", 10], ["Christian", 12], ["Jain", 8]])),
    diet: maybeNull(weighted<string>([["vegetarian", 40], ["eggetarian", 15], ["non-vegetarian", 45]])),
    smoking: maybeNull(weighted<string>([["no", 70], ["occasionally", 15], ["yes", 15]])),
    drinking: maybeNull(weighted<string>([["no", 40], ["social", 45], ["regular", 15]])),
    children: maybeNull(weighted<string>([["wants", 55], ["open", 30], ["does not want", 15]])),
    maritalStatus: maybeNull(weighted<string>([["never married", 80], ["divorced", 15], ["widowed", 5]]), 0.05),
    education: maybeNull(weighted<string>([["graduate", 40], ["postgraduate", 40], ["professional", 20]])),
  });
}

// ---- clients ----
const NOTES: { text: string; tag: string }[] = [
  { text: "Not too religious", tag: "religion" },
  { text: "Wants someone who will not relocate away from family", tag: "location" },
  { text: "Should be family-oriented", tag: "other" },
  { text: "Prefers someone ambitious but with work-life balance", tag: "other" },
];
const clients: Client[] = [];
const clientNotes = new Map<string, { text: string; tag: string }[]>();
for (let i = 0; i < 40; i++) {
  const gender = i % 2 === 0 ? "F" : "M";
  const age = gender === "F" ? 26 + Math.floor(rnd() * 9) : 28 + Math.floor(rnd() * 9);
  const city = pick(CITIES);
  const religion = weighted<string>([["Hindu", 55], ["Muslim", 15], ["Sikh", 10], ["Christian", 12], ["Jain", 8]]);
  const prefs: Preference[] = [];
  const hardPool = shuffle(["smoking", "children", "diet", "religion", "drinking", "maritalStatus"] as FieldKey[]).slice(0, 2 + Math.floor(rnd() * 2));
  for (const f of hardPool) {
    if (f === "smoking") prefs.push({ field: f, tier: "hard", allowed: ["no"] });
    if (f === "children") prefs.push({ field: f, tier: "hard", allowed: pick([["wants", "open"], ["does not want", "open"]]) });
    if (f === "diet") prefs.push({ field: f, tier: "hard", allowed: pick([["vegetarian"], ["vegetarian", "eggetarian"]]) });
    if (f === "religion") prefs.push({ field: f, tier: "hard", allowed: chance(0.6) ? [religion] : [religion, pick(RELIGIONS)] });
    if (f === "drinking") prefs.push({ field: f, tier: "hard", allowed: pick([["no"], ["no", "social"]]) });
    if (f === "maritalStatus") prefs.push({ field: f, tier: "hard", allowed: ["never married"] });
  }
  prefs.push(gender === "F" ? { field: "age", tier: "soft", min: age - 3, max: age + 8 } : { field: "age", tier: "soft", min: age - 8, max: age + 3 });
  if (gender === "F") prefs.push({ field: "heightCm", tier: "soft", min: 160 + Math.floor(rnd() * 8) });
  else prefs.push({ field: "heightCm", tier: "soft", max: 175 + Math.floor(rnd() * 8) });
  if (chance(0.4)) prefs.push({ field: "city", tier: "soft", allowed: [city, pick(CITIES), pick(CITIES)] });
  if (chance(0.3)) prefs.push({ field: "education", tier: "soft", allowed: ["postgraduate", "professional"] });
  const notes = chance(0.5) ? [pick(NOTES)] : [];
  const id = `C${String(i + 1).padStart(2, "0")}`;
  clientNotes.set(id, notes);
  clients.push({ id, name: `${gender === "F" ? F_NAMES[i % 20] : M_NAMES[i % 20]} ${SURNAMES[(i * 3) % SURNAMES.length]}`, age, gender, city, preferences: prefs, notes: notes.map((n) => n.text) });
}
const matchmakers: Matchmaker[] = ["A", "B", "C", "D"];
const clientMatchmaker = new Map<string, Matchmaker>();
clients.forEach((c, i) => clientMatchmaker.set(c.id, matchmakers[i % 4]));

// ---- rejection text templates ----
const STRONG: Record<string, string[]> = {
  age: ["{n} is older than what I asked for. I did mention my age range.", "The age is outside the range I gave you. Please check before sending.", "{n} is too far from my age preference, which I told you already."],
  height: ["{n} is shorter than I said I would be comfortable with.", "Height again. I did mention a limit on height.", "The height doesn't match what I asked for, sorry."],
  location: ["{n} is in a different city. I told you I want someone close to me.", "Location is not what I asked for. I said I can't relocate.", "Too far. I mentioned the city preference at the start."],
  religion: ["{n} is not from the community I asked for.", "I said religion matters to me. This is not a match on that.", "Religion is a deal breaker for me, as I mentioned."],
  diet: ["{n} is non-vegetarian. I told you I am strictly vegetarian.", "Diet is a problem. I did say I need a vegetarian partner.", "I can't do a different diet at home. I mentioned this."],
  smoking: ["{n} smokes. I did say this is a no for me.", "Smoking is a deal breaker, I mentioned it at the start.", "I told you no smokers. Please check before sending."],
  drinking: ["{n} drinks regularly. I said I want someone who doesn't.", "Drinking is not okay for me, as I told you.", "I mentioned I prefer a non-drinker. This is a no."],
  children: ["{n} does not want children. That's a deal breaker, I told you.", "We want different things on kids. I did mention this.", "I said I want children. {n} doesn't, so no."],
  marital_status: ["I said I'm only looking at people who haven't been married before.", "{n} was married before. I told you I prefer never married.", "Marital status is a deal breaker for me, I mentioned it."],
  education: ["The education level is below what I asked for.", "I told you I'd like someone with a postgraduate degree.", "Education doesn't match my preference, as I said."],
};
const MILD: Record<string, string[]> = {
  age: ["The age feels a bit off for me.", "I think I'd like someone a little different in age."],
  height: ["The height feels a bit off to me.", "Not sure about the height."],
  location: ["The distance worries me a little.", "Different city, not sure it would work."],
  religion: ["Not sure about the community fit.", "I'm not convinced about the background."],
  diet: ["Food habits feel different from mine.", "Not sure about the diet."],
  smoking: ["Not comfortable with the smoking.", "The smoking part puts me off."],
  drinking: ["Not sure about the drinking.", "The drinking habit makes me hesitate."],
  children: ["Not sure we want the same thing on kids.", "Children plans seem different."],
  marital_status: ["Not sure about the past marriage.", "I'm hesitant about marital history."],
  education: ["Not sure about the education.", "Hmm, education seems different from what I imagined."],
};
const NOTE_TEXT: Record<string, string[]> = {
  religion: ["{n} seems very religious. I did say I'm looking for someone relaxed about it.", "Too religious for me, I mentioned that."],
  location: ["I told you I'd like someone who stays near family. {n} seems likely to move away.", "Not close to family. I did say that matters."],
  other: ["I said family-oriented and this doesn't feel like it.", "I asked for someone balanced about work. This sounds too work-driven."],
};
const GENERAL: Record<string, string[]> = {
  no_spark: ["No spark, honestly.", "I just didn't feel anything from the profile.", "Nothing wrong on paper but no connection.", "Can't explain it, it doesn't click."],
  looks: ["Not attracted to the photos.", "The pictures didn't appeal to me.", "Not my type, looks-wise.", "I wanted to see better photos, these don't work."],
  other: ["Not now. I'd rather wait.", "Not for me, thanks.", "I'll pass on this one."],
};
const fillName = (t: string, p: Profile) => t.replace("{n}", p.name.split(" ")[0]);

const REASON_FOR_FIELD = Object.fromEntries(REASONS.filter((r) => r.field).map((r) => [r.field as string, r.id]));

// ---- plan the 1,000 shares ----
const plan: Record<Matchmaker, { accepted: number; avoidable: number; other: number }> = {
  A: { accepted: 110, avoidable: 30, other: 110 },
  B: { accepted: 52, avoidable: 100, other: 98 },
  C: { accepted: 74, avoidable: 55, other: 121 },
  D: { accepted: 74, avoidable: 56, other: 120 },
};

const used = new Set<string>();
const clientsOf = (m: Matchmaker) => clients.filter((c) => clientMatchmaker.get(c.id) === m);
const pool = (c: Client) => profiles.filter((p) => p.gender !== c.gender && !used.has(`${c.id}|${p.id}`));

type Spec = Omit<Share, "id" | "day">;
const specs: Spec[] = [];
const take = (c: Client, p: Profile) => used.add(`${c.id}|${p.id}`);

for (const m of matchmakers) {
  const mine = clientsOf(m);
  // avoidable rejections: about 60% catchable by structured rules, 25% missing profile field, 15% only in a free-text note
  for (let i = 0; i < plan[m].avoidable; i++) {
    const kind = weighted<"catchable" | "missing" | "note">([["catchable", 60], ["missing", 25], ["note", 15]]);
    for (let tries = 0; tries < 50; tries++) {
      const c = pick(mine);
      if (kind === "note" && clientNotes.get(c.id)!.length === 0) continue;
      const cand = shuffle(pool(c));
      let found: { p: Profile; tag: string } | null = null;
      for (const p of cand) {
        const r = checkProfile(c, p);
        if (kind === "catchable") {
          const f = r.findings.find((x) => (x.status === "block" || x.status === "warn") && x.field);
          if (f) { found = { p, tag: REASON_FOR_FIELD[f.field!] }; break; }
        } else if (kind === "missing") {
          const f = r.findings.find((x) => x.status === "cant_check" && x.source === "hard");
          if (f && r.status === "pass") { found = { p, tag: REASON_FOR_FIELD[f.field!] }; break; }
        } else if (r.status === "pass") {
          found = { p, tag: clientNotes.get(c.id)![0].tag }; break;
        }
      }
      if (!found) continue;
      take(c, found.p);
      const text = kind === "note" ? pick(NOTE_TEXT[found.tag]) : pick(STRONG[found.tag]);
      specs.push({ clientId: c.id, profileId: found.p.id, matchmaker: m, outcome: "rejected", rejectionText: fillName(text, found.p), tags: [found.tag], avoidable: true });
      break;
    }
  }
  // accepted: mostly clean matches, about 12% with a soft mismatch (clients say yes to profiles that "break" a soft preference)
  for (let i = 0; i < plan[m].accepted; i++) {
    const wantSoft = chance(0.12);
    for (let tries = 0; tries < 50; tries++) {
      const c = pick(mine);
      const found = shuffle(pool(c)).find((p) => {
        const r = checkProfile(c, p);
        if (wantSoft) return r.status === "warn" && !r.findings.some((f) => f.status === "block");
        return r.status === "pass";
      });
      if (!found) continue;
      take(c, found);
      specs.push({ clientId: c.id, profileId: found.id, matchmaker: m, outcome: "accepted" });
      break;
    }
  }
  // other rejections: taste, chemistry, or an attribute the client never said anything about
  for (let i = 0; i < plan[m].other; i++) {
    for (let tries = 0; tries < 50; tries++) {
      const c = pick(mine);
      const found = shuffle(pool(c)).find((p) => checkProfile(c, p).status === "pass");
      if (!found) continue;
      take(c, found);
      let tag = weighted<string>([["no_spark", 40], ["looks", 30], ["other", 15], ["attr", 15]]);
      let text: string;
      if (tag === "attr") {
        const freeFields = (Object.keys(MILD) as string[]).filter((t) => {
          const f = REASONS.find((r) => r.id === t)!.field!;
          return !c.preferences.some((p) => p.field === f) && !clientNotes.get(c.id)!.some((n) => n.tag === t);
        });
        if (freeFields.length === 0) tag = "no_spark";
        else { tag = pick(freeFields); text = pick(MILD[tag]); }
      }
      text = tag in GENERAL ? pick(GENERAL[tag]) : pick(MILD[tag]);
      specs.push({ clientId: c.id, profileId: found.id, matchmaker: m, outcome: "rejected", rejectionText: fillName(text, found), tags: [tag], avoidable: false });
      break;
    }
  }
}

// ---- stages after acceptance: 210 contact shared, 150 conversations, 75 meetings fixed, 42 completed ----
const acceptedIdx = shuffle(specs.map((s, i) => (s.outcome === "accepted" ? i : -1)).filter((i) => i >= 0));
const stages: (Stage | null)[] = [
  ...Array(42).fill("completed"),
  ...Array(33).fill("meeting_fixed"),
  ...Array(75).fill("conversation"),
  ...Array(60).fill("contact"),
  ...Array(acceptedIdx.length - 210).fill(null),
];
acceptedIdx.forEach((idx, k) => { specs[idx].stage = stages[k] ?? null; });

// ---- order by day and give ids ----
const shares: Share[] = shuffle(specs)
  .map((s) => ({ ...s, day: 1 + Math.floor(rnd() * 30) }))
  .sort((a, b) => a.day - b.day)
  .map((s, i) => ({ id: i + 1, ...s }));

writeFileSync("data/clients.json", JSON.stringify(clients, null, 1));
writeFileSync("data/profiles.json", JSON.stringify(profiles, null, 1));
writeFileSync("data/shares.json", JSON.stringify(shares));

// ---- sanity print ----
const acc = shares.filter((s) => s.outcome === "accepted").length;
const avoid = shares.filter((s) => s.avoidable).length;
console.log(`shares ${shares.length}, accepted ${acc} (${((acc / shares.length) * 100).toFixed(1)}%), avoidable ${avoid} (${((avoid / shares.length) * 100).toFixed(1)}%)`);
for (const m of matchmakers) {
  const ms = shares.filter((s) => s.matchmaker === m);
  console.log(m, ms.length, `${((ms.filter((s) => s.outcome === "accepted").length / ms.length) * 100).toFixed(0)}% accepted`);
}
const byStage = (st: Stage) => shares.filter((s) => s.outcome === "accepted" && s.stage && ["contact", "conversation", "meeting_fixed", "completed"].indexOf(s.stage) >= ["contact", "conversation", "meeting_fixed", "completed"].indexOf(st)).length;
console.log("contact", byStage("contact"), "conversation", byStage("conversation"), "meetings", byStage("meeting_fixed"), "completed", byStage("completed"));
