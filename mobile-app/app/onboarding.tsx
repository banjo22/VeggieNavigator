import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Leaf } from "lucide-react-native";
import { AppInput, PrimaryButton, SecondaryButton } from "@/components/ui";
import { useAppStore } from "@/store/AppStore";
import { colors, radius, space, type } from "@/theme";
import type { DietMode } from "@/types";
const goals: [[DietMode, string, string], ...[DietMode, string, string][]] = [
  ["vegan", "Ich lebe vegan.", "Nur vollständig pflanzliche Produkte"],
  ["vegetarian", "Ich lebe vegetarisch.", "Produkte ohne Fleisch und Fisch"],
  [
    "flexitarian",
    "Ich möchte weniger Fleisch essen.",
    "Mehr pflanzliche Alternativen entdecken",
  ],
];
export default function Onboarding() {
  const { completeOnboarding } = useAppStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [choice, setChoice] = useState(goals[0]);
  const [exclusions, setExclusions] = useState("");
  const finish = () =>
    completeOnboarding({
      name: name.trim() || "Du",
      dietMode: choice[0],
      goal: choice[1],
      exclusions: exclusions
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      country: "DE",
      language: "de",
    });
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.progress}>
        <View
          style={[s.progressFill, { width: `${((step + 1) / 3) * 100}%` }]}
        />
      </View>
      <View style={s.body}>
        <View style={s.mark}>
          <Leaf color={colors.primary} />
        </View>
        {step === 0 ? (
          <>
            <Text style={s.title}>Wie dürfen wir dich begrüßen?</Text>
            <Text style={s.copy}>
              Dein Name bleibt zunächst nur auf diesem Gerät.
            </Text>
            <AppInput
              value={name}
              onChangeText={setName}
              placeholder="Vorname"
              autoFocus
            />
          </>
        ) : null}
        {step === 1 ? (
          <>
            <Text style={s.title}>Was ist dein Ernährungsziel?</Text>
            <Text style={s.copy}>
              Wir passen jede Bewertung an dein Ziel an.
            </Text>
            {goals.map((g) => (
              <Pressable
                key={g[0]}
                onPress={() => setChoice(g)}
                style={[s.option, choice[0] === g[0] && s.selected]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.optionTitle}>{g[1]}</Text>
                  <Text style={s.optionCopy}>{g[2]}</Text>
                </View>
                {choice[0] === g[0] ? <Check color={colors.primary} /> : null}
              </Pressable>
            ))}
          </>
        ) : null}
        {step === 2 ? (
          <>
            <Text style={s.title}>Was möchtest du vermeiden?</Text>
            <Text style={s.copy}>
              Optional: Allergien, Unverträglichkeiten oder einzelne Zutaten,
              durch Kommas getrennt.
            </Text>
            <AppInput
              value={exclusions}
              onChangeText={setExclusions}
              placeholder="z. B. Erdnüsse, Gluten"
              multiline
            />
            <Text style={s.notice}>
              Die Analyse ersetzt nicht die Allergenkennzeichnung des
              Herstellers. Prüfe bei Allergien immer die Verpackung und mögliche
              Kreuzkontaminationen.
            </Text>
          </>
        ) : null}
        <View style={{ marginTop: "auto", gap: space.md }}>
          {step < 2 ? (
            <PrimaryButton
              title={step === 0 ? "Ziel auswählen" : "Ausschlüsse angeben"}
              onPress={() => setStep((x) => x + 1)}
              disabled={step === 0 && !name.trim()}
            />
          ) : (
            <PrimaryButton title="Veggie Navigator starten" onPress={finish} />
          )}
          {step > 0 ? (
            <SecondaryButton
              title={step === 2 ? "Optionale Angabe überspringen" : "Zurück"}
              onPress={() =>
                step === 2 && !exclusions ? finish() : setStep((x) => x - 1)
              }
            />
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  progress: { height: 5, backgroundColor: colors.border },
  progressFill: { height: 5, backgroundColor: colors.primary },
  body: { flex: 1, padding: space.xxl, gap: space.lg },
  mark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.xxl,
  },
  title: {
    fontSize: type.title,
    lineHeight: 35,
    fontWeight: "800",
    color: colors.text,
  },
  copy: { fontSize: type.body, lineHeight: 24, color: colors.textMuted },
  option: {
    minHeight: 82,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionTitle: { fontSize: type.body, fontWeight: "700", color: colors.text },
  optionCopy: { fontSize: type.caption, color: colors.textMuted, marginTop: 4 },
  notice: {
    fontSize: type.caption,
    lineHeight: 19,
    color: colors.textMuted,
    backgroundColor: colors.surface,
    padding: space.md,
    borderRadius: radius.md,
  },
});
