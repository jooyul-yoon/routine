import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
type Account = { session: Session | null; ready: boolean; error: string };
const Context = createContext<Account>({ session: null, ready: false, error: '' });
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account>({ session: null, ready: !supabase, error: '' });
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (active) setAccount({ session, ready: true, error: '' }); });
    supabase.auth.getSession().then(({ error }) => { if (active && error) setAccount({ session: null, ready: true, error: '로그인 정보를 확인하지 못했습니다. 다시 로그인해주세요.' }); }).catch(() => { if (active) setAccount({ session: null, ready: true, error: '로그인 정보를 확인하지 못했습니다. 다시 로그인해주세요.' }); });
    if (Platform.OS !== 'web') supabase.auth.startAutoRefresh();
    const subscription = AppState.addEventListener('change', state => {
      if (Platform.OS === 'web' || !supabase) return;
      if (state === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
    });
    return () => { active = false; data.subscription.unsubscribe(); subscription.remove(); if (Platform.OS !== 'web') supabase?.auth.stopAutoRefresh(); };
  }, []);
  return <Context.Provider value={account}>{children}</Context.Provider>;
}
export const useAccount = () => useContext(Context);
