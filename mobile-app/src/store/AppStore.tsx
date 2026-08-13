import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  clearAccountScans,
  deleteAccountFavorite,
  deleteAccountScan,
  loadAccountData,
  saveAccountFavorite,
  saveAccountProfile,
  saveAccountScan,
} from "../lib/data";
import type {
  MenuAnalysis,
  ProductResult,
  ScanRecord,
  UserProfile,
} from "../types";
const KEYS = {
  profile: "vn.profile.v2",
  scans: "vn.scans.v2",
  favorites: "vn.favorites.v2",
  onboarded: "vn.onboarded.v2",
  menuAnalysis: "vn.menu-analysis.v1",
};
const defaultProfile: UserProfile = {
  name: "",
  dietMode: "vegan",
  goal: "Ich lebe vegan.",
  exclusions: [],
  country: "DE",
  language: "de",
};
type Store = {
  ready: boolean;
  syncing: boolean;
  syncError: string;
  onboarded: boolean;
  profile: UserProfile;
  scans: ScanRecord[];
  favorites: ProductResult[];
  menuAnalysis: MenuAnalysis | null;
  refresh(): Promise<void>;
  completeOnboarding(p: UserProfile): Promise<void>;
  updateProfile(p: UserProfile): Promise<void>;
  addScan(type: ScanRecord["type"], result: ProductResult): Promise<void>;
  toggleFavorite(result: ProductResult): Promise<void>;
  removeScan(id: string): Promise<void>;
  clearScans(): Promise<void>;
  saveMenuAnalysis(result: MenuAnalysis): Promise<void>;
};
const Context = createContext<Store | null>(null);
export function AppStoreProvider({ children }: PropsWithChildren) {
  const { user, ready: authReady } = useAuth();
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [onboarded, setOnboarded] = useState(false);
  const [profile, setProfile] = useState(defaultProfile);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [favorites, setFavorites] = useState<ProductResult[]>([]);
  const [menuAnalysis, setMenuAnalysis] = useState<MenuAnalysis | null>(null);
  const persist = useCallback(
    async (
      nextProfile: UserProfile,
      nextScans: ScanRecord[],
      nextFavorites: ProductResult[],
      nextOnboarded: boolean,
    ) =>
      Promise.all([
        AsyncStorage.setItem(KEYS.profile, JSON.stringify(nextProfile)),
        AsyncStorage.setItem(KEYS.scans, JSON.stringify(nextScans)),
        AsyncStorage.setItem(KEYS.favorites, JSON.stringify(nextFavorites)),
        AsyncStorage.setItem(KEYS.onboarded, String(nextOnboarded)),
      ]),
    [],
  );
  const loadLocal = useCallback(async () => {
    const [p, s, f, o, m] = await Promise.all([
      AsyncStorage.getItem(KEYS.profile),
      AsyncStorage.getItem(KEYS.scans),
      AsyncStorage.getItem(KEYS.favorites),
      AsyncStorage.getItem(KEYS.onboarded),
      AsyncStorage.getItem(KEYS.menuAnalysis),
    ]);
    const np = p ? JSON.parse(p) : defaultProfile;
    const ns = s ? JSON.parse(s) : [];
    const nf = f ? JSON.parse(f) : [];
    const no = o === "true";
    setProfile(np);
    setScans(ns);
    setFavorites(nf);
    setOnboarded(no);
    setMenuAnalysis(m ? JSON.parse(m) : null);
  }, []);
  const refresh = useCallback(async () => {
    if (!user) {
      await loadLocal();
      return;
    }
    setSyncing(true);
    setSyncError("");
    try {
      const [data, savedMenu] = await Promise.all([
        loadAccountData(user),
        AsyncStorage.getItem(KEYS.menuAnalysis),
      ]);
      setProfile(data.profile);
      setScans(data.scans);
      setFavorites(data.favorites);
      setOnboarded(data.onboarded);
      setMenuAnalysis(savedMenu ? JSON.parse(savedMenu) : null);
      await persist(data.profile, data.scans, data.favorites, data.onboarded);
    } catch (e) {
      setSyncError(
        e instanceof Error ? e.message : "Synchronisierung fehlgeschlagen.",
      );
      await loadLocal();
    } finally {
      setSyncing(false);
    }
  }, [user, loadLocal, persist]);
  useEffect(() => {
    if (!authReady) return;
    setReady(false);
    void refresh().finally(() => setReady(true));
  }, [authReady, user?.id, refresh]);
  const updateProfile = useCallback(
    async (p: UserProfile) => {
      const old = profile;
      setProfile(p);
      try {
        if (user) await saveAccountProfile(user, p, onboarded);
        await persist(p, scans, favorites, onboarded);
      } catch (e) {
        setProfile(old);
        throw e;
      }
    },
    [profile, user, onboarded, scans, favorites, persist],
  );
  const completeOnboarding = useCallback(
    async (p: UserProfile) => {
      if (user) await saveAccountProfile(user, p, true);
      setProfile(p);
      setOnboarded(true);
      await persist(p, scans, favorites, true);
    },
    [user, scans, favorites, persist],
  );
  const addScan = useCallback(
    async (type: ScanRecord["type"], result: ProductResult) => {
      const requestId = randomUUID();
      const record: ScanRecord = {
        id: requestId,
        type,
        title: result.name,
        result,
        createdAt: new Date().toISOString(),
      };
      const next = [record, ...scans].slice(0, 50);
      setScans(next);
      await persist(profile, next, favorites, onboarded);
      try {
        if (user) await saveAccountScan(user, record, requestId);
      } catch (e) {
        setSyncError(
          e instanceof Error
            ? e.message
            : "Scan konnte nicht synchronisiert werden.",
        );
        throw e;
      }
    },
    [scans, profile, favorites, onboarded, user, persist],
  );
  const toggleFavorite = useCallback(
    async (result: ProductResult) => {
      const exists = favorites.some((x) => x.code === result.code);
      const next = exists
        ? favorites.filter((x) => x.code !== result.code)
        : [result, ...favorites];
      setFavorites(next);
      try {
        if (user) {
          if (exists) await deleteAccountFavorite(user, result.code);
          else await saveAccountFavorite(user, result);
        }
        await persist(profile, scans, next, onboarded);
      } catch (e) {
        setFavorites(favorites);
        throw e;
      }
    },
    [favorites, user, profile, scans, onboarded, persist],
  );
  const removeScan = useCallback(
    async (id: string) => {
      if (user && !id.includes("-")) await deleteAccountScan(user, id);
      const next = scans.filter((x) => x.id !== id);
      setScans(next);
      await persist(profile, next, favorites, onboarded);
    },
    [user, scans, profile, favorites, onboarded, persist],
  );
  const clearScans = useCallback(async () => {
    if (user) await clearAccountScans(user);
    setScans([]);
    await persist(profile, [], favorites, onboarded);
  }, [user, profile, favorites, onboarded, persist]);
  const saveMenuAnalysis = useCallback(async (result: MenuAnalysis) => {
    setMenuAnalysis(result);
    await AsyncStorage.setItem(KEYS.menuAnalysis, JSON.stringify(result));
  }, []);
  const value = useMemo(
    () => ({
      ready,
      syncing,
      syncError,
      onboarded,
      profile,
      scans,
      favorites,
      menuAnalysis,
      refresh,
      completeOnboarding,
      updateProfile,
      addScan,
      toggleFavorite,
      removeScan,
      clearScans,
      saveMenuAnalysis,
    }),
    [
      ready,
      syncing,
      syncError,
      onboarded,
      profile,
      scans,
      favorites,
      menuAnalysis,
      refresh,
      completeOnboarding,
      updateProfile,
      addScan,
      toggleFavorite,
      removeScan,
      clearScans,
      saveMenuAnalysis,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAppStore() {
  const value = useContext(Context);
  if (!value) throw new Error("AppStoreProvider fehlt");
  return value;
}
