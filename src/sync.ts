import type { Journal } from './domain';
export type RemoteJournal = { journal: Journal; revision: number };
export type Envelope = { journal: Journal; base: RemoteJournal | null; dirty: boolean };
const equal = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aa = a as Record<string, unknown>; const bb = b as Record<string, unknown>;
  return Object.keys(aa).length === Object.keys(bb).length && Object.keys(aa).every(k => Object.hasOwn(bb, k) && equal(aa[k], bb[k]));
};
export const journalsEqual = (a: Journal, b: Journal) => equal(a, b);
type Resolution = 'local' | 'remote';
export function mergeJournals(base: Journal, local: Journal, remote: Journal, resolution?: Resolution) {
  const conflicts: string[] = [];
  function merge(b: unknown, l: unknown, r: unknown, path: string): unknown {
    if (equal(l, r) || equal(b, r)) return l;
    if (equal(b, l)) return r;
    const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
    if (object(l) && object(r) && (object(b) || b === undefined)) {
      const before = object(b) ? b : {}; const result: Record<string, unknown> = {};
      for (const k of new Set([...Object.keys(before), ...Object.keys(l), ...Object.keys(r)])) {
        const value = merge(before[k], l[k], r[k], path ? `${path}.${k}` : k);
        if (value !== undefined) Object.defineProperty(result, k, { value, enumerable: true, writable: true, configurable: true });
      }
      return result;
    }
    if (Array.isArray(l) && Array.isArray(r) && (Array.isArray(b) || b === undefined) && [...l, ...r, ...(Array.isArray(b) ? b : [])].every(v => object(v) && typeof v.id === 'string')) {
      const before = new Map((Array.isArray(b) ? b : []).map(v => [v.id, v])); const left = new Map(l.map(v => [v.id, v])); const right = new Map(r.map(v => [v.id, v]));
      return [...new Set([...left.keys(), ...right.keys(), ...before.keys()])].map(id => merge(before.get(id), left.get(id), right.get(id), `${path}[${id}]`)).filter(v => v !== undefined);
    }
    conflicts.push(path); return resolution === 'remote' ? r : l;
  }
  return { journal: merge(base, local, remote, '') as Journal, conflicts };
}
