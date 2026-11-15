export type Routine = { id: string; title: string; icon: string; category: string; createdOn: string; archivedOn?: string };
export type Task = { id: string; title: string; done: boolean };
export type Day = { checks: Record<string, boolean>; tasks: Task[]; mood?: number; sleep?: number; note?: string };
export type Week = { goal: string; reward: string; quote: string };
export type Journal = { version: 1; routines: Routine[]; days: Record<string, Day>; weeks: Record<string, Week> };
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dateOf = (key: string) => new Date(`${key}T12:00:00`);
export function shiftDay(key: string, amount: number) { const d = dateOf(key); d.setDate(d.getDate() + amount); return dayKey(d); }
export function weekDays(key: string) { const d = dateOf(key); const start = shiftDay(key, -((d.getDay() + 6) % 7)); return Array.from({ length: 7 }, (_, i) => shiftDay(start, i)); }
export const emptyDay = (): Day => ({ checks: {}, tasks: [] });
export const emptyWeek = (): Week => ({ goal: '', reward: '', quote: '' });
export function initialJournal(today = dayKey()): Journal {
  return { version: 1, routines: [
    ['wake', '7:30 기상', '☀', '생활'], ['bible', '말씀 묵상', '▤', '신앙'], ['prayer', '15분 기도', '✧', '신앙'],
    ['contact', '목원 한 명 연락', '♡', '관계'], ['exercise', '헬스장 / 러닝 / 스포츠', '↗', '건강'],
    ['protein', '프로틴 쉐이크', '◒', '건강'], ['water', '물 2L', '◡', '건강'], ['vitamin', '비타민', '✳', '건강'],
  ].map(([id, title, icon, category]) => ({ id, title, icon, category, createdOn: today })), days: {}, weeks: {} };
}
export const activeRoutines = (data: Journal, key: string) => data.routines.filter(r => r.createdOn <= key && (!r.archivedOn || key < r.archivedOn));
export function progress(data: Journal, keys: string[]) {
  let done = 0; let total = 0;
  for (const key of keys) for (const r of activeRoutines(data, key)) { total++; if (data.days[key]?.checks[r.id]) done++; }
  return { done, total, percent: total ? Math.round(done / total * 100) : 0 };
}
export function monthDays(month: string) { const d = dateOf(`${month}-01`); return Array.from({ length: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`); }
export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const validKey = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(dateOf(key).getTime()) && dayKey(dateOf(key)) === key;
export function parseJournal(text: string): Journal {
  const j = JSON.parse(text) as Journal;
  const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!obj(j) || j.version !== 1 || !Array.isArray(j.routines) || !obj(j.days) || !obj(j.weeks)) throw new Error('지원하지 않는 백업 형식입니다.');
  const ids = new Set<string>();
  for (const r of j.routines) {
    if (!obj(r) || typeof r.id !== 'string' || ids.has(r.id) || !r.id || typeof r.title !== 'string' || !r.title.trim() || typeof r.icon !== 'string' || typeof r.category !== 'string' || !validKey(r.createdOn) || (r.archivedOn !== undefined && (!validKey(r.archivedOn) || r.archivedOn < r.createdOn))) throw new Error('루틴 데이터가 올바르지 않습니다.');
    ids.add(r.id);
  }
  for (const [key, day] of Object.entries(j.days)) {
    if (!validKey(key) || !obj(day) || !obj(day.checks) || Object.values(day.checks).some(v => typeof v !== 'boolean') || !Array.isArray(day.tasks) || day.tasks.some(t => !obj(t) || typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.done !== 'boolean') || (day.mood !== undefined && (!Number.isInteger(day.mood) || day.mood < 1 || day.mood > 5)) || (day.sleep !== undefined && (!Number.isFinite(day.sleep) || day.sleep < 0 || day.sleep > 24)) || (day.note !== undefined && typeof day.note !== 'string')) throw new Error('일별 기록이 올바르지 않습니다.');
  }
  for (const [key, w] of Object.entries(j.weeks)) if (!validKey(key) || weekDays(key)[0] !== key || !obj(w) || ['goal', 'reward', 'quote'].some(k => typeof w[k as keyof Week] !== 'string')) throw new Error('주간 기록이 올바르지 않습니다.');
  return j;
}
