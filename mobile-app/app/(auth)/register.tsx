import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { AppScreen } from "@/components/ui";
import { AuthForm, AppInput } from "@/components/AuthForm";
import { useAuth } from "@/auth/AuthProvider";
export default function Register() {
  const router = useRouter();
  const { error, signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      const state = await signUp(email, password, name);
      if (state === "confirmation_required") {
        Alert.alert(
          "E-Mail bestätigen",
          "Wir haben dir einen Bestätigungslink gesendet.",
        );
        router.replace("/(auth)/sign-in");
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };
  return (
    <AppScreen>
      <AuthForm
        title="Dein Konto"
        copy="Deine privaten Daten werden durch Supabase Row Level Security geschützt."
        error={error}
        primaryTitle="Registrierung abschließen"
        loading={loading}
        onPrimary={submit}
        secondaryTitle="Zur Anmeldung"
        onSecondary={() => router.back()}
      >
        <AppInput
          value={name}
          onChangeText={setName}
          placeholder="Anzeigename"
        />
        <AppInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="E-Mail-Adresse"
        />
        <AppInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Passwort (mindestens 6 Zeichen)"
        />
      </AuthForm>
    </AppScreen>
  );
}
