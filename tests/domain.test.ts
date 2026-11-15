import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeRoutines, dayKey, dateOf, emptyDay, initialJournal, monthDays, parseJournal, progress, shiftDay, weekDays } from '../src/domain.ts';

test('local dates cross month/year and Monday week boundaries without UTC conversion', () => {
  assert.equal(dayKey(new Date(2026, 10, 14, 23, 59)), '2026-11-14');
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
  assert.deepEqual(weekDays('2027-01-03'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.equal(dayKey(dateOf('2026-11-14')), '2026-11-14');
});
test('calendar includes leap days and correct month lengths', () => {
  assert.equal(monthDays('2028-02').length, 29); assert.equal(monthDays('2026-02').length, 28); assert.equal(monthDays('2026-11').at(-1), '2026-11-30');
});
test('new routines do not create missed checkboxes before their start date', () => {
  const d = initialJournal('2026-11-14');
  assert.deepEqual(progress(d, ['2026-11-13']), { done: 0, total: 0, percent: 0 });
  d.days['2026-11-14'] = { ...emptyDay(), checks: { wake: true, water: true } };
  assert.deepEqual(progress(d, ['2026-11-14']), { done: 2, total: 8, percent: 25 });
  d.routines.push({ id: 'new', title: '독서', icon: '✧', category: '성장', createdOn: '2026-11-15' });
  assert.equal(progress(d, ['2026-11-14']).total, 8);
  assert.equal(progress(d, ['2026-11-14', '2026-11-15']).total, 17);
});
test('archiving preserves historic progress and excludes checks after archive date', () => {
  const d = initialJournal('2026-11-13'); d.routines[0].archivedOn = '2026-11-14';
  d.days['2026-11-13'] = { ...emptyDay(), checks: { wake: true } };
  d.days['2026-11-14'] = { ...emptyDay(), checks: { wake: true } };
  assert.equal(progress(d, ['2026-11-13']).done, 1); assert.equal(progress(d, ['2026-11-14']).done, 0);
  assert.equal(activeRoutines(d, '2026-11-14').length, 7);
});
test('backup round trip preserves false checks, blank notes, zero sleep and weekly plans', () => {
  const d = initialJournal('2026-11-14'); d.days['2026-11-14'] = { checks: { wake: false, water: true }, tasks: [{ id: 't1', title: '장보기', done: true }], mood: 4, sleep: 0, note: '' };
  d.weeks['2026-11-09'] = { goal: '꾸준히', reward: '휴식', quote: '' };
  assert.deepEqual(parseJournal(JSON.stringify(d)), d);
});
test('rejects invalid and incompatible backups before replacing records', () => {
  assert.throws(() => parseJournal('{')); assert.throws(() => parseJournal('{"version":2}'));
  for (const patch of [ { sleep: 25 }, { mood: 6 }, { checks: { water: 'yes' } }, { tasks: [{}] }, { note: 1 } ]) {
    const d = initialJournal('2026-11-14'); Object.assign(d.days, { '2026-11-14': { ...emptyDay(), ...patch } });
    assert.throws(() => parseJournal(JSON.stringify(d)));
  }
  const d = initialJournal('2026-11-14'); d.routines.push(d.routines[0]); assert.throws(() => parseJournal(JSON.stringify(d)));
  const invalid = initialJournal('2026-11-14'); invalid.days['2026-02-30'] = emptyDay(); assert.throws(() => parseJournal(JSON.stringify(invalid)));
});
