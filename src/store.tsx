import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { dayKey, emptyDay, emptyWeek, initialJournal, parseJournal } from './domain';
import type { Day, Journal, Week } from './domain';

const KEY = 'harugyeol.journal.v1';
type Store = { data: Journal; ready: boolean; error: string; saved: boolean; today: string; update: (fn: (data: Journal) => Journal) => void; updateDay: (key: string, fn: (day: Day) => Day) => void; updateWeek: (key: string, patch: Partial<Week>) => void; retry: () => void };
const Context = createContext<Store | null>(null);
export function JournalProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Journal>(() => initialJournal());
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(true);
  const [today, setToday] = useState(dayKey()); const [revision, setRevision] = useState(0);
  const queue = useRef(Promise.resolve()); const sequence = useRef(0);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY).then(raw => { if (!alive) return; if (raw) setData(parseJournal(raw)); setReady(true); }).catch(() => { if (alive) setError('기록을 불러오지 못했습니다. 앱을 다시 열어주세요. 원본 기록은 덮어쓰지 않았습니다.'); });
    const timer = setInterval(() => setToday(dayKey()), 30_000);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') setToday(dayKey()); });
    return () => { alive = false; clearInterval(timer); sub.remove(); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const seq = ++sequence.current; const text = JSON.stringify(data);
    queue.current = queue.current.catch(() => {}).then(() => AsyncStorage.setItem(KEY, text)).then(() => { if (sequence.current === seq) { setSaved(true); setError(''); } }).catch(() => { if (sequence.current === seq) setError('저장하지 못했습니다. 저장 재시도를 눌러주세요.'); });
  }, [data, ready, revision]);
  const update: Store['update'] = fn => { setSaved(false); setData(old => fn(old)); };
  return <Context.Provider value={{ data, ready, error, saved, today, update, retry: () => setRevision(r => r + 1), updateDay: (key, fn) => update(old => ({ ...old, days: { ...old.days, [key]: fn(old.days[key] ?? emptyDay()) } })), updateWeek: (key, patch) => update(old => ({ ...old, weeks: { ...old.weeks, [key]: { ...(old.weeks[key] ?? emptyWeek()), ...patch } } })) }}>{children}</Context.Provider>;
}
export function useJournal() { const value = useContext(Context); if (!value) throw new Error('JournalProvider required'); return value; }
