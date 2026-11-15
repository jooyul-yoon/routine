import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { JournalProvider } from '../store';
import { colors, Icon } from '../ui';
export default function Layout() {
  return <JournalProvider><StatusBar style="dark" /><Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.green, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }, tabBarItemStyle: { paddingVertical: 5 } }}>
    <Tabs.Screen name="index" options={{ title: '오늘', tabBarIcon: ({ color }) => <Icon name="sunny-outline" color={color} /> }} />
    <Tabs.Screen name="week" options={{ title: '주간', tabBarIcon: ({ color }) => <Icon name="albums-outline" color={color} /> }} />
    <Tabs.Screen name="month" options={{ title: '월간', tabBarIcon: ({ color }) => <Icon name="calendar-outline" color={color} /> }} />
    <Tabs.Screen name="settings" options={{ title: '내 루틴', tabBarIcon: ({ color }) => <Icon name="options-outline" color={color} /> }} />
  </Tabs></JournalProvider>;
}
