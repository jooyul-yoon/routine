import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useAccount } from './account';
import { useJournal } from './store';
import { supabase } from './supabase';
import { Button, Card, colors, s, Section } from './ui';
export const syncLabel = { guest: '기기에만 저장', pending: '서버 저장 대기', syncing: '동기화 중', synced: '서버 동기화 완료', offline: '연결 대기 · 기기에 보관', conflict: '다른 기기의 수정 확인 필요' };
export function AccountPanel() {
  const { session, error: accountError } = useAccount();
  const { status, saved, sync, importGuest, conflicts } = useJournal();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [confirmImport, setConfirmImport] = useState(false); const [confirmLogout, setConfirmLogout] = useState(false);
  const submit = async () => {
    if (!supabase || busy) return;
    setBusy(true); setMessage('');
    try {
      const result = mode === 'signup' ? await supabase.auth.signUp({ email: email.trim(), password }) : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      setPassword('');
      if (mode === 'signup' && !result.data.session) setMessage('확인 메일을 보냈어요. 메일의 링크로 이메일 인증을 마친 후 이 앱으로 돌아와 로그인해주세요.');
    } catch (e) { const code = (e as { code?: string }).code; setMessage(code === 'invalid_credentials' ? '이메일 또는 비밀번호를 확인해주세요.' : code === 'email_not_confirmed' ? '이메일 인증을 먼저 완료해주세요.' : code === 'over_email_send_rate_limit' ? '메일 발송 제한에 도달했어요. 잠시 후 다시 시도해주세요.' : '요청하지 못했어요. 이메일·비밀번호와 인터넷 연결을 확인해주세요.'); }
    finally { setBusy(false); }
  };
  return <><Section title="계정과 동기화" /><Card>
    {session ? <>
      <Text style={s.label}>{session.user.email}</Text><Text style={s.body}>{saved ? syncLabel[status] : '기기에 저장 중…'}</Text>
      <Text style={s.muted}>같은 계정으로 로그인하면 다른 기기에서도 기록을 불러옵니다. 연결 중에는 약 30초마다 확인하며, 변경한 내용은 먼저 기기에 저장합니다.</Text>
      {status === 'conflict' ? <View style={{ gap: 10 }}><Text style={{ color: '#9B4030', lineHeight: 22 }}>다른 기기와 {conflicts}개 항목의 수정이 겹쳤어요. 백업을 보관한 뒤 충돌한 항목에 우선할 기록을 선택해주세요. 동기화 이력이 있는 기록은 충돌하지 않은 변경을 함께 유지합니다. 처음 연결하는 기록은 선택한 쪽의 전체 기록을 사용합니다.</Text><Button title="이 기기의 수정 우선" onPress={() => sync('local')} /><Button title="서버의 수정 우선" secondary onPress={() => sync('remote')} /></View> : <Button title="지금 동기화" disabled={status === 'syncing' || !saved} secondary onPress={() => sync()} />}
      {confirmImport ? <><Text style={{ color: '#9B4030', lineHeight: 22 }}>로그인 전 이 기기에서 작성한 기록으로 현재 계정 기록을 교체합니다. 현재 계정 기록을 먼저 백업해주세요. 다른 기기의 수정과 충돌하면 추가 확인을 요청합니다.</Text><Button title="이 기기 기록을 계정으로 가져오기" onPress={() => { void importGuest().then(ok => { setConfirmImport(false); setMessage(ok ? '기기 기록을 가져왔어요. 서버 동기화 상태를 확인해주세요.' : '가져올 기기 기록이 없어요.'); }).catch(() => setMessage('기기 기록을 읽지 못했습니다.')); }} /><Button title="가져오기 취소" secondary onPress={() => setConfirmImport(false)} /></> : <Button title="로그인 전 기기 기록 가져오기" secondary onPress={() => setConfirmImport(true)} />}
      {confirmLogout ? <><Text style={s.muted}>서버에 아직 반영되지 않은 기록은 이 기기에 남습니다. 같은 계정으로 다시 로그인하면 이어서 동기화합니다.</Text><Button title="로그아웃 확인" disabled={!saved || busy} onPress={() => { setBusy(true); void supabase?.auth.signOut({ scope: 'local' }).then(({ error }) => { if (error) setMessage('로그아웃하지 못했습니다. 다시 시도해주세요.'); }).finally(() => setBusy(false)); }} /><Button title="취소" secondary onPress={() => setConfirmLogout(false)} /></> : <Button title="로그아웃" disabled={!saved} secondary onPress={() => setConfirmLogout(true)} />}
    </> : <>
      <Text style={s.body}>로그인하면 기록을 서버에 보관해요.</Text><Text style={s.muted}>로그인 전 기록은 기기에 남습니다. 로그인 후 ‘기기 기록 가져오기’를 누르면 계정으로 옮길 수 있어요.</Text>
      {!supabase ? <Text style={{ color: '#9B4030' }}>서버 연결 설정이 필요합니다.</Text> : <>
        <Text style={s.label}>이메일</Text><TextInput accessibilityLabel="계정 이메일" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" style={s.input} value={email} onChangeText={setEmail} placeholder="you@example.com" editable={!busy} />
        <Text style={s.label}>비밀번호</Text><TextInput accessibilityLabel="계정 비밀번호" secureTextEntry textContentType={mode === 'signup' ? 'newPassword' : 'password'} autoCapitalize="none" autoCorrect={false} style={s.input} value={password} onChangeText={setPassword} placeholder={mode === 'signup' ? '8자 이상 입력해주세요' : '비밀번호'} editable={!busy} />
        <Button title={busy ? '확인 중…' : mode === 'login' ? '로그인' : '회원가입'} disabled={busy || !email.trim() || password.length < (mode === 'signup' ? 8 : 1)} onPress={() => { void submit(); }} />
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setPassword(''); setMessage(''); }} style={{ padding: 14, alignItems: 'center' }}><Text style={{ color: colors.green }}>{mode === 'login' ? '처음이라면 회원가입' : '이미 계정이 있다면 로그인'}</Text></Pressable>
      </>}
    </>}
    {message || accountError ? <Text accessibilityRole="alert" style={{ color: colors.green, lineHeight: 22 }}>{message || accountError}</Text> : null}
  </Card></>;
}
