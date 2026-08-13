import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { ShieldCheck, UserRound } from "lucide-react-native";
import { useAuth } from "@/auth/AuthProvider";
import {
  AppInput,
  AppScreen,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
} from "@/components/ui";
import { requestAccountDeletion } from "@/lib/data";
import { useAppStore } from "@/store/AppStore";
import { colors, radius, space, type } from "@/theme";
import type { DietMode } from "@/types";
const diets: [DietMode, string][] = [
  ["vegan", "Vegan"],
  ["vegetarian", "Vegetarisch"],
  ["flexitarian", "Flexitarisch"],
];
export default function Profile() {
  const { user, signOut, requestPasswordReset } = useAuth();
  const { profile, scans, favorites, updateProfile, syncing, syncError } =
    useAppStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [diet, setDiet] = useState(profile.dietMode);
  const [goal, setGoal] = useState(profile.goal);
  const [exclusions, setExclusions] = useState(profile.exclusions.join(", "));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({
        ...profile,
        name: name.trim(),
        dietMode: diet,
        goal: goal.trim(),
        exclusions: exclusions
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      });
      setEditing(false);
    } catch (e) {
      Alert.alert(
        "Speichern fehlgeschlagen",
        e instanceof Error ? e.message : "Bitte erneut versuchen.",
      );
    } finally {
      setSaving(false);
    }
  };
  const reset = async () => {
    if (!user?.email) return;
    try {
      await requestPasswordReset(user.email);
      Alert.alert("E-Mail gesendet", "Öffne den Reset-Link auf diesem Gerät.");
    } catch {}
  };
  const deletion = () =>
    Alert.alert(
      "Kontolöschung anfordern",
      "Dein Konto wird zur Löschung markiert. Private Nutzerdaten werden anschließend entfernt.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschung anfordern",
          style: "destructive",
          onPress: () =>
            user
              ? void requestAccountDeletion(user).then(() =>
                  Alert.alert("Anfrage gespeichert"),
                )
              : undefined,
        },
      ],
    );
  return (
    <AppScreen>
      <View style={s.head}>
        <View style={s.avatar}>
          <UserRound color={colors.primary} size={34} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{profile.name}</Text>
          <Text style={s.copy}>{user?.email}</Text>
          <Text style={s.sync}>
            {syncing
              ? "Wird synchronisiert …"
              : syncError || "Mit Supabase synchronisiert"}
          </Text>
        </View>
      </View>
      <SectionTitle>Dein Profil</SectionTitle>
      {editing ? (
        <View style={s.card}>
          <AppInput
            value={name}
            onChangeText={setName}
            placeholder="Anzeigename"
          />
          <Text style={s.label}>Ernährungsweise</Text>
          <View style={s.diets}>
            {diets.map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setDiet(value)}
                style={[s.diet, diet === value && s.selected]}
              >
                <Text style={[s.dietText, diet === value && s.selectedText]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <AppInput
            value={goal}
            onChangeText={setGoal}
            placeholder="Persönliches Ziel"
          />
          <AppInput
            value={exclusions}
            onChangeText={setExclusions}
            placeholder="Allergien und Ausschlüsse"
            multiline
          />
          <PrimaryButton
            title="Profil speichern"
            loading={saving}
            onPress={save}
          />
          <SecondaryButton
            title="Bearbeitung abbrechen"
            onPress={() => setEditing(false)}
          />
        </View>
      ) : (
        <View style={s.card}>
          <Field
            label="Ernährungsweise"
            value={
              diets.find((x) => x[0] === profile.dietMode)?.[1] ||
              profile.dietMode
            }
          />
          <Field label="Ziel" value={profile.goal} />
          <Field
            label="Allergien und Ausschlüsse"
            value={profile.exclusions.join(", ") || "Keine angegeben"}
          />
          <PrimaryButton
            title="Profil bearbeiten"
            onPress={() => setEditing(true)}
          />
        </View>
      )}
      <View style={s.stats}>
        <Stat value={scans.length} label="Scans" />
        <Stat value={favorites.length} label="Favoriten" />
      </View>
      <SectionTitle>Konto & Sicherheit</SectionTitle>
      <View style={s.card}>
        <SecondaryButton title="Passwort zurücksetzen" onPress={reset} />
        <SecondaryButton title="Abmelden" onPress={signOut} />
        <SecondaryButton title="Kontolöschung anfordern" onPress={deletion} />
      </View>
      <View style={s.notice}>
        <ShieldCheck color={colors.primary} />
        <Text style={s.noticeText}>
          Die Analyse ersetzt keine Allergenkennzeichnung. Private Daten sind
          über Row Level Security ausschließlich deinem Konto zugeordnet.
        </Text>
      </View>
    </AppScreen>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.copy}>{label}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.lg },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: type.title, fontWeight: "800", color: colors.text },
  copy: { fontSize: type.body, color: colors.textMuted },
  sync: { fontSize: type.caption, color: colors.primary, marginTop: 4 },
  card: {
    padding: space.lg,
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: type.caption,
    fontWeight: "800",
    color: colors.textMuted,
    marginBottom: 4,
  },
  value: { fontSize: type.body, color: colors.text },
  diets: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  diet: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.round,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dietText: { color: colors.text },
  selectedText: { color: "#fff", fontWeight: "700" },
  stats: { flexDirection: "row", gap: space.md },
  stat: {
    flex: 1,
    alignItems: "center",
    padding: space.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  statValue: { fontSize: 32, fontWeight: "800", color: colors.primary },
  notice: {
    flexDirection: "row",
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
  },
  noticeText: {
    flex: 1,
    fontSize: type.caption,
    lineHeight: 19,
    color: colors.text,
  },
});
