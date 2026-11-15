import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { AccountProvider, useAccount } from './account';
import { dayKey, emptyDay, emptyWeek } from './domain';
import type { Day, Journal, Week } from './domain';
import { JournalEngine, readGuest } from './journal-engine';
import type { SyncStatus } from './journal-engine';
import { fetchJournal, pushJournal } from './supabase';

type Store = {
  data: Journal; ready: boolean; error: string; saved: boolean; today: string;
  status: SyncStatus; conflicts: number;
  update: (fn: (data: Journal) => Journal) => void;
  updateDay: (key: string, fn: (day: Day) => Day) => void;
  updateWeek: (key: string, patch: Partial<Week>) => void;
  retry: () => void; sync: (resolution?: 'local' | 'remote') => void;
  importGuest: () => Promise<boolean>;
};
const Context = createContext<Store | null>(null);
const io = { read: AsyncStorage.getItem, write: AsyncStorage.setItem, fetch: fetchJournal, push: pushJournal };
export function JournalProvider({ children }: { children: React.ReactNode }) {
  return <AccountProvider><AccountScope>{children}</AccountScope></AccountProvider>;
}
function AccountScope({ children }: { children: React.ReactNode }) {
  const { ready, session, error } = useAccount();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F6F0', gap: 14 }}><ActivityIndicator /><Text>로그인 정보를 확인하고 있어요…{error}</Text></View>;
  const accountId = session?.user.id ?? null;
  return <JournalScope key={accountId ?? 'guest'} accountId={accountId}>{children}</JournalScope>;
}
function JournalScope({ accountId, children }: { accountId: string | null; children: React.ReactNode }) {
  const [engine] = useState(() => new JournalEngine(accountId, io));
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const [today, setToday] = useState(dayKey());
  useEffect(() => {
    void engine.load();
    const timer = setInterval(() => { setToday(dayKey()); void engine.sync(); }, 30_000);
    const sub = AppState.addEventListener('change', value => { if (value === 'active') { setToday(dayKey()); void engine.sync(); } });
    return () => { engine.dispose(); clearInterval(timer); sub.remove(); };
  }, [engine]);
  const update = (fn: (data: Journal) => Journal) => engine.edit(fn);
  return <Context.Provider value={{
    data: state.envelope.journal, ready: state.ready, error: state.error, saved: state.saved, today,
    status: state.status, conflicts: state.conflicts, update,
    retry: () => { void engine.retry(); }, sync: resolution => { void engine.sync(resolution); },
    importGuest: async () => { const guest = await readGuest(io); if (!guest) return false; engine.edit(() => guest); return true; },
    updateDay: (key, fn) => update(old => ({ ...old, days: { ...old.days, [key]: fn(old.days[key] ?? emptyDay()) } })),
    updateWeek: (key, patch) => update(old => ({ ...old, weeks: { ...old.weeks, [key]: { ...(old.weeks[key] ?? emptyWeek()), ...patch } } })),
  }}>{children}</Context.Provider>;
}
export function useJournal() { const value = useContext(Context); if (!value) throw new Error('JournalProvider required'); return value; }
