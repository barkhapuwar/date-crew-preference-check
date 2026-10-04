"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { LearnedEntry } from "./types";

export type LogEvent =
  | { type: "send"; clientId: string; profileId: string; status: string; at: number }
  | { type: "override"; clientId: string; profileId: string; reason: string; at: number }
  | { type: "rejection"; clientId: string; profileId: string; text: string; tags: string[]; avoidable: boolean; at: number };

type State = { learned: Record<string, LearnedEntry[]>; log: LogEvent[]; focus?: string };
const EMPTY: State = { learned: {}, log: [] };
const KEY = "dc-prototype-v1";

type Ctx = {
  state: State;
  ready: boolean;
  addLearned: (clientId: string, entries: LearnedEntry[]) => void;
  logEvent: (e: LogEvent) => void;
  setFocus: (clientId: string) => void;
  reset: () => void;
};
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      // storage unavailable: the demo still works for this page view
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, ready]);

  const addLearned = useCallback((clientId: string, entries: LearnedEntry[]) => {
    setState((s) => ({ ...s, learned: { ...s.learned, [clientId]: [...(s.learned[clientId] ?? []), ...entries] } }));
  }, []);
  const logEvent = useCallback((e: LogEvent) => setState((s) => ({ ...s, log: [...s.log, e] })), []);
  const setFocus = useCallback((clientId: string) => setState((s) => (s.focus === clientId ? s : { ...s, focus: clientId })), []);
  const reset = useCallback(() => setState(EMPTY), []);

  return <StoreCtx.Provider value={{ state, ready, addLearned, logEvent, setFocus, reset }}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
