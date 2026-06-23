import { AlertTriangle, Camera, Check, Coffee, Crown, Heart, Home, Loader2, LogIn, MapPinned, MenuSquare, Plus, ScanLine, Search, ShieldCheck, ShoppingBag, Sparkles, Star, Store, ThumbsDown, ThumbsUp, Trash2, UploadCloud, Utensils, UserRound, X } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { ChangeEvent, MouseEvent, ReactNode } from "react";
import {
  analyzeMenuPhoto,
  analyzeIngredientPhoto,
  claimCommunitySpots,
  confirmCommunitySpot as saveSpotConfirmation,
  createCommunitySpot as saveCommunitySpot,
  deleteAllScans as deleteAllRemoteScans,
  deleteScan as deleteRemoteScan,
  fetchComments,
  fetchCommunitySpots,
  fetchProfile,
  fetchProductFavorites,
  fetchPriceOptions,
  fetchProductByBarcode,
  fetchScanQuota,
  fetchScans,
  deleteComment as deleteRemoteComment,
  deleteProductFavorite as deleteRemoteProductFavorite,
  reactToCommunitySpot as saveSpotReaction,
  saveComment,
  saveProfile as saveUserProfile,
  saveProductFavorite,
  saveScan,
  searchPlaces,
  type CommentPayload,
  type CommunitySpotPayload,
  type IngredientAnalysis,
  type PlaceSuggestion,
  type ProfilePayload,
  type PriceOption,
  type ScanQuota
} from "./services/api";
import {
  categories,
  featureCards,
  initialFinds,
  recommendations,
  type CommunitySpot,
  type VeggieStatus
} from "./data/mockData";
import { authConfigured, clearProfileAvatarMetadata, getAccessToken, getCurrentUser, logout, onAuthChange, signInWithOAuth, signInWithPassword, signUpWithPassword, updateProfileName, type AuthUser } from "./services/auth";
import type { ProductResult } from "./services/openFoodFacts";

type Screen = "home" | "scanner" | "map" | "add" | "pricing" | "profile";
type AppRoute = { screen: Screen; spotId?: number };
type Find = CommunitySpot & { confirmations?: number; viewerConfirmed?: boolean; likeCount?: number; dislikeCount?: number; viewerReaction?: SpotReaction | "" };
type BarcodeResult = { rawValue: string };
type UserLocation = { lat: number; lng: number };
type ScanHistoryItem =
  | { id: number; type: "product"; title: string; subtitle: string; barcode: string; product: ProductResult }
  | { id: number; type: "ingredients"; title: string; subtitle: string; photo: string; analysis: IngredientAnalysis }
  | { id: number; type: "menu"; title: string; subtitle: string; photo: string; text: string };
type ScanRow = { id: number; type: string; title: string; subtitle: string; payload?: unknown };
type SpotComment = { id: number; userId?: string; author: string; text: string; createdAt: string; parentId?: number | null };
type ProfilePrivacy = { publicSpots: boolean; publicScans: boolean };
type PremiumState = { isPremium: boolean; status: string; plan: string; premiumUntil: string | null };
type MapFilterId = "all" | "vegan" | "vegetarian" | "cheap" | "confirmed" | "photo";
type SpotReaction = "like" | "dislike";
type DietMode = "vegan" | "vegetarisch" | "flexitarisch";
type DietaryPreferences = { diet: DietMode; warnings: string[] };
type FavoriteProduct = { barcode: string; name: string; status: VeggieStatus; imageUrl?: string; reason: string; createdAt: string };

const SCAN_HISTORY_STORAGE_KEY = "veggie-navigator-scan-history";
const SCAN_HISTORY_LIMIT = 10;
const PROFILE_PRIVACY_STORAGE_KEY = "veggie-navigator-profile-privacy";
const DIETARY_PREFERENCES_STORAGE_KEY = "veggie-navigator-dietary-preferences";
const PRODUCT_FAVORITES_STORAGE_KEY = "veggie-navigator-product-favorites";
const GUEST_DAILY_SCAN_LIMIT = 3;
const USER_DAILY_SCAN_LIMIT = 5;
const FREE_PREMIUM_STATE: PremiumState = { isPremium: false, status: "free", plan: "free", premiumUntil: null };
const DEFAULT_DIETARY_PREFERENCES: DietaryPreferences = { diet: "vegan", warnings: ["milch", "ei", "gelatine", "honig"] };
const warningOptions = [
  { id: "milch", label: "Milch" },
  { id: "ei", label: "Ei" },
  { id: "gelatine", label: "Gelatine" },
  { id: "honig", label: "Honig" },
  { id: "palmöl", label: "Palmöl" },
  { id: "gluten", label: "Gluten" },
  { id: "nüsse", label: "Nüsse" },
  { id: "soja", label: "Soja" }
];
const mapFilters: Array<{ id: MapFilterId; label: string }> = [
  { id: "all", label: "Alle" },
  { id: "vegan", label: "Vegan" },
  { id: "vegetarian", label: "Vegetarisch" },
  { id: "cheap", label: "Günstig" },
  { id: "confirmed", label: "Bestätigt" },
  { id: "photo", label: "Mit Foto" }
];

declare global {
  interface Window {
    BarcodeDetector?: {
      new(options?: { formats?: string[] }): { detect(source: CanvasImageSource): Promise<BarcodeResult[]> };
    };
  }
}

const navItems: Array<{ screen: Screen; label: string; icon: typeof Home }> = [
  { screen: "home", label: "Home", icon: Home },
  { screen: "scanner", label: "Scanner", icon: ScanLine },
  { screen: "add", label: "Hinzufügen", icon: Plus },
  { screen: "map", label: "Karte", icon: MapPinned },
  { screen: "profile", label: "Profil", icon: UserRound }
];

const screenPaths: Record<Screen, string> = {
  home: "/",
  scanner: "/scanner",
  map: "/karte",
  add: "/hinzufuegen",
  pricing: "/premium",
  profile: "/profil"
};

function getRouteFromLocation(): AppRoute {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const spotMatch = path.match(/^\/spots\/(\d+)$/);
  if (spotMatch) return { screen: "map", spotId: Number(spotMatch[1]) };
  if (path === "/scanner") return { screen: "scanner" };
  if (path === "/karte" || path === "/spots") return { screen: "map" };
  if (path === "/hinzufuegen" || path === "/hinzuf%C3%BCgen" || path === "/hinzufügen") return { screen: "add" };
  if (path === "/premium") return { screen: "pricing" };
  if (path === "/profil") return { screen: "profile" };
  return { screen: "home" };
}

function pathForScreen(screen: Screen) {
  return screenPaths[screen] || "/";
}

const statusStyles: Record<VeggieStatus, string> = {
  vegan: "bg-leaf text-white",
  vegetarisch: "bg-honey text-ink",
  "nicht veggie": "bg-tomato text-white",
  "vegan möglich": "bg-sage text-moss"
};

const statusLabels: Record<string, string> = {
  vegan: "vegan",
  vegetarisch: "vegetarisch",
  "nicht veggie": "nicht geeignet",
  "vegan möglich": "vegan möglich",
  unklar: "unklar"
};

function Badge({ status }: { status: VeggieStatus }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}>{statusLabels[status] || status}</span>;
}

function FindIcon({ category, size = 18 }: { category: string; size?: number }) {
  if (category === "Restaurant") return <Utensils size={size} />;
  if (category === "Supermarkt") return <Store size={size} />;
  if (category === "Café & Bäckerei") return <Coffee size={size} />;
  if (category === "Imbiss" || category === "Mensa/Kantine" || category === "Lieferdienst") return <ShoppingBag size={size} />;
  return <Star size={size} />;
}

