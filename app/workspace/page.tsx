"use client";
import { useEffect, useMemo, useState } from "react";
import { demoClients, seedSent } from "@/lib/demo";
import { profileById } from "@/lib/data";
import { activeLearned, describePreference, formatValue, LEARNED_THRESHOLD } from "@/lib/checker";
import { REASON_BY_ID } from "@/lib/taxonomy";
import { shortlistFor } from "@/lib/shortlist";
import { traitsOf } from "@/lib/traits";
import { useStore } from "@/lib/store";
import type { FieldKey, LearnedEntry } from "@/lib/types";
import { LearnedPill, Monogram, ProfileRow, StatusPill, pillKind, type PillKind } from "../ui";
import ReplyFlow from "./reply-flow";

const NO_LEARNED: LearnedEntry[] = [];

const VERDICT: Record<PillKind, { title: string; body: (n: string) => string }> = {
  block: { title: "Blocked", body: (n) => `This profile conflicts with a deal breaker stated by ${n}.` },
  warn: { title: "Warning", body: (n) => `No deal breaker is violated, but the profile does not match ${n}'s preferences.` },
  pass: { title: "Pass", body: (n) => `No conflicts with the preferences ${n} has stated.` },
  cant: { title: "Pass, with gaps", body: (n) => `Some of ${n}'s preferences could not be verified because the profile does not state them.` },
};

type Tab = "shortlist" | "shared";

