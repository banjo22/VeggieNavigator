import { StyleSheet, Text, View } from "react-native";
import { AppInput, ErrorState, PrimaryButton, SecondaryButton } from "./ui";
import { colors, space, type } from "../theme";
export function AuthForm({
  title,
  copy,
  error,
  children,
  primaryTitle,
  loading,
  onPrimary,
  secondaryTitle,
  onSecondary,
}: {
  title: string;
  copy: string;
  error?: string;
  children: React.ReactNode;
  primaryTitle: string;
  loading?: boolean;
  onPrimary: () => void;
  secondaryTitle?: string;
  onSecondary?: () => void;
}) {
  return (
    <View style={s.wrap}>
      <Text style={s.title}>{title}</Text>
      <Text style={s.copy}>{copy}</Text>
      {children}
      {error ? <ErrorState message={error} /> : null}
      <PrimaryButton
        title={primaryTitle}
        loading={loading}
        disabled={loading}
        onPress={onPrimary}
      />
      {secondaryTitle && onSecondary ? (
        <SecondaryButton title={secondaryTitle} onPress={onSecondary} />
      ) : null}
    </View>
  );
}
export { AppInput };
const s = StyleSheet.create({
  wrap: { gap: space.lg },
  title: { fontSize: type.title, fontWeight: "800", color: colors.text },
  copy: { fontSize: type.body, lineHeight: 24, color: colors.textMuted },
});
