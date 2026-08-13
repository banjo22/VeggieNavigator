import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Barcode,
  Camera,
  Heart,
  History,
  Leaf,
  Search,
  Utensils,
} from "lucide-react-native";
import {
  AppScreen,
  EmptyState,
  SectionTitle,
  StatusBadge,
} from "@/components/ui";
import { useAppStore } from "@/store/AppStore";
import { colors, radius, space, type } from "@/theme";
const actions = [
  { title: "Barcode scannen", icon: Barcode, href: "/scan?mode=barcode" },
  {
    title: "Zutaten fotografieren",
    icon: Camera,
    href: "/photo?mode=ingredients",
  },
  { title: "Speisekarte prüfen", icon: Utensils, href: "/photo?mode=menu" },
  { title: "Alternative suchen", icon: Search, href: "/(tabs)/discover" },
] as const;
export default function Home() {
  const router = useRouter();
  const { profile, scans, favorites } = useAppStore();
  return (
    <AppScreen>
      <View>
        <Text style={s.title}>Guten Morgen, {profile.name}</Text>
        <Text style={s.subtitle}>Was möchtest du prüfen?</Text>
      </View>
      <View style={s.grid}>
        {actions.map(({ title, icon: Icon, href }) => (
          <Pressable
            key={title}
            style={s.action}
            onPress={() => router.push(href)}
            accessibilityLabel={title}
          >
            <View style={s.icon}>
              <Icon color={colors.primary} size={26} />
            </View>
            <Text style={s.actionText}>{title}</Text>
          </Pressable>
        ))}
      </View>
      <SectionTitle
        action={
          <Pressable onPress={() => router.push("/history")}>
            <Text style={s.link}>Alle anzeigen</Text>
          </Pressable>
        }
      >
        Letzte Scans
      </SectionTitle>
      {scans.length ? (
        scans.slice(0, 3).map((scan) => (
          <Pressable
            key={scan.id}
            style={s.row}
            onPress={() =>
              router.push({ pathname: "/result", params: { scanId: scan.id } })
            }
          >
            <View style={s.rowIcon}>
              <Leaf color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{scan.title}</Text>
              <Text style={s.rowSub}>
                {new Date(scan.createdAt).toLocaleDateString("de-DE")}
              </Text>
            </View>
            <StatusBadge status={scan.result.status} />
          </Pressable>
        ))
      ) : (
        <EmptyState
          title="Noch keine Produkte gescannt"
          text="Scanne dein erstes Produkt und erfahre sofort, ob es zu deinem Ziel passt."
        />
      )}
      <View style={s.links}>
        <Pressable style={s.mini} onPress={() => router.push("/favorites")}>
          <Heart color={colors.primary} />
          <Text style={s.miniText}>{favorites.length} Favoriten</Text>
        </Pressable>
        <Pressable style={s.mini} onPress={() => router.push("/history")}>
          <History color={colors.primary} />
          <Text style={s.miniText}>Verlauf</Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}
const s = StyleSheet.create({
  title: { fontSize: type.title, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: type.body, color: colors.textMuted, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  action: {
    width: "48%",
    minHeight: 140,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "space-between",
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontSize: type.body, fontWeight: "700", color: colors.text },
  link: { color: colors.primary, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontWeight: "700", color: colors.text, fontSize: type.body },
  rowSub: { fontSize: type.caption, color: colors.textMuted },
  links: { flexDirection: "row", gap: space.md },
  mini: {
    flex: 1,
    flexDirection: "row",
    gap: space.sm,
    alignItems: "center",
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  miniText: { fontWeight: "700", color: colors.text },
});
