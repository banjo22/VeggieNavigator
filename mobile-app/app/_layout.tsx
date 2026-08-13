import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { AppStoreProvider, useAppStore } from "@/store/AppStore";
import { colors } from "@/theme";
function Gate() {
  const { ready, onboarded } = useAppStore();
  const { ready: authReady, configured, user, passwordRecovery } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (!ready || !authReady) return;
    const inAuth = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";
    if (passwordRecovery && segments.join("/") !== "(auth)/reset-password") {
      router.replace("/(auth)/reset-password");
      return;
    }
    if ((!configured || !user) && !inAuth) {
      router.replace("/(auth)/sign-in");
      return;
    }
    if (configured && user && inAuth) {
      router.replace(onboarded ? "/(tabs)" : "/onboarding");
      return;
    }
    if (user && !onboarded && !inOnboarding) router.replace("/onboarding");
    if (user && onboarded && inOnboarding) router.replace("/(tabs)");
  }, [
    ready,
    authReady,
    configured,
    user,
    passwordRecovery,
    onboarded,
    segments,
    router,
  ]);
  if (!ready || !authReady) return null;
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen
          name="scan"
          options={{ headerShown: false, presentation: "fullScreenModal" }}
        />
        <Stack.Screen name="photo" options={{ title: "Foto analysieren" }} />
        <Stack.Screen name="result" options={{ title: "Analyse" }} />
        <Stack.Screen
          name="menu-result"
          options={{ title: "Speisekartenanalyse" }}
        />
        <Stack.Screen name="history" options={{ title: "Scanverlauf" }} />
        <Stack.Screen name="favorites" options={{ title: "Favoriten" }} />
        <Stack.Screen name="spots" options={{ title: "Community-Spots" }} />
        <Stack.Screen name="create-spot" options={{ title: "Spot teilen" }} />
        <Stack.Screen name="spot/[id]" options={{ title: "Spot-Details" }} />
      </Stack>
    </>
  );
}
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppStoreProvider>
          <Gate />
        </AppStoreProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
