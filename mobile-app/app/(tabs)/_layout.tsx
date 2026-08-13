import { Tabs } from "expo-router";
import { Compass, Home, ScanLine, UserRound } from "lucide-react-native";
import { colors } from "@/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Start",
          tabBarIcon: ({ color }) => <Home color={color} size={23} />,
        }}
      />
      <Tabs.Screen
        name="scan-tab"
        options={{
          title: "Scannen",
          tabBarIcon: ({ color }) => <ScanLine color="#fff" size={27} />,
          tabBarIconStyle: {
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: colors.primary,
            marginTop: -20,
          },
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Entdecken",
          tabBarIcon: ({ color }) => <Compass color={color} size={23} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => <UserRound color={color} size={23} />,
        }}
      />
    </Tabs>
  );
}