function Shell({ screen, setScreen, children }: { screen: Screen; setScreen: (screen: Screen) => void; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream pb-24 text-ink md:pb-0">
      <div className="mx-auto flex w-full max-w-full md:min-h-screen md:max-w-6xl">
        <aside className="hidden w-64 border-r border-oat/80 px-5 py-8 md:block">
          <button onClick={() => setScreen("home")} className="mb-10 flex items-center gap-3 text-left">
            <span className="grid size-11 place-items-center rounded-2xl bg-moss text-white"><Sparkles size={20} /></span>
            <span>
              <span className="block text-lg font-bold">Veggie Navigator</span>
              <span className="text-sm text-ink/60">Find better food</span>
            </span>
          </button>
          <nav className="space-y-2">
            {navItems.map(({ screen: itemScreen, label, icon: Icon }) => (
              <button key={itemScreen} onClick={() => setScreen(itemScreen)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${screen === itemScreen ? "bg-moss text-white shadow-soft" : "text-ink/70 hover:bg-white"}`}>
                <Icon size={18} /> {label}
              </button>
            ))}
          </nav>
          <button onClick={() => setScreen("pricing")} className="mt-8 flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white">
            <Crown size={18} /> Premium
          </button>
        </aside>
        <main className="box-border w-full min-w-0 max-w-full overflow-x-hidden px-4 py-5 sm:px-6 md:px-8 md:py-8">{children}</main>
      </div>
      <nav className="fixed inset-x-3 bottom-3 z-20 grid grid-cols-5 rounded-3xl bg-white/95 p-2 shadow-soft backdrop-blur md:hidden">
        {navItems.map(({ screen: itemScreen, label, icon: Icon }) => (
          <button key={itemScreen} onClick={() => setScreen(itemScreen)} className={`grid justify-items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold ${screen === itemScreen ? "bg-moss text-white" : "text-ink/60"}`} aria-label={label}>
            <Icon size={19} /> {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Header({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}

function HomeScreen({ setScreen, user }: { setScreen: (screen: Screen) => void; user: AuthUser | null }) {
  const name = user ? getUserDisplayName(user) : "";
  return (
    <>
      <Header eyebrow={name ? `Hallo ${name}` : "Hallo"} title="Entdecken, prüfen, teilen." />
      <button onClick={() => setScreen("scanner")} className="mb-5 w-full rounded-3xl bg-moss p-6 text-left text-white shadow-soft">
        <div className="flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white text-moss"><ScanLine size={28} /></span>
          <span>
            <span className="block text-2xl font-bold">Produkt oder Speisekarte scannen</span>
            <span className="mt-2 block text-sm leading-6 text-white/80">Check Zutaten, Barcodes oder Restaurantkarten direkt mit Kamera oder Foto.</span>
          </span>
        </div>
      </button>
      <section className="grid gap-3 sm:grid-cols-3">
        {featureCards.filter((card) => card.target !== "add").map((card) => (
          <button key={card.title} onClick={() => setScreen(card.target)} className="rounded-3xl bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5">
            <div className="mb-5 grid size-11 place-items-center rounded-2xl bg-sage text-moss">
              {card.target === "scanner" && <ScanLine />}
              {card.target === "map" && <MapPinned />}
            </div>
            <h2 className="text-xl font-bold">{card.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">{card.text}</p>
          </button>
        ))}
      </section>
      <section className="mt-6 grid gap-3 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-3xl bg-white p-5 shadow-soft">
          <h2 className="text-lg font-bold">Neue Spots</h2>
          <div className="mt-4 space-y-3">
            {recommendations.map((item) => (
              <div key={item.label} className="rounded-2xl bg-cream p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-moss">{item.label}</p>
                <p className="mt-1 font-semibold">{item.value}</p>
              </div>
            ))}
            {recommendations.length === 0 && <p className="rounded-2xl bg-cream p-4 text-sm leading-6 text-ink/60">Noch keine Community-Spots. Der erste echte Beitrag erscheint hier.</p>}
          </div>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-soft">
          <LogIn className="mb-4 text-moss" />
          <h2 className="text-xl font-bold">Ohne Account starten</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">Ein Login ist nur für gespeicherte Lieblingsspots und spätere Sync-Funktionen gedacht. Beiträge sollen nicht hinter Premium liegen.</p>
        </div>
      </section>
    </>
  );
}

function ScannerScreen({ user, premium, setPremium, dietaryPreferences, favoriteProducts, toggleFavoriteProduct }: { user: AuthUser | null; premium: PremiumState; setPremium: (premium: PremiumState) => void; dietaryPreferences: DietaryPreferences; favoriteProducts: FavoriteProduct[]; toggleFavoriteProduct: (product: ProductResult) => void }) {
  const [scanMode, setScanMode] = useState<"ingredients" | "menu">("ingredients");
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<ProductResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState<PriceOption[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [analysis, setAnalysis] = useState<IngredientAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [menuPhotos, setMenuPhotos] = useState<string[]>([]);
  const [menuText, setMenuText] = useState("");
  const [menuLoading, setMenuLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [photoCameraActive, setPhotoCameraActive] = useState(false);
  const [ingredientPhoto, setIngredientPhoto] = useState("");
  const [ingredientMessage, setIngredientMessage] = useState("");
  const [menuMessage, setMenuMessage] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");
  const [quotaMessage, setQuotaMessage] = useState("");
  const [scanQuota, setScanQuota] = useState<ScanQuota | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>(() => readScanHistory(user?.id));
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const photoVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const photoStreamRef = useRef<MediaStream | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const analysisTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    stopCamera();
    stopPhotoCamera();
    analysisAbortRef.current?.abort();
    if (analysisTimeoutRef.current) window.clearTimeout(analysisTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!photoCameraActive || !photoVideoRef.current || !photoStreamRef.current) return;
    const video = photoVideoRef.current;
    video.srcObject = photoStreamRef.current;
    void video.play().catch(() => {
      const setter = scanMode === "ingredients" ? setIngredientMessage : setMenuMessage;
      setter("Kamera konnte nicht gestartet werden. Bitte Browser-Berechtigung prüfen.");
    });
  }, [photoCameraActive, scanMode]);

  useEffect(() => {
    if (user) return;
    saveScanHistory(scanHistory);
  }, [scanHistory, user]);

  useEffect(() => {
    let active = true;
    const userScopedHistory = readScanHistory(user?.id);
    setScanHistory(user ? [] : userScopedHistory);
    setScanQuota(null);
    setQuotaMessage("");
    setHistoryMessage("");
    if (!user) return () => {
      active = false;
    };
    const loadRemoteScans = () => fetchScans(user.id).then((items) => {
      if (!active) return;
      const remoteHistory = items.map(scanRowToHistoryItem).filter(Boolean) as ScanHistoryItem[];
      setScanHistory(remoteHistory);
    }).catch((error) => {
      if (!active) return;
      console.warn(error);
      setHistoryMessage("Deine gespeicherten Scans konnten gerade nicht aus Supabase geladen werden.");
    });
    void loadRemoteScans();
    const interval = window.setInterval(() => {
      void loadRemoteScans();
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    setQuotaMessage("");
    void getAccessToken().then((token) => fetchScanQuota(token)).then((quota) => {
      if (!active) return;
      applyQuota(quota);
    }).catch((error) => {
      if (!active) return;
      console.warn(error);
      if (error instanceof Error && error.message.includes("leer geantwortet")) return;
      setQuotaMessage(error instanceof Error ? error.message : "Scan-Limit konnte gerade nicht geladen werden.");
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  function applyQuota(quota?: ScanQuota) {
    if (!quota) return;
    setScanQuota(quota);
    setQuotaMessage("");
    setPremium({ isPremium: Boolean(quota.premium), status: quota.premiumStatus || "free", plan: quota.premiumPlan || "free", premiumUntil: quota.premiumUntil || null });
  }

  async function scanProduct(code = barcode) {
    const cleanedCode = code.trim();
    if (!cleanedCode) {
      setIngredientMessage("Bitte Barcode eingeben oder per Kamera scannen.");
      return;
    }
    setLoading(true);
    setProduct(null);
    setPrices([]);
    setIngredientMessage("");
    try {
      const { product: result, quota } = await fetchProductByBarcode(cleanedCode, await getAccessToken());
      applyQuota(quota);
      if (result) {
        setProduct(result);
        addScanHistory({
          id: Date.now(),
          type: "product",
          title: result.name,
          subtitle: `${result.status} - ${cleanedCode}`,
          barcode: cleanedCode,
          product: result
        });
        void loadPrices(cleanedCode);
      } else {
        setIngredientMessage("Kein Open-Food-Facts-Eintrag gefunden. In so einem Fall wäre ein Zutatenfoto besser.");
      }
    } catch (error) {
      setIngredientMessage(error instanceof Error ? error.message : "Produktdaten nicht erreichbar.");
    } finally {
      setLoading(false);
    }
  }

  async function loadPrices(code: string) {
    setPricesLoading(true);
    try {
      const result = await fetchPriceOptions(code);
      setPrices(result);
    } catch {
      setPrices([]);
    } finally {
      setPricesLoading(false);
    }
  }

  async function startCameraScan() {
    if (!window.BarcodeDetector) {
      setIngredientMessage("Dein Browser unterstützt Barcode-Scan per Kamera nicht. Du kannst den Barcode eintippen oder ein Zutatenfoto hochladen.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setIngredientMessage("Kamerazugriff ist in diesem Browser nicht verfügbar.");
      return;
    }

    setIngredientMessage("Kamera startet. Richte den Barcode ruhig und hell aus.");
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    streamRef.current = stream;
    setCameraActive(true);

    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    await video.play();

    const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
    const tick = async () => {
      if (!videoRef.current || !streamRef.current) return;
      const codes = await detector.detect(videoRef.current);
      if (codes[0]?.rawValue) {
        const detected = codes[0].rawValue;
        stopCamera();
        setBarcode(detected);
        setIngredientMessage(`Barcode erkannt: ${detected}`);
        void scanProduct(detected);
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }

  function stopCamera() {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  async function startPhotoCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      const setter = scanMode === "ingredients" ? setIngredientMessage : setMenuMessage;
      setter("Kamerazugriff ist in diesem Browser nicht verfügbar.");
      return;
    }

    try {
      stopCamera();
      stopPhotoCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      photoStreamRef.current = stream;
      setPhotoCameraActive(true);
      const setter = scanMode === "ingredients" ? setIngredientMessage : setMenuMessage;
      setter("Kamera bereit.");
    } catch (error) {
      const setter = scanMode === "ingredients" ? setIngredientMessage : setMenuMessage;
      setter(error instanceof DOMException && error.name === "NotAllowedError" ? "Kamera blockiert. Bitte im Browser erlauben." : "Kamera konnte nicht gestartet werden.");
    }
  }

  function stopPhotoCamera() {
    photoStreamRef.current?.getTracks().forEach((track) => track.stop());
    photoStreamRef.current = null;
    setPhotoCameraActive(false);
  }

  function capturePhoto() {
    const video = photoVideoRef.current;
    if (!video || video.readyState < 2) {
      const setter = scanMode === "ingredients" ? setIngredientMessage : setMenuMessage;
      setter("Kamera ist noch nicht bereit.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    stopPhotoCamera();
    if (scanMode === "ingredients") {
      setIngredientPhoto(imageDataUrl);
      void runIngredientAnalysis(imageDataUrl);
    } else {
      setMenuPhotos((current) => [...current, imageDataUrl].slice(0, 8));
      setMenuMessage("Seite hinzugefügt. Du kannst weitere Seiten fotografieren oder analysieren.");
    }
  }

  function handleIngredientUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    if (scanMode === "ingredients") {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const imageDataUrl = String(reader.result);
        setIngredientPhoto(imageDataUrl);
        void runIngredientAnalysis(imageDataUrl);
      };
      reader.readAsDataURL(file);
      return;
    }

    void readImageFiles(files.slice(0, 8 - menuPhotos.length)).then((images) => {
      setMenuPhotos((current) => [...current, ...images].slice(0, 8));
      setMenuMessage(`${images.length} Seite${images.length === 1 ? "" : "n"} hinzugefügt.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }).catch(() => setMenuMessage("Bilder konnten nicht gelesen werden."));
  }

  async function runIngredientAnalysis(imageDataUrl: string) {
    analysisAbortRef.current?.abort();
    if (analysisTimeoutRef.current) window.clearTimeout(analysisTimeoutRef.current);
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    analysisTimeoutRef.current = window.setTimeout(() => controller.abort(), 95000);
    setAnalysisLoading(true);
    setAnalysis(null);
    setIngredientMessage("KI analysiert die Zutatenliste.");
    try {
      const { result, quota } = await analyzeIngredientPhoto(imageDataUrl, controller.signal, await getAccessToken());
      applyQuota(quota);
      setAnalysis(result);
      addScanHistory({
        id: Date.now(),
        type: "ingredients",
        title: `Zutaten: ${result.status}`,
        subtitle: result.explanation.slice(0, 72),
        photo: await createScanThumbnail(imageDataUrl),
        analysis: result
      });
      setIngredientMessage("Zutatenliste wurde per KI analysiert.");
    } catch (error) {
      setIngredientMessage(error instanceof DOMException && error.name === "AbortError" ? "Analyse abgebrochen oder Timeout." : error instanceof Error ? error.message : "KI-Analyse nicht erreichbar.");
    } finally {
      setAnalysisLoading(false);
      if (analysisTimeoutRef.current) window.clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = null;
      if (analysisAbortRef.current === controller) analysisAbortRef.current = null;
    }
  }

  async function runMenuAnalysis(images = menuPhotos) {
    if (images.length === 0) {
      setMenuMessage("Bitte lade mindestens eine Speisekarten-Seite hoch oder fotografiere sie.");
      return;
    }
    analysisAbortRef.current?.abort();
    if (analysisTimeoutRef.current) window.clearTimeout(analysisTimeoutRef.current);
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    analysisTimeoutRef.current = window.setTimeout(() => controller.abort(), 95000);
    setMenuLoading(true);
    setMenuText("");
    setMenuMessage("Speisekarte wird analysiert.");
    try {
      const { text: result, quota } = await analyzeMenuPhoto(images, controller.signal, await getAccessToken());
      applyQuota(quota);
      setMenuText(result);
      addScanHistory({
        id: Date.now(),
        type: "menu",
        title: `Speisekarte (${images.length} Seite${images.length === 1 ? "" : "n"})`,
        subtitle: result.split("\n").find(Boolean)?.slice(0, 72) || "Analyse gespeichert",
        photo: await createScanThumbnail(images[0]),
        text: result
      });
      setMenuLoading(false);
      setMenuMessage("Speisekarte analysiert.");
    } catch (error) {
      setMenuMessage(error instanceof DOMException && error.name === "AbortError" ? "Analyse abgebrochen oder Timeout." : error instanceof Error ? error.message : "Speisekartenanalyse nicht erreichbar.");
    } finally {
      setMenuLoading(false);
      if (analysisTimeoutRef.current) window.clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = null;
      if (analysisAbortRef.current === controller) analysisAbortRef.current = null;
    }
  }

  function cancelAnalysis() {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    if (analysisTimeoutRef.current) window.clearTimeout(analysisTimeoutRef.current);
    analysisTimeoutRef.current = null;
    if (scanMode === "ingredients") {
      setIngredientPhoto("");
      setAnalysis(null);
      setIngredientMessage("Analyse abgebrochen.");
    } else {
      setMenuPhotos([]);
      setMenuText("");
      setMenuMessage("Analyse abgebrochen.");
    }
    stopPhotoCamera();
    if (fileInputRef.current) fileInputRef.current.value = "";
    setAnalysisLoading(false);
    setMenuLoading(false);
  }

  function resetCurrentScan() {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    if (analysisTimeoutRef.current) window.clearTimeout(analysisTimeoutRef.current);
    analysisTimeoutRef.current = null;
    stopCamera();
    stopPhotoCamera();
    if (scanMode === "ingredients") {
      setIngredientPhoto("");
      setAnalysis(null);
      setIngredientMessage("");
    } else {
      setMenuPhotos([]);
      setMenuText("");
      setMenuMessage("");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    setAnalysisLoading(false);
    setMenuLoading(false);
  }

  function addScanHistory(item: ScanHistoryItem) {
    setScanHistory((current) => [item, ...current.filter((entry) => getScanHistoryKey(entry) !== getScanHistoryKey(item))].slice(0, SCAN_HISTORY_LIMIT));
    if (user) {
      const privacy = readProfilePrivacy();
      void saveScan({
        userId: user.id,
        type: item.type,
        title: item.title,
        subtitle: item.subtitle,
        payload: compactScanHistoryItem(item),
        isPublic: privacy.publicScans
      }).then((saved: ScanRow) => {
        const savedItem = scanRowToHistoryItem(saved);
        if (!savedItem) return;
        setScanHistory((current) => mergeScanHistory([savedItem], current));
      }).catch((error) => {
        console.warn(error);
        setHistoryMessage("Scan ist lokal gespeichert, aber noch nicht in Supabase angekommen.");
      });
    }
  }

  function restoreScan(item: ScanHistoryItem) {
    resetCurrentScan();
    if (item.type === "product") {
      setScanMode("ingredients");
      setBarcode(item.barcode);
      setProduct(item.product);
      void loadPrices(item.barcode);
      return;
    }
    if (item.type === "ingredients") {
      setScanMode("ingredients");
      setIngredientPhoto(item.photo || "");
      setAnalysis(item.analysis);
      return;
    }
    setScanMode("menu");
    setMenuPhotos(item.photo ? [item.photo] : []);
    setMenuText(item.text);
  }

  function deleteScanHistoryItem(id: number) {
    setScanHistory((current) => current.filter((item) => item.id !== id));
    if (user) {
      void deleteRemoteScan(user.id, id).catch((error) => {
        console.warn(error);
        setHistoryMessage("Scan wurde lokal entfernt, aber noch nicht in Supabase gelöscht.");
      });
    }
  }

  function clearScanHistory() {
    setScanHistory([]);
    if (user) {
      void deleteAllRemoteScans(user.id).catch((error) => {
        console.warn(error);
        setHistoryMessage("Scans wurden lokal entfernt, aber noch nicht in Supabase gelöscht.");
      });
    }
  }

  const hasCurrentScan = scanMode === "ingredients" ? Boolean(ingredientPhoto || analysis || analysisLoading) : Boolean(menuPhotos.length || menuText || menuLoading);
  const isPremium = premium.isPremium || Boolean(scanQuota?.premium);
  const dailyScanLimit = scanQuota?.limit ?? (user ? USER_DAILY_SCAN_LIMIT : GUEST_DAILY_SCAN_LIMIT);
  const shownRemainingScans = scanQuota ? scanQuota.remaining : dailyScanLimit;

  return (
    <>
      <Header eyebrow="Scanner" title="Was willst du scannen?" />
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)]">
        <section className="min-w-0 rounded-3xl bg-white p-5 shadow-soft">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-oat bg-cream px-4 py-3">
            <div>
              <p className="text-sm font-bold text-moss">Scans heute</p>
              <p className="text-xs leading-5 text-ink/55">{isPremium ? "Premium: unbegrenzt" : user ? "Eingeloggt: 5 pro Tag" : "Ohne Login: 3 pro Tag"}</p>
            </div>
            <span className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-ink">{isPremium ? "Unbegrenzt" : `${shownRemainingScans}/${dailyScanLimit} übrig`}</span>
            {quotaMessage && <p className="w-full text-xs font-bold text-tomato">{quotaMessage}</p>}
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-3xl bg-cream p-2">
            <button onClick={() => setScanMode("ingredients")} className={`rounded-2xl px-4 py-3 text-sm font-bold ${scanMode === "ingredients" ? "bg-moss text-white" : "bg-white text-ink/65"}`}>Zutaten</button>
            <button onClick={() => setScanMode("menu")} className={`rounded-2xl px-4 py-3 text-sm font-bold ${scanMode === "menu" ? "bg-moss text-white" : "bg-white text-ink/65"}`}>Speisekarte</button>
          </div>
          <div className="rounded-3xl bg-cream p-5 text-center">
            {scanMode === "ingredients" ? <ScanLine className="mx-auto text-moss" size={42} /> : <MenuSquare className="mx-auto text-moss" size={42} />}
            <p className="mt-3 font-semibold">{scanMode === "ingredients" ? "Barcode oder Zutatenliste" : "Speisekarte im Restaurant"}</p>
            <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-ink/60">{scanMode === "ingredients" ? "Barcode ist schnell. Zutatenfoto ist genauer, wenn Daten fehlen." : "Foto hochladen, Optionen sehen: vegan, vegetarisch, oder was du weglassen musst."}</p>
            {scanMode === "ingredients" && (
              <>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button onClick={() => void startCameraScan()} className="inline-flex flex-1 items-center justify-center rounded-2xl bg-moss px-5 py-3 font-bold text-white shadow-soft">
                    <Camera className="mr-2" size={18} /> Scannen
                  </button>
                  <input value={barcode} onChange={(event) => setBarcode(event.target.value)} inputMode="numeric" className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-3 text-center font-bold outline-none focus:ring-2 focus:ring-moss" aria-label="Barcode" placeholder="Barcode eingeben" />
                  <button onClick={() => scanProduct()} disabled={loading} className="inline-flex flex-1 items-center justify-center rounded-2xl bg-ink px-5 py-3 font-bold text-white shadow-soft disabled:opacity-60">
                    {loading ? <Loader2 className="mr-2 animate-spin" size={18} /> : <Search className="mr-2" size={18} />} Prüfen
                  </button>
                </div>
                <video ref={videoRef} className={`mt-4 aspect-video w-full rounded-3xl bg-ink object-cover ${cameraActive ? "block" : "hidden"}`} muted playsInline />
                {cameraActive && <button onClick={stopCamera} className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-bold text-moss">Kamera stoppen</button>}
              </>
            )}
            <div className="mt-4 rounded-3xl border-2 border-dashed border-oat bg-white p-5 shadow-sm">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-sage text-moss">
                <UploadCloud />
              </div>
              <span className="mt-3 block text-lg font-bold">{scanMode === "ingredients" ? "Zutatenliste fotografieren" : "Speisekarte fotografieren"}</span>
              <span className="mx-auto mt-1 block max-w-lg text-sm leading-6 text-ink/55">{scanMode === "ingredients" ? "Ein Foto reicht meistens. Die KI prüft die sichtbaren Zutaten." : "Füge mehrere Seiten hinzu, wenn die Speisekarte länger ist. Du siehst jede Seite unten als Vorschau."}</span>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center justify-center rounded-2xl bg-ink px-5 py-3 font-bold text-white shadow-soft">
                  <UploadCloud className="mr-2" size={18} /> Datei hochladen
                </button>
                <button type="button" onClick={() => void startPhotoCamera()} className="inline-flex items-center justify-center rounded-2xl bg-moss px-5 py-3 font-bold text-white shadow-soft">
                  <Camera className="mr-2" size={18} /> Kamera nutzen
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple={scanMode === "menu"} onChange={handleIngredientUpload} className="hidden" />
            </div>
            {photoCameraActive && (
              <div className="mt-4 rounded-3xl bg-white p-3">
                <video ref={photoVideoRef} className="aspect-video w-full rounded-2xl bg-ink object-cover" muted playsInline />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={capturePhoto} className="rounded-2xl bg-moss px-4 py-3 font-bold text-white">Foto aufnehmen</button>
                  <button onClick={stopPhotoCamera} className="rounded-2xl bg-cream px-4 py-3 font-bold text-ink/70">Schließen</button>
                </div>
              </div>
            )}
            {scanMode === "ingredients" && ingredientPhoto && <img src={ingredientPhoto} alt="Zutatenfoto Vorschau" className="mt-4 max-h-52 w-full rounded-3xl object-cover" />}
            {scanMode === "menu" && menuPhotos.length > 0 && <MenuPhotoStrip photos={menuPhotos} removePhoto={(index) => setMenuPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} analyze={() => void runMenuAnalysis()} loading={menuLoading} />}
            {((scanMode === "ingredients" && analysisLoading) || (scanMode === "menu" && menuLoading)) && <LoadingAnalysis label={scanMode === "ingredients" ? "Zutaten werden gecheckt" : "Speisekarte wird gecheckt"} onCancel={cancelAnalysis} />}
            {scanMode === "ingredients" && product && <div className="mt-4 rounded-3xl bg-white p-4 text-left"><ProductResultCard product={product} prices={prices} pricesLoading={pricesLoading} preferences={dietaryPreferences} isFavorite={isFavoriteProduct(product, favoriteProducts)} toggleFavorite={toggleFavoriteProduct} /></div>}
            {scanMode === "ingredients" && analysis && <AnalysisBox title="KI-Ergebnis" badge={statusLabels[analysis.status] || analysis.status}><p>{analysis.explanation}</p>{getAnalysisWarnings(analysis, dietaryPreferences).length > 0 && <p className="mt-2 font-semibold text-tomato">Warnung: {getAnalysisWarnings(analysis, dietaryPreferences).join(", ")}</p>}{analysis.problematicIngredients?.length > 0 && <p className="mt-2 font-semibold text-tomato">Kritisch: {analysis.problematicIngredients.join(", ")}</p>}{analysis.detectedIngredients?.length ? <p className="mt-2 text-xs font-semibold leading-5 text-ink/45">Gelesen: {analysis.detectedIngredients.join(", ")}</p> : null}</AnalysisBox>}
            {scanMode === "menu" && menuText && <AnalysisBox title="Speisekarte"><p className="whitespace-pre-wrap">{menuText}</p></AnalysisBox>}
            {hasCurrentScan && !analysisLoading && !menuLoading && <button onClick={resetCurrentScan} className="mt-4 rounded-full bg-white px-5 py-3 text-sm font-bold text-moss shadow-sm">{scanMode === "ingredients" ? "Neue Zutatenliste scannen" : "Neue Speisekarte scannen"}</button>}
            {scanMode === "ingredients" && ingredientMessage && <p className="mt-3 text-sm font-semibold text-tomato">{ingredientMessage}</p>}
            {scanMode === "menu" && menuMessage && <p className="mt-3 text-sm font-semibold text-tomato">{menuMessage}</p>}
          </div>
        </section>
        <section className="flex max-h-[calc(100vh-8rem)] min-w-0 max-w-full flex-col gap-4 overflow-hidden rounded-3xl bg-white p-5 shadow-soft">
          <div className="min-h-0 min-w-0 shrink overflow-y-auto pr-1">
            {scanMode === "ingredients" && product ? (
              <div className="grid min-h-40 place-items-center rounded-3xl bg-cream p-6 text-center">
                <div>
                  <p className="text-lg font-bold">Produkt-Ergebnis</p>
                  <p className="mt-2 text-sm leading-6 text-ink/60">Das aktuelle Scan-Ergebnis steht links direkt unter dem Scanner.</p>
                </div>
              </div>
            ) : scanMode === "ingredients" && analysis ? (
              <AnalysisBox title="Aktuelles Zutaten-Ergebnis" badge={analysis.status}><p>{analysis.explanation}</p></AnalysisBox>
            ) : scanMode === "menu" && menuText ? (
              <AnalysisBox title="Aktuelle Speisekarte"><p className="whitespace-pre-wrap">{menuText}</p></AnalysisBox>
            ) : (
              <div className="grid min-h-48 place-items-center rounded-3xl bg-cream p-6 text-center">
                <div>
                  <p className="text-lg font-bold">{scanMode === "ingredients" ? "Noch kein Produkt geprüft" : "Speisekarten-Check"}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/60">{scanMode === "ingredients" ? "Scanne Barcode oder Zutatenfoto." : "Lade eine Speisekarte hoch. Ergebnis: 3 klare Listen."}</p>
                </div>
              </div>
            )}
          </div>
          <ScanHistoryList items={scanHistory} restoreScan={restoreScan} deleteItem={deleteScanHistoryItem} clearItems={clearScanHistory} openImage={setPreviewImage} />
          {historyMessage && <p className="rounded-2xl bg-tomato px-4 py-3 text-sm font-bold text-white">{historyMessage}</p>}
        </section>
      </div>
      {previewImage && <ScanImageModal image={previewImage} close={() => setPreviewImage(null)} />}
    </>
  );
}

function ProductResultCard({ product, prices, pricesLoading, preferences, isFavorite, toggleFavorite, compact = false }: { product: ProductResult; prices: PriceOption[]; pricesLoading: boolean; preferences: DietaryPreferences; isFavorite: boolean; toggleFavorite: (product: ProductResult) => void; compact?: boolean }) {
  const warnings = getProductWarnings(product, preferences);
  const alternatives = getProductAlternatives(product, preferences);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className={`${compact ? "text-xl" : "text-2xl"} font-bold`}>{product.name}</h2>
        <Badge status={product.status} />
      </div>
      <p className="mt-2 text-sm font-semibold text-moss">Quelle: {product.source}</p>
      <p className={`${compact ? "max-h-20 overflow-hidden text-sm leading-6" : "leading-7"} mt-3 text-ink/70`}>{product.reason}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => toggleFavorite(product)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${isFavorite ? "bg-moss text-white" : "bg-cream text-moss"}`}>
          <Heart size={16} fill={isFavorite ? "currentColor" : "none"} /> {isFavorite ? "Gemerkte Wahl" : "Produkt merken"}
        </button>
        <span className="inline-flex items-center gap-2 rounded-full bg-sage px-4 py-2 text-sm font-bold text-moss">
          <ShieldCheck size={16} /> Profil: {dietLabel(preferences.diet)}
        </span>
      </div>
      {warnings.length > 0 && (
        <div className="mt-4 rounded-3xl bg-tomato/10 p-4">
          <p className="flex items-center gap-2 text-sm font-black text-tomato"><AlertTriangle size={18} /> Warnungen für dein Profil</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {warnings.map((warning) => <span key={warning} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-tomato">{warning}</span>)}
          </div>
        </div>
      )}
      {product.imageUrl && <img src={product.imageUrl} alt={product.name} className="mt-4 h-32 rounded-2xl bg-cream object-contain p-3" />}
      <div className="mt-4 flex flex-wrap gap-2">
        {product.ingredients.map((item) => (
          <span key={item.name} className={`rounded-full px-3 py-2 text-sm font-semibold ${item.problematic ? "bg-tomato text-white" : "bg-sage text-moss"}`}>{item.name}</span>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-cream p-4"><span className="block text-ink/50">Preis</span><b>{product.price}</b></div>
        <div className="rounded-2xl bg-cream p-4"><span className="block text-ink/50">Laden</span><b>{product.store}</b></div>
      </div>
      <div className="mt-4 rounded-3xl bg-cream p-4">
        <p className="font-bold">Wo gibt es das günstiger?</p>
        <p className="mt-1 text-xs leading-5 text-ink/55">Echte Crowdsourcing-Preise aus Open Food Facts Open Prices. In Deutschland kann die Abdeckung noch lückenhaft sein.</p>
        {pricesLoading && <p className="mt-3 text-sm font-bold text-moss">Preise werden geladen...</p>}
        {!pricesLoading && prices.length === 0 && <p className="mt-3 text-sm text-ink/60">Keine verifizierten Preisspots für diesen Barcode gefunden.</p>}
        <div className="mt-3 space-y-2">
          {prices.map((price) => (
            <div key={`${price.store}-${price.price}-${price.date}`} className="rounded-2xl bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <b>{price.store}</b>
                <b>{price.price.toFixed(2).replace(".", ",")} {price.currency}</b>
              </div>
              <p className="mt-1 text-xs text-ink/55">{price.city || price.country} - bestätigt {price.date}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-3xl bg-sage p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">Veggie Alternativen</p>
        <h3 className="mt-2 text-xl font-bold">{alternatives[0]?.name || product.alternative.name}</h3>
        <p className="mt-2 text-sm leading-6 text-ink/70">{alternatives[0]?.reason || product.alternative.reason}</p>
        <div className="mt-3 grid gap-2">
          {alternatives.slice(0, 3).map((alternative) => (
            <div key={alternative.name} className="rounded-2xl bg-white/70 p-3 text-sm">
              <b>{alternative.name}</b>
              <p className="mt-1 text-ink/60">{alternative.reason}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScanHistoryList({ items, restoreScan, deleteItem, clearItems, openImage }: { items: ScanHistoryItem[]; restoreScan: (item: ScanHistoryItem) => void; deleteItem: (id: number) => void; clearItems: () => void; openImage: (image: { src: string; title: string }) => void }) {
  return (
    <div className="min-h-0 min-w-0 max-w-full overflow-hidden rounded-3xl bg-cream p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">Letzte Scans</h2>
        {items.length > 0 && (
          <button onClick={clearItems} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-bold text-tomato">
            <Trash2 size={14} /> Alle
          </button>
        )}
      </div>
      {items.length === 0 && <p className="mt-2 text-sm leading-6 text-ink/60">Hier erscheinen deine letzten Produkt-, Zutaten- und Speisekartenchecks.</p>}
      <div className="mt-3 max-h-80 max-w-full space-y-2 overflow-y-auto overflow-x-hidden pr-1">
        {items.map((item) => (
          <div key={item.id} className="flex min-w-0 max-w-full items-center gap-2 rounded-2xl bg-white p-2 text-sm">
            {getScanPreviewImage(item) ? (
              <button onClick={() => openImage({ src: getScanPreviewImage(item) || "", title: item.title })} className="shrink-0 overflow-hidden rounded-xl bg-cream" aria-label="Scan-Bild groß anzeigen">
                <img src={getScanPreviewImage(item) || ""} alt="" className="size-12 object-cover" />
              </button>
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sage text-moss"><ScanLine size={18} /></span>
            )}
            <button onClick={() => restoreScan(item)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left hover:bg-sage">
              <span className="min-w-0">
                <b className="block max-w-full truncate">{item.title}</b>
                <span className="mt-1 block max-w-full truncate text-xs text-ink/55">{item.subtitle}</span>
              </span>
            </button>
            <button onClick={() => deleteItem(item.id)} className="grid size-9 shrink-0 place-items-center rounded-full bg-cream text-ink/55 hover:bg-tomato hover:text-white" aria-label="Scan löschen">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function getScanPreviewImage(item: ScanHistoryItem) {
  if ("photo" in item && item.photo) return item.photo;
  if (item.type === "product" && item.product.imageUrl) return item.product.imageUrl;
  return "";
}

function getProductWarnings(product: ProductResult, preferences: DietaryPreferences) {
  if (product.status === "vegan") return [];
  const haystack = [product.name, product.reason, ...product.ingredients.map((item) => item.name)].join(" ").toLowerCase();
  const warnings = preferences.warnings.filter((warning) => getWarningTerms(warning).some((term) => containsIngredientSignal(haystack, term)));
  if (preferences.diet === "vegan") warnings.unshift("nicht vegan");
  if (preferences.diet === "vegetarisch" && product.status === "nicht veggie") warnings.unshift("nicht vegetarisch");
  return Array.from(new Set(warnings));
}

function getAnalysisWarnings(analysis: IngredientAnalysis, preferences: DietaryPreferences) {
  if (analysis.status === "vegan") return [];
  const haystack = [analysis.explanation, ...(analysis.problematicIngredients || []), ...(analysis.detectedIngredients || [])].join(" ").toLowerCase();
  const warnings = preferences.warnings.filter((warning) => getWarningTerms(warning).some((term) => containsIngredientSignal(haystack, term)));
  if (preferences.diet === "vegan") warnings.unshift("nicht vegan");
  if (preferences.diet === "vegetarisch" && analysis.status === "nicht veggie") warnings.unshift("nicht vegetarisch");
  return Array.from(new Set(warnings));
}

function containsIngredientSignal(text: string, signal: string) {
  const normalizedText = normalizeSearch(text);
  const normalizedSignal = normalizeSearch(signal);
  if (normalizedSignal.length <= 2) {
    return new RegExp(`(^|[^a-z0-9äöüß])${escapeRegExp(normalizedSignal)}([^a-z0-9äöüß]|$)`, "i").test(normalizedText);
  }
  return normalizedText.includes(normalizedSignal);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getProductAlternatives(product: ProductResult, preferences: DietaryPreferences) {
  const isVeganProfile = preferences.diet === "vegan";
  const alternatives = [
    {
      name: isVeganProfile ? "Vegane Variante dieses Produkts suchen" : "Vegetarische Variante dieses Produkts suchen",
      reason: `Passt besser zu deinem Profil: ${dietLabel(preferences.diet)}.`
    },
    {
      name: "Community-Spots auf der Karte prüfen",
      reason: "Andere Nutzer können lokale Alternativen, Supermärkte oder Restaurants ergänzt haben."
    },
    {
      name: "Zutatenfoto scannen",
      reason: "Wenn der Barcode unklar ist, liefert ein Zutatenfoto oft eine genauere Einschätzung."
    }
  ];
  if (product.status === "vegan") {
    alternatives.unshift({ name: "Als sicheres Produkt speichern", reason: "Dieses Produkt wirkt passend. Speichere es für deinen nächsten Einkauf." });
  }
  return alternatives;
}

function dietLabel(diet: DietMode) {
  if (diet === "vegan") return "Vegan";
  if (diet === "vegetarisch") return "Vegetarisch";
  return "Flexitarisch";
}

function ScanImageModal({ image, close }: { image: { src: string; title: string }; close: () => void }) {
  return (
    <div className="fixed inset-0 z-[1100] grid place-items-center bg-ink/85 p-4" role="dialog" aria-modal="true">
      <button onClick={close} className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white text-ink shadow-soft" aria-label="Bild schließen"><X size={20} /></button>
      <figure className="w-full max-w-3xl">
        <img src={image.src} alt={image.title} className="max-h-[82vh] w-full rounded-3xl bg-white object-contain p-2 shadow-soft" />
        <figcaption className="mt-3 text-center text-sm font-bold text-white">{image.title}</figcaption>
      </figure>
    </div>
  );
}

function MenuPhotoStrip({ photos, removePhoto, analyze, loading }: { photos: string[]; removePhoto: (index: number) => void; analyze: () => void; loading: boolean }) {
  return (
    <div className="mt-4 rounded-3xl bg-white p-4 text-left shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold">Speisekarten-Seiten</p>
          <p className="mt-1 text-xs font-semibold text-ink/50">{photos.length} von 8 Seiten hinzugefügt</p>
        </div>
        <button onClick={analyze} disabled={loading || photos.length === 0} className="inline-flex items-center rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {loading ? <Loader2 className="mr-2 animate-spin" size={16} /> : <Search className="mr-2" size={16} />} Analysieren
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <div key={`${photo.slice(0, 32)}-${index}`} className="group relative overflow-hidden rounded-2xl bg-cream">
            <img src={photo} alt={`Speisekarte Seite ${index + 1}`} className="aspect-[3/4] w-full object-cover" />
            <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-1 text-xs font-bold text-moss shadow-sm">Seite {index + 1}</span>
            <button onClick={() => removePhoto(index)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-ink/80 text-white opacity-100 shadow-sm hover:bg-tomato sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Seite ${index + 1} entfernen`}>
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingAnalysis({ label, onCancel }: { label: string; onCancel: () => void }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-3xl bg-white p-4 text-left">
      <div className="flex items-center gap-3">
        <Loader2 className="animate-spin text-moss" size={20} />
        <span className="font-bold text-ink">{label}...</span>
      </div>
      <button onClick={onCancel} className="rounded-full bg-cream px-4 py-2 text-sm font-bold text-ink/70">Abbrechen</button>
    </div>
  );
}

function AnalysisBox({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
  return (
    <div className="mt-4 rounded-3xl bg-white p-4 text-left text-sm leading-6 text-ink">
      <div className="flex items-center justify-between gap-3">
        <b>{title}</b>
        {badge && <span className="rounded-full bg-sage px-3 py-1 text-xs font-bold text-moss">{badge}</span>}
      </div>
      <div className="mt-2 font-medium text-ink/75">{children}</div>
    </div>
  );
}

function MapScreen({ finds, setScreen, confirmFind, user, reactToFind, routeSpotId, openSpotRoute, closeSpotRoute }: { finds: Find[]; setScreen: (screen: Screen) => void; confirmFind: (id: number) => void; user: AuthUser | null; reactToFind: (id: number, reaction: SpotReaction) => void; routeSpotId?: number; openSpotRoute: (id: number) => void; closeSpotRoute: () => void }) {
  const [activeFilter, setActiveFilter] = useState<MapFilterId>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailFind, setDetailFind] = useState<Find | null>(null);
  const [publicProfile, setPublicProfile] = useState<{ id?: string; name: string } | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const normalizedSearch = normalizeSearch(searchQuery);
  const visible = finds.filter((find) => matchesMapFilter(find, activeFilter) && matchesSpotSearch(find, normalizedSearch));
  const displayFinds = userLocation
    ? [...visible].sort((a, b) => getDistanceKm(userLocation, a) - getDistanceKm(userLocation, b)).map((find) => ({ ...find, distance: formatDistance(getDistanceKm(userLocation, find)) }))
    : visible;
  const mappable = displayFinds.filter((find) => Number.isFinite(find.lat) && Number.isFinite(find.lng));
  const selected = displayFinds.find((find) => find.id === selectedId) ?? null;
  const selectedFilterLabel = mapFilters.find((filter) => filter.id === activeFilter)?.label || "Alle";

  useEffect(() => {
    if (!routeSpotId) {
      setDetailFind(null);
      return;
    }
    const routedFind = finds.find((find) => find.id === routeSpotId);
    if (routedFind) {
      setSelectedId(routeSpotId);
      setDetailFind(routedFind);
    }
  }, [routeSpotId, finds]);

  function findNearby() {
    if (!navigator.geolocation) {
      setLocationMessage("Dein Browser kann keinen Standort liefern.");
      return;
    }
    setLocationMessage("Standort wird abgefragt...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setActiveFilter("all");
        setLocationMessage("Spots nach Entfernung sortiert.");
      },
      () => setLocationMessage("Standortfreigabe wurde nicht erlaubt oder ist nicht verfügbar."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <>
      <Header eyebrow="In der Nähe" title="Community-Spots" action={<button onClick={() => setScreen("add")} className="rounded-2xl bg-moss p-3 text-white shadow-soft" aria-label="Spot hinzufügen"><Plus /></button>} />
      <button onClick={() => setScreen("add")} className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-moss p-4 text-left text-white shadow-soft sm:mb-4 sm:gap-4 sm:rounded-3xl sm:p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-moss sm:size-12"><Plus size={20} /></span>
        <span><span className="block text-lg font-bold sm:text-xl">Spot hinzufügen</span><span className="text-sm text-white/80">Gerade etwas Gutes entdeckt? Teile es ohne Anmeldung.</span></span>
      </button>
      <div className="mb-4 grid gap-3 rounded-3xl bg-white p-3 shadow-soft lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <label className="flex min-w-0 items-center gap-3 rounded-2xl bg-cream px-4 py-3">
          <Search size={18} className="shrink-0 text-moss" />
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-ink/40" placeholder="Spot, Ort oder Gericht suchen" />
          {searchQuery && <button type="button" onClick={() => setSearchQuery("")} className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-ink/45 hover:text-tomato" aria-label="Suche löschen"><X size={14} /></button>}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={findNearby} className="rounded-2xl bg-moss px-4 py-3 text-sm font-bold text-white">In meiner Nähe</button>
          {userLocation && <button onClick={() => { setUserLocation(null); setLocationMessage(""); }} className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold text-moss">Sortierung zurücksetzen</button>}
        </div>
        {(locationMessage || finds.length > 0) && <div className="rounded-2xl bg-cream px-4 py-3 text-sm font-semibold text-ink/60 lg:col-span-2"><b className="text-moss">{displayFinds.length}</b> von {finds.length} Spots sichtbar · Filter: {selectedFilterLabel}{locationMessage ? ` · ${locationMessage}` : ""}</div>}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {mapFilters.map((filter) => <button key={filter.id} onClick={() => { setActiveFilter(filter.id); setSelectedId(null); }} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${activeFilter === filter.id ? "bg-moss text-white" : "bg-white"}`}>{filter.label}</button>)}
      </div>
      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative h-[18rem] overflow-hidden rounded-3xl bg-sage shadow-soft sm:h-[24rem] lg:h-[min(70vh,42rem)]">
          {mappable.length > 0 ? (
            <>
              <SpotMap
                spots={mappable}
                selectedId={selectedId}
                userLocation={userLocation}
                selectSpot={setSelectedId}
              />
              {selected && <div className="absolute bottom-4 right-4 max-w-56 rounded-2xl bg-white/95 p-3 text-sm shadow-soft backdrop-blur"><b>{selected.name}</b><p className="mt-1 text-xs text-ink/60">{getShortPlace(selected.place)}</p><p className="mt-1 text-xs font-bold text-moss">{selected.price}</p></div>}
              {selected && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selected.lat},${selected.lng}`)}`} target="_blank" rel="noreferrer" className="absolute bottom-4 left-4 rounded-2xl bg-white/95 px-4 py-3 text-sm font-bold text-moss backdrop-blur">Google Maps</a>}
            </>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center">
              <div>
                <MapPinned className="mx-auto text-moss" size={44} />
                <p className="mt-3 text-lg font-bold">Noch keine Spots auf der Karte</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/60">Sobald du ein Produkt oder Gericht mit echter Location hinzufügst, erscheint es hier.</p>
                <button onClick={() => setScreen("add")} className="mt-5 rounded-2xl bg-moss px-5 py-3 font-bold text-white shadow-soft">Ersten Spot hinzufügen</button>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-3 p-1 lg:max-h-[min(70vh,42rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:pr-4 lg:[scrollbar-gutter:stable]">
          {displayFinds.map((find) => <FindCard key={find.id} find={find} confirmFind={confirmFind} selected={find.id === selectedId} reactToFind={reactToFind} focusFind={() => setSelectedId(find.id)} openFind={() => openSpotRoute(find.id)} openProfile={(profile) => setPublicProfile(profile)} />)}
          {displayFinds.length === 0 && <p className="rounded-2xl bg-white p-5 text-ink/60">Keine passenden Spots gefunden. Ändere den Filter oder füge den ersten passenden Ort hinzu.</p>}
        </div>
      </section>
      {detailFind && <FindDetailModal find={finds.find((item) => item.id === detailFind.id) || detailFind} finds={finds} confirmFind={confirmFind} reactToFind={reactToFind} close={closeSpotRoute} setScreen={setScreen} user={user} />}
      {publicProfile && <PublicProfileModal profile={publicProfile} finds={finds} close={() => setPublicProfile(null)} />}
    </>
  );
}

function matchesMapFilter(find: Find, filter: MapFilterId) {
  if (filter === "all") return true;
  if (filter === "vegan") return find.status === "vegan";
  if (filter === "vegetarian") return find.status === "vegetarisch" || find.status === "vegan" || find.status === "vegan möglich";
  if (filter === "cheap") return getPriceNumber(find.price) <= 5;
  if (filter === "confirmed") return Number(find.confirmations || 0) > 0;
  if (filter === "photo") return Boolean(find.imageDataUrl);
  return true;
}

function matchesSpotSearch(find: Find, query: string) {
  if (!query) return true;
  return [find.name, find.place, find.description, find.category, find.price]
    .map(normalizeSearch)
    .some((value) => value.includes(query));
}

function normalizeSearch(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getPriceNumber(price: string) {
  const match = price.replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

function getTrustScore(find: Find) {
  const confirmations = Math.min(35, (find.confirmations || 0) * 7);
  const likes = find.likeCount || 0;
  const dislikes = find.dislikeCount || 0;
  const reactionTotal = likes + dislikes;
  const reactionScore = reactionTotal > 0 ? Math.round((likes / reactionTotal) * 25) : 8;
  const photoScore = find.imageDataUrl ? 12 : 0;
  const detailScore = find.description?.length > 12 ? 10 : 0;
  const ownerScore = find.createdByName ? 8 : 0;
  const freshnessScore = /gerade|Min|Std|Tag/.test(find.confirmed || "") ? 10 : 5;
  return Math.max(1, Math.min(100, confirmations + reactionScore + photoScore + detailScore + ownerScore + freshnessScore));
}

function TrustScoreBadge({ find, onClick }: { find: Find; onClick?: (event: MouseEvent<HTMLButtonElement>) => void }) {
  const score = getTrustScore(find);
  const tone = score >= 75 ? "bg-leaf text-white" : score >= 45 ? "bg-honey text-ink" : "bg-cream text-ink/60";
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${tone}`} aria-label={`Vertrauensscore ${score} von 100 erklären`}><ShieldCheck size={14} /> {score}</button>;
}

function getTrustScoreLabel(score: number) {
  if (score >= 75) return "sehr vertrauenswürdig";
  if (score >= 45) return "solide, aber noch ausbaufähig";
  return "noch wenig bestätigt";
}

function getWarningTerms(signal: string) {
  const normalized = normalizeSearch(signal);
  const terms: Record<string, string[]> = {
    gluten: ["gluten", "weizen", "weizenmehl", "roggen", "gerste", "dinkel", "hafer", "grünkern", "graupen", "bulgur", "couscous", "seitan"],
    nusse: ["nuss", "nüsse", "haselnuss", "mandel", "cashew", "walnuss", "erdnuss", "pistazie", "pecan", "macadamia"],
    soja: ["soja", "sojabohne", "sojalecithin", "tofu", "tempeh"],
    milch: ["milch", "laktose", "molke", "casein", "kasein", "butter", "sahne", "käse", "kaese"],
    ei: ["ei", "eier", "eiklar", "eigelb", "vollei", "albumin"],
    gelatine: ["gelatine", "kollagen"],
    honig: ["honig", "bienenhonig"],
    palmol: ["palmöl", "palmoel", "palmfett", "palmenfett"]
  };
  return terms[normalized] || terms[normalized.replace("ö", "o")] || [signal];
}

function getShortPlace(place: string) {
  const parts = place.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 2) return place;

  const postcodeIndex = parts.findIndex((part) => /\b\d{5}\b/.test(part));
  const postcode = postcodeIndex >= 0 ? parts[postcodeIndex].match(/\b\d{5}\b/)?.[0] || "" : "";
  const houseNumberIndex = parts.findIndex((part) => /^\d+[a-zA-Z]?(?:[-/]\d+[a-zA-Z]?)?$/.test(part));
  const streetIndex = houseNumberIndex >= 0 && parts[houseNumberIndex + 1]
    ? houseNumberIndex + 1
    : parts.findIndex((part) => /(straße|strasse|platz|weg|allee|gasse|ring|damm|ufer|markt|chaussee|boulevard|street|road|avenue)/i.test(part));
  const street = normalizeStreetPart(streetIndex >= 0 ? parts[streetIndex] : parts[0]);
  const houseNumber = houseNumberIndex >= 0 ? parts[houseNumberIndex] : "";
  const streetLine = houseNumber && !street.includes(houseNumber) ? `${street} ${houseNumber}` : street;

  let city = "";
  if (postcodeIndex >= 0) {
    const afterPostcode = parts.slice(postcodeIndex + 1).find((part) => !isCountryName(part));
    const beforePostcode = parts.slice(0, postcodeIndex).reverse().find((part) => {
      if (part === street || part === houseNumber) return false;
      if (/\d/.test(part)) return false;
      return !isStateName(part);
    });
    city = afterPostcode || beforePostcode || "";
  }

  const cityLine = [postcode, city].filter(Boolean).join(" ");
  return [streetLine, cityLine].filter(Boolean).join(", ") || place;
}

function isCountryName(value: string) {
  return /^(deutschland|germany|allemagne)$/i.test(value.trim());
}

function isStateName(value: string) {
  return /^(baden-württemberg|bayern|berlin|brandenburg|bremen|hamburg|hessen|mecklenburg-vorpommern|niedersachsen|nordrhein-westfalen|rheinland-pfalz|saarland|sachsen|sachsen-anhalt|schleswig-holstein|thüringen)$/i.test(value.trim());
}

function normalizeStreetPart(value: string) {
  const segments = value.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  return segments.reverse().find((part) => /(straße|strasse|platz|weg|allee|gasse|ring|damm|ufer|markt|chaussee|boulevard|street|road|avenue)/i.test(part)) || value;
}

function SpotMap({ spots, selectedId, userLocation, selectSpot }: { spots: Find[]; selectedId: number | null; userLocation: UserLocation | null; selectSpot: (id: number) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const locationLayerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([51.1657, 10.4515], 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    const markerLayer = L.layerGroup().addTo(map);
    mapRef.current = map;
    markerLayerRef.current = markerLayer;
    window.setTimeout(() => map.invalidateSize(), 120);

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      locationLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    spots.forEach((spot) => {
      const marker = L.marker([spot.lat, spot.lng], {
        icon: createSpotMarkerIcon(spot.id === selectedId)
      }).addTo(layer);
      marker.bindPopup(`<strong>${escapeHtml(spot.name)}</strong><br>${escapeHtml(getShortPlace(spot.place))}<br><span>${escapeHtml(spot.price)}</span>`);
      marker.on("click", () => {
        selectSpot(spot.id);
      });
    });
  }, [spots, selectedId, selectSpot]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || spots.length === 0) return;
    const bounds = L.latLngBounds(spots.map((spot) => [spot.lat, spot.lng] as [number, number]));
    if (userLocation) bounds.extend([userLocation.lat, userLocation.lng]);
    map.fitBounds(bounds.pad(0.22), { maxZoom: 15, animate: true });
  }, [spots, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    locationLayerRef.current?.remove();
    locationLayerRef.current = null;
    if (!userLocation) return;
    locationLayerRef.current = L.circleMarker([userLocation.lat, userLocation.lng], {
      radius: 9,
      color: "#ffffff",
      weight: 3,
      fillColor: "#d46a5f",
      fillOpacity: 1
    }).addTo(map).bindTooltip("Dein Standort");
  }, [userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const selected = spots.find((spot) => spot.id === selectedId);
    if (!selected) return;
    map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.55 });
  }, [selectedId, spots]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Interaktive Karte mit Community-Spots" />;
}

