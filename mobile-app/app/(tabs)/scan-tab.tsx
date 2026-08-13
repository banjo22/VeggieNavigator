import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Barcode,
  Camera,
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
          title="Zutaten"
          onPress={() => router.push("/photo?mode=ingredients")}
        />
        <Action
          icon={Utensils}
          title="Speisekarte"
          onPress={() => router.push("/photo?mode=menu")}
        />
      </View>
      <SecondaryButton
        title="Bild aus Galerie auswählen"
        onPress={() => router.push("/photo?mode=ingredients&source=gallery")}
      />
    </AppScreen>
  );
}
function Action({
  icon: Icon,
  title,
  onPress,
}: {
  icon: typeof Camera;
  title: string;
  onPress: () => void;
}) {
  return (
    <View style={s.action}>
      <Icon color={colors.primary} />
      <Text style={s.actionTitle}>{title}</Text>
      <PrimaryButton title="Auswählen" onPress={onPress} />
    </View>
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
  row: { flexDirection: "row", gap: space.md },
  action: {
    flex: 1,
    padding: space.lg,
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionTitle: { fontSize: type.card, fontWeight: "700", color: colors.text },
});
