import { Stack } from "expo-router";
import { colors } from "@/theme";
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: "Konto erstellen" }} />
      <Stack.Screen
        name="forgot-password"
        options={{ title: "Passwort vergessen" }}
      />
      <Stack.Screen
        name="reset-password"
        options={{ title: "Neues Passwort" }}
      />
    </Stack>
  );
}
