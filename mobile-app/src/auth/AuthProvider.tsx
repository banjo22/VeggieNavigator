import * as Linking from "expo-linking";
import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  authConfigured,
  authRedirectUrl,
  consumeAuthUrl,
  friendlyAuthError,
  resetRedirectUrl,
  supabase,
} from "../lib/auth";

type AuthContextValue = {
  ready: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  passwordRecovery: boolean;
  error: string;
  clearError(): void;
  signIn(email: string, password: string): Promise<void>;
  signUp(
    email: string,
    password: string,
    name: string,
  ): Promise<"confirmed" | "confirmation_required">;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
};
const Context = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) setError(friendlyAuthError(error));
        setSession(data.session);
      })
      .finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
    });
    const listener = Linking.addEventListener(
      "url",
      ({ url }) =>
        void consumeAuthUrl(url).catch((e) => setError(friendlyAuthError(e))),
    );
    void Linking.getInitialURL()
      .then((url) => (url ? consumeAuthUrl(url) : null))
      .catch((e) => setError(friendlyAuthError(e)));
    return () => {
      data.subscription.unsubscribe();
      listener.remove();
    };
  }, []);
  const run = useCallback(async (action: () => Promise<void>) => {
    setError("");
    try {
      await action();
    } catch (e) {
      const message = friendlyAuthError(e);
      setError(message);
      throw new Error(message);
    }
  }, []);
  const signIn = useCallback(
    (email: string, password: string) =>
      run(async () => {
        if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }),
    [run],
  );
  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      let state: "confirmed" | "confirmation_required" =
        "confirmation_required";
      await run(async () => {
        if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: authRedirectUrl,
            data: { profile_name: name.trim(), full_name: name.trim() },
          },
        });
        if (error) throw error;
        state = data.session ? "confirmed" : "confirmation_required";
      });
      return state;
    },
    [run],
  );
  const signOut = useCallback(
    () =>
      run(async () => {
        if (supabase) {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;
        }
      }),
    [run],
  );
  const requestPasswordReset = useCallback(
    (email: string) =>
      run(async () => {
        if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: resetRedirectUrl },
        );
        if (error) throw error;
      }),
    [run],
  );
  const updatePassword = useCallback(
    (password: string) =>
      run(async () => {
        if (!supabase) throw new Error("Supabase ist nicht konfiguriert.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPasswordRecovery(false);
      }),
    [run],
  );
  const value = useMemo(
    () => ({
      ready,
      configured: authConfigured,
      session,
      user: session?.user ?? null,
      passwordRecovery,
      error,
      clearError: () => setError(""),
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
    }),
    [
      ready,
      session,
      passwordRecovery,
      error,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider fehlt");
  return value;
}
