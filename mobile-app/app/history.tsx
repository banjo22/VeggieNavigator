import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { EmptyState, SecondaryButton, StatusBadge } from "@/components/ui";
import { useAppStore } from "@/store/AppStore";
import { colors, radius, space, type } from "@/theme";
import type { ScanRecord, Suitability } from "@/types";
const typeFilters: ["all" | ScanRecord["type"], string][] = [
  ["all", "Alle"],
  ["barcode", "Barcode"],
  ["ingredients", "Zutaten"],
  ["menu", "Menü"],
];
const statusFilters: ["all" | Suitability, string][] = [
  ["all", "Alle Ergebnisse"],
  ["vegan", "Vegan"],
  ["vegetarian", "Vegetarisch"],
  ["not_suitable", "Nicht geeignet"],
  ["unclear", "Unklar"],
];
export default function History() {
  const router = useRouter();
  const { scans, removeScan, clearScans, refresh, syncing } = useAppStore();
  const [typeFilter, setTypeFilter] =
    useState<(typeof typeFilters)[number][0]>("all");
  const [statusFilter, setStatusFilter] =
    useState<(typeof statusFilters)[number][0]>("all");
  const [limit, setLimit] = useState(20);
  const items = useMemo(
    () =>
      scans
        .filter(
          (x) =>
            (typeFilter === "all" || x.type === typeFilter) &&
            (statusFilter === "all" || x.result.status === statusFilter),
        )
        .slice(0, limit),
    [scans, typeFilter, statusFilter, limit],
  );
  return (
    <View style={s.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={syncing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={s.filters}>
            <FilterRow
              items={typeFilters}
              value={typeFilter}
              setValue={setTypeFilter}
            />
            <FilterRow
              items={statusFilters}
              value={statusFilter}
              setValue={setStatusFilter}
            />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={s.row}
            onPress={() =>
              router.push({ pathname: "/result", params: { scanId: item.id } })
            }
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.title}>{item.title}</Text>
              <Text style={s.date}>
                {new Date(item.createdAt).toLocaleString("de-DE")}
              </Text>
              <StatusBadge status={item.result.status} />
            </View>
            <Pressable
              accessibilityLabel="Scan löschen"
              hitSlop={12}
              onPress={() => removeScan(item.id)}
            >
              <Trash2 color={colors.danger} />
            </Pressable>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        ListEmptyComponent={
          <EmptyState
            title="Keine passenden Scans"
            text="Ändere die Filter oder starte einen neuen Scan."
          />
        }
        ListFooterComponent={
          <View style={s.footer}>
            {items.length < scans.length ? (
              <SecondaryButton
                title="Weitere Scans laden"
                onPress={() => setLimit((x) => x + 20)}
              />
            ) : null}
            {scans.length ? (
              <SecondaryButton
                title="Gesamten Verlauf leeren"
                onPress={clearScans}
              />
            ) : null}
          </View>
        }
      />
    </View>
  );
}
function FilterRow<T extends string>({
  items,
  value,
  setValue,
}: {
  items: readonly [T, string][];
  value: T;
  setValue: (value: T) => void;
}) {
  return (
    <View style={s.chips}>
      {items.map(([id, label]) => (
        <Pressable
          key={id}
          style={[s.chip, value === id && s.selected]}
          onPress={() => setValue(id)}
        >
          <Text style={[s.chipText, value === id && s.selectedText]}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.xl, paddingBottom: 80 },
  filters: { gap: space.sm, marginBottom: space.lg },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: type.caption, color: colors.text },
  selectedText: { color: "#fff", fontWeight: "700" },
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
  date: { fontSize: type.caption, color: colors.textMuted },
  footer: { gap: space.md, marginTop: space.lg },
});
