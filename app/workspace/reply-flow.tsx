"use client";
import { useState } from "react";
import { describePreference, formatValue, LEARNED_THRESHOLD, violates } from "@/lib/checker";
import { REASONS, REASON_BY_ID } from "@/lib/taxonomy";
import { useStore } from "@/lib/store";
import type { Client, LearnedEntry, Profile } from "@/lib/types";
import type { Tag } from "@/lib/tagger";

const SAMPLES = [
  "Lives in a different city. I want someone close to me.",
  "Too far from where I live, that's a problem.",
  "Not attracted to the photos, honestly.",
  "Doesn't want kids and I do. We want different things.",
];

type Kind = "avoidable" | "softer" | "new" | "unknown" | "general";
type Analysis = { kind: Kind; label: string; text: string; learn?: LearnedEntry };

// Inline form for logging a client's rejection of a profile that was shared with them.
export default function ReplyFlow({ client, profile, onBackToShortlist, onClose }: { client: Client; profile: Profile; onBackToShortlist: () => void; onClose: () => void }) {
  const { state, addLearned, logEvent } = useStore();
  const first = client.name.split(" ")[0];
  const learned = state.learned[client.id];

  const [text, setText] = useState("");
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [meta, setMeta] = useState<{ source: string; note?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ label: string; n: number }[] | null>(null);

  function clearResult() {
    setTags(null);
    setPicked([]);
    setMeta(null);
    setDone(null);
    setError(null);
  }

  async function analyse() {
    clearResult();
    setBusy(true);
    try {
      const res = await fetch("/api/tag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "The reply could not be analysed.");
      setTags(body.tags);
      setPicked(body.tags.map((t: Tag) => t.id));
      setMeta({ source: body.source, note: body.note });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The reply could not be analysed.");
    } finally {
      setBusy(false);
    }
  }

  function implication(id: string): Analysis {
    const reason = REASON_BY_ID[id];
    if (!reason.field) return { kind: "general", label: "General", text: "No specific attribute to learn from." };
    const pref = client.preferences.find((p) => p.field === reason.field);
    const value = profile[reason.field];
    if (pref && value !== null && violates(pref, value)) {
      return { kind: "avoidable", label: "Avoidable", text: `${first} had already stated this (${describePreference(pref)}); the profile is ${formatValue(reason.field, value)}. The check would have flagged it.` };
    }
    if (pref) {
      return { kind: "softer", label: "Possibly softer than stated", text: `${first} stated ${describePreference(pref)}, and this profile meets it. The real preference may differ from the stated one.` };
    }
    if (value === null) return { kind: "unknown", label: "No data", text: "The profile does not state this, so nothing can be learned from it." };
    return {
      kind: "new",
      label: "New preference",
      text: `${first} had not mentioned this before. It will be stored as a learned preference (${formatValue(reason.field, value)}).`,
      learn: { tag: id, field: reason.field, value, profileId: profile.id },
    };
  }

  const implications = picked.map((id) => ({ id, a: implication(id) }));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function confirm() {
    const entries = implications.flatMap((x) => (x.a.learn ? [x.a.learn] : []));
    if (entries.length) addLearned(client.id, entries);
    logEvent({ type: "rejection", clientId: client.id, profileId: profile.id, text, tags: picked, avoidable: implications.some((x) => x.a.kind === "avoidable"), at: Date.now() });
    const existing = learned ?? [];
    setDone(entries.map((e) => ({ label: REASON_BY_ID[e.tag].label, n: existing.filter((x) => x.tag === e.tag).length + 1 })));
  }

  return (
    <div className="reply-flow" aria-live="polite">
      <label htmlFor={`reply-${profile.id}`} style={{ marginTop: 12 }}>What did {first} say about {profile.name.split(" ")[0]}?</label>
      <textarea id={`reply-${profile.id}`} value={text} onChange={(e) => { setText(e.target.value); clearResult(); }} placeholder="Paste the client's reply here" disabled={done !== null} />
      {done === null && (
        <div className="samples" aria-label="Sample replies">
          <span className="muted small" style={{ alignSelf: "center" }}>Sample replies:</span>
          {SAMPLES.map((s) => (
            <button key={s} className="sample" onClick={() => { setText(s); clearResult(); }}>{s}</button>
          ))}
        </div>
      )}
      {done === null && <button className="btn primary" onClick={analyse} disabled={busy || text.trim().length === 0}>{busy ? "Analysing…" : "Analyse reply"}</button>}
      {error && <p role="alert" style={{ color: "var(--block-fg)" }}>{error}</p>}

      {tags && (
        <div style={{ marginTop: 16 }}>
          <h3>Reasons identified</h3>
          <div>
            {picked.map((id) => <span key={id} className="chip learned">{REASON_BY_ID[id].label}</span>)}
            {picked.length === 0 && <span className="muted small">No reason selected.</span>}
          </div>
          {tags.filter((t) => t.evidence && picked.includes(t.id)).map((t) => (
            <p key={t.id} className="small muted" style={{ margin: "2px 0" }}>{t.label}: &ldquo;{t.evidence}&rdquo;</p>
          ))}
          <p className="small muted" style={{ margin: "8px 0" }}>
            {meta?.source === "gemini" ? "Identified by AI (Gemini)." : "Identified by keyword matching."} {meta?.note} The matchmaker confirms before anything is saved.
          </p>
          {done === null && (
            <details style={{ margin: "8px 0 4px" }}>
              <summary className="small" style={{ cursor: "pointer", color: "var(--accent)", fontWeight: 600 }}>Edit reasons</summary>
              <div style={{ marginTop: 10 }}>
                {REASONS.map((r) => (
                  <button key={r.id} className={`chip chip-btn ${picked.includes(r.id) ? "on" : ""}`} onClick={() => toggle(r.id)} aria-pressed={picked.includes(r.id)}>
                    {r.label}
                  </button>
                ))}
              </div>
            </details>
          )}

          <h3 style={{ marginTop: 16 }}>Implications</h3>
          {implications.map(({ id, a }) => (
            <div key={id} className={`implication ${a.kind}`}>
              <b>{REASON_BY_ID[id].label} · {a.label}.</b> {a.text}
            </div>
          ))}
          {done === null && (
            <div style={{ marginTop: 14 }}>
              <button className="btn primary" onClick={confirm} disabled={picked.length === 0}>Confirm and save</button>
            </div>
          )}

          {done && (
            <div style={{ marginTop: 14 }}>
              <p className="ok" style={{ margin: "0 0 8px" }}>Saved. The client record on the left is updated.</p>
              {done.map((d) => (
                <div key={d.label} style={{ margin: "8px 0", maxWidth: 480 }}>
                  <div className="small">
                    <b>{d.label}</b>: {Math.min(d.n, LEARNED_THRESHOLD)} of {LEARNED_THRESHOLD} rejections.{" "}
                    {d.n >= LEARNED_THRESHOLD ? `Checks for ${first} now warn on similar profiles.` : "Checks start warning once the threshold is reached."}
                  </div>
                  <div className="track" style={{ marginTop: 6 }}><div className="fill" style={{ width: `${(Math.min(d.n, LEARNED_THRESHOLD) / LEARNED_THRESHOLD) * 100}%` }} /></div>
                </div>
              ))}
              {done.length === 0 && <p className="small muted">Nothing new to store from this reply.</p>}
              <div className="row-gap" style={{ marginTop: 14 }}>
                {done.some((d) => d.n >= LEARNED_THRESHOLD)
                  ? <button className="btn primary" onClick={onBackToShortlist}>Back to the shortlist to see the new warning</button>
                  : <span className="muted small">To see the system learn, log a second rejection for the same reason on another shared profile.</span>}
                <button className="btn" onClick={onClose}>Close</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
