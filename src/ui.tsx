import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useJournal } from './store';
export const colors = { bg: '#F6F6F0', ink: '#253A32', green: '#3E6652', light: '#EAF0E5', muted: '#7B8479', border: '#E5E8DF', gold: '#D4B777', white: '#FFFFFF' };
export function Icon({ name, size = 22, color = colors.ink }: { name: React.ComponentProps<typeof Ionicons>['name']; size?: number; color?: React.ComponentProps<typeof Ionicons>['color'] }) { return <Ionicons name={name} size={size} color={color} />; }
export function Button({ title, onPress, secondary, disabled }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}><Text style={[s.buttonText, secondary && { color: colors.green }]}>{title}</Text></Pressable>;
}
export function Page({ title, subtitle, action, children }: { title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) {
  const store = useJournal();
  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <View style={s.brandRow}><View style={s.row}><Icon name="leaf-outline" size={20} color={colors.green} /><Text style={s.brand}>하루결</Text></View><Text style={s.overline}>MY DAILY RHYTHM</Text></View>
    <View style={[s.row, { justifyContent: 'space-between', marginBottom: 22 }]}><View style={{ flex: 1 }}><Text style={s.title}>{title}</Text><Text style={s.subtitle}>{subtitle}</Text></View>{action}</View>
    {!store.ready ? <Card><Text style={s.body}>{store.error || '기록을 불러오고 있어요…'}</Text></Card> : <>{store.error ? <Card><Text style={{ color: '#9B4030' }}>{store.error}</Text><Button title="저장 재시도" onPress={store.retry} secondary /></Card> : null}{children}<Text style={s.footer}>{store.saved ? ({ guest: '기기에 저장됨', pending: '기기 저장 완료 · 서버 대기', syncing: '기기 저장 완료 · 동기화 중', synced: '서버 동기화 완료', offline: '기기 저장 완료 · 연결 대기', conflict: '기기 저장 완료 · 수정 충돌 확인 필요' }[store.status]) : '저장 중…'} · 나의 속도로, 하루씩</Text></>}
  </ScrollView></SafeAreaView>;
}
export function Card({ children, green = false }: { children: React.ReactNode; green?: boolean }) { return <View style={[s.card, green && { backgroundColor: colors.green, borderColor: colors.green }]}>{children}</View>; }
export function Section({ title, aside }: { title: string; aside?: React.ReactNode }) { return <View style={[s.row, { justifyContent: 'space-between', marginTop: 24, marginBottom: 12 }]}><Text style={s.section}>{title}</Text>{aside}</View>; }
export function Field({ label, value, onChange, placeholder, multiline = false }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) { return <View style={{ gap: 8, marginBottom: 16 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted} multiline={multiline} maxLength={3000} style={[s.input, multiline && { minHeight: 90, textAlignVertical: 'top' }]} /></View>; }
export function ProgressBar({ percent, light = false }: { percent: number; light?: boolean }) { return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} style={[s.bar, light && { backgroundColor: '#60826B' }]}><View style={{ width: `${percent}%`, height: '100%', backgroundColor: light ? '#D3DEBD' : colors.green, borderRadius: 10 }} /></View>; }
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, page: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 24, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, marginTop: 8 }, brand: { fontSize: 19, fontWeight: '700', color: colors.ink, letterSpacing: -0.7 },
  overline: { color: colors.muted, letterSpacing: 2, fontSize: 9, fontWeight: '600' }, title: { fontSize: 29, fontWeight: '700', color: colors.ink, letterSpacing: -1.4 }, subtitle: { fontSize: 13, color: colors.muted, marginTop: 8, lineHeight: 21 }, section: { fontSize: 18, fontWeight: '700', letterSpacing: -0.5, color: colors.ink },
  card: { backgroundColor: colors.white, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: colors.border, gap: 12 }, body: { color: colors.ink, fontSize: 15, lineHeight: 24 }, muted: { color: colors.muted, fontSize: 12, lineHeight: 20 }, label: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  button: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', minHeight: 48 }, secondary: { backgroundColor: colors.light }, buttonText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  input: { backgroundColor: '#F6F7F2', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.ink, fontSize: 15, minHeight: 48 },
  bar: { width: '100%', height: 7, backgroundColor: colors.light, borderRadius: 10, overflow: 'hidden' }, footer: { marginTop: 28, textAlign: 'center', fontSize: 11, color: colors.muted },
  dateButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  routineRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }, routineIcon: { height: 44, width: 44, backgroundColor: '#F0F2E8', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, checkbox: { height: 28, width: 28, borderRadius: 10, borderWidth: 1.5, borderColor: '#D0D7CA', alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: colors.green, borderColor: colors.green },
});
