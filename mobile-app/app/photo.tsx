import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Camera,
  Check,
  Clock3,
  Image as ImageIcon,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react-native";
import {
  AppScreen,
  ErrorState,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";
import { analyzeImage } from "@/lib/api";
import { uploadTemporaryAnalysisImage } from "@/lib/data";
import { useAuth } from "@/auth/AuthProvider";
import { useAppStore } from "@/store/AppStore";
import { colors, radius, space, type } from "@/theme";
import type { MenuAnalysis, ProductResult } from "@/types";

type SelectedImage = { uri: string; base64: string };
const MAX_MENU_PAGES = 8;

export default function Photo() {
  const params = useLocalSearchParams<{
    mode?: "ingredients" | "menu";
    source?: string;
    barcode?: string;
  }>();
  const mode = params.mode === "menu" ? "menu" : "ingredients";
  const router = useRouter();
  const { user } = useAuth();
  const { profile, addScan, saveMenuAnalysis } = useAppStore();
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<
    "upload" | "read" | "finish"
  >("upload");
  const [error, setError] = useState("");

  useEffect(() => {
    if (params.source === "gallery") void pick("gallery");
  }, []);

  const prepare = async (assets: ImagePicker.ImagePickerAsset[]) =>
    Promise.all(
      assets.map(async (asset) => {
        const maximumWidth = mode === "menu" ? 1280 : 1400;
        const targetWidth = Math.min(asset.width || maximumWidth, maximumWidth);
        const edited = await ImageManipulator.manipulateAsync(
          asset.uri,
          asset.width && asset.width <= maximumWidth
            ? []
            : [{ resize: { width: targetWidth } }],
          {
            compress: mode === "menu" ? 0.65 : 0.7,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          },
        );
        return {
          uri: edited.uri,
          base64: `data:image/jpeg;base64,${edited.base64 ?? ""}`,
        };
      }),
    );

  const pick = async (source: "camera" | "gallery") => {
    setError("");
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(
        permission.canAskAgain
          ? "Für diese Aktion fehlt die Berechtigung."
          : "Die Berechtigung wurde dauerhaft abgelehnt. Öffne die Systemeinstellungen.",
      );
      return;
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.8,
            allowsMultipleSelection: mode === "menu",
            selectionLimit: mode === "menu" ? MAX_MENU_PAGES : 1,
          });
    if (result.canceled) return;
    const prepared = await prepare(result.assets);
    setImages((current) =>
      mode === "menu"
        ? [...current, ...prepared].slice(0, MAX_MENU_PAGES)
        : prepared.slice(0, 1),
    );
  };

  const analyze = async () => {
    if (!images.length) return;
    setLoading(true);
    setAnalysisStage("upload");
    setError("");
    const temporary: Awaited<
      ReturnType<typeof uploadTemporaryAnalysisImage>
    >[] = [];
    try {
      if (!user)
        throw new Error(
          "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
        );
      const uploads = await Promise.all(
        images.map((image) =>
          uploadTemporaryAnalysisImage(
            user,
            image.base64,
            mode === "menu" ? "menu-scans" : "ingredient-scans",
          ),
        ),
      );
      temporary.push(...uploads);
      setAnalysisStage("read");
      const firstUpload = uploads[0];
      if (!firstUpload) throw new Error("Kein Bild konnte hochgeladen werden.");
      const result = await analyzeImage(
        mode === "menu" ? uploads.map((item) => item.url) : firstUpload.url,
        mode,
        profile.dietMode,
        "",
        params.barcode,
        profile.exclusions,
        profile.language,
      );
      if (mode === "ingredients") {
        setAnalysisStage("finish");
        await addScan("ingredients", result as ProductResult);
        router.replace({
          pathname: "/result",
          params: { code: (result as ProductResult).code },
        });
      } else {
        setAnalysisStage("finish");
        await saveMenuAnalysis(result as MenuAnalysis);
        router.replace("/menu-result");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyse fehlgeschlagen.");
    } finally {
      await Promise.allSettled(temporary.map((item) => item.remove()));
      setLoading(false);
    }
  };

  return (
    <AppScreen>
      {images.length ? (
        <>
          <View style={s.pageHeader}>
            <Text style={s.title}>
              {mode === "menu"
                ? `${images.length} von ${MAX_MENU_PAGES} Seiten`
                : "Bildvorschau"}
            </Text>
            {mode === "menu" && images.length < MAX_MENU_PAGES ? (
              <Pressable style={s.addSmall} onPress={() => pick("camera")}>
                <Plus color={colors.primary} size={18} />
                <Text style={s.addText}>Seite</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.previews}
          >
            {images.map((image, index) => (
              <View key={`${image.uri}-${index}`}>
                <Image
                  source={{ uri: image.uri }}
                  style={s.preview}
                  contentFit="cover"
                />
                <Pressable
                  accessibilityLabel={`Seite ${index + 1} entfernen`}
                  style={s.remove}
                  onPress={() =>
                    setImages((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                >
                  <X color="#fff" size={18} />
                </Pressable>
                <Text style={s.pageNumber}>Seite {index + 1}</Text>
              </View>
            ))}
          </ScrollView>
        </>
      ) : (
        <View style={s.placeholder}>
          {mode === "menu" ? (
            <ImageIcon color={colors.primary} size={46} />
          ) : (
            <Camera color={colors.primary} size={46} />
          )}
          <Text style={s.title}>
            {mode === "menu"
              ? "Speisekarte aufnehmen"
              : "Zutatenliste aufnehmen"}
          </Text>
          <Text style={s.copy}>
            {mode === "menu"
              ? "Fotografiere bis zu acht Seiten. Du kannst Kamera und Galerie kombinieren."
              : "Fotografiere den Text scharf, vollständig und ohne starke Spiegelungen."}
          </Text>
        </View>
      )}
      {error ? (
        <ErrorState message={error} onRetry={() => setError("")} />
      ) : null}
      {loading ? (
        <View style={s.progressCard} accessibilityLiveRegion="polite">
          <View style={s.progressHeader}>
            <Clock3 color={colors.primary} size={20} />
            <View style={{ flex: 1 }}>
              <Text style={s.progressTitle}>
                {analysisStage === "upload"
                  ? "Bilder werden vorbereitet"
                  : analysisStage === "read"
                    ? "Gerichte werden geprüft"
                    : "Ergebnis wird gespeichert"}
              </Text>
              <Text style={s.progressCopy}>
                {analysisStage === "read"
                  ? "Die KI liest die Karte, gleicht dein Profil ab und erstellt Restaurantfragen."
                  : "Bitte lass die App kurz geöffnet."}
              </Text>
            </View>
          </View>
          <View style={s.steps}>
            {[
              ["upload", "Bilder"],
              ["read", "Analyse"],
              ["finish", "Fertig"],
            ].map(([stage, label], index) => {
              const order = { upload: 0, read: 1, finish: 2 } as const;
              const done = order[analysisStage] > index;
              const active = order[analysisStage] === index;
              return (
                <View style={s.step} key={stage}>
                  <View
                    style={[s.stepDot, done || active ? s.stepDotActive : null]}
                  >
                    {done ? <Check color="#fff" size={12} /> : null}
                  </View>
                  <Text style={active ? s.stepTextActive : s.stepText}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
      {!images.length ? (
        <>
          <PrimaryButton
            title="Foto aufnehmen"
            onPress={() => pick("camera")}
          />
          <SecondaryButton
            title={
              mode === "menu"
                ? "Mehrere Bilder auswählen"
                : "Aus Galerie auswählen"
            }
            onPress={() => pick("gallery")}
          />
        </>
      ) : (
        <>
          <PrimaryButton
            title={
              loading
                ? "Analyse läuft …"
                : mode === "menu"
                  ? `${images.length} Seiten analysieren`
                  : "Bild sicher analysieren"
            }
            loading={loading}
            disabled={loading}
            onPress={analyze}
          />
          {mode === "menu" && images.length < MAX_MENU_PAGES ? (
            <SecondaryButton
              title="Weitere Bilder aus Galerie"
              onPress={() => pick("gallery")}
            />
          ) : null}
          <SecondaryButton
            title="Auswahl zurücksetzen"
            onPress={() => setImages([])}
          />
        </>
      )}
      <View style={s.privacy}>
        <ShieldCheck color={colors.primary} size={20} />
        <Text style={s.privacyText}>
          Bilder werden komprimiert, nur kurz signiert und nach der Analyse
          automatisch gelöscht.
        </Text>
      </View>
      {error.includes("Systemeinstellungen") ? (
        <SecondaryButton
          title="Einstellungen öffnen"
          onPress={Linking.openSettings}
        />
      ) : null}
    </AppScreen>
  );
}

const s = StyleSheet.create({
  placeholder: {
    minHeight: 300,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xxl,
    gap: space.md,
  },
  previews: { gap: space.md, paddingRight: space.xl },
  preview: { width: 250, height: 320, borderRadius: radius.xl },
  remove: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(20,30,25,.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  pageNumber: {
    position: "absolute",
    left: 12,
    bottom: 12,
    color: "#fff",
    fontWeight: "800",
    backgroundColor: "rgba(20,30,25,.72)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.round,
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    minHeight: 40,
    borderRadius: radius.round,
    backgroundColor: colors.primarySoft,
  },
  addText: { color: colors.primary, fontWeight: "800" },
  title: {
    fontSize: type.section,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  copy: {
    fontSize: type.body,
    lineHeight: 24,
    color: colors.textMuted,
    textAlign: "center",
  },
  privacy: {
    flexDirection: "row",
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  privacyText: {
    flex: 1,
    fontSize: type.caption,
    lineHeight: 19,
    color: colors.textMuted,
  },
  progressCard: {
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
  },
  progressTitle: { color: colors.text, fontWeight: "800", fontSize: type.body },
  progressCopy: {
    color: colors.textMuted,
    fontSize: type.caption,
    lineHeight: 19,
    marginTop: 3,
  },
  steps: { flexDirection: "row", justifyContent: "space-between" },
  step: { flex: 1, alignItems: "center", gap: space.xs },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  stepDotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  stepText: { color: colors.textMuted, fontSize: type.caption },
  stepTextActive: {
    color: colors.primary,
    fontSize: type.caption,
    fontWeight: "800",
  },
});
