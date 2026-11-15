// Live integration test. Creates only isolated disposable test users, then removes them.
// CLI credentials and the service key stay in process memory and are never printed/written.
import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const project = process.argv[2];
if (!/^[a-z]{20}$/.test(project ?? '')) throw new Error('Pass the exact Supabase project ref as the first argument.');
const keys = JSON.parse(execFileSync('supabase', ['projects', 'api-keys', '--project-ref', project, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const url = `https://${project}.supabase.co`;
const anon = keys.find(k => k.name === 'anon')?.api_key;
const secret = keys.find(k => k.name === 'service_role')?.api_key;
if (!anon || !secret) throw new Error('Project API credentials unavailable.');
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: async (input, init) => {
    const response = await fetch(input, { ...init, signal: AbortSignal.timeout(15000) });
    console.log('Test request:', new URL(String(input)).pathname, response.status);
    return response;
  } },
};
const admin = createClient(url, secret, options); const anonymous = createClient(url, anon, options);
const users = []; const clients = [];
const journal = { version: 1, routines: [], days: {}, weeks: {} };
const rpc = (client, id, revision, document = journal) => client.rpc('put_routine_journal', { expected_account_id: id, expected_revision: revision, document }).single();
try {
  for (let i = 0; i < 2; i++) {
    const email = `routine-integration-${randomUUID()}@example.com`; const password = `${randomBytes(24).toString('base64url')}aA1!`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { routine_integration_test: true } });
    if (error) throw new Error(`Test user creation failed (${error.status}).`);
    users.push(data.user.id);
    const client = createClient(url, anon, options);
    const login = await client.auth.signInWithPassword({ email, password });
    assert.equal(login.error, null); clients.push(client);
  }
  assert.ok((await anonymous.from('routine_journals').select('user_id')).error, 'Anonymous reads must be denied');
  assert.ok((await rpc(anonymous, users[0], 0)).error, 'Anonymous writes must be denied');
  const first = await rpc(clients[0], users[0], 0); assert.equal(first.error, null); assert.equal(first.data.revision, 1);
  const own = await clients[0].from('routine_journals').select('document,revision'); assert.equal(own.error, null); assert.equal(own.data.length, 1);
  const other = await clients[1].from('routine_journals').select('user_id'); assert.equal(other.error, null); assert.deepEqual(other.data, []);
  assert.equal((await rpc(clients[1], users[0], 1)).error?.code, '42501', 'Account mismatch must be rejected');
  assert.ok((await clients[1].from('routine_journals').update({ document: journal }).eq('user_id', users[0])).error, 'Direct table writes must be denied');
  const second = await rpc(clients[1], users[1], 0); assert.equal(second.error, null);
  assert.equal((await rpc(clients[0], users[0], 0)).error?.code, 'PT409', 'Stale creation must not overwrite');
  const concurrent = await Promise.all([rpc(clients[0], users[0], 1), rpc(clients[0], users[0], 1)]);
  assert.equal(concurrent.filter(x => !x.error).length, 1); assert.equal(concurrent.filter(x => x.error?.code === 'PT409').length, 1);
  assert.ok((await rpc(clients[0], users[0], 2, {})).error, 'Malformed documents must be rejected');
  console.log('PASS: login, own reads/writes, anonymous denial, account isolation, direct-write denial, atomic conflict detection, document constraint.');
} finally {
  let failed = false;
  for (const id of users) { const result = await admin.auth.admin.deleteUser(id); if (result.error) failed = true; }
  if (failed) throw new Error('Disposable test user cleanup failed. Check the Supabase Auth test-user list.');
  console.log('Disposable test accounts and their journals removed.');
}
