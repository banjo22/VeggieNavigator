import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import {
  AlertTriangle,
  Languages,
  MessageCircle,
  RotateCcw,
  Utensils,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import {
  AppScreen,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  StatusBadge,
} from "@/components/ui";
import { useAppStore } from "@/store/AppStore";
import { colors, radius, space, type } from "@/theme";
import { useState } from "react";

type RestaurantQuestionProps = {
  german?: string;
  local?: string;
  english?: string;
  fallback?: string;
  menuLanguage: string;
};

type QuestionLanguage = "de" | "local" | "en";
type QuestionVariant = {
  key: QuestionLanguage;
  label: string;
  text: string;
};

function RestaurantQuestion({
  german,
  local,
  english,
  fallback,
  menuLanguage,
}: RestaurantQuestionProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<QuestionLanguage>(
    local ? "local" : german ? "de" : "en",
  );
  const variants: QuestionVariant[] = [];

  if (german) variants.push({ key: "de", label: "Deutsch", text: german });
  if (local && local !== german) {
    const isEnglishMenu = menuLanguage.startsWith("en");
    variants.push({
      key: "local",
      label:
        isEnglishMenu || local === english ? "Englisch · Menü" : "Menüsprache",
      text: local,
    });
  }
  if (english && english !== german && english !== local) {
    variants.push({ key: "en", label: "Englisch", text: english });
  }
  if (variants.length === 0 && fallback) {
    variants.push({ key: "local", label: "Restaurantfrage", text: fallback });
  }

  const selected =
    variants.find((variant) => variant.key === selectedLanguage) || variants[0];

  if (!selected) return null;

  return (
    <View style={s.question}>
      <MessageCircle color={colors.primary} size={18} />
      <View style={s.questionContent}>
        <Text style={s.questionText}>{selected.text}</Text>
        {variants.length > 1 ? (
          <View style={s.languageControls}>
            <Languages color={colors.primary} size={15} />
            {variants.map((variant) => {
              const active = variant.key === selected.key;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Restaurantfrage auf ${variant.label} anzeigen`}
                  hitSlop={5}
                  key={variant.key}
                  onPress={() => setSelectedLanguage(variant.key)}
                  style={[
                    s.languageButton,
                    active ? s.languageButtonActive : null,
                  ]}
                >
                  <Text
                    style={[
                      s.languageButtonText,
                      active ? s.languageButtonTextActive : null,
                    ]}
                  >
                    {variant.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function MenuResult() {
  const router = useRouter();
  const { menuAnalysis } = useAppStore();
  if (!menuAnalysis) {
    return (
      <AppScreen>
        <EmptyState
          title="Keine Speisekartenanalyse"
          text="Scanne eine oder mehrere Seiten, um Gerichte gemeinsam auszuwerten."
        />
        <PrimaryButton
          title="Speisekarte scannen"
          onPress={() => router.replace("/photo?mode=menu")}
        />
      </AppScreen>
    );
  }
  const adaptable = menuAnalysis.dishes.filter(
    (dish) =>
      dish.adaptationSuggestion ||
      dish.questionForRestaurant ||
      dish.questionForRestaurantGerman ||
      dish.questionForRestaurantLocal ||
      dish.questionForRestaurantEnglish,
  );
  const isGermanMenu = (menuAnalysis.language || "de")
    .toLowerCase()
    .startsWith("de");
  const shareQuestions = async () => {
    const questions = adaptable
      .map((dish) => {
        const german =
          dish.questionForRestaurantGerman ||
          (isGermanMenu ? dish.questionForRestaurant : "");
        const local =
          dish.questionForRestaurantLocal ||
          (!isGermanMenu ? dish.questionForRestaurant : "");
        const english = dish.questionForRestaurantEnglish || "";
        const seen = new Set<string>();
        const translations = [
          { label: "Deutsch", text: german },
          { label: "Menüsprache", text: local },
          { label: "Englisch", text: english },
        ].flatMap(({ label, text }) => {
          if (!text || seen.has(text)) return [];
          seen.add(text);
          return [`${label}: ${text}`];
        });
        return translations.length
          ? `${dish.name}:\n${translations.join("\n")}`
          : "";
      })
      .filter(Boolean);
    await Share.share({
      message: questions.length
        ? questions.join("\n")
        : "Bitte prüfen Sie, welche Gerichte vegan oder vegetarisch zubereitet werden können.",
    });
  };
  return (
    <AppScreen>
      <View style={s.hero}>
        <Utensils color={colors.primary} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>
            {menuAnalysis.dishes.length} Gerichte erkannt
          </Text>
          <Text style={s.copy}>
            Alle aufgenommenen Seiten wurden zusammengeführt und doppelte
            Gerichte vermieden.
          </Text>
        </View>
      </View>
      {menuAnalysis.generalNotes?.length ? (
        <View style={s.note}>
          <AlertTriangle color={colors.warning} />
          <Text style={s.copy}>{menuAnalysis.generalNotes.join(" · ")}</Text>
        </View>
      ) : null}
      <SectionTitle>Gerichte</SectionTitle>
      {menuAnalysis.dishes.map((dish, index) => (
        <View style={s.card} key={`${dish.name}-${index}`}>
          <StatusBadge status={dish.classification} />
          <Text style={s.cardTitle}>{dish.name}</Text>
          {dish.description ? (
            <Text style={s.copy}>{dish.description}</Text>
          ) : null}
          <Text style={s.copy}>{dish.reason}</Text>
          {dish.problematicIngredients?.length ? (
            <Text style={s.warning}>
              Achten auf: {dish.problematicIngredients.join(", ")}
            </Text>
          ) : null}
          {dish.adaptationSuggestion ? (
            <Text style={s.tip}>{dish.adaptationSuggestion}</Text>
          ) : null}
          <RestaurantQuestion
            german={
              dish.questionForRestaurantGerman ||
              (isGermanMenu ? dish.questionForRestaurant : undefined)
            }
            local={
              dish.questionForRestaurantLocal ||
              (!isGermanMenu ? dish.questionForRestaurant : undefined)
            }
            english={dish.questionForRestaurantEnglish}
            fallback={dish.questionForRestaurant}
            menuLanguage={(menuAnalysis.language || "de").toLowerCase()}
          />
        </View>
      ))}
      <SecondaryButton
        title="Fragen fürs Restaurant teilen"
        onPress={shareQuestions}
      />
      <PrimaryButton
        title="Weitere Speisekarte scannen"
        onPress={() => router.replace("/photo?mode=menu")}
      />
      <View style={s.disclaimer}>
        <RotateCcw color={colors.textMuted} size={18} />
        <Text style={s.disclaimerText}>
          Die Analyse bleibt auf diesem Gerät gespeichert, bis du eine neue
          Speisekarte analysierst.
        </Text>
      </View>
    </AppScreen>
  );
}

const s = StyleSheet.create({
  hero: {
    flexDirection: "row",
    gap: space.lg,
    padding: space.xl,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xl,
    alignItems: "center",
  },
  title: { fontSize: type.section, fontWeight: "800", color: colors.text },
  copy: {
    flex: 1,
    fontSize: type.body,
    lineHeight: 23,
    color: colors.textMuted,
  },
  note: {
    flexDirection: "row",
    gap: space.md,
    padding: space.lg,
    backgroundColor: "#FFF3D9",
    borderRadius: radius.md,
  },
  card: {
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  cardTitle: { fontSize: type.card, fontWeight: "800", color: colors.text },
  warning: { color: colors.danger, fontWeight: "700", lineHeight: 21 },
  tip: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontWeight: "700",
  },
  question: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    paddingTop: space.sm,
  },
  questionText: {
    color: colors.text,
    fontWeight: "700",
    lineHeight: 21,
  },
  questionContent: { flex: 1, gap: space.sm },
  languageControls: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  languageButton: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "transparent",
  },
  languageButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  languageButtonText: {
    color: colors.primary,
    fontSize: type.caption,
    fontWeight: "700",
  },
  languageButtonTextActive: { fontWeight: "900" },
  disclaimer: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  disclaimerText: { flex: 1, fontSize: type.caption, color: colors.textMuted },
});
