import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import {
  CheckCircle2,
  MapPin,
  Navigation,
  ThumbsDown,
  ThumbsUp,
  UserRound,
} from "lucide-react-native";
import {
  AppScreen,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui";
import { SpotStatus } from "@/components/SpotCard";
import {
  confirmCommunitySpot,
  fetchCommunitySpots,
  reactToCommunitySpot,
} from "@/lib/api";
import { colors, radius, space, type } from "@/theme";
import type { CommunitySpot } from "@/types";
export default function SpotDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [spot, setSpot] = useState<CommunitySpot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const items = await fetchCommunitySpots();
      const found = items.find((x) => x.id === Number(id));
      if (!found) throw new Error("Dieser Spot ist nicht mehr verfügbar.");
      setSpot(found);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Spot konnte nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [id]);
  const confirm = async () => {
    if (!spot || spot.viewerConfirmed) return;
    try {
      setSpot(await confirmCommunitySpot(spot.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bestätigung fehlgeschlagen.");
    }
  };
  const react = async (reaction: "like" | "dislike") => {
    if (!spot) return;
    try {
      setSpot(
        await reactToCommunitySpot(
          spot.id,
          spot.viewerReaction === reaction ? "" : reaction,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reaktion fehlgeschlagen.");
    }
  };
  if (loading)
    return (
      <AppScreen>
        <LoadingState text="Spot wird geladen …" />
      </AppScreen>
    );
  if (!spot)
    return (
      <AppScreen>
        <ErrorState message={error || "Spot nicht gefunden"} onRetry={load} />
      </AppScreen>
    );
  return (
    <AppScreen>
      {spot.imageDataUrl ? (
        <Image
          source={{ uri: spot.imageDataUrl }}
          style={s.hero}
          contentFit="cover"
        />
      ) : (
        <View style={s.heroFallback}>
          <MapPin color={colors.primary} size={54} />
        </View>
      )}
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{spot.name}</Text>
          <Text style={s.place}>{spot.place}</Text>
        </View>
        <SpotStatus status={spot.status} />
      </View>
      {error ? <ErrorState message={error} /> : null}
      <View style={s.trust}>
        <CheckCircle2 color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.trustTitle}>
            {spot.confirmations} Community-Bestätigungen
          </Text>
          <Text style={s.trustCopy}>Zuletzt bestätigt {spot.confirmed}</Text>
        </View>
      </View>
      <SectionTitle>Darum lohnt sich der Spot</SectionTitle>
      <Text style={s.description}>
        {spot.description ||
          "Die Community hat noch keine Beschreibung ergänzt."}
      </Text>
      <View style={s.meta}>
        <Meta label="Kategorie" value={spot.category} />
        <Meta label="Preis" value={spot.price} />
      </View>
      <SectionTitle>Community</SectionTitle>
      <View style={s.actions}>
        <Pressable
          style={[s.action, spot.viewerReaction === "like" && s.active]}
          onPress={() => react("like")}
        >
          <ThumbsUp
            color={spot.viewerReaction === "like" ? "#fff" : colors.primary}
          />
          <Text
            style={[
              s.actionText,
              spot.viewerReaction === "like" && s.activeText,
            ]}
          >
            Hilfreich · {spot.likeCount}
          </Text>
        </Pressable>
        <Pressable
          style={[
            s.action,
            spot.viewerReaction === "dislike" && s.dangerActive,
          ]}
          onPress={() => react("dislike")}
        >
          <ThumbsDown
            color={spot.viewerReaction === "dislike" ? "#fff" : colors.danger}
          />
          <Text
            style={[
              s.actionText,
              spot.viewerReaction === "dislike" && s.activeText,
            ]}
          >
            Nicht aktuell · {spot.dislikeCount}
          </Text>
        </Pressable>
      </View>
      <PrimaryButton
        title={spot.viewerConfirmed ? "Von dir bestätigt" : "Spot bestätigen"}
        disabled={spot.viewerConfirmed}
        onPress={confirm}
      />
      <PrimaryButton
        title="Route öffnen"
        onPress={() =>
          Linking.openURL(
            `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`,
          )
        }
      />
      <View style={s.author}>
        <UserRound color={colors.textMuted} />
        <Text style={s.authorText}>
          Geteilt von {spot.createdByName || "der Veggie-Navigator-Community"}
        </Text>
      </View>
      <Text style={s.notice}>
        Community-Angaben können sich ändern. Prüfe Speisekarte, Zutaten und
        Öffnungszeiten vor Ort.
      </Text>
    </AppScreen>
  );
}
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metaCard}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  hero: { width: "100%", height: 280, borderRadius: radius.xl },
  heroFallback: {
    height: 220,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  head: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  title: { fontSize: type.title, fontWeight: "800", color: colors.text },
  place: {
    fontSize: type.body,
    lineHeight: 23,
    color: colors.textMuted,
    marginTop: 4,
  },
  trust: {
    flexDirection: "row",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  trustTitle: { fontSize: type.body, fontWeight: "800", color: colors.text },
  trustCopy: { fontSize: type.caption, color: colors.textMuted, marginTop: 3 },
  description: { fontSize: type.body, lineHeight: 25, color: colors.text },
  meta: { flexDirection: "row", gap: space.md },
  metaCard: {
    flex: 1,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaLabel: { fontSize: type.caption, color: colors.textMuted },
  metaValue: {
    fontSize: type.body,
    fontWeight: "800",
    color: colors.text,
    marginTop: 4,
  },
  actions: { flexDirection: "row", gap: space.md },
  action: {
    flex: 1,
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  dangerActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  actionText: { fontSize: type.caption, fontWeight: "700", color: colors.text },
  activeText: { color: "#fff" },
  author: { flexDirection: "row", alignItems: "center", gap: space.sm },
  authorText: { fontSize: type.caption, color: colors.textMuted },
  notice: {
    fontSize: type.caption,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: "center",
  },
});
