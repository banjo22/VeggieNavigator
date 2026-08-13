import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ChevronLeft, Flashlight, Keyboard } from "lucide-react-native";
import {
  AppInput,
  ErrorState,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";
import { getProduct } from "@/lib/api";
import { createScanGate } from "@/lib/scanDedupe";
import { useAppStore } from "@/store/AppStore";
import { colors, radius, space, type } from "@/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export default function Scanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, addScan } = useAppStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState("");
  const gate = useMemo(() => createScanGate(), []);
  const handle = async (value: string) => {
    const clean = value.trim();
    if (!clean || loading || !gate(clean)) return;
    setLoading(true);
    setError("");
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const product = await getProduct(clean, profile.dietMode);
      if (!product) {
        router.replace(
          `/photo?mode=ingredients&barcode=${encodeURIComponent(clean)}`,
        );
        return;
      }
      await addScan("barcode", product);
      router.replace({ pathname: "/result", params: { code: product.code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };
  if (!permission)
    return (
      <View style={s.permission}>
        <Text>Lade Kameraberechtigung …</Text>
      </View>
    );
  if (!permission.granted)
    return (
      <View style={s.permission}>
        <Text style={s.permissionTitle}>
          Für das Scannen benötigen wir Zugriff auf deine Kamera.
        </Text>
        <Text style={s.permissionText}>
          Die Kamera wird nur geöffnet, wenn du aktiv scannst.
        </Text>
        {permission.canAskAgain ? (
          <PrimaryButton
            title="Kamerazugriff erlauben"
            onPress={requestPermission}
          />
        ) : (
          <PrimaryButton
            title="In den Einstellungen öffnen"
            onPress={Linking.openSettings}
          />
        )}
        <SecondaryButton
          title="Barcode manuell eingeben"
          onPress={() => setManual(true)}
        />
        <Manual
          visible={manual}
          code={code}
          setCode={setCode}
          close={() => setManual(false)}
          submit={() => handle(code)}
        />
      </View>
    );
  return (
    <View style={s.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"],
        }}
        onBarcodeScanned={(event: BarcodeScanningResult) => handle(event.data)}
      />
      <View
        style={[
          s.overlay,
          {
            paddingTop: insets.top + space.md,
            paddingBottom: insets.bottom + space.md,
          },
        ]}
      >
        <View style={s.top}>
          <Pressable
            style={s.circle}
            onPress={() => router.back()}
            accessibilityLabel="Scanner schließen"
          >
            <ChevronLeft color="#fff" />
          </Pressable>
          <Text style={s.cameraTitle}>Barcode scannen</Text>
          <View style={{ width: 48 }} />
        </View>
        <Text style={s.hint}>Halte den Barcode in den Rahmen</Text>
        <View style={s.frame} />
        {error ? (
          <View style={s.error}>
            <ErrorState message={error} onRetry={() => setError("")} />
          </View>
        ) : null}
        <View style={s.bottom}>
          <Pressable style={s.cameraAction} onPress={() => setTorch((x) => !x)}>
            <Flashlight color="#fff" />
            <Text style={s.actionText}>{torch ? "Blitz aus" : "Blitz"}</Text>
          </Pressable>
          <Text style={s.loading}>
            {loading
              ? "Produkt wird geprüft …"
              : "Barcode wird automatisch erkannt"}
          </Text>
          <Pressable style={s.cameraAction} onPress={() => setManual(true)}>
            <Keyboard color="#fff" />
            <Text style={s.actionText}>Manuell</Text>
          </Pressable>
        </View>
      </View>
      <Manual
        visible={manual}
        code={code}
        setCode={setCode}
        close={() => setManual(false)}
        submit={() => handle(code)}
      />
    </View>
  );
}
function Manual({
  visible,
  code,
  setCode,
  close,
  submit,
}: {
  visible: boolean;
  code: string;
  setCode: (x: string) => void;
  close: () => void;
  submit: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <View style={s.modal}>
        <View style={s.sheet}>
          <Text style={s.permissionTitle}>Barcode eingeben</Text>
          <AppInput
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            placeholder="z. B. 4012345678901"
          />
          <PrimaryButton title="Produkt prüfen" onPress={submit} />
          <SecondaryButton title="Abbrechen" onPress={close} />
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.camera },
  overlay: { flex: 1, padding: space.xl, alignItems: "center" },
  top: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0008",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraTitle: { fontSize: type.section, color: "#fff", fontWeight: "800" },
  hint: {
    marginTop: 42,
    color: "#fff",
    backgroundColor: "#000A",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.round,
    fontSize: type.body,
  },
  frame: {
    marginTop: 42,
    width: "90%",
    aspectRatio: 1.3,
    borderWidth: 4,
    borderColor: "#fff",
    borderRadius: radius.xl,
  },
  bottom: {
    marginTop: "auto",
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 32,
  },
  cameraAction: { alignItems: "center", gap: space.sm, minWidth: 72 },
  actionText: { color: "#fff", fontSize: type.caption, fontWeight: "700" },
  loading: {
    color: "#fff",
    fontSize: type.caption,
    textAlign: "center",
    maxWidth: 140,
  },
  error: { position: "absolute", left: 20, right: 20, bottom: 130 },
  permission: {
    flex: 1,
    justifyContent: "center",
    padding: space.xxl,
    gap: space.lg,
    backgroundColor: colors.background,
  },
  permissionTitle: {
    fontSize: type.section,
    fontWeight: "800",
    color: colors.text,
  },
  permissionText: {
    fontSize: type.body,
    lineHeight: 24,
    color: colors.textMuted,
  },
  modal: { flex: 1, backgroundColor: "#0008", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.background,
    padding: space.xxl,
    paddingBottom: 44,
    gap: space.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
});
