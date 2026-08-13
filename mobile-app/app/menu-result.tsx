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
import { isMenuDishFitting, isMenuDishRecommended } from "@/lib/classification";
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

const languageNames: Record<string, string> = {
  de: "Deutsch",
  german: "Deutsch",
  en: "Englisch",
  english: "Englisch",
  it: "Italienisch",
  italian: "Italienisch",
  es: "Spanisch",
  spanish: "Spanisch",
  fr: "Französisch",
  french: "Französisch",
  pt: "Portugiesisch",
  nl: "Niederländisch",
  tr: "Türkisch",
  el: "Griechisch",
  greek: "Griechisch",
  ja: "Japanisch",
  zh: "Chinesisch",
  th: "Thailändisch",
  vi: "Vietnamesisch",
};

function getMenuLanguageLabel(language: string) {
  const normalized = language.toLowerCase().split(/[-_]/)[0] ?? "";
  return languageNames[normalized] || "Menüsprache";
}

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
  const menuLanguageText =
    local ||
    (menuLanguage.startsWith("de") ? german : undefined) ||
    (menuLanguage.startsWith("en") ? english : undefined) ||
    fallback;
  const variants: QuestionVariant[] = [
    ...(german ? [{ key: "de" as const, label: "Deutsch", text: german }] : []),
    ...(menuLanguageText
      ? [
          {
            key: "local" as const,
            label: `Menü: ${getMenuLanguageLabel(menuLanguage)}`,
            text: menuLanguageText,
          },
        ]
      : []),
    ...(english
      ? [{ key: "en" as const, label: "Englisch", text: english }]
      : []),
  ];
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
  const { menuAnalysis, profile } = useAppStore();
  const [dishFilter, setDishFilter] = useState<
    "recommended" | "adaptable" | "all"
  >("recommended");
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
  const fittingCount = menuAnalysis.dishes.filter((dish) =>
    isMenuDishFitting(dish.classification, profile.dietMode),
  ).length;
  const adaptableCount = menuAnalysis.dishes.filter(
    (dish) => dish.classification === "possibly_adaptable",
  ).length;
  const visibleDishes = menuAnalysis.dishes.filter((dish) => {
    if (dishFilter === "all") return true;
    if (dishFilter === "adaptable")
      return dish.classification === "possibly_adaptable";
    return isMenuDishRecommended(dish.classification, profile.dietMode);
  });
  const shareQuestions = async () => {
    const questions = adaptable
      .map((dish) => {
        const german =
          dish.questionForRestaurantGerman ||
          (isGermanMenu ? dish.questionForRestaurant : "");
        const english = dish.questionForRestaurantEnglish || "";
        const local =
          dish.questionForRestaurantLocal ||
          (isGermanMenu
            ? german
            : (menuAnalysis.language || "").toLowerCase().startsWith("en")
              ? english || dish.questionForRestaurant || ""
              : dish.questionForRestaurant || "");
        const translations = [
          { label: "Deutsch", text: german },
          { label: "Menüsprache", text: local },
          { label: "Englisch", text: english },
        ].flatMap(({ label, text }) => {
          if (!text) return [];
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
            {fittingCount} passend · {adaptableCount} anpassbar
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
      <View style={s.filterBar}>
        {[
          ["recommended", `Empfohlen (${fittingCount + adaptableCount})`],
          ["adaptable", `Anpassbar (${adaptableCount})`],
          ["all", `Alle (${menuAnalysis.dishes.length})`],
        ].map(([value, label]) => {
          const active = dishFilter === value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={value}
              onPress={() =>
                setDishFilter(value as "recommended" | "adaptable" | "all")
              }
              style={[s.filterButton, active ? s.filterButtonActive : null]}
            >
              <Text style={[s.filterText, active ? s.filterTextActive : null]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {visibleDishes.length ? (
        visibleDishes.map((dish, index) => (
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
            <RestaurantQuestion
              german={
                dish.questionForRestaurantGerman ||
                (isGermanMenu ? dish.questionForRestaurant : undefined)
              }
              local={
                dish.questionForRestaurantLocal ||
                (isGermanMenu
                  ? dish.questionForRestaurantGerman ||
                    dish.questionForRestaurant
                  : dish.questionForRestaurant)
              }
              english={dish.questionForRestaurantEnglish}
              fallback={dish.questionForRestaurant}
              menuLanguage={(menuAnalysis.language || "de").toLowerCase()}
            />
          </View>
        ))
      ) : (
        <View style={s.emptyFilter}>
          <Text style={s.emptyFilterTitle}>
            Keine Gerichte in dieser Auswahl
          </Text>
          <Text style={s.copy}>
            Wechsle zu „Alle“, um die vollständige Speisekarte zu sehen.
          </Text>
        </View>
      )}
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
  filterBar: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  filterButton: {
    paddingHorizontal: space.md,
    paddingVertical: 9,
    borderRadius: radius.round,
    backgroundColor: colors.primarySoft,
  },
  filterButtonActive: { backgroundColor: colors.primary },
  filterText: {
    color: colors.primary,
    fontSize: type.caption,
    fontWeight: "800",
  },
  filterTextActive: { color: "#fff" },
  emptyFilter: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyFilterTitle: {
    color: colors.text,
    fontSize: type.body,
    fontWeight: "800",
  },
  warning: { color: colors.danger, fontWeight: "700", lineHeight: 21 },
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