function createSpotMarkerIcon(selected: boolean) {
  return L.divIcon({
    className: "veggie-map-marker",
    html: `<span class="veggie-map-marker__pin${selected ? " veggie-map-marker__pin--selected" : ""}"><span></span></span>`,
    iconSize: selected ? [44, 52] : [34, 42],
    iconAnchor: selected ? [22, 50] : [17, 40],
    popupAnchor: [0, -40]
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

function FindCard({ find, confirmFind, selected, reactToFind, focusFind, openFind, openProfile }: { find: Find; confirmFind: (id: number) => void; selected: boolean; reactToFind: (id: number, reaction: SpotReaction) => void; focusFind: () => void; openFind: () => void; openProfile: (profile: { id?: string; name: string }) => void }) {
  const confirmations = find.confirmations ?? 0;
  const isConfirmed = find.viewerConfirmed ?? false;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${find.lat},${find.lng}`)}`;
  const shortPlace = getShortPlace(find.place);
  const reaction = find.viewerReaction || "";
  const likeCount = find.likeCount ?? 0;
  const dislikeCount = find.dislikeCount ?? 0;
  const [scoreOpen, setScoreOpen] = useState(false);
  const trustScore = getTrustScore(find);
  return (
    <article className={`relative rounded-3xl border-2 bg-white p-4 shadow-soft transition ${selected ? "border-moss" : "border-transparent"}`}>
      <button onClick={openFind} className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-cream text-moss shadow-sm transition hover:bg-moss hover:text-white" aria-label={`${find.name} Details öffnen`}>
        <MenuSquare size={18} />
      </button>
      <div onClick={focusFind} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") focusFind(); }} role="button" tabIndex={0} className="flex w-full cursor-pointer gap-3 pr-10 text-left outline-none sm:gap-4">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-oat text-moss">
          {find.imageDataUrl ? <img src={find.imageDataUrl} alt="" className="h-full w-full object-cover" /> : <FindIcon category={find.category} size={28} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 max-w-full truncate font-bold">{find.name}</h2>
            <Badge status={find.status} />
            <TrustScoreBadge find={find} onClick={(event) => { event.stopPropagation(); setScoreOpen((open) => !open); }} />
          </div>
          {scoreOpen && (
            <div className="absolute right-12 top-14 z-20 max-w-56 rounded-2xl bg-ink px-4 py-3 text-xs font-semibold leading-5 text-white shadow-soft">
              <span className="absolute -top-1 right-8 size-3 rotate-45 bg-ink" />
              <b>Score {trustScore}/100</b>
              <span className="mt-1 block text-white/75">{getTrustScoreLabel(trustScore)}. Basiert auf Bestätigungen, Likes, Foto, Beschreibung und Aktualität.</span>
            </div>
          )}
          <p className="mt-1 line-clamp-2 text-sm text-ink/60">{shortPlace}{find.distance ? ` - ${find.distance}` : ""}</p>
          <p className="mt-2 text-sm leading-6">{find.description}</p>
          <p className="mt-2 text-sm font-semibold text-moss">{find.price} - zuletzt bestätigt {find.confirmed}</p>
        </div>
      </div>
      {find.createdByName && (
        <button type="button" onClick={() => openProfile({ id: find.createdBy, name: find.createdByName || "Veggie Nutzer" })} className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-cream px-3 py-2 text-xs font-bold text-moss transition hover:bg-sage">
          <UserRound size={14} />
          <span className="truncate">Von {find.createdByName}</span>
        </button>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => reactToFind(find.id, "like")} aria-pressed={reaction === "like"} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${reaction === "like" ? "bg-moss text-white" : "bg-cream text-moss"}`} aria-label="Spot liken">
          <ThumbsUp size={16} /> {likeCount}
        </button>
        <button type="button" onClick={() => reactToFind(find.id, "dislike")} aria-pressed={reaction === "dislike"} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${reaction === "dislike" ? "bg-tomato text-white" : "bg-cream text-ink/60"}`} aria-label="Spot disliken">
          <ThumbsDown size={16} /> {dislikeCount}
        </button>
        <button onClick={() => confirmFind(find.id)} disabled={isConfirmed} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${isConfirmed ? "bg-cream text-ink/45" : "bg-sage text-moss"}`}>
          <Check size={16} /> {isConfirmed ? "Spot bestätigt" : "Spot bestätigen"} {confirmations > 0 && `(${confirmations})`}
        </button>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">
          <MapPinned size={16} /> Route
        </a>
      </div>
    </article>
  );
}

function FindDetailModal({ find, finds, confirmFind, reactToFind, close, setScreen, user }: { find: Find; finds: Find[]; confirmFind: (id: number) => void; reactToFind: (id: number, reaction: SpotReaction) => void; close: () => void; setScreen: (screen: Screen) => void; user: AuthUser | null }) {
  const [locallyConfirmed, setLocallyConfirmed] = useState(Boolean(find.viewerConfirmed));
  const [localConfirmations, setLocalConfirmations] = useState(find.confirmations ?? 0);
  const confirmations = localConfirmations;
  const isConfirmed = locallyConfirmed;
  const isLoggedIn = Boolean(user);
  const [imageOpen, setImageOpen] = useState(false);
  const [publicProfile, setPublicProfile] = useState<{ id?: string; name: string } | null>(null);
  const [comments, setComments] = useState<SpotComment[]>(() => readSpotComments(find.id));
  const [commentText, setCommentText] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ parentId: number; author: string } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${find.lat},${find.lng}`)}`;
  const commentThreads = buildCommentThreads(comments);
  const shortPlace = getShortPlace(find.place);
  const reaction = find.viewerReaction || "";
  const likeCount = find.likeCount ?? 0;
  const dislikeCount = find.dislikeCount ?? 0;

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchComments(find.id).then((items) => {
      if (active) setComments(items);
    }).catch((error) => {
      console.warn(error);
      if (active) setCommentMessage("Kommentare konnten gerade nicht aus Supabase geladen werden.");
    });
    return () => {
      active = false;
    };
  }, [find.id]);

  function confirmFromDetail() {
    if (isConfirmed) return;
    setLocallyConfirmed(true);
    setLocalConfirmations((current) => current + 1);
    confirmFind(find.id);
  }

  function submitComment(parentId: number | null = null) {
    const rawText = (parentId ? replyText : commentText).trim();
    const text = parentId && replyTarget ? `@${replyTarget.author} ${rawText}` : rawText;
    if (!isLoggedIn || !rawText) return;
    const currentUser = user;
    if (!currentUser) return;
    setCommentMessage("");
    const payload: CommentPayload = {
      spotId: find.id,
      userId: currentUser.id,
      authorName: getUserDisplayName(currentUser),
      body: text,
      isPublic: true,
      parentCommentId: parentId
    };
    const comment = {
      id: Date.now(),
      userId: currentUser.id,
      author: getUserDisplayName(currentUser),
      text,
      parentId,
      createdAt: new Date().toISOString()
    };
    const next = parentId ? [...comments, comment].slice(-100) : [comment, ...comments].slice(0, 100);
    setComments(next);
    saveSpotComments(find.id, next);
    void saveComment(payload).then((saved) => {
      setComments((current) => {
        const updated = current.map((item) => item.id === comment.id ? saved : item);
        saveSpotComments(find.id, updated);
        return updated;
      });
      setCommentMessage(parentId ? "Antwort gespeichert." : "Kommentar gespeichert.");
    }).catch((error) => {
      console.warn(error);
      setCommentMessage(parentId ? "Antwort ist lokal sichtbar, aber noch nicht in Supabase gespeichert." : "Kommentar ist lokal sichtbar, aber noch nicht in Supabase gespeichert.");
    });
    if (parentId) {
      setReplyText("");
      setReplyTarget(null);
    } else {
      setCommentText("");
    }
  }

  function deleteOwnComment(comment: SpotComment) {
    const currentUser = user;
    if (!currentUser || comment.userId !== currentUser.id) return;
    const next = removeCommentWithReplies(comments, comment.id);
    setComments(next);
    saveSpotComments(find.id, next);
    void deleteRemoteComment(currentUser.id, comment.id).then(() => {
      setCommentMessage("Kommentar gelöscht.");
    }).catch((error) => {
      console.warn(error);
      setCommentMessage("Kommentar wurde lokal entfernt, aber noch nicht in Supabase gelöscht.");
    });
  }

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-end bg-ink/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-6" role="dialog" aria-modal="true">
      <article className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-cream shadow-soft sm:max-w-2xl sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-oat/70 bg-cream/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-moss">Spotdetails</p>
            <h2 className="truncate text-xl font-black">{find.name}</h2>
          </div>
          <button onClick={close} className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-ink shadow-soft" aria-label="Details schließen"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain">
        <div className="relative h-56 overflow-hidden bg-oat sm:h-72">
          {find.imageDataUrl ? (
            <button onClick={() => setImageOpen(true)} className="h-full w-full bg-ink/5 p-3" aria-label="Bild groß anzeigen">
              <img src={find.imageDataUrl} alt={find.name} className="h-full w-full rounded-2xl object-contain" />
            </button>
          ) : <div className="grid h-full place-items-center text-moss"><FindIcon category={find.category} size={72} /></div>}
          {find.imageDataUrl && <button onClick={() => setImageOpen(true)} className="absolute left-4 top-4 rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-moss shadow-soft">Bild anzeigen</button>}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
            <div>
              <Badge status={find.status} />
              <h2 className="mt-2 text-3xl font-bold text-white drop-shadow">{find.name}</h2>
            </div>
            <span className="rounded-2xl bg-white/95 px-4 py-3 text-sm font-bold text-moss shadow-soft">{find.price}</span>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-3xl bg-white p-4">
            <span className="block text-xs font-bold uppercase text-ink/45">Ort</span>
            <b className="mt-1 block text-lg">{shortPlace}</b>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-cream px-3 py-1 text-moss">{find.category}</span>
              <span className="rounded-full bg-cream px-3 py-1 text-ink/60">{confirmations} bestätigt</span>
              <TrustScoreBadge find={find} />
            </div>
          </div>
          <div className="rounded-3xl bg-white p-5">
            <p className="text-sm font-bold uppercase text-moss">Beschreibung</p>
            <p className="mt-2 leading-7 text-ink/75">{find.description}</p>
            {find.createdByName && (
              <button onClick={() => setPublicProfile({ id: find.createdBy, name: find.createdByName || "Veggie Nutzer" })} className="mt-3 rounded-full bg-sage px-4 py-2 text-sm font-bold text-moss">
                Von {find.createdByName}
              </button>
            )}
            <p className="mt-3 text-sm font-semibold text-ink/55">Zuletzt bestätigt {find.confirmed}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => reactToFind(find.id, "like")} aria-pressed={reaction === "like"} className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-bold ${reaction === "like" ? "bg-moss text-white" : "bg-white text-moss"}`} aria-label="Spot liken">
              <ThumbsUp size={18} /> {likeCount}
            </button>
            <button type="button" onClick={() => reactToFind(find.id, "dislike")} aria-pressed={reaction === "dislike"} className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-bold ${reaction === "dislike" ? "bg-tomato text-white" : "bg-white text-ink/60"}`} aria-label="Spot disliken">
              <ThumbsDown size={18} /> {dislikeCount}
            </button>
            <button onClick={confirmFromDetail} disabled={isConfirmed} className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-bold ${isConfirmed ? "bg-white text-ink/45" : "bg-sage text-moss"}`}>
              <Check size={18} /> {isConfirmed ? "Schon bestätigt" : "Spot bestätigen"}
            </button>
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-ink px-5 py-3 font-bold text-white">
              <MapPinned size={18} /> Route in Google Maps
            </a>
          </div>
          <section className="rounded-3xl bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Kommentare</h3>
                <p className="mt-1 text-sm text-ink/55">Fragen, Tipps oder Updates zu diesem Spot.</p>
              </div>
              <span className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-ink/50">{comments.length}</span>
            </div>
            <div className="mt-4 space-y-2">
              {commentThreads.map((thread) => (
                <CommentThread
                  key={thread.comment.id}
                  thread={thread}
                  isLoggedIn={isLoggedIn}
                  replyTarget={replyTarget}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  currentUserId={user?.id || ""}
                  deleteComment={deleteOwnComment}
                  startReply={(comment, parent) => {
                    setReplyTarget({ parentId: parent.id, author: comment.author });
                    setReplyText("");
                  }}
                  cancelReply={() => {
                    setReplyTarget(null);
                    setReplyText("");
                  }}
                  submitReply={() => { if (replyTarget) submitComment(replyTarget.parentId); }}
                />
              ))}
              {comments.length === 0 && <div className="rounded-2xl bg-cream p-4 text-sm text-ink/60">Noch keine Kommentare.</div>}
            </div>
            <div className="mt-4">
              <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} disabled={!isLoggedIn} className="min-h-24 w-full rounded-2xl bg-cream px-4 py-3 outline-none disabled:text-ink/45" placeholder={isLoggedIn ? "Kommentar schreiben..." : "Zum Kommentieren bitte anmelden."} />
              {isLoggedIn ? (
                <button type="button" onClick={() => submitComment(null)} className="mt-3 rounded-2xl bg-moss px-5 py-3 font-bold text-white">Kommentar senden</button>
              ) : (
                <button type="button" onClick={() => { close(); setScreen("profile"); }} className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-moss px-5 py-3 font-bold text-white">
                  <LogIn size={18} /> Zum Kommentieren anmelden
                </button>
              )}
              {commentMessage && <p className="mt-3 rounded-2xl bg-cream px-4 py-3 text-sm font-bold text-moss">{commentMessage}</p>}
            </div>
          </section>
        </div>
        </div>
      </article>
      {imageOpen && find.imageDataUrl && (
        <div className="fixed inset-0 z-[1100] grid place-items-center bg-ink/90 p-4" role="dialog" aria-modal="true">
          <button onClick={() => setImageOpen(false)} className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white text-ink shadow-soft" aria-label="Bild schließen"><X size={20} /></button>
          <img src={find.imageDataUrl} alt={find.name} className="max-h-[88vh] max-w-[94vw] rounded-3xl bg-white object-contain p-2 shadow-soft" />
        </div>
      )}
      {publicProfile && <PublicProfileModal profile={publicProfile} finds={finds} close={() => setPublicProfile(null)} />}
    </div>
  );
}

