import { initialJournal, parseJournal } from './domain.ts';
import type { Journal } from './domain';
import { journalsEqual, mergeJournals } from './sync.ts';
import type { Envelope, RemoteJournal } from './sync';

export const GUEST_KEY = 'harugyeol.local.v2:guest';
export type SyncStatus = 'guest' | 'pending' | 'syncing' | 'synced' | 'offline' | 'conflict';
type State = { envelope: Envelope; ready: boolean; error: string; saved: boolean; status: SyncStatus; conflicts: number };
export type EngineIO = {
  read: (key: string) => Promise<string | null>;
  write: (key: string, value: string) => Promise<void>;
  fetch: (accountId: string) => Promise<RemoteJournal | null>;
  push: (accountId: string, journal: Journal, revision: number) => Promise<RemoteJournal>;
};
export async function readGuest(io: Pick<EngineIO, 'read'>) {
  const envelope = await io.read(GUEST_KEY);
  if (envelope) return parseJournal(JSON.stringify(JSON.parse(envelope).journal));
  const legacy = await io.read('harugyeol.journal.v1');
  return legacy ? parseJournal(legacy) : null;
}
export class JournalEngine {
  private state: State;
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  private version = 0;
  private running = false;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  readonly key: string;
  readonly accountId: string | null;
  private io: EngineIO;
  constructor(accountId: string | null, io: EngineIO) {
    this.accountId = accountId; this.io = io;
    this.key = accountId ? `harugyeol.local.v2:${accountId}` : GUEST_KEY;
    this.state = { envelope: { journal: initialJournal(), base: null, dirty: false }, ready: false, error: '', saved: true, status: accountId ? 'pending' : 'guest', conflicts: 0 };
  }
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private publish(patch: Partial<State>) { if (this.stopped) return; this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  async load() {
    try {
      const raw = await this.io.read(this.key);
      if (this.stopped) return;
      let envelope = this.state.envelope;
      if (raw) {
        const parsed = JSON.parse(raw) as Envelope;
        const journal = parseJournal(JSON.stringify(parsed.journal));
        if (typeof parsed.dirty !== 'boolean') throw new Error('Invalid local state');
        const base = parsed.base === null ? null : { revision: parsed.base.revision, journal: parseJournal(JSON.stringify(parsed.base.journal)) };
        if (base && (!Number.isInteger(base.revision) || base.revision < 1)) throw new Error('Invalid local revision');
        envelope = { journal, base, dirty: parsed.dirty };
      } else if (!this.accountId) {
        const legacy = await readGuest(this.io);
        if (legacy) envelope = { journal: legacy, base: null, dirty: false };
      }
      this.publish({ envelope, ready: true });
      await this.persist();
      if (!this.stopped && this.accountId) await this.sync();
    } catch { this.publish({ error: '기기 기록을 불러오지 못했습니다. 기존 기록을 보존했습니다. 앱을 다시 열어주세요.' }); }
  }
  edit(fn: (journal: Journal) => Journal) {
    if (!this.state.ready || this.stopped) return;
    const journal = parseJournal(JSON.stringify(fn(this.state.envelope.journal)));
    this.publish({ envelope: { ...this.state.envelope, journal, dirty: !!this.accountId }, saved: false, status: this.state.status === 'conflict' ? 'conflict' : this.accountId ? 'pending' : 'guest' });
    void this.persist().then(() => this.schedule());
  }
  private async persist() {
    const stamp = ++this.version; const serialized = JSON.stringify(this.state.envelope);
    this.queue = this.queue.catch(() => {}).then(() => this.io.write(this.key, serialized)).then(() => {
      if (stamp === this.version) this.publish({ saved: true, error: '' });
    }).catch(() => { if (stamp === this.version) this.publish({ saved: false, error: '기기에 저장하지 못했습니다. 저장 재시도를 눌러주세요.' }); });
    await this.queue;
  }
  private schedule() {
    if (!this.accountId || this.stopped || this.state.status === 'conflict') return;
    clearTimeout(this.timer); this.timer = setTimeout(() => { void this.sync(); }, 900);
  }
  async retry() { if (!this.state.ready) { await this.load(); return; } await this.persist(); await this.sync(); }
  async sync(resolution?: 'local' | 'remote') {
    if (!this.accountId || this.stopped || !this.state.ready || this.running || (this.state.status === 'conflict' && !resolution)) return;
    this.running = true;
    try {
      await this.queue;
      if (!this.state.saved || this.stopped) return;
      this.publish({ status: 'syncing' });
      const remote = await this.io.fetch(this.accountId);
      if (this.stopped) return;
      const local = this.state.envelope;
      let candidate = local.journal;
      if (remote) {
        if (!local.dirty) candidate = remote.journal;
        else if (local.base) {
          const merged = mergeJournals(local.base.journal, local.journal, remote.journal, resolution);
          if (merged.conflicts.length && !resolution) { this.publish({ status: 'conflict', conflicts: merged.conflicts.length }); return; }
          candidate = parseJournal(JSON.stringify(merged.journal));
        } else if (!resolution) { this.publish({ status: 'conflict', conflicts: 1 }); return; }
        else if (resolution === 'remote') candidate = remote.journal;
      } else if (local.base && !resolution) { this.publish({ status: 'conflict', conflicts: 1 }); return; }
      if (remote && journalsEqual(candidate, remote.journal)) {
        this.publish({ envelope: { journal: candidate, base: remote, dirty: false }, status: 'synced', conflicts: 0, saved: false });
        await this.persist(); return;
      }
      const sent = candidate; const atSend = local.journal;
      const result = await this.io.push(this.accountId, sent, remote?.revision ?? 0);
      if (this.stopped) return;
      // Preserve edits made while the network request was in flight.
      const current = this.state.envelope.journal;
      const next = journalsEqual(current, atSend) ? result.journal : parseJournal(JSON.stringify(mergeJournals(atSend, current, result.journal, 'local').journal));
      const dirty = !journalsEqual(next, result.journal);
      this.publish({ envelope: { journal: next, base: result, dirty }, status: dirty ? 'pending' : 'synced', conflicts: 0, saved: false });
      await this.persist();
      if (dirty) this.schedule();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      this.publish({ status: code === 'PT409' ? 'pending' : 'offline' });
      if (code === 'PT409') this.schedule();
    } finally { this.running = false; }
  }
  dispose() { this.stopped = true; clearTimeout(this.timer); this.listeners.clear(); }
}
