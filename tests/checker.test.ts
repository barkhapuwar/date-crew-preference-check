import { test } from "node:test";
import assert from "node:assert/strict";
import { checkProfile } from "../lib/checker";
import type { Client, LearnedEntry, Profile } from "../lib/types";

const client: Client = {
  id: "c1",
  name: "Test Client",
  age: 30,
  gender: "F",
  city: "Mumbai",
  preferences: [
    { field: "smoking", tier: "hard", allowed: ["no"] },
    { field: "children", tier: "hard", allowed: ["wants", "open"] },
    { field: "age", tier: "soft", min: 28, max: 34 },
  ],
  notes: ["Family-oriented"],
};

const base: Profile = {
  id: "p1",
  name: "Test Profile",
  gender: "M",
  profession: "Engineer",
  age: 31,
  heightCm: 175,
  city: "Mumbai",
  religion: "Hindu",
  diet: "vegetarian",
  smoking: "no",
  drinking: "no",
  children: "wants",
  maritalStatus: "never married",
  education: "postgraduate",
};

test("passes when nothing is violated", () => {
  assert.equal(checkProfile(client, base).status, "pass");
});

test("blocks on a deal breaker violation", () => {
  const r = checkProfile(client, { ...base, smoking: "yes" });
  assert.equal(r.status, "block");
  assert.ok(r.findings.some((f) => f.field === "smoking" && f.status === "block"));
});

test("warns on a soft preference violation", () => {
  const r = checkProfile(client, { ...base, age: 40 });
  assert.equal(r.status, "warn");
});

test("a missing field is reported as can't check, not a pass-through of a violation", () => {
  const r = checkProfile(client, { ...base, children: null });
  assert.ok(r.findings.some((f) => f.field === "children" && f.status === "cant_check"));
  assert.equal(r.status, "pass");
});

test("a learned preference stays silent after one rejection and warns after two", () => {
  const one: LearnedEntry[] = [{ tag: "location", field: "city", value: "Pune", profileId: "x" }];
  const two: LearnedEntry[] = [...one, { tag: "location", field: "city", value: "Pune", profileId: "y" }];
  const profile = { ...base, city: "Pune" };
  assert.equal(checkProfile(client, profile, one).status, "pass");
  const r = checkProfile(client, profile, two);
  assert.equal(r.status, "warn");
  assert.ok(r.findings.some((f) => f.source === "learned"));
});

test("learned numeric preference uses a tolerance", () => {
  const entries: LearnedEntry[] = [
    { tag: "height", field: "heightCm", value: 160, profileId: "x" },
    { tag: "height", field: "heightCm", value: 162, profileId: "y" },
  ];
  assert.equal(checkProfile(client, { ...base, heightCm: 163 }, entries).status, "warn");
  assert.equal(checkProfile(client, { ...base, heightCm: 180 }, entries).status, "pass");
});

test("notes are shown but never change the status", () => {
  const r = checkProfile(client, base);
  assert.ok(r.findings.some((f) => f.status === "note"));
  assert.equal(r.status, "pass");
});