function CommentThread({ thread, isLoggedIn, replyTarget, replyText, setReplyText, currentUserId, deleteComment, startReply, cancelReply, submitReply }: {
  thread: { comment: SpotComment; replies: SpotComment[] };
  isLoggedIn: boolean;
  replyTarget: { parentId: number; author: string } | null;
  replyText: string;
  setReplyText: (value: string) => void;
  currentUserId: string;
  deleteComment: (comment: SpotComment) => void;
  startReply: (comment: SpotComment, parent: SpotComment) => void;
  cancelReply: () => void;
  submitReply: () => void;
}) {
  const isReplying = replyTarget?.parentId === thread.comment.id;
  return (
    <div className="rounded-2xl bg-cream p-4 text-sm">
      <CommentBubble comment={thread.comment} isReply={false} isLoggedIn={isLoggedIn} canDelete={thread.comment.userId === currentUserId} startReply={(comment) => startReply(comment, thread.comment)} deleteComment={deleteComment} />
      {thread.replies.length > 0 && (
        <div className="mt-3 space-y-2 border-l-2 border-moss/20 pl-3">
          {thread.replies.map((reply) => (
            <CommentBubble key={reply.id} comment={reply} isReply isLoggedIn={isLoggedIn} canDelete={reply.userId === currentUserId} startReply={(comment) => startReply(comment, thread.comment)} deleteComment={deleteComment} />
          ))}
        </div>
      )}
      {isReplying && (
        <div className="mt-3 rounded-2xl bg-white p-3">
          <p className="text-xs font-bold text-moss">Antwort an {replyTarget.author}</p>
          <textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} className="mt-2 min-h-20 w-full rounded-2xl bg-cream px-4 py-3 outline-none focus:ring-2 focus:ring-moss" placeholder="Antwort schreiben..." />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={submitReply} className="rounded-full bg-moss px-4 py-2 text-sm font-bold text-white">Antwort senden</button>
            <button type="button" onClick={cancelReply} className="rounded-full bg-cream px-4 py-2 text-sm font-bold text-ink/60">Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentBubble({ comment, isReply, isLoggedIn, canDelete, startReply, deleteComment }: { comment: SpotComment; isReply: boolean; isLoggedIn: boolean; canDelete: boolean; startReply: (comment: SpotComment) => void; deleteComment: (comment: SpotComment) => void }) {
  return (
    <div className={isReply ? "rounded-2xl bg-white p-3" : ""}>
      <div className="flex items-center justify-between gap-3">
        <b>{comment.author}</b>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink/45">{formatCommentDate(comment.createdAt)}</span>
          {canDelete && (
            <button type="button" onClick={() => deleteComment(comment)} className="grid size-7 place-items-center rounded-full bg-cream text-ink/45 transition hover:bg-tomato hover:text-white" aria-label="Kommentar löschen">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 leading-6 text-ink/70">{comment.text}</p>
      {isLoggedIn && (
        <button type="button" onClick={() => startReply(comment)} className="mt-2 text-xs font-black uppercase tracking-wide text-moss">
          Antworten
        </button>
      )}
    </div>
  );
}

function PublicProfileModal({ profile, finds, close }: { profile: { id?: string; name: string }; finds: Find[]; close: () => void }) {
  const publicSpots = finds.filter((find) => find.createdBy && find.createdBy === profile.id);
  return (
    <div className="fixed inset-0 z-[1050] grid place-items-end bg-ink/55 p-0 backdrop-blur-sm sm:place-items-center sm:p-6" role="dialog" aria-modal="true">
      <article className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-cream p-5 shadow-soft sm:max-w-xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="grid size-14 place-items-center rounded-2xl bg-moss text-2xl font-black text-white">{profile.name.slice(0, 1).toUpperCase()}</div>
            <p className="mt-4 text-sm font-bold uppercase text-moss">Öffentliches Profil</p>
            <h2 className="mt-1 text-3xl font-bold">{profile.name}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">Geteilte Spots sind öffentlich. Scans sind standardmäßig privat.</p>
          </div>
          <button onClick={close} className="grid size-10 place-items-center rounded-full bg-white text-ink shadow-soft" aria-label="Profil schließen"><X size={18} /></button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4"><span className="block text-xs font-bold uppercase text-ink/45">öffentliche Spots</span><b className="text-2xl text-moss">{publicSpots.length}</b></div>
          <div className="rounded-2xl bg-white p-4"><span className="block text-xs font-bold uppercase text-ink/45">Scans</span><b className="text-lg text-ink/50">privat</b></div>
        </div>
        <div className="mt-5 space-y-3">
          {publicSpots.map((spot) => <ProfileSpotCard key={spot.id} spot={spot} />)}
          {publicSpots.length === 0 && <p className="rounded-2xl bg-white p-4 text-sm text-ink/60">Noch keine öffentlichen Spots.</p>}
        </div>
      </article>
    </div>
  );
}

function AddFindScreen({ addFind, setScreen, user }: { addFind: (find: CommunitySpotPayload) => Promise<void>; setScreen: (screen: Screen) => void; user: AuthUser | null }) {
  const [submitted, setSubmitted] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeOptions, setPlaceOptions] = useState<PlaceSuggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [spotCameraActive, setSpotCameraActive] = useState(false);
  const spotFileInputRef = useRef<HTMLInputElement | null>(null);
  const spotVideoRef = useRef<HTMLVideoElement | null>(null);
  const spotStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => stopSpotCamera(), []);

  useEffect(() => {
    if (!spotCameraActive || !spotVideoRef.current || !spotStreamRef.current) return;
    const video = spotVideoRef.current;
    video.srcObject = spotStreamRef.current;
    void video.play().catch(() => setPlaceError("Kamera konnte nicht gestartet werden. Bitte Browser-Berechtigung prüfen."));
  }, [spotCameraActive]);

  useEffect(() => {
    const query = placeQuery.trim();
    if (query.length < 2 || selectedPlace?.name === placeQuery) {
      setPlaceOptions([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPlaceLoading(true);
      setPlaceError("");
      try {
        const result = await searchPlaces(query, controller.signal);
        setPlaceOptions(result);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPlaceError(error instanceof Error ? error.message : "Standortsuche nicht erreichbar.");
      } finally {
        if (!controller.signal.aborted) setPlaceLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [placeQuery, selectedPlace?.name]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlace) {
      setPlaceError("Bitte wähle einen vorgeschlagenen echten Ort aus.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setPlaceError("");
    try {
      await addFind({
        name: String(form.get("name")),
        place: formatPlaceLabel(selectedPlace),
        price: formatEuroPrice(String(form.get("price") || "")),
        status: form.get("status") as VeggieStatus,
        category: String(form.get("category")),
        confirmations: 1,
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        description: String(form.get("description")),
        imageDataUrl,
        createdBy: user?.id,
        createdByName: user ? getUserDisplayName(user) : undefined
      });
      setSubmitted(true);
    } catch (error) {
      setPlaceError(error instanceof Error ? error.message : "Spot konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function startSpotCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPlaceError("Kamerazugriff ist in diesem Browser nicht verfügbar.");
      return;
    }

    try {
      stopSpotCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      spotStreamRef.current = stream;
      setSpotCameraActive(true);
      setPlaceError("");
    } catch (error) {
      setPlaceError(error instanceof DOMException && error.name === "NotAllowedError" ? "Kamera blockiert. Bitte im Browser erlauben." : "Kamera konnte nicht gestartet werden.");
    }
  }

  function stopSpotCamera() {
    spotStreamRef.current?.getTracks().forEach((track) => track.stop());
    spotStreamRef.current = null;
    setSpotCameraActive(false);
  }

  function captureSpotPhoto() {
    const video = spotVideoRef.current;
    if (!video || video.readyState < 2) {
      setPlaceError("Kamera ist noch nicht bereit.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setImageDataUrl(canvas.toDataURL("image/jpeg", 0.82));
    stopSpotCamera();
  }

  return (
    <>
      <Header eyebrow="Community" title="Essen oder Produkt hinzufügen" />
      <div className="mb-4 rounded-3xl bg-sage p-5">
        <p className="font-bold text-moss">Kein Login nötig.</p>
        <p className="mt-1 text-sm leading-6 text-ink/70">Du kannst direkt beitragen. Anmeldung ist später nur praktisch, wenn du deine Spots bearbeiten, speichern oder zwischen Geräten synchronisieren willst.</p>
      </div>
      <form onSubmit={submit} className="grid gap-4 rounded-3xl bg-white p-5 shadow-soft sm:grid-cols-2">
        <div className="rounded-3xl bg-cream p-4 sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="font-bold">Foto</span>
              <p className="mt-1 text-sm text-ink/55">Wähle ein Bild aus der Galerie oder fotografiere den Spot direkt.</p>
            </div>
            {imageDataUrl && <button type="button" onClick={() => setImageDataUrl("")} className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-ink/55 hover:bg-tomato hover:text-white" aria-label="Foto entfernen"><X size={16} /></button>}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => spotFileInputRef.current?.click()} className="inline-flex items-center justify-center rounded-2xl bg-ink px-5 py-3 font-bold text-white shadow-soft">
              <UploadCloud className="mr-2" size={18} /> Galerie
            </button>
            <button type="button" onClick={() => void startSpotCamera()} className="inline-flex items-center justify-center rounded-2xl bg-moss px-5 py-3 font-bold text-white shadow-soft">
              <Camera className="mr-2" size={18} /> Kamera
            </button>
          </div>
          <input ref={spotFileInputRef} type="file" accept="image/*" onChange={(event) => void handleSpotImage(event, setImageDataUrl, setPlaceError)} className="hidden" />
          {spotCameraActive && (
            <div className="mt-4 rounded-3xl bg-white p-3">
              <video ref={spotVideoRef} className="aspect-video w-full rounded-2xl bg-ink object-cover" muted playsInline />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={captureSpotPhoto} className="rounded-2xl bg-moss px-4 py-3 font-bold text-white">Foto aufnehmen</button>
                <button type="button" onClick={stopSpotCamera} className="rounded-2xl bg-cream px-4 py-3 font-bold text-ink/70">Schließen</button>
              </div>
            </div>
          )}
          {imageDataUrl && <img src={imageDataUrl} alt="Spot Vorschau" className="mt-3 h-44 w-full rounded-2xl object-cover" />}
        </div>
        <Field name="name" label="Produkt/Gericht" placeholder="z.B. vegane Ube-Schnecke" required />
        <div className="sm:col-span-2">
          <label>
            <span className="font-bold">Restaurant oder Location</span>
            <input value={placeQuery} onChange={(event) => { setPlaceQuery(event.target.value); setSelectedPlace(null); }} className="mt-2 w-full rounded-2xl bg-cream px-4 py-3 outline-none focus:ring-2 focus:ring-moss" placeholder="z.B. Café Kranz Köln, Rewe Ehrenfeld, Kiez Kebab Hamburg" required />
          </label>
          <p className="mt-2 text-xs text-ink/55">Speichern geht nur mit einem ausgewählten echten Ort aus der Vorschlagsliste.</p>
          {placeLoading && <p className="mt-2 text-sm font-bold text-moss">Standorte werden gesucht...</p>}
          {placeError && <p className="mt-2 text-sm font-semibold text-tomato">{placeError}</p>}
          {selectedPlace && <div className="mt-3 rounded-2xl bg-sage p-3 text-sm"><b>{selectedPlace.name}</b><p className="text-ink/65">{selectedPlace.address}</p><p className="mt-1 text-xs font-bold text-moss">Quelle: {selectedPlace.provider}</p></div>}
          {placeOptions.length > 0 && !selectedPlace && (
            <div className="mt-3 space-y-2">
              {placeOptions.map((place) => (
                <button type="button" key={place.id} onClick={() => { setSelectedPlace(place); setPlaceQuery(place.name); setPlaceOptions([]); }} className="w-full rounded-2xl bg-cream p-3 text-left text-sm hover:bg-sage">
                  <b>{place.name}</b>
                  <p className="mt-1 text-ink/60">{place.address}</p>
                  <p className="mt-1 text-xs font-bold text-moss">{place.provider}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <PriceField />
        <Select name="status" label="Einordnung" options={["vegan", "vegetarisch"]} />
        <Select name="category" label="Kategorie" options={categories} />
        <label className="sm:col-span-2"><span className="font-bold">Kurze Beschreibung</span><textarea name="description" required className="mt-2 min-h-28 w-full rounded-2xl bg-cream px-4 py-3 outline-none focus:ring-2 focus:ring-moss" placeholder="Was macht den Spot besonders? Was sollte man beim Bestellen beachten?" /></label>
        <button disabled={saving} className="rounded-2xl bg-moss px-5 py-4 text-lg font-bold text-white shadow-soft disabled:opacity-60 sm:col-span-2">{saving ? "Wird gespeichert..." : "Spot auf die Karte bringen"}</button>
        {submitted && <button type="button" onClick={() => setScreen("map")} className="rounded-2xl bg-sage px-5 py-3 font-bold text-moss sm:col-span-2"><Check className="mr-2 inline" size={18} /> Gespeichert, zur Karte</button>}
      </form>
    </>
  );
}

function Field({ name, label, placeholder, required = false }: { name: string; label: string; placeholder: string; required?: boolean }) {
  return <label><span className="font-bold">{label}</span><input name={name} required={required} className="mt-2 w-full rounded-2xl bg-cream px-4 py-3 outline-none focus:ring-2 focus:ring-moss" placeholder={placeholder} /></label>;
}

function PriceField() {
  return (
    <label>
      <span className="font-bold">Preis</span>
      <span className="mt-2 flex items-center rounded-2xl bg-cream pr-4 focus-within:ring-2 focus-within:ring-moss">
        <input name="price" inputMode="decimal" required className="min-w-0 flex-1 rounded-2xl bg-transparent px-4 py-3 outline-none" placeholder="3,20" />
        <span className="font-bold text-moss">€</span>
      </span>
    </label>
  );
}

function Select({ name, label, options }: { name: string; label: string; options: string[] }) {
  return <label><span className="font-bold">{label}</span><select name={name} className="mt-2 w-full rounded-2xl bg-cream px-4 py-3 outline-none focus:ring-2 focus:ring-moss">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function formatEuroPrice(value: string) {
  const cleaned = value.trim().replace(/\s*(eur|euro|€)\s*$/i, "").trim();
  if (!cleaned) return "Preis offen";
  return `${cleaned} €`;
}

function formatPlaceLabel(place: PlaceSuggestion) {
  const address = place.address.trim();
  return address && address !== place.name ? `${place.name} - ${address}` : place.name;
}

async function handleSpotImage(event: ChangeEvent<HTMLInputElement>, setImageDataUrl: (value: string) => void, setError: (value: string) => void) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    setImageDataUrl(await resizeImage(file, 900));
  } catch {
    setError("Foto konnte nicht gelesen werden.");
  }
}

function resizeImage(file: File, maxSize: number) {
  return new Promise<string>((resolveImage, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Canvas nicht verfügbar."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolveImage(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function readImageFiles(files: File[]) {
  return Promise.all(files.map((file) => resizeImage(file, 1400)));
}

function createScanThumbnail(imageDataUrl: string) {
  return new Promise<string>((resolveImage) => {
    if (!imageDataUrl.startsWith("data:image/")) {
      resolveImage(imageDataUrl);
      return;
    }
    const image = new Image();
    image.onerror = () => resolveImage("");
    image.onload = () => {
      const maxSize = 420;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        resolveImage("");
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolveImage(canvas.toDataURL("image/jpeg", 0.7));
    };
    image.src = imageDataUrl;
  });
}

function getDistanceKm(from: UserLocation, to: Pick<Find, "lat" | "lng">) {
  const radiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceKm: number) {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1).replace(".", ",")} km`;
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function getScanHistoryKey(item: ScanHistoryItem) {
  if (item.type === "product") return `${item.type}:${item.barcode}`;
  return `${item.type}:${item.title}:${item.subtitle}`;
}

function getScanHistoryStorageKey(userId?: string) {
  return userId ? `${SCAN_HISTORY_STORAGE_KEY}-${userId}` : `${SCAN_HISTORY_STORAGE_KEY}-guest`;
}

function readScanHistory(userId?: string): ScanHistoryItem[] {
  try {
    const value = localStorage.getItem(getScanHistoryStorageKey(userId));
    if (!value) return [];
    const items = JSON.parse(value);
    if (!Array.isArray(items)) return [];
    return items.filter(isScanHistoryItem).slice(0, SCAN_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function saveScanHistory(items: ScanHistoryItem[], userId?: string) {
  const compactItems = items.map(compactScanHistoryItem).slice(0, SCAN_HISTORY_LIMIT);
  try {
    localStorage.setItem(getScanHistoryStorageKey(userId), JSON.stringify(compactItems));
  } catch (error) {
    console.warn("Scan history storage skipped", error);
    try {
      localStorage.removeItem(getScanHistoryStorageKey(userId));
      localStorage.setItem(getScanHistoryStorageKey(userId), JSON.stringify(compactItems.slice(0, 3)));
    } catch (retryError) {
      console.warn("Scan history storage retry failed", retryError);
    }
  }
}

function compactScanHistoryItem(item: ScanHistoryItem): ScanHistoryItem {
  if (item.type === "ingredients") return { ...item, photo: compactScanPhoto(item.photo) };
  if (item.type === "menu") return { ...item, photo: compactScanPhoto(item.photo) };
  return item;
}

function compactScanPhoto(photo: string) {
  return photo.length < 180_000 ? photo : "";
}

function mergeScanHistory(primary: ScanHistoryItem[], secondary: ScanHistoryItem[] = []) {
  const seen = new Set<string>();
  return [...primary, ...secondary].filter((item) => {
    const key = getScanHistoryKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, SCAN_HISTORY_LIMIT);
}

function isScanHistoryItem(item: unknown): item is ScanHistoryItem {
  if (!item || typeof item !== "object") return false;
  const value = item as Partial<ScanHistoryItem>;
  if (typeof value.id !== "number" || typeof value.title !== "string" || typeof value.subtitle !== "string") return false;
  if (value.type === "product") return typeof value.barcode === "string" && Boolean(value.product);
  if (value.type === "ingredients") return typeof value.photo === "string" && Boolean(value.analysis);
  if (value.type === "menu") return typeof value.photo === "string" && typeof value.text === "string";
  return false;
}

function scanRowToHistoryItem(row: ScanRow): ScanHistoryItem | null {
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  if (isScanHistoryItem(payload)) return { ...payload, id: row.id };
  if (row.type === "product") return null;
  if (row.type === "ingredients") return null;
  if (row.type === "menu") return null;
  return null;
}

function PricingScreen({ premium, user, setScreen }: { premium: PremiumState; user: AuthUser | null; setScreen: (screen: Screen) => void }) {
  return (
    <>
      <Header eyebrow="Premium" title="Unbegrenzt scannen." />
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <article className="rounded-[28px] bg-ink p-6 text-white shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-honey">Veggie Navigator Premium</p>
              <h2 className="mt-2 text-4xl font-black">4,99 € / Monat</h2>
              <p className="mt-3 max-w-xl leading-7 text-white/70">Für Nutzer, die wirklich oft scannen: keine Tagesgrenze, bessere Speisekartenanalyse und später Preisalarme für Produkte in deiner Nähe.</p>
            </div>
            <span className={`rounded-full px-4 py-2 text-sm font-black ${premium.isPremium ? "bg-leaf text-white" : "bg-white text-ink"}`}>{premium.isPremium ? "Aktiv" : "Noch nicht aktiv"}</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {["Unbegrenzte Barcode-, Zutaten- und Speisekarten-Scans", "Mehrseitige Speisekarten bequem auswerten", "Scan-Verlauf dauerhaft mit deinem Account synchronisieren", "Vorbereitung für Preisalarme und Lieblingsspots"].map((perk) => (
              <div key={perk} className="rounded-2xl bg-white/10 p-4">
                <Check className="text-honey" />
                <p className="mt-3 text-sm font-bold leading-6">{perk}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => user ? setScreen("scanner") : setScreen("profile")} className="rounded-2xl bg-honey px-5 py-3 font-black text-ink shadow-soft">
              {premium.isPremium ? "Zum Scanner" : user ? "Premium später mit Stripe starten" : "Erst einloggen"}
            </button>
            <button type="button" onClick={() => setScreen("profile")} className="rounded-2xl bg-white/10 px-5 py-3 font-bold text-white">Profil ansehen</button>
          </div>
        </article>
        <aside className="rounded-[28px] bg-white p-6 shadow-soft">
          <p className="text-sm font-black uppercase tracking-wide text-moss">Premium v1</p>
          <h3 className="mt-2 text-2xl font-black">Aktuell manuell testbar</h3>
          <p className="mt-3 text-sm leading-6 text-ink/60">Stripe kommt als nächster Schritt. Für jetzt kannst du Premium in Supabase aktivieren und sofort testen, ob unbegrenzte Scans greifen.</p>
          <div className="mt-5 rounded-2xl bg-cream p-4 text-sm">
            <p className="font-black text-ink">Dein Status</p>
            <p className="mt-2 text-ink/65">Plan: <b>{premium.plan}</b></p>
            <p className="text-ink/65">Status: <b>{premium.status}</b></p>
            <p className="text-ink/65">Premium: <b>{premium.isPremium ? "ja" : "nein"}</b></p>
          </div>
          <p className="mt-4 text-xs leading-5 text-ink/45">SQL zum Aktivieren liegt in <b>supabase/premium-v1.sql</b>.</p>
        </aside>
      </section>
    </>
  );
}

function ProfileScreen({ setScreen, user, setUser, finds, premium, setPremium, dietaryPreferences, setDietaryPreferences, favoriteProducts }: { setScreen: (screen: Screen) => void; user: AuthUser | null; setUser: (user: AuthUser | null) => void; finds: Find[]; premium: PremiumState; setPremium: (premium: PremiumState) => void; dietaryPreferences: DietaryPreferences; setDietaryPreferences: (preferences: DietaryPreferences) => void; favoriteProducts: FavoriteProduct[] }) {
  const [profileName, setProfileName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editProfileName, setEditProfileName] = useState(user ? getUserDisplayName(user) : "");
  const [avatarUrl, setAvatarUrl] = useState(getUserAvatarUrl(user));
  const [editAvatarUrl, setEditAvatarUrl] = useState(getUserAvatarUrl(user));
  const [privacy, setPrivacy] = useState<ProfilePrivacy>(readProfilePrivacy);
  const [remoteScans, setRemoteScans] = useState<ScanHistoryItem[]>([]);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const [detailScan, setDetailScan] = useState<ScanHistoryItem | null>(null);
  const mySpotIds = user ? [] : readMySpotIds();
  const mySpots = finds.filter((find) => user ? find.createdBy === user.id : mySpotIds.includes(find.id));
  const totalConfirmations = mySpots.reduce((sum, find) => sum + (find.confirmations ?? 0), 0);
  const scans = user ? remoteScans : readScanHistory();

  useEffect(() => {
    saveProfilePrivacy(privacy);
  }, [privacy]);

  function saveProfileSettings(nextPreferences = dietaryPreferences, nextPrivacy = privacy) {
    if (!user) {
      saveDietaryPreferences(nextPreferences);
      saveProfilePrivacy(nextPrivacy);
      return;
    }
    saveDietaryPreferences(nextPreferences, user.id);
    saveProfilePrivacy(nextPrivacy);
    void saveUserProfile({
      id: user.id,
      profileName: getUserDisplayName(user),
      dietMode: nextPreferences.diet,
      warningIngredients: nextPreferences.warnings,
      ...nextPrivacy
    }).catch((error) => {
      console.warn(error);
      setMessage(error instanceof Error ? error.message : "Profil-Einstellungen konnten nicht gespeichert werden.");
    });
  }

  function updateDietMode(diet: DietMode) {
    const nextPreferences = { ...dietaryPreferences, diet };
    setDietaryPreferences(nextPreferences);
    saveProfileSettings(nextPreferences);
  }

  function toggleWarningIngredient(ingredient: string) {
    const warnings = dietaryPreferences.warnings.includes(ingredient)
      ? dietaryPreferences.warnings.filter((item) => item !== ingredient)
      : [...dietaryPreferences.warnings, ingredient];
    const nextPreferences = { ...dietaryPreferences, warnings };
    setDietaryPreferences(nextPreferences);
    saveProfileSettings(nextPreferences);
  }

  function updatePrivacy(nextPrivacy: ProfilePrivacy) {
    setPrivacy(nextPrivacy);
    saveProfileSettings(dietaryPreferences, nextPrivacy);
  }

  useEffect(() => {
    if (!user) return;
    const currentAvatar = getUserAvatarUrl(user);
    if (currentAvatar && !avatarUrl) {
      setAvatarUrl(currentAvatar);
      setEditAvatarUrl(currentAvatar);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetchProfile(user.id).then((profile) => {
      if (!active || !profile) return;
      setAvatarUrl(profile.avatarUrl || getUserAvatarUrl(user));
      setEditAvatarUrl(profile.avatarUrl || getUserAvatarUrl(user));
      setPremium({
        isPremium: Boolean(profile.isPremium),
        status: profile.premiumStatus || "free",
        plan: profile.premiumPlan || "free",
        premiumUntil: profile.premiumUntil || null
      });
      setPrivacy({
        publicSpots: profile.publicSpots,
        publicScans: profile.publicScans
      });
    }).catch(console.warn);
    void fetchScans(user.id).then((items) => {
      if (!active) return;
      setRemoteScans(items.map(scanRowToHistoryItem).filter(Boolean) as ScanHistoryItem[]);
    }).catch(console.warn);
    return () => {
      active = false;
    };
  }, [user]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAuth(true);
    setMessage("");
    try {
      if (authMode === "register" && !profileName.trim()) {
        setMessage("Bitte wähle einen Profilnamen.");
        setLoadingAuth(false);
        return;
      }
      const authUser = authMode === "login" ? await signInWithPassword(email, password) : await signUpWithPassword(email, password, profileName.trim());
      if (authUser) setUser(authUser);
      setMessage(authMode === "login" ? "Du bist eingeloggt." : "Account erstellt. Falls Supabase E-Mail-Bestätigung verlangt, bitte Postfach prüfen.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Anmeldung gerade nicht möglich.");
    } finally {
      setLoadingAuth(false);
    }
  }

  async function socialLogin(provider: "google") {
    setLoadingAuth(true);
    setMessage("");
    try {
      await signInWithOAuth(provider);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${provider} Login gerade nicht möglich.`);
      setLoadingAuth(false);
    }
  }

  async function signOut() {
    try {
      await logout();
    } catch (error) {
      console.warn(error);
    }
    setUser(null);
    setMessage("Du bist abgemeldet.");
  }

  async function saveProfile() {
    const nextName = editProfileName.trim();
    if (!nextName) {
      setMessage("Profilname darf nicht leer sein.");
      return;
    }
    setLoadingAuth(true);
    setMessage("");
    try {
      const updatedUser = await updateProfileName(nextName);
      const cleanedUser = await clearProfileAvatarMetadata();
      setUser(cleanedUser || updatedUser);
      setAvatarUrl(editAvatarUrl);
      await saveUserProfile({ id: updatedUser.id, profileName: nextName, avatarUrl: editAvatarUrl, dietMode: dietaryPreferences.diet, warningIngredients: dietaryPreferences.warnings, ...privacy });
      setEditingProfile(false);
      setMessage("Profil aktualisiert.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profil konnte nicht gespeichert werden.");
    } finally {
      setLoadingAuth(false);
    }
  }

  async function handleProfileAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setEditAvatarUrl(await resizeImage(file, 360));
    } catch {
      setMessage("Profilbild konnte nicht gelesen werden.");
    } finally {
      event.target.value = "";
    }
  }

  function deleteProfileScan(id: number) {
    setRemoteScans((current) => current.filter((scan) => scan.id !== id));
    setDetailScan((current) => current?.id === id ? null : current);
    if (!user) return;
    void deleteRemoteScan(user.id, id).then(() => {
      setMessage("Scan gelöscht.");
    }).catch((error) => {
      console.warn(error);
      setMessage("Scan wurde ausgeblendet, aber noch nicht in Supabase gelöscht.");
    });
  }

  return (
    <>
      <Header eyebrow="Profil" title={user ? "Dein Profil" : "Einloggen"} />
      {user ? (
        <section className="profile-mobile-shell min-w-0 space-y-4 pb-28 sm:space-y-5 md:pb-0">
          <div className="profile-mobile-panel rounded-[24px] border border-oat/70 bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5 md:p-6">
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-center">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:gap-4">
                <div className="shrink-0">
                  <ProfileAvatar user={user} avatarUrl={editingProfile ? editAvatarUrl : avatarUrl} />
                  {editingProfile && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <label className="cursor-pointer rounded-xl bg-sage px-3 py-2 text-xs font-bold text-moss">
                        Bild wählen
                        <input type="file" accept="image/*" onChange={(event) => void handleProfileAvatar(event)} className="sr-only" />
                      </label>
                      {editAvatarUrl && <button type="button" onClick={() => setEditAvatarUrl("")} className="rounded-xl bg-cream px-3 py-2 text-xs font-bold text-ink/55">Entfernen</button>}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-wide text-moss">Veggie Profil</p>
                {editingProfile ? (
                  <div className="mt-2 max-w-md">
                    <label>
                      <span className="text-sm font-bold text-ink/65">Profilname</span>
                      <input value={editProfileName} onChange={(event) => setEditProfileName(event.target.value)} className="mt-2 w-full rounded-2xl border border-oat bg-cream px-4 py-3 font-bold text-ink outline-none focus:border-moss focus:ring-4 focus:ring-sage" />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => void saveProfile()} disabled={loadingAuth} className="rounded-2xl bg-moss px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Speichern</button>
                      <button onClick={() => { setEditingProfile(false); setEditProfileName(getUserDisplayName(user)); setEditAvatarUrl(avatarUrl); }} className="rounded-2xl border border-oat bg-white px-4 py-2 text-sm font-bold text-ink/65">Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <h2 className="mt-1 break-words text-2xl font-black leading-tight text-ink sm:text-3xl md:text-4xl">{getUserDisplayName(user)}</h2>
                )}
                  <p className="mt-1 break-all text-sm font-semibold text-ink/45">{user.email}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <button onClick={() => { setEditingProfile(true); setEditProfileName(getUserDisplayName(user)); setEditAvatarUrl(avatarUrl || getUserAvatarUrl(user)); }} className="rounded-2xl bg-moss px-3 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-leaf sm:px-4">Profil bearbeiten</button>
                    <button onClick={() => setScreen("add")} className="rounded-2xl border border-oat bg-cream px-3 py-2.5 text-sm font-bold text-moss hover:bg-sage sm:px-4">Spot teilen</button>
                    <button onClick={() => void signOut()} className="col-span-2 rounded-2xl border border-oat bg-white px-3 py-2.5 text-sm font-bold text-ink/55 hover:bg-cream sm:col-span-1 sm:px-4">Abmelden</button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ProfileStat label="Spots" value={String(mySpots.length)} />
                <ProfileStat label="Bestätigt" value={String(totalConfirmations)} />
              </div>
              <div className="rounded-2xl border border-oat bg-cream p-4 xl:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs font-black uppercase tracking-wide text-ink/45">Premium</span>
                    <b className="mt-1 block text-lg text-moss">{premium.isPremium ? "Aktiv - unbegrenzte Scans" : "Free - 5 Scans pro Tag"}</b>
                  </div>
                  <button type="button" onClick={() => setScreen("pricing")} className="rounded-2xl bg-ink px-4 py-2 text-sm font-bold text-white">{premium.isPremium ? "Premium ansehen" : "Premium holen"}</button>
                </div>
              </div>
            </div>
          </div>
          <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.75fr)]">
            <div className="profile-mobile-panel rounded-[24px] border border-oat/70 bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
              <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-moss">Meine Beiträge</p>
                  <h3 className="mt-1 text-2xl font-black">Deine Spots</h3>
                </div>
                <button onClick={() => setScreen("add")} className="max-w-full rounded-2xl bg-moss px-4 py-3 text-sm font-bold text-white shadow-sm sm:w-auto">Spot hinzufügen</button>
              </div>
              <div className="mt-5 space-y-3">
                {mySpots.map((spot) => <ProfileSpotCard key={spot.id} spot={spot} setScreen={setScreen} />)}
                {mySpots.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-oat bg-cream p-6 text-center">
                    <Store className="mx-auto text-moss" size={36} />
                    <p className="mt-3 text-lg font-bold">Noch keine eigenen Spots</p>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/60">Füge deinen ersten Fund hinzu. Danach erscheint er hier in deinem Profil.</p>
                    <button onClick={() => setScreen("add")} className="mt-4 rounded-2xl bg-moss px-5 py-3 font-bold text-white">Ersten Spot teilen</button>
                  </div>
                )}
              </div>
            </div>
            <aside className="space-y-5">
              <div className="rounded-[28px] border border-oat/70 bg-white p-5 shadow-soft">
                <p className="text-xs font-black uppercase tracking-wide text-moss">Ernährungsprofil</p>
                <h3 className="mt-1 text-xl font-black">Deine Regeln</h3>
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-cream p-1">
                  {(["vegan", "vegetarisch", "flexitarisch"] as DietMode[]).map((diet) => (
                    <button key={diet} type="button" onClick={() => updateDietMode(diet)} className={`rounded-xl px-3 py-2 text-xs font-black ${dietaryPreferences.diet === diet ? "bg-moss text-white" : "bg-white text-ink/60"}`}>
                      {dietLabel(diet)}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-sm font-bold text-ink/65">Warnen bei</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {warningOptions.map((option) => {
                    const checked = dietaryPreferences.warnings.includes(option.id);
                    return (
                      <button key={option.id} type="button" onClick={() => toggleWarningIngredient(option.id)} className={`rounded-full px-3 py-2 text-xs font-bold ${checked ? "bg-moss text-white" : "bg-cream text-ink/55"}`}>
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-[28px] border border-oat/70 bg-white p-5 shadow-soft">
                <p className="text-xs font-black uppercase tracking-wide text-moss">Gemerkte Produkte</p>
                <h3 className="mt-1 text-xl font-black">Deine Auswahl</h3>
                <div className="mt-4 space-y-2">
                  {favoriteProducts.slice(0, 6).map((product) => (
                    <div key={product.barcode} className="flex items-center gap-3 rounded-2xl bg-cream p-2">
                      {product.imageUrl ? <img src={product.imageUrl} alt="" className="size-10 rounded-xl object-contain bg-white" /> : <span className="grid size-10 place-items-center rounded-xl bg-sage text-moss"><Heart size={16} /></span>}
                      <div className="min-w-0 flex-1">
                        <b className="block truncate text-sm">{product.name}</b>
                        <span className="text-xs text-ink/50">{product.status}</span>
                      </div>
                    </div>
                  ))}
                  {favoriteProducts.length === 0 && <p className="rounded-2xl bg-cream p-4 text-sm text-ink/60">Noch keine Produkte gemerkt.</p>}
                </div>
              </div>
              <div className="rounded-[28px] border border-oat/70 bg-white p-5 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-moss">Meine Scans</p>
                    <h3 className="mt-1 text-xl font-black">Scan-Verlauf</h3>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${privacy.publicScans ? "bg-sage text-moss" : "bg-cream text-ink/45"}`}>{privacy.publicScans ? "öffentlich" : "privat"}</span>
                </div>
                <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                  {scans.map((scan) => <ProfileScanCard key={scan.id} scan={scan} openImage={setPreviewImage} openDetails={setDetailScan} deleteScan={deleteProfileScan} />)}
                  {scans.length === 0 && <p className="rounded-2xl bg-cream p-4 text-sm text-ink/60">Noch keine Scans gespeichert.</p>}
                </div>
              </div>
              <div className="rounded-[28px] border border-oat/70 bg-white p-5 shadow-soft">
                <p className="text-xs font-black uppercase tracking-wide text-moss">Privatsphäre</p>
                <h3 className="mt-1 text-xl font-black">Sichtbarkeit</h3>
                <div className="mt-4 space-y-3">
                  <PrivacyToggle label="Geteilte Spots öffentlich" checked={privacy.publicSpots} onChange={(checked) => updatePrivacy({ ...privacy, publicSpots: checked })} />
                  <PrivacyToggle label="Scans öffentlich" checked={privacy.publicScans} onChange={(checked) => updatePrivacy({ ...privacy, publicScans: checked })} />
                </div>
                <p className="mt-3 text-xs leading-5 text-ink/50">Standard: Spots öffentlich, Scans privat.</p>
              </div>
            </aside>
          </section>
          {message && <p className="rounded-2xl bg-sage px-4 py-3 text-sm font-bold text-moss">{message}</p>}
          {detailScan && <ScanDetailModal scan={detailScan} close={() => setDetailScan(null)} openImage={setPreviewImage} deleteScan={deleteProfileScan} />}
          {previewImage && <ScanImageModal image={previewImage} close={() => setPreviewImage(null)} />}
        </section>
      ) : (
        <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(18rem,0.7fr)] lg:items-start">
          <div className="overflow-hidden rounded-[28px] border border-oat/70 bg-white shadow-soft">
            <div className="border-b border-oat/70 bg-white px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-sage text-moss"><LogIn size={20} /></span>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-moss">Veggie Navigator</p>
                  <h2 className="text-2xl font-bold">Dein Profil</h2>
                </div>
              </div>
              <p className="mt-4 max-w-xl text-sm leading-6 text-ink/60">Speichere deine Scans, kommentiere Spots und behalte deine eigenen Beiträge im Blick.</p>
            </div>
            <div className="p-6">
              {!authConfigured && <p className="mb-4 rounded-2xl bg-tomato px-4 py-3 text-sm font-bold text-white">Supabase Auth fehlt noch: Setze `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`.</p>}
              <button type="button" onClick={() => void socialLogin("google")} disabled={loadingAuth || !authConfigured} className="flex w-full items-center justify-center gap-3 rounded-2xl border border-oat bg-white px-5 py-3.5 font-bold text-ink shadow-sm transition hover:border-moss/40 hover:bg-cream disabled:opacity-60">
                <GoogleLogo /> Mit Google anmelden
              </button>
              <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase text-ink/35">
                <span className="h-px flex-1 bg-oat" />
                oder
                <span className="h-px flex-1 bg-oat" />
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-2xl border border-oat bg-cream p-1">
                <button type="button" onClick={() => setAuthMode("login")} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${authMode === "login" ? "bg-moss text-white shadow-sm" : "text-ink/60 hover:bg-white"}`}>Anmelden</button>
                <button type="button" onClick={() => setAuthMode("register")} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${authMode === "register" ? "bg-moss text-white shadow-sm" : "text-ink/60 hover:bg-white"}`}>Registrieren</button>
              </div>
              <form onSubmit={login} className="mt-5 space-y-4">
                {authMode === "register" && (
                  <label className="block">
                    <span className="text-sm font-bold text-ink/75">Profilname</span>
                    <input value={profileName} onChange={(event) => setProfileName(event.target.value)} required={authMode === "register"} className="mt-2 w-full rounded-2xl border border-oat bg-white px-4 py-3 outline-none transition focus:border-moss focus:ring-4 focus:ring-sage" placeholder="z.B. VeggieNils" />
                  </label>
                )}
                <label className="block">
                  <span className="text-sm font-bold text-ink/75">E-Mail</span>
                  <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="mt-2 w-full rounded-2xl border border-oat bg-white px-4 py-3 outline-none transition focus:border-moss focus:ring-4 focus:ring-sage" placeholder="du@example.com" />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-ink/75">Passwort</span>
                  <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={6} className="mt-2 w-full rounded-2xl border border-oat bg-white px-4 py-3 outline-none transition focus:border-moss focus:ring-4 focus:ring-sage" placeholder="Mindestens 6 Zeichen" />
                </label>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <button disabled={loadingAuth || !authConfigured} className="rounded-2xl bg-moss px-5 py-3 font-bold text-white shadow-soft transition hover:bg-leaf disabled:opacity-60">{loadingAuth ? "Bitte warten..." : authMode === "login" ? "Einloggen" : "Account erstellen"}</button>
                  <button type="button" onClick={() => setScreen("add")} className="rounded-2xl border border-oat bg-white px-5 py-3 font-bold text-moss transition hover:bg-cream">Ohne Login weiter</button>
                </div>
              </form>
              {message && <p className="mt-4 rounded-2xl bg-sage px-4 py-3 text-sm font-bold text-moss">{message}</p>}
            </div>
          </div>
          <aside className="rounded-[28px] border border-oat/70 bg-cream p-6">
            <p className="text-sm font-bold uppercase tracking-wide text-moss">Warum ein Profil?</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight">Mehr scannen, weniger verlieren.</h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-4">
                <span className="block text-xs font-black uppercase text-ink/40">Ohne Login</span>
                <b className="mt-1 block text-2xl text-ink">3</b>
                <span className="text-xs font-bold text-ink/50">Scans pro Tag</span>
              </div>
              <div className="rounded-2xl bg-moss p-4 text-white">
                <span className="block text-xs font-black uppercase text-white/65">Mit Profil</span>
                <b className="mt-1 block text-2xl text-honey">5</b>
                <span className="text-xs font-bold text-white/75">Scans pro Tag</span>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ["Mehr Tageslimit", "Mit Account bekommst du 5 statt 3 Scans pro Tag."],
                ["Verlauf auf allen Geräten", "Gelöschte oder gespeicherte Scans bleiben zwischen Handy und PC synchron."],
                ["Eigene Spots wiederfinden", "Deine hinzugefügten Orte landen gesammelt in deinem Profil."],
                ["Mitreden", "Du kannst Spots kommentieren und echte Updates zur Community beitragen."],
                ["Privatsphäre", "Spots sind öffentlich, Scans bleiben standardmäßig privat."]
              ].map(([title, text]) => (
                <div key={title} className="flex gap-3">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-white text-moss"><Check size={15} /></span>
                  <p className="text-sm leading-6 text-ink/65"><b className="block text-ink">{title}</b>{text}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>
      )}
    </>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-oat bg-cream p-4">
      <span className="block text-xs font-black uppercase tracking-wide text-ink/45">{label}</span>
      <b className="mt-1 block text-3xl font-black text-moss">{value}</b>
    </div>
  );
}

function ProfileSpotCard({ spot, setScreen }: { spot: Find; setScreen?: (screen: Screen) => void }) {
  return (
    <article className="profile-spot-card w-full max-w-full overflow-hidden rounded-3xl bg-cream p-3 sm:p-4">
      <div className="flex min-w-0 gap-3">
        <div className="grid size-[4.25rem] shrink-0 place-items-center overflow-hidden rounded-2xl bg-oat text-moss sm:size-20">
          {spot.imageDataUrl ? <img src={spot.imageDataUrl} alt="" className="h-full w-full object-cover" /> : <FindIcon category={spot.category} size={28} />}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <h4 className="min-w-0 truncate font-bold">{spot.name}</h4>
            <span className="shrink-0"><Badge status={spot.status} /></span>
          </div>
          <p className="mt-1 line-clamp-2 break-words text-sm leading-6 text-ink/55">{getShortPlace(spot.place)}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 max-w-full break-words text-sm leading-6 text-ink/70">{spot.description}</p>
      <div className="mt-3 grid w-full max-w-full grid-cols-2 gap-2 text-xs sm:flex sm:flex-wrap sm:items-center">
        <span className="min-w-0 truncate rounded-full bg-white px-3 py-1 text-center text-xs font-bold text-moss">{spot.price}</span>
        <span className="min-w-0 truncate rounded-full bg-white px-3 py-1 text-center text-xs font-bold text-ink/50">{spot.confirmations ?? 0} bestätigt</span>
        {setScreen && <button onClick={() => setScreen("map")} className="col-span-2 w-full rounded-full bg-moss px-3 py-2 text-xs font-bold text-white sm:col-span-1 sm:w-auto sm:py-1">Auf Karte ansehen</button>}
      </div>
    </article>
  );
}

function ProfileScanCard({ scan, openImage, openDetails, deleteScan }: { scan: ScanHistoryItem; openImage: (image: { src: string; title: string }) => void; openDetails: (scan: ScanHistoryItem) => void; deleteScan: (id: number) => void }) {
  const preview = getScanPreviewImage(scan);
  return (
    <div className="flex w-full items-center gap-2 rounded-2xl bg-cream p-2 text-sm transition hover:bg-sage">
      <button onClick={() => openDetails(scan)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left">
      {preview ? (
        <span onClick={(event) => { event.stopPropagation(); openImage({ src: preview, title: scan.title }); }} className="shrink-0 overflow-hidden rounded-xl bg-white" role="button" tabIndex={-1} aria-label="Scan-Bild groß anzeigen">
          <img src={preview} alt="" className="size-12 object-cover" />
        </span>
      ) : (
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sage text-moss"><ScanLine size={18} /></span>
      )}
      <div className="min-w-0">
        <b className="block truncate">{scan.title}</b>
        <span className="mt-1 block truncate text-xs text-ink/55">{scan.subtitle}</span>
      </div>
      </button>
      <button onClick={() => deleteScan(scan.id)} className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-ink/45 transition hover:bg-tomato hover:text-white" aria-label="Scan löschen">
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function ScanDetailModal({ scan, close, openImage, deleteScan }: { scan: ScanHistoryItem; close: () => void; openImage: (image: { src: string; title: string }) => void; deleteScan: (id: number) => void }) {
  const preview = getScanPreviewImage(scan);
  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto bg-ink/80 p-4" role="dialog" aria-modal="true">
      <div className="mx-auto my-6 max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-soft">
        <div className="flex items-start justify-between gap-4 border-b border-oat bg-cream px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-moss">{scan.type === "product" ? "Produkt-Scan" : scan.type === "ingredients" ? "Zutaten-Scan" : "Speisekarten-Scan"}</p>
            <h2 className="mt-1 break-words text-2xl font-black text-ink">{scan.title}</h2>
            <p className="mt-1 text-sm font-semibold text-ink/55">{scan.subtitle}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={() => deleteScan(scan.id)} className="grid size-10 place-items-center rounded-full bg-white text-tomato shadow-sm" aria-label="Scan löschen"><Trash2 size={18} /></button>
            <button onClick={close} className="grid size-10 place-items-center rounded-full bg-white text-ink/65 shadow-sm" aria-label="Details schließen"><X size={18} /></button>
          </div>
        </div>
        <div className="grid gap-5 p-5 md:grid-cols-[15rem_minmax(0,1fr)]">
          <div>
            {preview ? (
              <button onClick={() => openImage({ src: preview, title: scan.title })} className="block w-full overflow-hidden rounded-3xl bg-cream shadow-sm">
                <img src={preview} alt="" className="aspect-[3/4] w-full object-contain p-2" />
              </button>
            ) : (
              <div className="grid aspect-[3/4] place-items-center rounded-3xl bg-cream text-moss"><ScanLine size={42} /></div>
            )}
          </div>
          <div className="min-w-0 space-y-4">
            {scan.type === "product" && (
              <>
                <div className="rounded-2xl bg-cream p-4">
                  <p className="text-xs font-black uppercase text-moss">Barcode</p>
                  <p className="mt-1 break-all font-bold">{scan.barcode}</p>
                </div>
                <div className="rounded-2xl bg-cream p-4">
                  <p className="text-xs font-black uppercase text-moss">Einschätzung</p>
                  <p className="mt-1 font-bold">{scan.product.status}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/70">{scan.product.reason}</p>
                </div>
              </>
            )}
            {scan.type === "ingredients" && (
              <>
                <div className="rounded-2xl bg-cream p-4">
                  <p className="text-xs font-black uppercase text-moss">Ergebnis</p>
                  <p className="mt-1 font-bold">{scan.analysis.status}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/70">{scan.analysis.explanation}</p>
                </div>
                {scan.analysis.problematicIngredients.length > 0 && (
                  <div className="rounded-2xl bg-tomato/10 p-4">
                    <p className="text-xs font-black uppercase text-tomato">Auffällige Zutaten</p>
                    <p className="mt-2 text-sm font-semibold text-ink/75">{scan.analysis.problematicIngredients.join(", ")}</p>
                  </div>
                )}
              </>
            )}
            {scan.type === "menu" && (
              <div className="rounded-2xl bg-cream p-4">
                <p className="text-xs font-black uppercase text-moss">Analyse</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink/75">{scan.text}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivacyToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-oat bg-cream px-4 py-3 transition hover:bg-sage/70">
      <span className="text-sm font-bold">{label}</span>
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl border text-white ${checked ? "border-moss bg-moss" : "border-ink/15 bg-white text-ink/35"}`}>
        {checked ? <Check size={18} /> : <X size={18} />}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
    </label>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.37c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.37 12 5.37z" />
    </svg>
  );
}

function getUserAvatarUrl(user: AuthUser | null) {
  const metadata = user?.user_metadata || {};
  const avatar = String(metadata.avatar_url || metadata.picture || "");
  return avatar.startsWith("data:image/") ? "" : avatar;
}

function ProfileAvatar({ user, avatarUrl, size = "lg" }: { user: AuthUser | null; avatarUrl?: string; size?: "sm" | "lg" }) {
  const src = avatarUrl || getUserAvatarUrl(user);
  const name = user ? getUserDisplayName(user) : "Veggie Nutzer";
  const sizeClass = size === "sm" ? "size-12 rounded-2xl text-lg" : "size-14 rounded-2xl text-xl sm:size-16 sm:text-2xl";
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden bg-moss font-black text-white shadow-sm ${sizeClass}`}>
      {src ? <img src={src} alt={`${name} Profilbild`} className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(getRouteFromLocation);
  const screen = route.screen;
  const [user, setUser] = useState<AuthUser | null>(null);
  const [premium, setPremium] = useState<PremiumState>(FREE_PREMIUM_STATE);
  const [profileLoadedFor, setProfileLoadedFor] = useState("");
  const [guestId] = useState(readGuestId);
  const [dietaryPreferences, setDietaryPreferences] = useState<DietaryPreferences>(() => readDietaryPreferences());
  const [favoriteProducts, setFavoriteProducts] = useState<FavoriteProduct[]>(() => readFavoriteProducts());
  const [finds, setFinds] = useState<Find[]>(() => initialFinds.map((find) => ({ ...find, confirmations: 0, viewerConfirmed: false, likeCount: 0, dislikeCount: 0, viewerReaction: "" })));

  const navigateToPath = (path: string, replace = false) => {
    if (window.location.pathname !== path) {
      if (replace) window.history.replaceState(null, "", path);
      else window.history.pushState(null, "", path);
    }
    setRoute(getRouteFromLocation());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setScreen = (nextScreen: Screen) => {
    navigateToPath(pathForScreen(nextScreen));
  };

  const openSpotRoute = (id: number) => {
    navigateToPath(`/spots/${id}`);
  };

  const closeSpotRoute = () => {
    navigateToPath(pathForScreen("map"), true);
  };

  useEffect(() => {
    const handlePopState = () => setRoute(getRouteFromLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    let active = true;
    cleanupLargeAppStorage();
    void getCurrentUser().then((currentUser) => {
      if (active) setUser(currentUser);
    });
    const unsubscribe = onAuthChange((currentUser) => setUser(currentUser));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const metadata = user.user_metadata || {};
    const authAvatar = String(metadata.avatar_url || metadata.picture || "");
    if (!authAvatar.startsWith("data:image/")) return;
    void clearProfileAvatarMetadata().then((cleanedUser) => {
      if (cleanedUser) setUser(cleanedUser);
    }).catch(console.warn);
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setPremium(FREE_PREMIUM_STATE);
      setProfileLoadedFor("");
      setDietaryPreferences(readDietaryPreferences());
      setFavoriteProducts(readFavoriteProducts());
      return;
    }
    setProfileLoadedFor("");
    let active = true;
    void fetchProfile(user.id).then((profile) => {
      if (!active) return;
      if (profile) {
        setPremium({
          isPremium: Boolean(profile.isPremium),
          status: profile.premiumStatus || "free",
          plan: profile.premiumPlan || "free",
          premiumUntil: profile.premiumUntil || null
        });
        setDietaryPreferences({
          diet: profile.dietMode || DEFAULT_DIETARY_PREFERENCES.diet,
          warnings: Array.isArray(profile.warningIngredients) ? profile.warningIngredients : DEFAULT_DIETARY_PREFERENCES.warnings
        });
      }
      setProfileLoadedFor(user.id);
    }).catch((error) => {
      if (!active) return;
      console.warn(error);
      setProfileLoadedFor(user.id);
    });
    void fetchProductFavorites(user.id).then((items) => {
      if (active) setFavoriteProducts(items);
    }).catch(console.warn);
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (user) return;
    saveDietaryPreferences(dietaryPreferences);
  }, [dietaryPreferences, user]);

  useEffect(() => {
    if (!user) return;
    if (profileLoadedFor !== user.id) return;
    void saveUserProfile({
      id: user.id,
      profileName: getUserDisplayName(user),
      dietMode: dietaryPreferences.diet,
      warningIngredients: dietaryPreferences.warnings,
      publicSpots: readProfilePrivacy().publicSpots,
      publicScans: readProfilePrivacy().publicScans
    }).catch(console.warn);
  }, [dietaryPreferences, profileLoadedFor, user?.id]);

  useEffect(() => {
    if (user) return;
    saveFavoriteProducts(favoriteProducts);
  }, [favoriteProducts, user]);

  useEffect(() => {
    let active = true;
    async function loadSpots() {
      try {
        const items = await fetchCommunitySpots(user?.id || "", guestId);
        if (active) setFinds(items.map((find: Find) => ({ ...find, viewerConfirmed: Boolean(find.viewerConfirmed) })));
      } catch (error) {
        console.warn(error);
      }
    }
    void loadSpots();
    return () => {
      active = false;
    };
  }, [user?.id, guestId]);

  useEffect(() => {
    if (!user) return;
    const spotIds = readMySpotIds();
    if (spotIds.length === 0) return;
    void claimCommunitySpots(user.id, getUserDisplayName(user), spotIds).then((claimedSpots) => {
      if (!claimedSpots.length) return;
      const claimedFinds = claimedSpots as Find[];
      setFinds((current) => {
        const claimedById = new Map(claimedFinds.map((spot) => [spot.id, spot]));
        return current.map((find) => claimedById.get(find.id) || find);
      });
    }).catch(console.warn);
  }, [user?.id]);

  const addFind = async (find: CommunitySpotPayload) => {
    const saved = await saveCommunitySpot(find);
    saveMySpotId(saved.id);
    setFinds((current) => [{ ...saved, viewerConfirmed: false }, ...current]);
  };

  const confirmFind = (id: number) => {
    const target = finds.find((find) => find.id === id);
    if (!target || target.viewerConfirmed) return;
    setFinds((current) => current.map((find) => find.id === id ? { ...find, confirmations: (find.confirmations ?? 0) + 1, confirmed: "gerade eben", viewerConfirmed: true } : find));
    void saveSpotConfirmation(id, user?.id || "", guestId).then((saved) => {
      setFinds((current) => current.map((find) => find.id === id ? { ...saved, viewerConfirmed: true } : find));
    }).catch(console.warn);
  };

  const reactToFind = (id: number, reaction: SpotReaction) => {
    const target = finds.find((find) => find.id === id);
    if (!target) return;
    const previousReaction = target.viewerReaction || "";
    const nextReaction: SpotReaction | "" = previousReaction === reaction ? "" : reaction;

    setFinds((current) => current.map((find) => find.id === id ? applyReactionToFind(find, nextReaction) : find));
    void saveSpotReaction(id, nextReaction, user?.id || "", guestId).then((saved) => {
      setFinds((current) => current.map((find) => find.id === id ? { ...saved, viewerConfirmed: find.viewerConfirmed } : find));
    }).catch((error) => {
      console.warn(error);
      setFinds((current) => current.map((find) => find.id === id ? applyReactionToFind(find, previousReaction) : find));
    });
  };

  const toggleFavoriteProduct = (product: ProductResult) => {
    const key = product.barcode || product.name;
    const existing = favoriteProducts.some((item) => item.barcode === key);
    const favorite: FavoriteProduct = {
      barcode: key,
      name: product.name,
      status: product.status,
      imageUrl: product.imageUrl,
      reason: product.reason,
      createdAt: new Date().toISOString()
    };
    setFavoriteProducts((current) => {
      if (current.some((item) => item.barcode === key)) return current.filter((item) => item.barcode !== key);
      return [favorite, ...current].slice(0, 100);
    });
    if (!user) return;
    if (existing) {
      void deleteRemoteProductFavorite(user.id, key).catch(console.warn);
    } else {
      void saveProductFavorite({ userId: user.id, ...favorite }).catch(console.warn);
    }
  };

  return (
    <Shell screen={screen} setScreen={setScreen}>
      {screen === "home" && <HomeScreen setScreen={setScreen} user={user} />}
      {screen === "scanner" && <ScannerScreen user={user} premium={premium} setPremium={setPremium} dietaryPreferences={dietaryPreferences} favoriteProducts={favoriteProducts} toggleFavoriteProduct={toggleFavoriteProduct} />}
      {screen === "map" && <MapScreen finds={finds} setScreen={setScreen} confirmFind={confirmFind} user={user} reactToFind={reactToFind} routeSpotId={route.spotId} openSpotRoute={openSpotRoute} closeSpotRoute={closeSpotRoute} />}
      {screen === "add" && <AddFindScreen addFind={addFind} setScreen={setScreen} user={user} />}
      {screen === "pricing" && <PricingScreen premium={premium} user={user} setScreen={setScreen} />}
      {screen === "profile" && <ProfileScreen setScreen={setScreen} user={user} setUser={setUser} finds={finds} premium={premium} setPremium={setPremium} dietaryPreferences={dietaryPreferences} setDietaryPreferences={setDietaryPreferences} favoriteProducts={favoriteProducts} />}
    </Shell>
  );
}

function readMySpotIds() {
  try {
    const value = localStorage.getItem("veggie-navigator-my-spot-ids");
    const ids = value ? JSON.parse(value) : [];
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "number") : [];
  } catch {
    return [];
  }
}

function readGuestId() {
  const key = "veggie-navigator-guest-id";
  try {
    const current = localStorage.getItem(key);
    if (current) return current;
    const next = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, next);
    return next;
  } catch {
    return "guest-session";
  }
}

function cleanupLargeAppStorage() {
  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(SCAN_HISTORY_STORAGE_KEY)) continue;
      const value = localStorage.getItem(key) || "";
      if (key !== getScanHistoryStorageKey() || value.length > 220_000) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn("Local storage cleanup skipped", error);
  }
}

function saveMySpotId(id: number) {
  const ids = Array.from(new Set([id, ...readMySpotIds()]));
  localStorage.setItem("veggie-navigator-my-spot-ids", JSON.stringify(ids));
}

function readProfilePrivacy(): ProfilePrivacy {
  try {
    const value = localStorage.getItem(PROFILE_PRIVACY_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : {};
    return {
      publicSpots: typeof parsed.publicSpots === "boolean" ? parsed.publicSpots : true,
      publicScans: typeof parsed.publicScans === "boolean" ? parsed.publicScans : false
    };
  } catch {
    return { publicSpots: true, publicScans: false };
  }
}

function saveProfilePrivacy(privacy: ProfilePrivacy) {
  localStorage.setItem(PROFILE_PRIVACY_STORAGE_KEY, JSON.stringify(privacy));
}

function getUserScopedStorageKey(baseKey: string, userId?: string) {
  return userId ? `${baseKey}-${userId}` : `${baseKey}-guest`;
}

function readDietaryPreferences(userId?: string): DietaryPreferences {
  try {
    const value = localStorage.getItem(getUserScopedStorageKey(DIETARY_PREFERENCES_STORAGE_KEY, userId));
    const parsed = value ? JSON.parse(value) : null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_DIETARY_PREFERENCES;
    const diet = ["vegan", "vegetarisch", "flexitarisch"].includes(parsed.diet) ? parsed.diet : DEFAULT_DIETARY_PREFERENCES.diet;
    const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.filter((item: unknown) => typeof item === "string") : DEFAULT_DIETARY_PREFERENCES.warnings;
    return { diet, warnings };
  } catch {
    return DEFAULT_DIETARY_PREFERENCES;
  }
}

function saveDietaryPreferences(preferences: DietaryPreferences, userId?: string) {
  localStorage.setItem(getUserScopedStorageKey(DIETARY_PREFERENCES_STORAGE_KEY, userId), JSON.stringify(preferences));
}

function readFavoriteProducts(userId?: string): FavoriteProduct[] {
  try {
    const value = localStorage.getItem(getUserScopedStorageKey(PRODUCT_FAVORITES_STORAGE_KEY, userId));
    const items = value ? JSON.parse(value) : [];
    return Array.isArray(items) ? items.filter(isFavoriteProductItem).slice(0, 100) : [];
  } catch {
    return [];
  }
}

function saveFavoriteProducts(items: FavoriteProduct[], userId?: string) {
  localStorage.setItem(getUserScopedStorageKey(PRODUCT_FAVORITES_STORAGE_KEY, userId), JSON.stringify(items.slice(0, 100)));
}

function isFavoriteProductItem(item: unknown): item is FavoriteProduct {
  if (!item || typeof item !== "object") return false;
  const value = item as Partial<FavoriteProduct>;
  return typeof value.barcode === "string" && typeof value.name === "string" && typeof value.createdAt === "string";
}

function isFavoriteProduct(product: ProductResult, favorites: FavoriteProduct[]) {
  const key = product.barcode || product.name;
  return favorites.some((item) => item.barcode === key);
}

function readSpotComments(spotId: number): SpotComment[] {
  try {
    const value = localStorage.getItem(`veggie-navigator-spot-comments-${spotId}`);
    const comments = value ? JSON.parse(value) : [];
    return Array.isArray(comments) ? comments.filter(isSpotComment) : [];
  } catch {
    return [];
  }
}

function saveSpotComments(spotId: number, comments: SpotComment[]) {
  localStorage.setItem(`veggie-navigator-spot-comments-${spotId}`, JSON.stringify(comments));
}

function applyReactionToFind(find: Find, nextReaction: SpotReaction | ""): Find {
  const previousReaction = find.viewerReaction || "";
  let likeCount = find.likeCount ?? 0;
  let dislikeCount = find.dislikeCount ?? 0;
  if (previousReaction === "like") likeCount = Math.max(0, likeCount - 1);
  if (previousReaction === "dislike") dislikeCount = Math.max(0, dislikeCount - 1);
  if (nextReaction === "like") likeCount += 1;
  if (nextReaction === "dislike") dislikeCount += 1;
  return { ...find, likeCount, dislikeCount, viewerReaction: nextReaction };
}

function isSpotComment(comment: unknown): comment is SpotComment {
  if (!comment || typeof comment !== "object") return false;
  const value = comment as Partial<SpotComment>;
  return typeof value.id === "number" && typeof value.author === "string" && typeof value.text === "string" && typeof value.createdAt === "string";
}

function buildCommentThreads(comments: SpotComment[]) {
  const repliesByParent = new Map<number, SpotComment[]>();
  const parents: SpotComment[] = [];

  comments.forEach((comment) => {
    if (comment.parentId) {
      repliesByParent.set(comment.parentId, [...(repliesByParent.get(comment.parentId) || []), comment]);
    } else {
      parents.push(comment);
    }
  });

  const byNewest = (a: SpotComment, b: SpotComment) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  const byOldest = (a: SpotComment, b: SpotComment) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  return parents.sort(byNewest).map((comment) => ({
    comment,
    replies: (repliesByParent.get(comment.id) || []).sort(byOldest)
  }));
}

function removeCommentWithReplies(comments: SpotComment[], id: number) {
  const removeIds = new Set<number>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    comments.forEach((comment) => {
      if (comment.parentId && removeIds.has(comment.parentId) && !removeIds.has(comment.id)) {
        removeIds.add(comment.id);
        changed = true;
      }
    });
  }
  return comments.filter((comment) => !removeIds.has(comment.id));
}

function formatCommentDate(value: string) {
  return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function getUserDisplayName(user: AuthUser) {
  const metadata = user.user_metadata || {};
  return String(metadata.profile_name || metadata.full_name || metadata.name || user.email || "Veggie Nutzer");
}
