import { Tabs, router } from 'expo-router';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.inkSoft,
        tabBarStyle: {
          backgroundColor: t.colors.surface,
          borderTopWidth: 2,
          borderTopColor: t.colors.hairline,
          height: 60,
          paddingBottom: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: { paddingVertical: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        headerStyle: { backgroundColor: t.colors.bg },
        headerTintColor: t.colors.text,
        headerRight: () => (
          <Pressable onPress={() => router.push('/settings')} style={{ paddingHorizontal: 16 }}>
            <Ionicons name="settings-outline" size={22} color={t.colors.text} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="whenbee"
        options={{
          title: 'Whenbee',
          tabBarIcon: ({ color, size }) => <Ionicons name="bug-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="patterns"
        options={{
          title: 'Patterns',
          tabBarIcon: ({ color, size }) => <Ionicons name="pulse-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
