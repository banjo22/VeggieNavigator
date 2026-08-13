import { useState } from "react";
import { Alert } from "react-native";
import { AppScreen } from "@/components/ui";
import { AuthForm, AppInput } from "@/components/AuthForm";
import { useAuth } from "@/auth/AuthProvider";
export default function Forgot() {
  const { error, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      await requestPasswordReset(email);
      Alert.alert(
        "E-Mail gesendet",
        "Öffne den Link auf diesem Gerät, um dein Passwort zu ändern.",
      );
    } catch {
    } finally {
      setLoading(false);
    }
  };
  return (
    <AppScreen>
      <AuthForm
        title="Passwort zurücksetzen"
        copy="Wir senden dir einen sicheren Link an deine E-Mail-Adresse."
        error={error}
        primaryTitle="Reset-Link senden"
        loading={loading}
        onPrimary={submit}
      >
        <AppInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="E-Mail-Adresse"
        />
      </AuthForm>
    </AppScreen>
  );
}