export default function WorkspacePage() {
  const { state, ready, logEvent, setFocus } = useStore();
  const [clientId, setClientId] = useState(demoClients[0].id);
  const [tab, setTab] = useState<Tab>("shortlist");
  const [selId, setSelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [logId, setLogId] = useState<string | null>(null);
  const [viewedBlock, setViewedBlock] = useState(false);
  const [viewedLearned, setViewedLearned] = useState(false);

  useEffect(() => {
    if (ready && state.focus && demoClients.some((c) => c.id === state.focus)) setClientId(state.focus);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const client = demoClients.find((c) => c.id === clientId)!;
  const first = client.name.split(" ")[0];
  const learned = state.learned[clientId] ?? NO_LEARNED;
  const active = useMemo(() => activeLearned(learned), [learned]);

  // Profiles already shared with this client: pre-seeded earlier sends plus anything sent in this session.
  const seeded = useMemo(() => seedSent(client).map((p) => p.id), [client]);
  const events = useMemo(() => state.log.filter((e) => e.clientId === clientId), [state.log, clientId]);
  const sentIds = useMemo(() => Array.from(new Set([...seeded, ...events.filter((e) => e.type === "send").map((e) => e.profileId)])), [seeded, events]);
  const rejections = useMemo(() => {
    const m = new Map<string, { tags: string[]; text: string }>();
    for (const e of events) if (e.type === "rejection") m.set(e.profileId, { tags: e.tags, text: e.text });
    return m;
  }, [events]);
  const awaitingCount = sentIds.filter((id) => !rejections.has(id)).length;

  const exclude = useMemo(() => new Set(sentIds), [sentIds]);
  const list = useMemo(() => shortlistFor(client, learned, exclude), [client, learned, exclude]);
  const hasLearnedFinding = (c: (typeof list)[number]) => c.result.findings.some((f) => f.source === "learned");
  const selected = list.find((c) => c.profile.id === selId) ?? (active.size > 0 ? list.find((c) => c.result.status === "warn" && hasLearnedFinding(c)) ?? list.find(hasLearnedFinding) : undefined) ?? list.find((c) => c.result.status === "block") ?? list[0];
  const kind = pillKind(selected.result);
  const verdict = VERDICT[kind];

  // Only count a profile as "viewed" while the shortlist is actually on screen.
  useEffect(() => {
    if (tab !== "shortlist") return;
    if (selected.result.status === "block") setViewedBlock(true);
    if (hasLearnedFinding(selected)) setViewedLearned(true);
  }, [tab, selected.profile.id, selected.result.status]); // eslint-disable-line react-hooks/exhaustive-deps

  function switchClient(id: string) {
    setClientId(id);
    setFocus(id);
    setTab("shortlist");
    setSelId(null);
    setReason("");
    setNotice(null);
    setOpenIds([]);
    setLogId(null);
    setViewedBlock(false);
    setViewedLearned(false);
  }
  function toggleOpen(id: string) {
    setOpenIds((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  }
  function chooseCandidate(id: string) {
    setSelId(id);
    setReason("");
  }
  function send() {
    const { profile, result } = selected;
    if (result.status === "block") logEvent({ type: "override", clientId, profileId: profile.id, reason: reason.trim(), at: Date.now() });
    logEvent({ type: "send", clientId, profileId: profile.id, status: result.status, at: Date.now() });
    setNotice(`${profile.name} was sent to ${first}${result.status === "block" ? " with an override" : ""}. It now appears under Shared.`);
    setReason("");
    setSelId(null);
    setOpenIds((o) => (o.includes(profile.id) ? o : [...o, profile.id]));
    setLogId(null);
    setTab("shared");
  }

  const flags = new Map<FieldKey, "bad" | "soft-bad" | "unknown">();
  selected.result.findings.forEach((f) => {
    if (!f.field) return;
    if (f.status === "block") flags.set(f.field, "bad");
    else if (f.status === "warn" && flags.get(f.field) !== "bad") flags.set(f.field, "soft-bad");
    else if (f.status === "cant_check" && !flags.has(f.field)) flags.set(f.field, "unknown");
  });
  const p = selected.profile;
  const basics: { field: FieldKey; text: string }[] = [
    { field: "age", text: `Age ${p.age}` },
    { field: "heightCm", text: formatValue("heightCm", p.heightCm) },
    { field: "city", text: p.city ?? "City not stated" },
  ];
  const issues = selected.result.findings.filter((f) => f.status !== "note");
  const notes = selected.result.findings.filter((f) => f.status === "note");

  // Walkthrough progress, derived from what has actually happened for this client.
  const overrides = events.filter((e) => e.type === "override").length;
  const locationRejections = events.filter((e) => e.type === "rejection" && e.tags.includes("location")).length;
  const locationLearned = learned.filter((e) => e.tag === "location").length;
  const steps = [
    { done: viewedBlock || overrides > 0, text: "Open the profile marked Block in the shortlist and read the result." },
    { done: overrides > 0, text: "Send it anyway, with an override reason." },
    { done: locationRejections > 0, text: "On the Shared tab, log the client's reply using a sample such as “Lives in a different city”." },
    { done: locationLearned >= LEARNED_THRESHOLD, text: "Log a second location rejection on another shared profile." },
    { done: locationLearned >= LEARNED_THRESHOLD && viewedLearned, text: "Return to the shortlist: a profile now carries a learned warning." },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <>
      <div className="ws-head">
        <div className="who">
          <Monogram name={client.name} seed={client.id} size={52} />
          <div>
            <div className="eyebrow" style={{ margin: 0 }}>Client workspace</div>
            <h2>{client.name}</h2>
            <div className="muted small">{client.age} · {client.city}</div>
          </div>
        </div>
        <label className="switch" style={{ margin: 0 }}>
          Switch client
          <select value={clientId} onChange={(e) => switchClient(e.target.value)}>
            {demoClients.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.city}</option>)}
          </select>
        </label>
      </div>

      <details className="card checklist" open>
        <summary>Walkthrough <span className="prog">{doneCount} of {steps.length} done</span></summary>
        <ol>
          {steps.map((s, i) => (
            <li key={i} className={s.done ? "done" : ""}><span className="dot" aria-hidden="true" /><span>{s.text}<span className="sr-only">{s.done ? " (done)" : ""}</span></span></li>
          ))}
        </ol>
      </details>

      <div className="grid two">
        <aside className="card sticky" aria-label={`${first}'s record`}>
          <h3>Deal breakers</h3>
          <div>{client.preferences.filter((x) => x.tier === "hard").map((x) => <span key={x.field} className="chip hard">{describePreference(x)}</span>)}</div>
          <h3 style={{ marginTop: 8 }}>Preferences</h3>
          <div>{client.preferences.filter((x) => x.tier === "soft").map((x) => <span key={x.field} className="chip soft">{describePreference(x)}</span>)}</div>
          {client.notes.length > 0 && (
            <>
              <h3 style={{ marginTop: 8 }}>Also mentioned</h3>
              <div>{client.notes.map((n) => <span key={n} className="chip note">{n}</span>)}</div>
            </>
          )}
          <h3 style={{ marginTop: 8 }}>Learned from rejections</h3>
          {learned.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>None yet. Log a rejection under Shared and it appears here.</p>
          ) : (
            <>
              <div>
                {Object.entries(learned.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.tag]: (acc[e.tag] ?? 0) + 1 }), {})).map(([tag, n]) => (
                  <LearnedPill key={tag} label={REASON_BY_ID[tag]?.label ?? tag} count={n} threshold={LEARNED_THRESHOLD} />
                ))}
              </div>
              <p className="muted small" style={{ margin: "4px 0 0" }}>Half filled: logged, not yet applied to checks.</p>
            </>
          )}
        </aside>

        <div>
          <div className="tabs" role="tablist" aria-label="Workspace sections">
            <button role="tab" aria-selected={tab === "shortlist"} className={`tab ${tab === "shortlist" ? "on" : ""}`} onClick={() => { setTab("shortlist"); setNotice(null); }}>
              Shortlist<span className="count">{list.length}</span>
            </button>
            <button role="tab" aria-selected={tab === "shared"} className={`tab ${tab === "shared" ? "on" : ""}`} onClick={() => setTab("shared")}>
              Shared with {first}<span className="count">{sentIds.length}</span>
            </button>
          </div>

          {notice && <div className="notice" role="status">{notice}</div>}

          {tab === "shortlist" && (
            <div className="grid">
              <div className="card" style={{ padding: 0 }}>
                <div className="rows">
                  {list.map((c) => (
                    <ProfileRow key={c.profile.id} profile={c.profile} selected={c.profile.id === selected.profile.id} onClick={() => chooseCandidate(c.profile.id)} right={<StatusPill kind={pillKind(c.result)} />} />
                  ))}
                </div>
              </div>

              <div className="card" aria-live="polite">
                <div className="profile-head">
                  <Monogram name={p.name} seed={p.id} size={64} />
                  <div>
                    <h2>{p.name}, {p.age}</h2>
                    <div className="muted">{p.profession} · {p.city}</div>
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  {basics.map((b) => <span key={b.field} className={`chip ${flags.get(b.field) ?? ""}`}>{b.text}</span>)}
                  {traitsOf(p).map((t) => <span key={t.field} className={`chip ${flags.get(t.field) ?? ""}`}>{t.text}</span>)}
                </div>

                <div className={`verdict ${kind}`}>
                  <p className="title">{verdict.title}</p>
                  <div>{verdict.body(first)}</div>
                  {issues.length > 0 && <ul className="reasons">{issues.map((f, i) => <li key={i}>{f.message}</li>)}</ul>}
                </div>
                {notes.map((f, i) => <p key={i} className="muted small" style={{ margin: "4px 0" }}>{f.message}</p>)}

                {selected.result.status === "block" && (
                  <div style={{ margin: "16px 0 4px" }}>
                    <label htmlFor="reason">Reason for override (required to send)</label>
                    <input id="reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why should this profile be sent despite the deal breaker?" />
                  </div>
                )}
                <div className="row-gap" style={{ marginTop: 16 }}>
                  <button className="btn primary" onClick={send} disabled={selected.result.status === "block" && reason.trim().length < 3}>
                    {selected.result.status === "block" ? "Override and send" : "Send to client"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "shared" && (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: "16px 20px 4px" }}>
                <h3>{awaitingCount} awaiting a reply · {sentIds.length - awaitingCount} answered</h3>
              </div>
              {sentIds.map((id) => {
                const profile = profileById.get(id)!;
                const rejected = rejections.get(id);
                const open = openIds.includes(id);
                const logging = logId === id;
                return (
                  <div key={id} className="shared-item">
                    <div className="shared-row">
                      <Monogram name={profile.name} seed={profile.id} size={40} />
                      <span className="who">
                        <button className="shared-toggle" id={`head-${id}`} aria-expanded={open} aria-controls={`panel-${id}`} onClick={() => toggleOpen(id)}>
                          {profile.name}, {profile.age}
                        </button>
                        <span>{profile.profession} · {profile.city} · {seeded.includes(id) ? "Sent earlier" : "Sent in this session"}</span>
                      </span>
                      <span className="actions">
                        {rejected ? (
                          <span className="slot" aria-hidden="true" />
                        ) : (
                          <button className="btn sm log" aria-expanded={logging} onClick={() => setLogId(logging ? null : id)}>
                            {logging ? "Cancel" : "Log rejection"}
                          </button>
                        )}
                        <span className={`pill status ${rejected ? "block" : "neutral"}`}>{rejected ? "Rejected" : "Awaiting reply"}</span>
                      </span>
                      <svg className={`chev ${open ? "open" : ""}`} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    {open && (
                      <div id={`panel-${id}`} role="region" aria-labelledby={`head-${id}`} className="shared-body">
                        <h3 style={{ marginTop: 12 }}>Profile</h3>
                        <div>
                          <span className="chip">Age {profile.age}</span>
                          <span className="chip">{formatValue("heightCm", profile.heightCm)}</span>
                          <span className="chip">{profile.city}</span>
                          {traitsOf(profile).map((t) => <span key={t.field} className="chip">{t.text}</span>)}
                        </div>
                        {rejected && !logging && (
                          <>
                            <h3 style={{ marginTop: 12 }}>Rejected by {first}</h3>
                            <p style={{ margin: "0 0 8px" }}>&ldquo;{rejected.text}&rdquo;</p>
                            <div>{rejected.tags.map((t) => <span key={t} className="chip learned">{REASON_BY_ID[t]?.label ?? t}</span>)}</div>
                          </>
                        )}
                      </div>
                    )}

                    {logging && (
                      <div className="shared-body">
                        <ReplyFlow
                          client={client}
                          profile={profile}
                          onClose={() => setLogId(null)}
                          onBackToShortlist={() => { setTab("shortlist"); setSelId(null); setNotice(null); setLogId(null); }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
