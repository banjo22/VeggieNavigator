import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { Heart, Info, Leaf, ShieldAlert } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  EmptyState,
  PrimaryButton,
  SectionTitle,
  StatusBadge,
  statusMeta,
} from "@/components/ui";
import { useAppStore } from "@/store/AppStore";
import { colors, radius, space, type } from "@/theme";
export default function Result() {
  const { code, scanId } = useLocalSearchParams<{
    code?: string;
    scanId?: string;
  }>();
  const { scans, favorites, toggleFavorite } = useAppStore();
  const matchedScan = scans.find(
    (s) => s.id === scanId || s.result.code === code,
  );
  const product =
    matchedScan?.result ?? favorites.find((item) => item.code === code);
  if (!product)
    return (
      <AppScreen>
        <EmptyState
          title="Ergebnis nicht mehr verfügbar"
          text="Öffne den Scan erneut über den Verlauf oder starte eine neue Analyse."
        />
      </AppScreen>
    );
  const meta = statusMeta(product.status);
  const saved = favorites.some((x) => x.code === product.code);
  return (
    <AppScreen>
      <View style={s.product}>
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={s.image}
            contentFit="contain"
          />
        ) : (
          <View style={s.imageFallback}>
            <Leaf color={colors.primary} size={42} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{product.name}</Text>
          {product.brand ? <Text style={s.brand}>{product.brand}</Text> : null}
          <Text style={s.source}>
            Quelle: {product.dataSource ?? "Analyse"}
          </Text>
          {product.code ? (
            <Text style={s.source}>Barcode/ID: {product.code}</Text>
          ) : null}
          {matchedScan ? (
            <Text style={s.source}>
              Analysiert:{" "}
              {new Date(matchedScan.createdAt).toLocaleString("de-DE")}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={[s.status, { backgroundColor: meta.color }]}>
        <meta.Icon size={38} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={s.statusTitle}>{meta.label}</Text>
          <Text style={s.statusText}>{product.reason}</Text>
        </View>
      </View>
      <SectionTitle>Warum?</SectionTitle>
      <View style={s.card}>
        <Info color={colors.primary} />
        <Text style={s.body}>{product.reason}</Text>
      </View>
      <SectionTitle>Problematische Zutaten</SectionTitle>
      {product.problematicIngredients.length ? (
        product.problematicIngredients.map((item) => (
          <View key={item} style={s.ingredient}>
            <ShieldAlert color={colors.danger} />
            <Text style={s.ingredientText}>{item}</Text>
          </View>
        ))
      ) : (
        <View style={s.card}>
          <StatusBadge status="unclear" />
          <Text style={s.body}>
            Keine problematischen Zutaten sicher erkannt.
          </Text>
        </View>
      )}
      {product.uncertainIngredients?.length || product.uncertainties?.length ? (
        <>
          <SectionTitle>Unsicherheiten</SectionTitle>
          <View style={s.card}>
            <StatusBadge status="unclear" />
            <Text style={s.body}>
              {[
                ...(product.uncertainIngredients ?? []),
                ...(product.uncertainties ?? []),
              ].join(" · ")}
            </Text>
          </View>
        </>
      ) : null}
      {product.allergens.length ? (
        <>
          <SectionTitle>Mögliche Allergene</SectionTitle>
          <View style={s.card}>
            <ShieldAlert color={colors.warning} />
            <Text style={s.body}>{product.allergens.join(", ")}</Text>
          </View>
        </>
      ) : null}
      <SectionTitle>Alternativen</SectionTitle>
      {product.alternatives.length ? (
        product.alternatives.map((a) => (
          <View key={a.id} style={s.card}>
            <Leaf color={colors.vegan} />
            <View>
              <Text style={s.ingredientText}>{a.name}</Text>
              <Text style={s.brand}>{a.reason}</Text>
            </View>
          </View>
        ))
      ) : (
        <EmptyState
          title="Noch keine belastbaren Alternativen"
          text="Wir zeigen hier nur Alternativen mit ausreichender Datengrundlage."
        />
      )}
      <Text style={s.allergen}>
        Die Analyse ersetzt nicht die Allergenkennzeichnung des Herstellers.
        Prüfe bei Allergien immer die Verpackung und mögliche
        Kreuzkontaminationen.
      </Text>
      <PrimaryButton
        title={saved ? "Aus Favoriten entfernen" : "Als Favorit speichern"}
        onPress={() => toggleFavorite(product)}
      />
    </AppScreen>
  );
}
const s = StyleSheet.create({
  product: { flexDirection: "row", gap: space.lg, alignItems: "center" },
  image: {
    width: 86,
    height: 86,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  imageFallback: {
    width: 86,
    height: 86,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: type.section, fontWeight: "800", color: colors.text },
  brand: { fontSize: type.caption, color: colors.textMuted, marginTop: 3 },
  source: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
  status: {
    padding: space.xl,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: space.lg,
    alignItems: "center",
  },
  statusTitle: { fontSize: type.section, fontWeight: "800", color: "#fff" },
  statusText: {
    fontSize: type.body,
    lineHeight: 22,
    color: "#fff",
    marginTop: space.sm,
  },
  card: {
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    gap: space.md,
    alignItems: "flex-start",
  },
  body: { flex: 1, fontSize: type.body, lineHeight: 24, color: colors.text },
  ingredient: {
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: "#FDE8E6",
    flexDirection: "row",
    gap: space.md,
    alignItems: "center",
  },
  ingredientText: {
    fontSize: type.body,
    fontWeight: "700",
    color: colors.text,
  },
  allergen: {
    fontSize: type.caption,
    lineHeight: 19,
    color: colors.textMuted,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
});
