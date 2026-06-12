import { createClient, type User } from "@supabase/supabase-js";
import type { Provider } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const authConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const supabase = authConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null;

export type AuthUser = User;

export async function getCurrentUser() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export function onAuthChange(callback: (user: AuthUser | null) => void) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error("Supabase Auth ist nicht konfiguriert.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signUpWithPassword(email: string, password: string, profileName: string) {
  if (!supabase) throw new Error("Supabase Auth ist nicht konfiguriert.");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: {
        profile_name: profileName,
        full_name: profileName
      }
    }
  });
  if (error) throw error;
  return data.user;
}

export async function signInWithOAuth(provider: Provider) {
  if (!supabase) throw new Error("Supabase Auth ist nicht konfiguriert.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/`
    }
  });
  if (error) throw error;
}

export async function updateProfileName(profileName: string) {
  if (!supabase) throw new Error("Supabase Auth ist nicht konfiguriert.");
  const { data, error } = await supabase.auth.updateUser({
    data: {
      profile_name: profileName,
      full_name: profileName
    }
  });
  if (error) throw error;
  return data.user;
}

export async function logout() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
