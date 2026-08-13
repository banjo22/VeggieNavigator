import "react-native-url-polyfill/auto";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { createClient, type Session } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const secureAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
export const authConfigured = Boolean(url && publishableKey);
export const authRedirectUrl = Linking.createURL("sign-in");
export const resetRedirectUrl = Linking.createURL("reset-password");
export const supabase = authConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        storage: secureAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export async function consumeAuthUrl(value: string): Promise<Session | null> {
  if (!supabase) return null;
  const parsed = Linking.parse(value);
  const params = parsed.queryParams ?? {};
  const code = typeof params.code === "string" ? params.code : "";
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }
  const hash = value.includes("#")
    ? new URLSearchParams(value.split("#")[1])
    : null;
  const access =
    hash?.get("access_token") ??
    (typeof params.access_token === "string" ? params.access_token : "");
  const refresh =
    hash?.get("refresh_token") ??
    (typeof params.refresh_token === "string" ? params.refresh_token : "");
  if (access && refresh) {
    const { data, error } = await supabase.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    });
    if (error) throw error;
    return data.session;
  }
  return null;
}
export function friendlyAuthError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Authentifizierung fehlgeschlagen.";
  if (message.includes("Invalid login"))
    return "E-Mail oder Passwort ist nicht korrekt.";
  if (message.includes("already registered"))
    return "Für diese E-Mail existiert bereits ein Konto.";
  if (message.includes("Password should"))
    return "Das Passwort muss mindestens 6 Zeichen lang sein.";
  if (message.includes("Email not confirmed"))
    return "Bitte bestätige zuerst deine E-Mail-Adresse.";
  return message;
}
