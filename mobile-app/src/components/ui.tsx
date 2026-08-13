import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AlertTriangle,
  Check,
  CircleHelp,
  RefreshCw,
} from "lucide-react-native";
import { colors, radius, space, type } from "../theme";
import type { Suitability } from "../types";

export function AppScreen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const content = <View style={styles.screenInner}>{children}</View>;
  return scroll ? (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {content}
      </ScrollView>
    </SafeAreaView>
  ) : (
    <SafeAreaView
      style={[styles.screen, styles.screenInner]}
      edges={["top", "left", "right", "bottom"]}
    >
      {children}
    </SafeAreaView>
  );
}
export function PrimaryButton({
  title,
  loading,
  ...props
}: PressableProps & { title: string; loading?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.primary,
        pressed && styles.pressed,
        props.disabled && styles.disabled,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.primaryText}>{title}</Text>
      )}
    </Pressable>
  );
}
export function SecondaryButton({
  title,
  ...props
}: PressableProps & { title: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
      {...props}
    >
      <Text style={styles.secondaryText}>{title}</Text>
    </Pressable>
  );
}
export function AppInput({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      style={[styles.input, style]}
      {...props}
    />
  );
}
export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}
export function StatusBadge({ status }: { status: Suitability }) {
  const meta = statusMeta(status);
  return (
    <View style={[styles.badge, { backgroundColor: meta.soft }]}>
      <meta.Icon size={15} color={meta.color} />
      <Text style={[styles.badgeText, { color: meta.color }]}>
        {meta.label}
      </Text>
    </View>
  );
}
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.state}>
      <AlertTriangle color={colors.danger} size={32} />
      <Text style={styles.stateTitle}>Das hat nicht geklappt</Text>
      <Text style={styles.stateText}>{message}</Text>
      {onRetry ? (
        <SecondaryButton title="Erneut versuchen" onPress={onRetry} />
      ) : null}
    </View>
  );
}
export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.state}>
      <CircleHelp color={colors.primary} size={32} />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}
export function LoadingState({ text = "Wird geladen …" }: { text?: string }) {
  return (
    <View style={styles.state}>
      <RefreshCw color={colors.primary} size={30} />
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}
export function statusMeta(status: Suitability) {
  if (status === "vegan")
    return {
      label: "Vegan geeignet",
      color: colors.vegan,
      soft: "#E7F3EC",
      Icon: Check,
    };
  if (status === "vegetarian")
    return {
      label: "Vegetarisch",
      color: colors.warning,
      soft: "#FFF3D9",
      Icon: Check,
    };
  if (status === "not_suitable")
    return {
      label: "Nicht geeignet",
      color: colors.danger,
      soft: "#FDE8E6",
      Icon: AlertTriangle,
    };
  if (status === "possibly_adaptable")
    return {
      label: "Anpassbar",
      color: colors.warning,
      soft: "#FFF3D9",
      Icon: CircleHelp,
    };
  return {
    label: "Unklar",
    color: colors.unclear,
    soft: "#EDF0F2",
    Icon: CircleHelp,
  };
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 110 },
  screenInner: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    gap: space.lg,
  },
  primary: {
    minHeight: 54,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: type.body },
  secondary: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  secondaryText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: type.body,
  },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.5 },
  input: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    fontSize: type.body,
    color: colors.text,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: type.section,
    fontWeight: "700",
    color: colors.text,
  },
  badge: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.round,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: type.caption, fontWeight: "700" },
  state: {
    padding: space.xxl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: space.md,
  },
  stateTitle: {
    fontSize: type.card,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  stateText: {
    fontSize: type.body,
    lineHeight: 23,
    color: colors.textMuted,
    textAlign: "center",
  },
});
