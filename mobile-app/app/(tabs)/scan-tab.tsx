import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Barcode,
  Camera,
  ChevronRight,
  Image as ImageIcon,
  Utensils,
} from "lucide-react-native";
import { AppScreen, PrimaryButton, SecondaryButton } from "@/components/ui";
import { colors, radius, space, type } from "@/theme";
export default function ScanTab() {
  const router = useRouter();
  useFocusEffect(useCallback(() => {}, []));
  return (
    <AppScreen>
      <Text style={s.title}>Was möchtest du scannen?</Text>
      <Text style={s.copy}>
        Wähle die passende Methode. Bilder werden nur für die Analyse an dein
        Backend übertragen.
      </Text>
      <View style={s.hero}>
        <Barcode color={colors.primary} size={44} />
        <Text style={s.heroTitle}>Produkt per Barcode prüfen</Text>
        <Text style={s.center}>
          Das schnellste Ergebnis mit vorhandenen Produktdaten.
        </Text>
        <PrimaryButton
          title="Kamera öffnen"
          onPress={() => router.push("/scan")}
        />
      </View>
      <View style={s.row}>
        <Action
          icon={Camera}
          title="Zutaten fotografieren"
          description="Für Verpackungen ohne lesbaren Barcode"
          onPress={() => router.push("/photo?mode=ingredients")}
        />
        <Action
          icon={Utensils}
          title="Speisekarte prüfen"
          description="Eine oder mehrere Seiten gemeinsam analysieren"
          onPress={() => router.push("/photo?mode=menu")}
        />
      </View>
      <SecondaryButton
        title="Zutatenbild aus Galerie"
        onPress={() => router.push("/photo?mode=ingredients&source=gallery")}
      />
      <SecondaryButton
        title="Speisekartenbilder aus Galerie"
        onPress={() => router.push("/photo?mode=menu&source=gallery")}
      />
    </AppScreen>
  );
}
function Action({
  icon: Icon,
  title,
  description,
  onPress,
}: {
  icon: typeof Camera;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={onPress}
      style={({ pressed }) => [s.action, pressed ? s.actionPressed : null]}
    >
      <View style={s.actionIcon}>
        <Icon color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.actionTitle}>{title}</Text>
        <Text style={s.actionCopy}>{description}</Text>
      </View>
      <ChevronRight color={colors.textMuted} />
    </Pressable>
  );
}
const s = StyleSheet.create({
  title: { fontSize: type.title, fontWeight: "800", color: colors.text },
  copy: { fontSize: type.body, lineHeight: 24, color: colors.textMuted },
  hero: {
    padding: space.xxl,
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xl,
  },
  heroTitle: { fontSize: type.section, fontWeight: "800", color: colors.text },
  center: { textAlign: "center", color: colors.textMuted, fontSize: type.body },
  row: { gap: space.md },
  action: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.lg,
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionPressed: { opacity: 0.8 },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  actionTitle: { fontSize: type.card, fontWeight: "700", color: colors.text },
  actionCopy: {
    color: colors.textMuted,
    fontSize: type.caption,
    lineHeight: 18,
    marginTop: 3,
  },
});
