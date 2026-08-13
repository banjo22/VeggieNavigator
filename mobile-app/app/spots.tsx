import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { List, LocateFixed, Map as MapIcon, Plus } from "lucide-react-native";
import {
  AppInput,
  EmptyState,
  ErrorState,
  PrimaryButton,
} from "@/components/ui";
import { SpotCard } from "@/components/SpotCard";
import { SpotMap } from "@/components/SpotMap";
import { fetchCommunitySpots } from "@/lib/api";
import { colors, radius, space, type } from "@/theme";
import type { CommunitySpot } from "@/types";
import { SafeAreaView } from "react-native-safe-area-context";
type Filter = "all" | "vegan" | "vegetarisch" | "vegan moeglich" | "confirmed";
export default function Spots() {
  const router = useRouter();
  const [spots, setSpots] = useState<CommunitySpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [mode, setMode] = useState<"map" | "list">("map");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await fetchCommunitySpots();
      setSpots(items);
      setSelectedId((current) =>
        current && items.some((x) => x.id === current)
          ? current
          : (items[0]?.id ?? null),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Spots konnten nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const locate = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setError(
        "Standortzugriff fehlt. Erlaube ihn in den Systemeinstellungen oder nutze die Liste.",
      );
      return;
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    setUserLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
  };
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return spots
      .filter(
        (spot) =>
          (!normalized ||
            `${spot.name} ${spot.place} ${spot.category}`
              .toLowerCase()
              .includes(normalized)) &&
          (filter === "all" || filter === "confirmed"
            ? filter !== "confirmed" || spot.confirmations >= 2
            : spot.status === filter),
      )
      .sort((a, b) =>
        userLocation
          ? distance(userLocation, a) - distance(userLocation, b)
          : b.confirmations - a.confirmations,
      );
  }, [spots, query, filter, userLocation]);
  const selected = visible.find((x) => x.id === selectedId) ?? null;
  return (
    <SafeAreaView style={s.screen} edges={["top", "left", "right"]}>
      <FlatList
        data={mode === "list" ? visible : []}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={s.content}
        ListHeaderComponent={
          <View style={s.header}>
            <View style={s.titleRow}>
              <View>
                <Text style={s.title}>Community-Spots</Text>
                <Text style={s.copy}>
                  {visible.length} pflanzliche Fundorte
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Neuen Spot teilen"
                style={s.add}
                onPress={() => router.push("/create-spot")}
              >
                <Plus color="#fff" />
              </Pressable>
            </View>
            <AppInput
              value={query}
              onChangeText={setQuery}
              placeholder="Spot, Ort oder Kategorie suchen"
            />
            <View style={s.controls}>
              <View style={s.segment}>
                <Pressable
                  style={[s.segmentButton, mode === "map" && s.active]}
                  onPress={() => setMode("map")}
                >
                  <MapIcon
                    size={18}
                    color={mode === "map" ? "#fff" : colors.text}
                  />
                  <Text style={[s.segmentText, mode === "map" && s.activeText]}>
                    Karte
                  </Text>
                </Pressable>
                <Pressable
                  style={[s.segmentButton, mode === "list" && s.active]}
                  onPress={() => setMode("list")}
                >
                  <List
                    size={18}
                    color={mode === "list" ? "#fff" : colors.text}
                  />
                  <Text
                    style={[s.segmentText, mode === "list" && s.activeText]}
                  >
                    Liste
                  </Text>
                </Pressable>
              </View>
              <Pressable
                style={s.locate}
                onPress={locate}
                accessibilityLabel="Meinen Standort verwenden"
              >
                <LocateFixed color={colors.primary} />
              </Pressable>
            </View>
            <View style={s.filters}>
              {(
                [
                  ["all", "Alle"],
                  ["vegan", "Vegan"],
                  ["vegetarisch", "Vegetarisch"],
                  ["vegan moeglich", "Anpassbar"],
                  ["confirmed", "Bestätigt"],
                ] as [Filter, string][]
              ).map(([id, label]) => (
                <Pressable
                  key={id}
                  onPress={() => setFilter(id)}
                  style={[s.chip, filter === id && s.chipActive]}
                >
                  <Text style={[s.chipText, filter === id && s.chipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {error ? <ErrorState message={error} onRetry={load} /> : null}
            {mode === "map" && !error ? (
              <>
                <SpotMap
                  spots={visible}
                  selectedId={selectedId}
                  userLocation={userLocation}
                  onSelect={setSelectedId}
                />
                {selected ? (
                  <SpotCard
                    spot={selected}
                    onPress={() =>
                      router.push({
                        pathname: "/spot/[id]",
                        params: { id: String(selected.id) },
                      })
                    }
                  />
                ) : (
                  <EmptyState
                    title="Keine Spots im Ausschnitt"
                    text="Ändere Filter oder teile den ersten Community-Spot."
                  />
                )}
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <SpotCard
            spot={item}
            onPress={() =>
              router.push({
                pathname: "/spot/[id]",
                params: { id: String(item.id) },
              })
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        ListEmptyComponent={
          mode === "list" && !loading ? (
            <EmptyState
              title="Keine Spots gefunden"
              text="Ändere die Suche oder teile einen neuen Spot."
            />
          ) : null
        }
        ListFooterComponent={<View style={{ height: 80 }} />}
      />
      <View style={s.fab}>
        <PrimaryButton
          title="Spot teilen"
          onPress={() => router.push("/create-spot")}
        />
      </View>
    </SafeAreaView>
  );
}
function distance(
  origin: { latitude: number; longitude: number },
  spot: CommunitySpot,
) {
  const r = 6371;
  const dLat = ((spot.lat - origin.latitude) * Math.PI) / 180;
  const dLng = ((spot.lng - origin.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((origin.latitude * Math.PI) / 180) *
      Math.cos((spot.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.xl, paddingBottom: 120 },
  header: { gap: space.lg, marginBottom: space.lg },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: type.title, fontWeight: "800", color: colors.text },
  copy: { fontSize: type.caption, color: colors.textMuted, marginTop: 4 },
  add: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  controls: { flexDirection: "row", gap: space.sm },
  segment: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.surface,
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderRadius: radius.sm,
  },
  active: { backgroundColor: colors.primary },
  segmentText: { fontWeight: "700", color: colors.text },
  activeText: { color: "#fff" },
  locate: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: type.caption,
    fontWeight: "700",
    color: colors.textMuted,
  },
  chipTextActive: { color: colors.primary },
  fab: { position: "absolute", left: 20, right: 20, bottom: 22 },
});
