import { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen } from "@/components/ui";
import { AuthForm, AppInput } from "@/components/AuthForm";
import { useAuth } from "@/auth/AuthProvider";
export default function Reset() {
  const router = useRouter();
  const { error, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      await updatePassword(password);
      Alert.alert("Passwort geändert");
      router.replace("/(tabs)/profile");
    } catch {
    } finally {
      setLoading(false);
    }
  };
  return (
    <AppScreen>
      <AuthForm
        title="Neues Passwort"
        copy="Wähle ein neues Passwort mit mindestens sechs Zeichen."
        error={error}
        primaryTitle="Passwort speichern"
        loading={loading}
        onPrimary={submit}
      >
        <AppInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Neues Passwort"
        />
      </AuthForm>
    </AppScreen>
  );
}
