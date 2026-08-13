import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { HeartOff } from "lucide-react-native";
import { AppInput, AppScreen, EmptyState, StatusBadge } from "@/components/ui";
import { useAppStore } from "@/store/AppStore";
import { colors, radius, space, type } from "@/theme";
export default function Favorites() {
  const router = useRouter();
  const { favorites, toggleFavorite } = useAppStore();
  const [query, setQuery] = useState("");
  const items = useMemo(
    () =>
      favorites.filter((x) =>
        `${x.name} ${x.brand ?? ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [favorites, query],
  );
  return (
    <AppScreen>
      <AppInput
        value={query}
        onChangeText={setQuery}
        placeholder="Favoriten durchsuchen"
      />
      {items.length ? (
        items.map((item) => (
          <Pressable
            style={s.row}
            key={item.code}
            onPress={() =>
              router.push({ pathname: "/result", params: { code: item.code } })
            }
          >
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.title}>{item.name}</Text>
              {item.brand ? <Text style={s.brand}>{item.brand}</Text> : null}
              <StatusBadge status={item.status} />
            </View>
            <Pressable
              accessibilityLabel="Aus Favoriten entfernen"
              hitSlop={12}
              onPress={() => toggleFavorite(item)}
            >
              <HeartOff color={colors.danger} />
            </Pressable>
          </Pressable>
        ))
      ) : (
        <EmptyState
          title={query ? "Kein Favorit gefunden" : "Noch keine Favoriten"}
          text={
            query
              ? "Versuche einen anderen Suchbegriff."
              : "Speichere Produkte und Analysen direkt auf der Ergebnisseite."
          }
        />
      )}
    </AppScreen>
  );
}
const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.lg,
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: type.body, fontWeight: "800", color: colors.text },
  brand: { fontSize: type.caption, color: colors.textMuted },
});
