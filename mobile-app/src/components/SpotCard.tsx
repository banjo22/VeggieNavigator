import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CheckCircle2, MapPin, ThumbsUp } from "lucide-react-native";
import { colors, radius, space, type } from "../theme";
import type { CommunitySpot } from "../types";
export function SpotCard({
  spot,
  onPress,
  compact = false,
}: {
  spot: CommunitySpot;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${spot.name} öffnen`}
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        compact && s.compact,
        pressed && { opacity: 0.82 },
      ]}
    >
      {spot.imageDataUrl ? (
        <Image
          source={{ uri: spot.imageDataUrl }}
          style={s.image}
          contentFit="cover"
        />
      ) : (
        <View style={s.fallback}>
          <MapPin color={colors.primary} size={30} />
        </View>
      )}
      <View style={s.content}>
        <View style={s.titleRow}>
          <Text style={s.title} numberOfLines={1}>
            {spot.name}
          </Text>
          <SpotStatus status={spot.status} />
        </View>
        <Text style={s.place} numberOfLines={1}>
          {spot.place}
        </Text>
        <Text style={s.description} numberOfLines={compact ? 1 : 2}>
          {spot.description}
        </Text>
        <View style={s.meta}>
          <Text style={s.price}>{spot.price}</Text>
          <View style={s.metaItem}>
            <CheckCircle2 size={14} color={colors.primary} />
            <Text style={s.metaText}>{spot.confirmations}</Text>
          </View>
          <View style={s.metaItem}>
            <ThumbsUp size={14} color={colors.primary} />
            <Text style={s.metaText}>{spot.likeCount}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
export function SpotStatus({ status }: { status: CommunitySpot["status"] }) {
  const meta =
    status === "vegan"
      ? { label: "Vegan", color: colors.vegan, bg: colors.primarySoft }
      : status === "vegetarisch"
        ? { label: "Vegetarisch", color: colors.warning, bg: "#FFF3D9" }
        : status === "vegan moeglich"
          ? { label: "Vegan möglich", color: colors.warning, bg: "#FFF3D9" }
          : { label: "Nicht geeignet", color: colors.danger, bg: "#FDE8E6" };
  return (
    <View style={[s.badge, { backgroundColor: meta.bg }]}>
      <View style={[s.dot, { backgroundColor: meta.color }]} />
      <Text style={[s.badgeText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compact: { width: 330 },
  image: { width: 94, height: 112, borderRadius: radius.md },
  fallback: {
    width: 94,
    height: 112,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1, gap: 5 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: {
    flex: 1,
    fontSize: type.card,
    fontWeight: "800",
    color: colors.text,
  },
  place: { fontSize: type.caption, color: colors.textMuted },
  description: { fontSize: type.caption, lineHeight: 18, color: colors.text },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: "auto",
  },
  price: { fontSize: type.caption, fontWeight: "800", color: colors.primary },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: type.caption, color: colors.textMuted },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.round,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: "800" },
});
