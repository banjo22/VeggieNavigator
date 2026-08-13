import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Camera, ImagePlus, LocateFixed, MapPin, X } from "lucide-react-native";
import { useAuth } from "@/auth/AuthProvider";
import {
  AppInput,
  AppScreen,
  ErrorState,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
} from "@/components/ui";
import { createCommunitySpot, searchPlaces } from "@/lib/api";
import { uploadCommunitySpotImage } from "@/lib/data";
import { colors, radius, space, type } from "@/theme";
import type { CommunitySpot, PlaceSuggestion } from "@/types";
const statuses: [CommunitySpot["status"], string][] = [
  ["vegan", "Vegan"],
  ["vegetarisch", "Vegetarisch"],
  ["vegan moeglich", "Vegan möglich"],
];
const categories = [
  "Restaurant",
  "Café",
  "Supermarkt",
  "Bäckerei",
  "Imbiss",
  "Sonstiges",
];
export default function CreateSpot() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [status, setStatus] = useState<CommunitySpot["status"]>("vegan");
  const [category, setCategory] = useState("Restaurant");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [imageUri, setImageUri] = useState("");
  const [imageBase64, setImageBase64] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (place.trim().length < 3 || lat !== null) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        void searchPlaces(place, controller.signal)
          .then(setSuggestions)
          .catch(() => {}),
      450,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [place, lat]);
  const selectPlace = (item: PlaceSuggestion) => {
    setPlace(item.address || item.name);
    setLat(item.lat);
    setLng(item.lng);
    setSuggestions([]);
  };
  const locate = async () => {
    setError("");
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setError(
        "Standortzugriff wurde nicht erlaubt. Suche stattdessen nach einer Adresse.",
      );
      return;
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    setLat(position.coords.latitude);
    setLng(position.coords.longitude);
    const addresses = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    const first = addresses[0];
    setPlace(
      first
        ? [first.name, first.street, first.city].filter(Boolean).join(", ")
        : `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
    );
  };
  const pick = async (source: "camera" | "gallery") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Für das Spot-Foto fehlt die benötigte Berechtigung.");
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
          });
    if (result.canceled || !result.assets[0]) return;
    const edited = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 1400 } }],
      {
        compress: 0.75,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );
    setImageUri(edited.uri);
    setImageBase64(`data:image/jpeg;base64,${edited.base64 ?? ""}`);
  };
  const submit = async () => {
    if (!user) {
      setError("Deine Sitzung ist abgelaufen.");
      return;
    }
    if (!name.trim() || !place.trim() || lat === null || lng === null) {
      setError("Name und ein ausgewählter Standort sind erforderlich.");
      return;
    }
    setSaving(true);
    setError("");
    let upload: Awaited<ReturnType<typeof uploadCommunitySpotImage>> | null =
      null;
    try {
      if (imageBase64)
        upload = await uploadCommunitySpotImage(user, imageBase64);
      const item = await createCommunitySpot({
        name: name.trim(),
        place: place.trim(),
        lat,
        lng,
        status,
        category,
        price: price.trim() || "Preis offen",
        description: description.trim(),
        confirmations: 0,
        imageUrl: upload?.url,
      });
      router.replace({
        pathname: "/spot/[id]",
        params: { id: String(item.id) },
      });
    } catch (e) {
      if (upload) await upload.remove();
      setError(
        e instanceof Error
          ? e.message
          : "Spot konnte nicht gespeichert werden.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <AppScreen>
      <Text style={s.title}>Community-Spot teilen</Text>
      <Text style={s.copy}>
        Teile einen echten Fundort. Andere können ihn bestätigen und bewerten.
      </Text>
      {error ? <ErrorState message={error} /> : null}
      <SectionTitle>Foto</SectionTitle>
      {imageUri ? (
        <View>
          <Image
            source={{ uri: imageUri }}
            style={s.preview}
            contentFit="cover"
          />
          <Pressable
            style={s.remove}
            onPress={() => {
              setImageUri("");
              setImageBase64("");
            }}
            accessibilityLabel="Foto entfernen"
          >
            <X color="#fff" />
          </Pressable>
        </View>
      ) : (
        <View style={s.photoActions}>
          <SecondaryButton
            title="Foto aufnehmen"
            onPress={() => pick("camera")}
          />
          <SecondaryButton
            title="Galerie öffnen"
            onPress={() => pick("gallery")}
          />
        </View>
      )}
      <SectionTitle>Was hast du gefunden?</SectionTitle>
      <AppInput
        value={name}
        onChangeText={setName}
        placeholder="Name des Spots"
      />
      <AppInput
        value={description}
        onChangeText={setDescription}
        placeholder="Was ist dort besonders gut?"
        multiline
        maxLength={1200}
      />
      <Text style={s.label}>Eignung</Text>
      <View style={s.chips}>
        {statuses.map(([id, label]) => (
          <Chip
            key={id}
            label={label}
            active={status === id}
            onPress={() => setStatus(id)}
          />
        ))}
      </View>
      <Text style={s.label}>Kategorie</Text>
      <View style={s.chips}>
        {categories.map((item) => (
          <Chip
            key={item}
            label={item}
            active={category === item}
            onPress={() => setCategory(item)}
          />
        ))}
      </View>
      <AppInput
        value={price}
        onChangeText={setPrice}
        placeholder="Preis optional, z. B. 8,50"
        keyboardType="decimal-pad"
      />
      <SectionTitle>Standort</SectionTitle>
      <AppInput
        value={place}
        onChangeText={(value) => {
          setPlace(value);
          setLat(null);
          setLng(null);
        }}
        placeholder="Adresse oder Ort suchen"
      />
      {suggestions.map((item) => (
        <Pressable
          key={item.id}
          style={s.suggestion}
          onPress={() => selectPlace(item)}
        >
          <MapPin color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={s.suggestionTitle}>{item.name}</Text>
            <Text style={s.suggestionText}>{item.address}</Text>
          </View>
        </Pressable>
      ))}
      <SecondaryButton title="Aktuellen Standort verwenden" onPress={locate} />
      {lat !== null ? (
        <Text style={s.selectedLocation}>
          Standort ausgewählt · {lat.toFixed(4)}, {lng?.toFixed(4)}
        </Text>
      ) : null}
      <PrimaryButton
        title="Spot auf die Karte bringen"
        loading={saving}
        disabled={saving}
        onPress={submit}
      />
      <Text style={s.notice}>
        Bitte teile nur Orte, die du selbst besucht oder zuverlässig geprüft
        hast. Rezepturen und Angebote können sich ändern.
      </Text>
    </AppScreen>
  );
}
function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  title: { fontSize: type.title, fontWeight: "800", color: colors.text },
  copy: { fontSize: type.body, lineHeight: 24, color: colors.textMuted },
  preview: { width: "100%", height: 240, borderRadius: radius.xl },
  remove: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#0009",
    alignItems: "center",
    justifyContent: "center",
  },
  photoActions: { gap: space.md },
  label: { fontSize: type.caption, fontWeight: "800", color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: type.caption, fontWeight: "700", color: colors.text },
  chipTextActive: { color: "#fff" },
  suggestion: {
    flexDirection: "row",
    gap: space.md,
    alignItems: "center",
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionTitle: {
    fontSize: type.body,
    fontWeight: "700",
    color: colors.text,
  },
  suggestionText: { fontSize: type.caption, color: colors.textMuted },
  selectedLocation: {
    fontSize: type.caption,
    color: colors.primary,
    fontWeight: "700",
  },
  notice: {
    fontSize: type.caption,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: "center",
  },
});
