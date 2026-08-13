import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  BookOpen,
  ChevronDown,
  Globe2,
  MapPinned,
  Search,
  Share2,
  Utensils,
  X,
} from "lucide-react-native";
import {
  AppInput,
  AppScreen,
  EmptyState,
  PrimaryButton,
  SectionTitle,
  StatusBadge,
} from "@/components/ui";
import { countries } from "@/data/countries";
import {
  getTravelQuestions,
  ingredients,
  travelGuides,
  type IngredientKnowledge,
} from "@/data/knowledge";
import { useAppStore } from "@/store/AppStore";
import { colors, radius, space, type } from "@/theme";

type Category = "Alle" | IngredientKnowledge["category"];
const categories: Category[] = [
  "Alle",
  "Tierisch",
  "Zusatzstoff",
  "Unklar",
  "Pflanzlich",
];

export default function Discover() {
  const router = useRouter();
  const { profile, menuAnalysis } = useAppStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("Alle");
  const [countryCode, setCountryCode] = useState(profile.country || "DE");
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [section, setSection] = useState<"lexicon" | "travel" | "community">(
    "lexicon",
  );
  const found = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ingredients.filter(
      (item) =>
        (category === "Alle" || item.category === category) &&
        (!normalized ||
          `${item.name} ${item.aliases.join(" ")} ${item.why}`
            .toLowerCase()
            .includes(normalized)),
    );
  }, [query, category]);
  const country =
    countries.find((item) => item.code === countryCode) ?? countries[0];
  const guide = travelGuides.find((item) => item.code === countryCode);
  const travelQuestions = getTravelQuestions(countryCode);
  const filteredCountries = useMemo(() => {
    const normalized = countrySearch.trim().toLowerCase();
    return normalized
      ? countries.filter(
          (item) =>
            item.name.toLowerCase().includes(normalized) ||
            item.code.toLowerCase().includes(normalized),
        )
      : countries;
  }, [countrySearch]);
  const shareTravelCard = () =>
    Share.share({
      message: guide
        ? [
            `Veggie-Reisekarte: ${country.name}`,
            ...travelQuestions.flatMap((question) => [
              question.de,
              question.local,
            ]),
            ...guide.phrases.flatMap((phrase) => [phrase.de, phrase.local]),
          ].join("\n")
        : `Ich ernähre mich vegan/vegetarisch. Bitte helfen Sie mir zu prüfen, ob das Gericht Fleisch, Fisch, Milch, Ei, Honig oder tierische Brühe enthält.`,
    });
  return (
    <AppScreen>
      <Text style={s.title}>Entdecken</Text>
      <View style={s.quickRow}>
        <Pressable
          style={s.quick}
          onPress={() => router.push("/photo?mode=menu")}
        >
          <Utensils color={colors.primary} />
          <Text style={s.quickText}>Menü scannen</Text>
        </Pressable>
        <Pressable
          style={s.quick}
          onPress={() => router.push("/menu-result")}
          disabled={!menuAnalysis}
        >
          <BookOpen color={menuAnalysis ? colors.primary : colors.textMuted} />
          <Text style={[s.quickText, !menuAnalysis && s.muted]}>
            Letzte Analyse
          </Text>
        </Pressable>
      </View>
      <View style={s.sectionTabs}>
        {(
          [
            ["lexicon", "Lexikon"],
            ["travel", "Reise"],
            ["community", "Spots"],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setSection(id)}
            style={[s.sectionTab, section === id && s.sectionTabActive]}
          >
            <Text
              style={[
                s.sectionTabText,
                section === id && s.sectionTabTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {section === "community" ? (
        <View style={s.spotHero}>
          <View style={s.spotIcon}>
            <MapPinned color={colors.primary} size={30} />
          </View>
          <Text style={s.cardTitle}>Spots aus der Community</Text>
          <Text style={s.copy}>
            Finde pflanzliche Empfehlungen auf der Karte oder teile deinen
            eigenen Fund.
          </Text>
          <PrimaryButton
            title="Community-Karte öffnen"
            onPress={() => router.push("/spots")}
          />
        </View>
      ) : null}

      {section === "lexicon" ? (
        <>
          <SectionTitle>Zutatenlexikon</SectionTitle>
          <AppInput
            value={query}
            onChangeText={setQuery}
            placeholder="Zutat, E-Nummer oder Alias suchen"
          />
          <View style={s.chips}>
            {categories.map((item) => (
              <Pressable
                key={item}
                style={[s.chip, category === item && s.chipActive]}
                onPress={() => setCategory(item)}
              >
                <Text
                  style={[s.chipText, category === item && s.chipTextActive]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.counter}>
            {found.length} von {ingredients.length} Einträgen
          </Text>
          {found.slice(0, 30).map((item) => (
            <View style={s.card} key={item.name}>
              <View style={s.cardHead}>
                <StatusBadge status={item.status} />
                <Text style={s.category}>{item.category}</Text>
              </View>
              <Text style={s.cardTitle}>{item.name}</Text>
              {item.aliases.length ? (
                <Text style={s.aliases}>Auch: {item.aliases.join(", ")}</Text>
              ) : null}
              <Text style={s.copy}>{item.why}</Text>
            </View>
          ))}
          {!found.length ? (
            <EmptyState
              title="Keine Zutat gefunden"
              text="Versuche einen anderen Namen, eine E-Nummer oder einen Alias."
            />
          ) : null}
        </>
      ) : null}

      {section === "travel" ? (
        <>
          <SectionTitle>Reisemodus</SectionTitle>
          <Pressable style={s.dropdown} onPress={() => setCountryOpen(true)}>
            <Globe2 color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.dropdownLabel}>Reiseland</Text>
              <Text style={s.dropdownValue}>{country.name}</Text>
            </View>
            <ChevronDown color={colors.textMuted} />
          </Pressable>
          {guide ? (
            <View style={s.travel}>
              <Text style={s.cardTitle}>{country.name}</Text>
              <Text style={s.tip}>{guide.tip}</Text>
              <Text style={s.label}>Konkrete Zutatenfragen</Text>
              <Text style={s.copy}>
                Zeige die passende Frage und lasse dir die Zubereitung
                bestätigen. Die deutsche Zeile hilft dir bei der Auswahl.
              </Text>
              {travelQuestions.map((question) => (
                <View style={s.questionCard} key={question.topic}>
                  <Text style={s.questionTopic}>{question.topic}</Text>
                  <Text style={s.copy}>{question.de}</Text>
                  <Text selectable style={s.phrase}>
                    {question.local}
                  </Text>
                </View>
              ))}
              <Text style={s.label}>Zusätzliche Sätze</Text>
              {guide.phrases.map((phrase) => (
                <View key={phrase.de}>
                  <Text style={s.copy}>{phrase.de}</Text>
                  <Text selectable style={s.phrase}>
                    {phrase.local}
                  </Text>
                </View>
              ))}
              <Pressable style={s.share} onPress={shareTravelCard}>
                <Share2 color={colors.primary} size={18} />
                <Text style={s.shareText}>Reisekarte teilen</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.travel}>
              <Text style={s.cardTitle}>{country.name}</Text>
              <Text style={s.copy}>
                Für dieses Land ist noch kein geprüfter Detailguide hinterlegt.
                Nutze die universelle Ernährungskarte, statt unzuverlässige
                Übersetzungen zu erhalten.
              </Text>
              <Text style={s.tip}>
                Ich esse vegan/vegetarisch. Enthält das Gericht Fleisch, Fisch,
                Milch, Ei, Honig oder tierische Brühe?
              </Text>
              <Pressable style={s.share} onPress={shareTravelCard}>
                <Share2 color={colors.primary} size={18} />
                <Text style={s.shareText}>Ernährungskarte zeigen/teilen</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : null}

      <Modal
        visible={countryOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCountryOpen(false)}
      >
        <View style={s.modal}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>Land auswählen</Text>
            <Pressable onPress={() => setCountryOpen(false)} style={s.close}>
              <X color={colors.text} />
            </Pressable>
          </View>
          <View style={s.searchWrap}>
            <Search color={colors.textMuted} size={20} />
            <AppInput
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Land suchen"
              style={s.searchInput}
            />
          </View>
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={[
                  s.countryRow,
                  item.code === countryCode && s.countrySelected,
                ]}
                onPress={() => {
                  setCountryCode(item.code);
                  setCountryOpen(false);
                  setCountrySearch("");
                }}
              >
                <Text style={s.countryName}>{item.name}</Text>
                <Text style={s.countryCode}>{item.code}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </AppScreen>
  );
}

const s = StyleSheet.create({
  title: { fontSize: type.title, fontWeight: "800", color: colors.text },
  card: {
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: type.card, fontWeight: "800", color: colors.text },
  copy: { fontSize: type.body, lineHeight: 23, color: colors.textMuted },
  category: {
    fontSize: type.caption,
    color: colors.textMuted,
    fontWeight: "700",
  },
  aliases: { fontSize: type.caption, color: colors.primary, fontWeight: "700" },
  counter: { fontSize: type.caption, color: colors.textMuted },
  tip: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontWeight: "700",
    lineHeight: 21,
  },
  quickRow: { flexDirection: "row", gap: space.md },
  quick: {
    flex: 1,
    flexDirection: "row",
    gap: space.sm,
    alignItems: "center",
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickText: { flex: 1, fontWeight: "700", color: colors.text },
  muted: { color: colors.textMuted },
  sectionTabs: {
    flexDirection: "row",
    padding: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTab: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  sectionTabActive: { backgroundColor: colors.primary },
  sectionTabText: { color: colors.textMuted, fontWeight: "800" },
  sectionTabTextActive: { color: "#fff" },
  chips: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
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
  chipText: { color: colors.textMuted, fontWeight: "700" },
  chipTextActive: { color: colors.primary },
  dropdown: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dropdownLabel: { fontSize: type.caption, color: colors.textMuted },
  dropdownValue: {
    fontSize: type.body,
    fontWeight: "800",
    color: colors.text,
    marginTop: 2,
  },
  travel: {
    padding: space.lg,
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: type.caption,
    fontWeight: "800",
    color: colors.primary,
    marginTop: space.sm,
  },
  phrase: {
    fontSize: type.body,
    fontWeight: "800",
    color: colors.text,
    marginBottom: space.sm,
  },
  questionCard: {
    padding: space.md,
    gap: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionTopic: {
    fontSize: type.caption,
    fontWeight: "800",
    color: colors.primary,
  },
  share: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    marginTop: space.sm,
  },
  shareText: { color: colors.primary, fontWeight: "800" },
  spotHero: {
    padding: space.xl,
    gap: space.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xl,
  },
  spotIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: space.xxl,
    paddingHorizontal: space.xl,
  },
  modalHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.lg,
  },
  modalTitle: { fontSize: type.title, fontWeight: "800", color: colors.text },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.md,
  },
  searchInput: { flex: 1 },
  countryRow: {
    minHeight: 58,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  countrySelected: { backgroundColor: colors.primarySoft },
  countryName: { fontSize: type.body, color: colors.text, fontWeight: "700" },
  countryCode: {
    fontSize: type.caption,
    color: colors.textMuted,
    fontWeight: "800",
  },
});
