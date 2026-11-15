import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDay, initialJournal, parseJournal } from '../src/domain.ts';
import { journalsEqual, mergeJournals } from '../src/sync.ts';
import { JournalEngine, GUEST_KEY } from '../src/journal-engine.ts';
import type { EngineIO } from '../src/journal-engine.ts';
import type { RemoteJournal } from '../src/sync.ts';

const clone = <T,>(v: T): T => structuredClone(v);
function harness() {
  const disk = new Map<string, string>(); let remote: RemoteJournal | null = null; let online = true; let failWrite = false; let pushes = 0;
  const io: EngineIO = {
    read: async k => disk.get(k) ?? null,
    write: async (k, v) => { if (failWrite) throw new Error('Disk full'); disk.set(k, v); },
    fetch: async () => { if (!online) throw new Error('offline'); return clone(remote); },
    push: async (_id, journal, revision) => {
      if (!online) throw new Error('offline');
      if ((remote?.revision ?? 0) !== revision) throw { code: 'PT409' };
      pushes++; remote = { journal: clone(journal), revision: revision + 1 }; return clone(remote);
    },
  };
  return { io, disk, remote: () => remote!, setRemote: (v: RemoteJournal) => { remote = v; }, setOnline: (v: boolean) => { online = v; }, failWrite: (v: boolean) => { failWrite = v; }, pushes: () => pushes };
}
test('three-way merge combines independent checkbox, task and routine edits', () => {
  const base = initialJournal('2026-11-14'); base.days['2026-11-14'] = emptyDay();
  const local = clone(base); const remote = clone(base);
  local.days['2026-11-14'].checks.water = true; remote.days['2026-11-14'].checks.wake = true;
  local.days['2026-11-14'].tasks.push({ id: 'a', title: 'local', done: false }); remote.days['2026-11-14'].tasks.push({ id: 'b', title: 'remote', done: true });
  local.routines[0].title = '기상'; remote.routines[0].category = '건강';
  const merged = mergeJournals(base, local, remote);
  assert.deepEqual(merged.conflicts, []); assert.deepEqual(merged.journal.days['2026-11-14'].checks, { water: true, wake: true });
  assert.equal(merged.journal.days['2026-11-14'].tasks.length, 2); assert.equal(merged.journal.routines[0].title, '기상'); assert.equal(merged.journal.routines[0].category, '건강');
});
test('same-field and delete-versus-edit conflicts require an explicit choice', () => {
  const base = initialJournal('2026-11-14'); base.days['2026-11-14'] = { ...emptyDay(), note: 'original' };
  const local = clone(base); const remote = clone(base); local.days['2026-11-14'].note = 'local'; remote.days['2026-11-14'].note = 'remote';
  assert.equal(mergeJournals(base, local, remote).conflicts.length, 1);
  assert.equal(mergeJournals(base, local, remote, 'remote').journal.days['2026-11-14'].note, 'remote');
  delete local.days['2026-11-14']; assert.equal(mergeJournals(base, local, remote).conflicts.length, 1);
});
test('rejects duplicate task IDs before they could collapse during sync', () => {
  const j = initialJournal('2026-11-14'); j.days['2026-11-14'] = { checks: {}, tasks: [{ id: 'same', title: 'a', done: false }, { id: 'same', title: 'b', done: false }] };
  assert.throws(() => parseJournal(JSON.stringify(j)));
});
test('migrates legacy guest records without copying them into another account', async () => {
  const h = harness(); const legacy = initialJournal('2026-10-01'); legacy.days['2026-11-14'] = { ...emptyDay(), note: 'guest only' };
  h.disk.set('harugyeol.journal.v1', JSON.stringify(legacy));
  const guest = new JournalEngine(null, h.io); const account = new JournalEngine('user-a', h.io);
  try { await guest.load(); await account.load(); assert.ok(h.disk.has(GUEST_KEY)); assert.deepEqual(guest.getSnapshot().envelope.journal, legacy); assert.equal(account.getSnapshot().envelope.journal.days['2026-11-14'], undefined); assert.equal(h.remote().journal.days['2026-11-14'], undefined); }
  finally { guest.dispose(); account.dispose(); }
});
test('offline pending edits survive restart then sync after reconnection', async () => {
  const h = harness(); const first = new JournalEngine('a', h.io); await first.load(); h.setOnline(false);
  first.edit(j => ({ ...j, days: { '2026-11-14': { ...emptyDay(), note: 'offline note' } } })); await first.retry(); assert.equal(first.getSnapshot().status, 'offline'); first.dispose();
  const second = new JournalEngine('a', h.io);
  try { await second.load(); assert.equal(second.getSnapshot().envelope.dirty, true); h.setOnline(true); await second.sync(); assert.equal(h.remote().journal.days['2026-11-14'].note, 'offline note'); assert.equal(second.getSnapshot().status, 'synced'); }
  finally { second.dispose(); }
});
test('merges remote edits while preserving newer local edits during upload', async () => {
  const h = harness(); const engine = new JournalEngine('a', h.io); await engine.load();
  let release!: () => void; let started!: () => void; const waiting = new Promise<void>(r => { started = r; }); const gate = new Promise<void>(r => { release = r; }); const original = h.io.push;
  h.io.push = async (...args) => { started(); await gate; return original(...args); };
  try {
    engine.edit(j => ({ ...j, days: { '2026-11-14': { ...emptyDay(), note: 'first' } } }));
    const syncing = engine.retry(); await waiting;
    engine.edit(j => ({ ...j, days: { ...j.days, '2026-11-14': { ...j.days['2026-11-14'], note: 'newer' } } }));
    release(); await syncing;
    assert.equal(engine.getSnapshot().envelope.journal.days['2026-11-14'].note, 'newer'); assert.equal(engine.getSnapshot().envelope.dirty, true);
    await engine.sync(); assert.equal(h.remote().journal.days['2026-11-14'].note, 'newer');
  } finally { engine.dispose(); }
});
test('conflicting notes never silently overwrite and can be explicitly resolved', async () => {
  const h = harness(); const engine = new JournalEngine('a', h.io); await engine.load();
  try {
    engine.edit(j => ({ ...j, days: { '2026-11-14': { ...emptyDay(), note: 'base' } } })); await engine.retry();
    engine.edit(j => ({ ...j, days: { ...j.days, '2026-11-14': { ...j.days['2026-11-14'], note: 'local' } } }));
    const remote = clone(h.remote()); remote.journal.days['2026-11-14'].note = 'other device'; remote.revision++; h.setRemote(remote);
    await engine.retry(); assert.equal(engine.getSnapshot().status, 'conflict'); assert.equal(h.remote().journal.days['2026-11-14'].note, 'other device');
    await engine.sync('local'); assert.equal(h.remote().journal.days['2026-11-14'].note, 'local'); assert.equal(engine.getSnapshot().status, 'synced');
  } finally { engine.dispose(); }
});
test('disk failure blocks cloud uploads and a retry persists the latest changes', async () => {
  const h = harness(); const engine = new JournalEngine('a', h.io); await engine.load(); const before = h.pushes(); h.failWrite(true);
  try {
    engine.edit(j => ({ ...j, weeks: { '2026-11-09': { goal: 'new', reward: '', quote: '' } } })); await engine.retry(); assert.equal(engine.getSnapshot().saved, false); assert.equal(h.pushes(), before);
    h.failWrite(false); await engine.retry(); assert.equal(engine.getSnapshot().saved, true); assert.equal(h.remote().journal.weeks['2026-11-09'].goal, 'new');
  } finally { engine.dispose(); }
});
test('disposed account engine never sends another account data after a pending fetch', async () => {
  const h = harness(); let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  h.io.fetch = async () => { await gate; return null; }; const engine = new JournalEngine('old-account', h.io); const loading = engine.load();
  await new Promise(r => setTimeout(r, 0)); engine.dispose(); release(); await loading; assert.equal(h.pushes(), 0);
  assert.equal(journalsEqual(initialJournal('2026-11-14'), initialJournal('2026-11-14')), true);
});
