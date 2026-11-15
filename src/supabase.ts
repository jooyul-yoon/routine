import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { parseJournal } from './domain';
import type { Journal } from './domain';
import type { RemoteJournal } from './sync';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const timedFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController(); const upstream = init?.signal;
  const onAbort = () => controller.abort();
  if (upstream?.aborted) controller.abort(); else upstream?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), 15_000);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); upstream?.removeEventListener('abort', onAbort); }
};
export const supabase = url && key ? createClient(url, key, {
  global: { fetch: timedFetch },
  auth: { storage: AsyncStorage, storageKey: 'harugyeol.auth.v1', autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, ...(Platform.OS !== 'web' ? { lock: processLock } : {}) },
}) : null;
export async function fetchJournal(accountId: string): Promise<RemoteJournal | null> {
  if (!supabase) throw new Error('Supabase 연결 설정이 필요합니다.');
  const { data, error } = await supabase.from('routine_journals').select('document,revision').eq('user_id', accountId).maybeSingle();
  if (error) throw error;
  return data ? { journal: parseJournal(JSON.stringify(data.document)), revision: data.revision } : null;
}
export async function pushJournal(accountId: string, journal: Journal, revision: number): Promise<RemoteJournal> {
  if (!supabase) throw new Error('Supabase 연결 설정이 필요합니다.');
  const { data, error } = await supabase.rpc('put_routine_journal', { expected_account_id: accountId, expected_revision: revision, document: journal }).single();
  if (error) throw error;
  const row = data as { document: unknown; revision: number };
  return { journal: parseJournal(JSON.stringify(row.document)), revision: row.revision };
}
