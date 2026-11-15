import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { activeRoutines, dateOf, emptyDay, progress, shiftDay, uid, weekDays } from '../domain';
import { useJournal } from '../store';
import { Button, Card, colors, Field, Icon, Page, ProgressBar, s, Section } from '../ui';

function SleepField({ value, onSave }: { value?: number; onSave: (n?: number) => void }) {
  const [draft, setDraft] = useState(value?.toString() ?? ''); const [error, setError] = useState('');
  return <View style={{ gap: 8 }}><Text style={s.label}>수면 시간</Text><View style={s.row}><TextInput accessibilityLabel="수면 시간" style={[s.input, { width: 110 }]} keyboardType="decimal-pad" value={draft} maxLength={5} placeholder="미기록" onChangeText={v => { setDraft(v); setError(''); }} onEndEditing={() => { const n = Number(draft); if (draft.trim() === '') { onSave(undefined); return; } if (Number.isFinite(n) && n >= 0 && n <= 24) onSave(n); else setError('0~24시간으로 입력해주세요.'); }} /><Text style={s.muted}>시간</Text></View>{error ? <Text style={{ color: '#9B4030' }}>{error}</Text> : null}</View>;
}
export default function Today() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { today } = useJournal();
  const valid = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(dateOf(date).getTime());
  const key = valid ? date : today;
  return <Daily key={key} dateKey={key} />;
}
function Daily({ dateKey: key }: { dateKey: string }) {
  const { data, today, updateDay } = useJournal();
  const day = data.days[key] ?? emptyDay(); const isFuture = key > today;
  const routines = activeRoutines(data, key); const p = progress(data, [key]); const week = data.weeks[weekDays(key)[0]];
  const [task, setTask] = useState('');
  const move = (key: string) => router.setParams({ date: key });
  const dateLabel = dateOf(key).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  return <Page title={key === today ? '오늘의 작은 실천' : '하루의 기록'} subtitle={dateLabel} action={<Pressable accessibilityRole="button" accessibilityLabel="루틴 관리" onPress={() => router.push('/settings')} style={s.dateButton}><Icon name="options-outline" size={20} /></Pressable>}>
    <View style={[s.row, { marginBottom: 20, justifyContent: 'space-between' }]}><Pressable accessibilityRole="button" accessibilityLabel="이전 날짜" onPress={() => move(shiftDay(key, -1))} style={s.dateButton}><Icon name="chevron-back" size={18} /></Pressable><Pressable accessibilityRole="button" onPress={() => move(today)} style={{ padding: 12 }}><Text style={s.label}>{key === today ? 'TODAY' : '오늘로 돌아가기'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="다음 날짜" onPress={() => move(shiftDay(key, 1))} style={s.dateButton}><Icon name="chevron-forward" size={18} /></Pressable></View>
    <Card green><View style={[s.row, { justifyContent: 'space-between' }]}><View style={{ flex: 1 }}><Text style={{ color: '#D7E4D1', fontSize: 12 }}>하루를 채우는 나의 루틴</Text><Text style={{ color: 'white', fontSize: 22, fontWeight: '600', marginTop: 10 }}>{p.done === p.total && p.total > 0 ? '오늘의 루틴을 마쳤어요' : '조금씩, 꾸준히 쌓아가요'}</Text></View><Text style={{ color: '#E4EACE', fontSize: 32, fontWeight: '600' }}>{p.percent}<Text style={{ fontSize: 15 }}>%</Text></Text></View><View style={{ marginTop: 10 }}><ProgressBar percent={p.percent} light /></View><Text style={{ color: '#D7E4D1', fontSize: 12 }}>{p.total}개 중 {p.done}개 완료{isFuture ? ' · 미리 계획하는 하루' : ''}</Text></Card>
    {week?.goal ? <View style={[s.row, { marginTop: 18, paddingHorizontal: 8 }]}><Icon name="flag-outline" size={16} color={colors.green} /><Text style={[s.muted, { flex: 1 }]}>이번 주의 방향 · {week.goal}</Text></View> : null}
    <Section title="오늘의 루틴" aside={<Text style={s.muted}>{p.done} / {p.total}</Text>} />
    <Card>{routines.length === 0 ? <><Text style={s.muted}>이 날짜에 등록된 루틴이 없어요.</Text><Button title="내 루틴 관리" onPress={() => router.push('/settings')} secondary /></> : routines.map(r => {
      const checked = !!day.checks[r.id];
      return <Pressable key={r.id} accessibilityRole="checkbox" accessibilityState={{ checked, disabled: isFuture }} accessibilityLabel={r.title} disabled={isFuture} onPress={() => { updateDay(key, d => ({ ...d, checks: { ...d.checks, [r.id]: !d.checks[r.id] } })); Haptics.selectionAsync().catch(() => {}); }} style={({ pressed }) => [s.routineRow, { opacity: pressed ? 0.6 : 1 }]}><View style={s.routineIcon}><Text style={{ fontSize: 25, color: colors.green }}>{r.icon}</Text></View><View style={{ flex: 1, gap: 5 }}><Text style={[s.body, { fontWeight: '500' }, checked && { color: colors.muted, textDecorationLine: 'line-through' }]}>{r.title}</Text><Text style={s.muted}>{r.category}</Text></View><View style={[s.checkbox, checked && s.checked]}>{checked && <Icon name="checkmark" color="white" size={18} />}</View></Pressable>;
    })}{isFuture ? <Text style={s.muted}>루틴 완료와 컨디션은 해당 날짜부터 기록할 수 있어요.</Text> : null}</Card>
    <Section title="오늘 할 일" aside={<Text style={s.muted}>{day.tasks.filter(t => t.done).length} / {day.tasks.length}</Text>} />
    <Card>{day.tasks.length === 0 ? <Text style={s.muted}>오늘 꼭 하고 싶은 일을 적어보세요.</Text> : day.tasks.map(t => <View key={t.id} style={s.row}><Pressable accessibilityRole="checkbox" accessibilityLabel={t.title} accessibilityState={{ checked: t.done }} onPress={() => updateDay(key, d => ({ ...d, tasks: d.tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x) }))} style={[s.row, { flex: 1, minHeight: 48 }]}><View style={[s.checkbox, t.done && s.checked]}>{t.done && <Icon name="checkmark" color="white" size={16} />}</View><Text style={[s.body, { flex: 1 }, t.done && { textDecorationLine: 'line-through', color: colors.muted }]}>{t.title}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`${t.title} 삭제`} onPress={() => updateDay(key, d => ({ ...d, tasks: d.tasks.filter(x => x.id !== t.id) }))} style={{ padding: 12 }}><Icon name="close-outline" size={20} color={colors.muted} /></Pressable></View>)}<View style={s.row}><TextInput accessibilityLabel="새 할 일" placeholder="할 일 추가하기" value={task} onChangeText={setTask} maxLength={200} style={[s.input, { flex: 1 }]} onSubmitEditing={() => { if (!task.trim()) return; updateDay(key, d => ({ ...d, tasks: [...d.tasks, { id: uid(), title: task.trim(), done: false }] })); setTask(''); }} /><Button title="추가" disabled={!task.trim()} onPress={() => { updateDay(key, d => ({ ...d, tasks: [...d.tasks, { id: uid(), title: task.trim(), done: false }] })); setTask(''); }} /></View></Card>
    {!isFuture && <><Section title="나를 돌아보는 시간" /><Card><Text style={s.label}>오늘의 기분</Text><View style={[s.row, { justifyContent: 'space-between', marginBottom: 14 }]}>{['힘듦', '아쉬움', '보통', '좋음', '아주 좋음'].map((label, i) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: day.mood === i + 1 }} accessibilityLabel={`기분 ${label}`} onPress={() => updateDay(key, d => ({ ...d, mood: d.mood === i + 1 ? undefined : i + 1 }))} style={{ alignItems: 'center', flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: day.mood === i + 1 ? colors.light : 'transparent', gap: 8 }}><Text style={{ fontSize: 24 }}>{['😔', '🙁', '😐', '🙂', '😊'][i]}</Text><Text style={{ fontSize: 10, color: colors.muted }}>{label}</Text></Pressable>)}</View><SleepField key={`${key}:${day.sleep}`} value={day.sleep} onSave={sleep => updateDay(key, d => ({ ...d, sleep }))} /><Field label="하루 한 줄" placeholder="오늘 기억하고 싶은 순간은?" multiline value={day.note ?? ''} onChange={note => updateDay(key, d => ({ ...d, note }))} /></Card></>}
  </Page>;
}
