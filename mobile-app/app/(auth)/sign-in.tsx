import { useRouter } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Leaf } from "lucide-react-native";
import { useAuth } from "@/auth/AuthProvider";
import { AuthForm, AppInput } from "@/components/AuthForm";
import { colors, space, type } from "@/theme";
export default function SignIn() {
  const router = useRouter();
  const { configured, error, clearError, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      await signIn(email, password);
    } catch {
    } finally {
      setLoading(false);
    }
  };
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.brand}>
        <Leaf color={colors.primary} size={34} />
        <Text style={s.brandText}>Veggie Navigator</Text>
      </View>
      <AuthForm
        title="Willkommen zurück"
        copy={
          configured
            ? "Melde dich an, um Profil, Scans und Favoriten sicher zu synchronisieren."
            : "Die Mobile-Supabase-Konfiguration fehlt. Trage die öffentlichen Werte in mobile-app/.env ein."
        }
        error={error}
        primaryTitle="Anmelden"
        loading={loading}
        onPrimary={submit}
        secondaryTitle="Konto erstellen"
        onSecondary={() => {
          clearError();
          router.push("/(auth)/register");
        }}
      >
        <AppInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="E-Mail-Adresse"
        />
        <AppInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          placeholder="Passwort"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Passwort vergessen"
          onPress={() => router.push("/(auth)/forgot-password")}
        >
          <Text style={s.link}>Passwort vergessen?</Text>
        </Pressable>
      </AuthForm>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    padding: space.xxl,
    gap: space.huge,
    justifyContent: "center",
  },
  brand: { alignItems: "center", gap: space.sm },
  brandText: { fontSize: type.section, fontWeight: "800", color: colors.text },
  link: { color: colors.primary, fontWeight: "700", textAlign: "right" },
});
