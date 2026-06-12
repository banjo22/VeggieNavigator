import { Camera, Check, Coffee, Crown, Home, Loader2, LogIn, MapPinned, MenuSquare, Plus, ScanLine, Search, ShoppingBag, Sparkles, Star, Store, Trash2, UploadCloud, Utensils, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  analyzeMenuPhoto,
  analyzeIngredientPhoto,
  confirmCommunitySpot as saveSpotConfirmation,
  createCommunitySpot as saveCommunitySpot,
  fetchComments,
  fetchCommunitySpots,
  fetchProfile,
  fetchScans,
  fetchPriceOptions,
  saveComment,
  saveProfile as saveUserProfile,
  saveScan,
  searchPlaces,
  type CommentPayload,
  type CommunitySpotPayload,
  type IngredientAnalysis,
  type PlaceSuggestion,
  type ProfilePayload,
  type PriceOption
} from "./services/api";
import {
  categories,
  featureCards,
  initialFinds,
  pricing,
  recommendations,
  type CommunitySpot,
  type VeggieStatus
} from "./data/mockData";
import { authConfigured, getCurrentUser, logout, onAuthChange, signInWithOAuth, signInWithPassword, signUpWithPassword, updateProfileName, type AuthUser } from "./services/auth";
import { fetchProductByBarcode, type ProductResult } from "./services/openFoodFacts";

type Screen = "home" | "scanner" | "map" | "add" | "pricing" | "profile";
type Find = CommunitySpot & { confirmations?: number; viewerConfirmed?: boolean };
type BarcodeResult = { rawValue: string };
type UserLocation = { lat: number; lng: number };
type ScanHistoryItem =
  | { id: number; type: "product"; title: string; subtitle: string; barcode: string; product: ProductResult }
  | { id: number; type: "ingredients"; title: string; subtitle: string; photo: string; analysis: IngredientAnalysis }
  | { id: number; type: "menu"; title: string; subtitle: string; photo: string; text: string };
type SpotComment = { id: number; author: string; text: string; createdAt: string };
type ProfilePrivacy = { publicSpots: boolean; publicScans: boolean; publicComments: boolean };

const SCAN_HISTORY_STORAGE_KEY = "veggie-navigator-scan-history";
const SCAN_HISTORY_LIMIT = 10;
const PROFILE_PRIVACY_STORAGE_KEY = "veggie-navigator-profile-privacy";

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
  { screen: "add", label: "Hinzufuegen", icon: Plus },
  { screen: "map", label: "Karte", icon: MapPinned },
  { screen: "profile", label: "Profil", icon: UserRound }
];

const statusStyles: Record<VeggieStatus, string> = {
  vegan: "bg-leaf text-white",
  vegetarisch: "bg-honey text-ink",
  "nicht veggie": "bg-tomato text-white",
  "vegan moeglich": "bg-sage text-moss"
};

function Badge({ status }: { status: VeggieStatus }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}>{status}</span>;
}

function FindIcon({ category, size = 18 }: { category: string; size?: number }) {
  if (category === "Restaurants") return <Utensils size={size} />;
  if (category === "Supermarkt-Spots") return <Store size={size} />;
  if (category === "Suesses") return <Coffee size={size} />;
  if (category === "Guenstig") return <ShoppingBag size={size} />;
  return <Star size={size} />;
}

function Shell({ screen, setScreen, children }: { screen: Screen; setScreen: (screen: Screen) => void; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream pb-24 text-ink md:pb-0">
      <div className="mx-auto flex max-w-6xl md:min-h-screen">
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
        <main className="w-full px-4 py-5 sm:px-6 md:px-8 md:py-8">{children}</main>
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

function HomeScreen({ setScreen }: { setScreen: (screen: Screen) => void }) {
  return (
    <>
      <Header eyebrow="Hallo Nils" title="Entdecken, pruefen, teilen." />
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
          <p className="mt-2 text-sm leading-6 text-ink/65">Ein Login ist nur fuer gespeicherte Lieblingsspots und spaetere Sync-Funktionen gedacht. Beitraege sollen nicht hinter Premium liegen.</p>
        </div>
      </section>
    </>
  );
}

function ScannerScreen({ user }: { user: AuthUser | null }) {
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
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>(readScanHistory);
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
      setter("Kamera konnte nicht gestartet werden. Bitte Browser-Berechtigung pruefen.");
    });
  }, [photoCameraActive, scanMode]);

  useEffect(() => {
    localStorage.setItem(SCAN_HISTORY_STORAGE_KEY, JSON.stringify(scanHistory.slice(0, SCAN_HISTORY_LIMIT)));
  }, [scanHistory]);

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
      const result = await fetchProductByBarcode(cleanedCode);
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
        setIngredientMessage("Kein Open-Food-Facts-Eintrag gefunden. In so einem Fall waere ein Zutatenfoto besser.");
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
      setIngredientMessage("Dein Browser unterstuetzt Barcode-Scan per Kamera nicht. Du kannst den Barcode eintippen oder ein Zutatenfoto hochladen.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setIngredientMessage("Kamerazugriff ist in diesem Browser nicht verfuegbar.");
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
      setter("Kamerazugriff ist in diesem Browser nicht verfuegbar.");
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
      setMenuMessage("Seite hinzugefuegt. Du kannst weitere Seiten fotografieren oder analysieren.");
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
      setMenuMessage(`${images.length} Seite${images.length === 1 ? "" : "n"} hinzugefuegt.`);
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
      const result = await analyzeIngredientPhoto(imageDataUrl, controller.signal);
      setAnalysis(result);
      addScanHistory({
        id: Date.now(),
        type: "ingredients",
        title: `Zutaten: ${result.status}`,
        subtitle: result.explanation.slice(0, 72),
        photo: imageDataUrl,
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
      const result = await analyzeMenuPhoto(images, controller.signal);
      setMenuText(result);
      addScanHistory({
        id: Date.now(),
        type: "menu",
        title: `Speisekarte (${images.length} Seite${images.length === 1 ? "" : "n"})`,
        subtitle: result.split("\n").find(Boolean)?.slice(0, 72) || "Analyse gespeichert",
        photo: images[0],
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
        payload: item,
        isPublic: privacy.publicScans
      }).catch(console.warn);
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
      setIngredientPhoto(item.photo);
      setAnalysis(item.analysis);
      return;
    }
    setScanMode("menu");
    setMenuPhotos([item.photo]);
    setMenuText(item.text);
  }

  function deleteScanHistoryItem(id: number) {
    setScanHistory((current) => current.filter((item) => item.id !== id));
  }

  function clearScanHistory() {
    setScanHistory([]);
  }

  const hasCurrentScan = scanMode === "ingredients" ? Boolean(ingredientPhoto || analysis || analysisLoading) : Boolean(menuPhotos.length || menuText || menuLoading);

  return (
    <>
      <Header eyebrow="Scanner" title="Was willst du scannen?" />
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)]">
        <section className="min-w-0 rounded-3xl bg-white p-5 shadow-soft">
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
                    {loading ? <Loader2 className="mr-2 animate-spin" size={18} /> : <Search className="mr-2" size={18} />} Pruefen
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
              <span className="mx-auto mt-1 block max-w-lg text-sm leading-6 text-ink/55">{scanMode === "ingredients" ? "Ein Foto reicht meistens. Die KI prueft die sichtbaren Zutaten." : "Fuege mehrere Seiten hinzu, wenn die Speisekarte laenger ist. Du siehst jede Seite unten als Vorschau."}</span>
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
                  <button onClick={stopPhotoCamera} className="rounded-2xl bg-cream px-4 py-3 font-bold text-ink/70">Schliessen</button>
                </div>
              </div>
            )}
            {scanMode === "ingredients" && ingredientPhoto && <img src={ingredientPhoto} alt="Zutatenfoto Vorschau" className="mt-4 max-h-52 w-full rounded-3xl object-cover" />}
            {scanMode === "menu" && menuPhotos.length > 0 && <MenuPhotoStrip photos={menuPhotos} removePhoto={(index) => setMenuPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} analyze={() => void runMenuAnalysis()} loading={menuLoading} />}
            {((scanMode === "ingredients" && analysisLoading) || (scanMode === "menu" && menuLoading)) && <LoadingAnalysis label={scanMode === "ingredients" ? "Zutaten werden gecheckt" : "Speisekarte wird gecheckt"} onCancel={cancelAnalysis} />}
            {scanMode === "ingredients" && analysis && <AnalysisBox title="KI-Ergebnis" badge={analysis.status}><p>{analysis.explanation}</p>{analysis.problematicIngredients?.length > 0 && <p className="mt-2 font-semibold text-tomato">Kritisch: {analysis.problematicIngredients.join(", ")}</p>}</AnalysisBox>}
            {scanMode === "menu" && menuText && <AnalysisBox title="Speisekarte"><p className="whitespace-pre-wrap">{menuText}</p></AnalysisBox>}
            {hasCurrentScan && !analysisLoading && !menuLoading && <button onClick={resetCurrentScan} className="mt-4 rounded-full bg-white px-5 py-3 text-sm font-bold text-moss shadow-sm">{scanMode === "ingredients" ? "Neue Zutatenliste scannen" : "Neue Speisekarte scannen"}</button>}
            {scanMode === "ingredients" && ingredientMessage && <p className="mt-3 text-sm font-semibold text-tomato">{ingredientMessage}</p>}
            {scanMode === "menu" && menuMessage && <p className="mt-3 text-sm font-semibold text-tomato">{menuMessage}</p>}
          </div>
        </section>
        <section className="flex max-h-[calc(100vh-8rem)] min-w-0 max-w-full flex-col gap-4 overflow-hidden rounded-3xl bg-white p-5 shadow-soft">
          <div className="min-h-0 min-w-0 shrink overflow-y-auto pr-1">
            {scanMode === "ingredients" && product ? <ProductResultCard product={product} prices={prices} pricesLoading={pricesLoading} compact /> : scanMode === "ingredients" && analysis ? (
              <AnalysisBox title="Aktuelles Zutaten-Ergebnis" badge={analysis.status}><p>{analysis.explanation}</p></AnalysisBox>
            ) : scanMode === "menu" && menuText ? (
              <AnalysisBox title="Aktuelle Speisekarte"><p className="whitespace-pre-wrap">{menuText}</p></AnalysisBox>
            ) : (
              <div className="grid min-h-48 place-items-center rounded-3xl bg-cream p-6 text-center">
                <div>
                  <p className="text-lg font-bold">{scanMode === "ingredients" ? "Noch kein Produkt geprueft" : "Speisekarten-Check"}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/60">{scanMode === "ingredients" ? "Scanne Barcode oder Zutatenfoto." : "Lade eine Speisekarte hoch. Ergebnis: 3 klare Listen."}</p>
                </div>
              </div>
            )}
          </div>
          <ScanHistoryList items={scanHistory} restoreScan={restoreScan} deleteItem={deleteScanHistoryItem} clearItems={clearScanHistory} />
        </section>
      </div>
    </>
  );
}

function ProductResultCard({ product, prices, pricesLoading, compact = false }: { product: ProductResult; prices: PriceOption[]; pricesLoading: boolean; compact?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className={`${compact ? "text-xl" : "text-2xl"} font-bold`}>{product.name}</h2>
        <Badge status={product.status} />
      </div>
      <p className="mt-2 text-sm font-semibold text-moss">Quelle: {product.source}</p>
      <p className={`${compact ? "max-h-20 overflow-hidden text-sm leading-6" : "leading-7"} mt-3 text-ink/70`}>{product.reason}</p>
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
        <p className="font-bold">Wo gibt es das guenstiger?</p>
        <p className="mt-1 text-xs leading-5 text-ink/55">Echte Crowdsourcing-Preise aus Open Food Facts Open Prices. In Deutschland kann die Abdeckung noch lueckenhaft sein.</p>
        {pricesLoading && <p className="mt-3 text-sm font-bold text-moss">Preise werden geladen...</p>}
        {!pricesLoading && prices.length === 0 && <p className="mt-3 text-sm text-ink/60">Keine verifizierten Preisspots fuer diesen Barcode gefunden.</p>}
        <div className="mt-3 space-y-2">
          {prices.map((price) => (
            <div key={`${price.store}-${price.price}-${price.date}`} className="rounded-2xl bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <b>{price.store}</b>
                <b>{price.price.toFixed(2).replace(".", ",")} {price.currency}</b>
              </div>
              <p className="mt-1 text-xs text-ink/55">{price.city || price.country} - bestaetigt {price.date}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-3xl bg-sage p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">Naechster Schritt</p>
        <h3 className="mt-2 text-xl font-bold">{product.alternative.name}</h3>
        <p className="mt-2 text-sm leading-6 text-ink/70">{product.alternative.reason}</p>
      </div>
    </div>
  );
}

function ScanHistoryList({ items, restoreScan, deleteItem, clearItems }: { items: ScanHistoryItem[]; restoreScan: (item: ScanHistoryItem) => void; deleteItem: (id: number) => void; clearItems: () => void }) {
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
            <button onClick={() => restoreScan(item)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left hover:bg-sage">
              {"photo" in item && <img src={item.photo} alt="" className="size-12 shrink-0 rounded-xl object-cover" />}
              {item.type === "product" && item.product.imageUrl && <img src={item.product.imageUrl} alt="" className="size-12 shrink-0 rounded-xl bg-cream object-contain p-1" />}
              {item.type === "product" && !item.product.imageUrl && <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sage text-moss"><ScanLine size={18} /></span>}
              <span className="min-w-0">
                <b className="block max-w-full truncate">{item.title}</b>
                <span className="mt-1 block max-w-full truncate text-xs text-ink/55">{item.subtitle}</span>
              </span>
            </button>
            <button onClick={() => deleteItem(item.id)} className="grid size-9 shrink-0 place-items-center rounded-full bg-cream text-ink/55 hover:bg-tomato hover:text-white" aria-label="Scan loeschen">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuPhotoStrip({ photos, removePhoto, analyze, loading }: { photos: string[]; removePhoto: (index: number) => void; analyze: () => void; loading: boolean }) {
  return (
    <div className="mt-4 rounded-3xl bg-white p-4 text-left shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold">Speisekarten-Seiten</p>
          <p className="mt-1 text-xs font-semibold text-ink/50">{photos.length} von 8 Seiten hinzugefuegt</p>
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

function MapScreen({ finds, setScreen, confirmFind, user }: { finds: Find[]; setScreen: (screen: Screen) => void; confirmFind: (id: number) => void; user: AuthUser | null }) {
  const [active, setActive] = useState(categories[0]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailFind, setDetailFind] = useState<Find | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const visible = active === categories[0] ? finds : finds.filter((find) => find.category === active);
  const displayFinds = userLocation
    ? [...visible].sort((a, b) => getDistanceKm(userLocation, a) - getDistanceKm(userLocation, b)).map((find) => ({ ...find, distance: formatDistance(getDistanceKm(userLocation, find)) }))
    : visible;
  const mappable = displayFinds.filter((find) => Number.isFinite(find.lat) && Number.isFinite(find.lng));
  const selected = displayFinds.find((find) => find.id === selectedId) ?? mappable[0] ?? displayFinds[0] ?? null;
  const center = selected && Number.isFinite(selected.lat) && Number.isFinite(selected.lng) ? selected : mappable[0] ?? null;
  const bbox = mappable.length > 0 ? getMapBounds(mappable) : null;
  const mapUrl = bbox ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.minLng}%2C${bbox.minLat}%2C${bbox.maxLng}%2C${bbox.maxLat}&layer=mapnik` : "";

  function findNearby() {
    if (!navigator.geolocation) {
      setLocationMessage("Dein Browser kann keinen Standort liefern.");
      return;
    }
    setLocationMessage("Standort wird abgefragt...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setActive(categories[0]);
        setLocationMessage("Spots nach Entfernung sortiert.");
      },
      () => setLocationMessage("Standortfreigabe wurde nicht erlaubt oder ist nicht verfuegbar."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <>
      <Header eyebrow="In der Naehe" title="Community-Spots" action={<button onClick={() => setScreen("add")} className="rounded-2xl bg-moss p-3 text-white shadow-soft" aria-label="Spot hinzufuegen"><Plus /></button>} />
      <button onClick={() => setScreen("add")} className="mb-4 flex w-full items-center gap-4 rounded-3xl bg-moss p-5 text-left text-white shadow-soft">
        <span className="grid size-12 place-items-center rounded-2xl bg-white text-moss"><Plus /></span>
        <span><span className="block text-xl font-bold">Spot hinzufuegen</span><span className="text-sm text-white/80">Gerade etwas Gutes entdeckt? Teile es ohne Anmeldung.</span></span>
      </button>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-3xl bg-white p-3 shadow-soft">
        <button onClick={findNearby} className="rounded-2xl bg-moss px-4 py-3 text-sm font-bold text-white">Spots in meiner Naehe</button>
        {userLocation && <button onClick={() => { setUserLocation(null); setLocationMessage(""); }} className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold text-moss">Sortierung zuruecksetzen</button>}
        {locationMessage && <span className="text-sm font-semibold text-ink/60">{locationMessage}</span>}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => <button key={category} onClick={() => setActive(category)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${active === category ? "bg-moss text-white" : "bg-white"}`}>{category}</button>)}
      </div>
      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative h-[24rem] overflow-hidden rounded-3xl bg-sage shadow-soft lg:h-[min(70vh,42rem)]">
          {bbox && center ? (
            <>
              <iframe title="OpenStreetMap Karte" src={mapUrl} className="absolute inset-0 h-full w-full border-0" loading="lazy" />
              <div className="pointer-events-none absolute inset-0">
                {mappable.map((find) => {
                  const position = getMarkerPosition(find, bbox);
                  const isSelected = find.id === selected?.id;
                  return (
                    <button key={find.id} onClick={() => setSelectedId(find.id)} className={`pointer-events-auto absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white shadow-soft ring-4 ring-white/85 transition ${isSelected ? "size-14 bg-tomato" : "size-11 bg-moss hover:scale-105"}`} style={{ left: `${position.left}%`, top: `${position.top}%` }} aria-label={`${find.name} auswaehlen`}>
                      <FindIcon category={find.category} size={isSelected ? 24 : 19} />
                    </button>
                  );
                })}
              </div>
              <div className="absolute bottom-4 right-4 max-w-56 rounded-2xl bg-white/95 p-3 text-sm shadow-soft backdrop-blur"><b>{selected?.name}</b><p className="mt-1 text-xs text-ink/60">{selected?.place}</p><p className="mt-1 text-xs font-bold text-moss">{selected?.price}</p></div>
              <a href={`https://www.openstreetmap.org/?mlat=${center.lat}&mlon=${center.lng}#map=15/${center.lat}/${center.lng}`} target="_blank" rel="noreferrer" className="absolute bottom-4 left-4 rounded-2xl bg-white/95 px-4 py-3 text-sm font-bold text-moss backdrop-blur">In OpenStreetMap oeffnen</a>
            </>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center">
              <div>
                <MapPinned className="mx-auto text-moss" size={44} />
                <p className="mt-3 text-lg font-bold">Noch keine Spots auf der Karte</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/60">Sobald du ein Produkt oder Gericht mit echter Location hinzufuegst, erscheint es hier.</p>
                <button onClick={() => setScreen("add")} className="mt-5 rounded-2xl bg-moss px-5 py-3 font-bold text-white shadow-soft">Ersten Spot hinzufuegen</button>
              </div>
            </div>
          )}
        </div>
        <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1 lg:max-h-[min(70vh,42rem)]">
          {displayFinds.map((find) => <FindCard key={find.id} find={find} confirmFind={confirmFind} selected={find.id === selectedId} openFind={() => { setSelectedId(find.id); setDetailFind(find); }} />)}
          {displayFinds.length === 0 && <p className="rounded-2xl bg-white p-5 text-ink/60">In dieser Kategorie gibt es noch keinen Spot. Fueg den ersten hinzu.</p>}
        </div>
      </section>
      {detailFind && <FindDetailModal find={detailFind} finds={finds} confirmFind={confirmFind} close={() => setDetailFind(null)} setScreen={setScreen} user={user} />}
    </>
  );
}

function getMapBounds(items: Pick<Find, "lat" | "lng">[]) {
  const lats = items.map((item) => item.lat);
  const lngs = items.map((item) => item.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.02);
  const lngSpan = Math.max(maxLng - minLng, 0.02);
  const latPadding = latSpan * 0.35;
  const lngPadding = lngSpan * 0.35;
  return {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLng: minLng - lngPadding,
    maxLng: maxLng + lngPadding
  };
}

function getMarkerPosition(find: Pick<Find, "lat" | "lng">, bbox: ReturnType<typeof getMapBounds>) {
  const left = ((find.lng - bbox.minLng) / (bbox.maxLng - bbox.minLng)) * 100;
  const top = (1 - ((find.lat - bbox.minLat) / (bbox.maxLat - bbox.minLat))) * 100;
  return {
    left: Math.min(96, Math.max(4, left)),
    top: Math.min(96, Math.max(4, top))
  };
}

function FindCard({ find, confirmFind, selected, openFind }: { find: Find; confirmFind: (id: number) => void; selected: boolean; openFind: () => void }) {
  const confirmations = find.confirmations ?? 0;
  const isConfirmed = find.viewerConfirmed ?? false;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${find.lat},${find.lng}`)}`;
  return (
    <article className={`rounded-3xl bg-white p-4 shadow-soft ring-2 transition ${selected ? "ring-moss" : "ring-transparent"}`}>
      <button onClick={openFind} className="flex w-full gap-4 text-left">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-oat text-moss">
          {find.imageDataUrl ? <img src={find.imageDataUrl} alt="" className="h-full w-full object-cover" /> : <FindIcon category={find.category} size={28} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-bold">{find.name}</h2>
            <Badge status={find.status} />
          </div>
          <p className="mt-1 text-sm text-ink/60">{find.place}{find.distance ? ` - ${find.distance}` : ""}</p>
          <p className="mt-2 text-sm leading-6">{find.description}</p>
          <p className="mt-2 text-sm font-semibold text-moss">{find.price} - zuletzt bestaetigt {find.confirmed}</p>
        </div>
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => confirmFind(find.id)} disabled={isConfirmed} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${isConfirmed ? "bg-cream text-ink/45" : "bg-sage text-moss"}`}>
          <Check size={16} /> {isConfirmed ? "Spot bestaetigt" : "Spot bestaetigen"} {confirmations > 0 && `(${confirmations})`}
        </button>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">
          <MapPinned size={16} /> Route
        </a>
      </div>
    </article>
  );
}

function FindDetailModal({ find, finds, confirmFind, close, setScreen, user }: { find: Find; finds: Find[]; confirmFind: (id: number) => void; close: () => void; setScreen: (screen: Screen) => void; user: AuthUser | null }) {
  const [locallyConfirmed, setLocallyConfirmed] = useState(Boolean(find.viewerConfirmed));
  const [localConfirmations, setLocalConfirmations] = useState(find.confirmations ?? 0);
  const confirmations = localConfirmations;
  const isConfirmed = locallyConfirmed;
  const isLoggedIn = Boolean(user);
  const [imageOpen, setImageOpen] = useState(false);
  const [publicProfile, setPublicProfile] = useState<{ id?: string; name: string } | null>(null);
  const [comments, setComments] = useState<SpotComment[]>(() => readSpotComments(find.id));
  const [commentText, setCommentText] = useState("");
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${find.lat},${find.lng}`)}`;

  useEffect(() => {
    let active = true;
    void fetchComments(find.id).then((items) => {
      if (active) setComments(items);
    }).catch(console.warn);
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

  function submitComment() {
    const text = commentText.trim();
    if (!isLoggedIn || !text) return;
    const currentUser = user;
    if (!currentUser) return;
    const payload: CommentPayload = {
      spotId: find.id,
      userId: currentUser.id,
      authorName: getUserDisplayName(currentUser),
      body: text,
      isPublic: readProfilePrivacy().publicComments
    };
    const comment = {
      id: Date.now(),
      author: getUserDisplayName(currentUser),
      text,
      createdAt: new Date().toISOString()
    };
    const next = [comment, ...comments].slice(0, 50);
    setComments(next);
    saveSpotComments(find.id, next);
    void saveComment(payload).then((saved) => {
      setComments((current) => [saved, ...current.filter((item) => item.id !== comment.id)]);
    }).catch(console.warn);
    setCommentText("");
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-ink/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-6" role="dialog" aria-modal="true">
      <article className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-cream shadow-soft sm:max-w-2xl sm:rounded-3xl">
        <div className="relative h-72 overflow-hidden bg-oat sm:h-96">
          {find.imageDataUrl ? (
            <button onClick={() => setImageOpen(true)} className="h-full w-full bg-ink/5 p-3" aria-label="Bild gross anzeigen">
              <img src={find.imageDataUrl} alt={find.name} className="h-full w-full rounded-2xl object-contain" />
            </button>
          ) : <div className="grid h-full place-items-center text-moss"><FindIcon category={find.category} size={72} /></div>}
          <button onClick={close} className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/95 text-ink shadow-soft" aria-label="Details schliessen"><X size={18} /></button>
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4"><span className="block text-xs font-bold uppercase text-ink/45">Ort</span><b>{find.place}</b></div>
            <div className="rounded-2xl bg-white p-4"><span className="block text-xs font-bold uppercase text-ink/45">Kategorie</span><b>{find.category}</b></div>
            <div className="rounded-2xl bg-white p-4"><span className="block text-xs font-bold uppercase text-ink/45">Bestaetigt</span><b>{confirmations}</b></div>
          </div>
          <div className="rounded-3xl bg-white p-5">
            <p className="text-sm font-bold uppercase text-moss">Beschreibung</p>
            <p className="mt-2 leading-7 text-ink/75">{find.description}</p>
            {find.createdByName && (
              <button onClick={() => setPublicProfile({ id: find.createdBy, name: find.createdByName || "Veggie Nutzer" })} className="mt-3 rounded-full bg-sage px-4 py-2 text-sm font-bold text-moss">
                Von {find.createdByName}
              </button>
            )}
            <p className="mt-3 text-sm font-semibold text-ink/55">Zuletzt bestaetigt {find.confirmed}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={confirmFromDetail} disabled={isConfirmed} className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-bold ${isConfirmed ? "bg-white text-ink/45" : "bg-sage text-moss"}`}>
              <Check size={18} /> {isConfirmed ? "Schon bestaetigt" : "Spot bestaetigen"}
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
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl bg-cream p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <b>{comment.author}</b>
                    <span className="text-xs font-semibold text-ink/45">{formatCommentDate(comment.createdAt)}</span>
                  </div>
                  <p className="mt-2 leading-6 text-ink/70">{comment.text}</p>
                </div>
              ))}
              {comments.length === 0 && <div className="rounded-2xl bg-cream p-4 text-sm text-ink/60">Noch keine Kommentare.</div>}
            </div>
            <div className="mt-4">
              <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} disabled={!isLoggedIn} className="min-h-24 w-full rounded-2xl bg-cream px-4 py-3 outline-none disabled:text-ink/45" placeholder={isLoggedIn ? "Kommentar schreiben..." : "Zum Kommentieren bitte anmelden."} />
              {isLoggedIn ? (
                <button type="button" onClick={submitComment} className="mt-3 rounded-2xl bg-moss px-5 py-3 font-bold text-white">Kommentar senden</button>
              ) : (
                <button type="button" onClick={() => { close(); setScreen("profile"); }} className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-moss px-5 py-3 font-bold text-white">
                  <LogIn size={18} /> Zum Kommentieren anmelden
                </button>
              )}
            </div>
          </section>
        </div>
      </article>
      {imageOpen && find.imageDataUrl && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/90 p-4" role="dialog" aria-modal="true">
          <button onClick={() => setImageOpen(false)} className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white text-ink shadow-soft" aria-label="Bild schliessen"><X size={20} /></button>
          <img src={find.imageDataUrl} alt={find.name} className="max-h-[88vh] max-w-[94vw] rounded-3xl bg-white object-contain p-2 shadow-soft" />
        </div>
      )}
      {publicProfile && <PublicProfileModal profile={publicProfile} finds={finds} close={() => setPublicProfile(null)} />}
    </div>
  );
}

function PublicProfileModal({ profile, finds, close }: { profile: { id?: string; name: string }; finds: Find[]; close: () => void }) {
  const publicSpots = finds.filter((find) => find.createdBy && find.createdBy === profile.id);
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/55 p-0 backdrop-blur-sm sm:place-items-center sm:p-6" role="dialog" aria-modal="true">
      <article className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-cream p-5 shadow-soft sm:max-w-xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="grid size-14 place-items-center rounded-2xl bg-moss text-2xl font-black text-white">{profile.name.slice(0, 1).toUpperCase()}</div>
            <p className="mt-4 text-sm font-bold uppercase text-moss">Oeffentliches Profil</p>
            <h2 className="mt-1 text-3xl font-bold">{profile.name}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">Geteilte Spots sind oeffentlich. Scans sind standardmaessig privat.</p>
          </div>
          <button onClick={close} className="grid size-10 place-items-center rounded-full bg-white text-ink shadow-soft" aria-label="Profil schliessen"><X size={18} /></button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4"><span className="block text-xs font-bold uppercase text-ink/45">Oeffentliche Spots</span><b className="text-2xl text-moss">{publicSpots.length}</b></div>
          <div className="rounded-2xl bg-white p-4"><span className="block text-xs font-bold uppercase text-ink/45">Scans</span><b className="text-lg text-ink/50">privat</b></div>
        </div>
        <div className="mt-5 space-y-3">
          {publicSpots.map((spot) => <ProfileSpotCard key={spot.id} spot={spot} />)}
          {publicSpots.length === 0 && <p className="rounded-2xl bg-white p-4 text-sm text-ink/60">Noch keine oeffentlichen Spots.</p>}
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
    void video.play().catch(() => setPlaceError("Kamera konnte nicht gestartet werden. Bitte Browser-Berechtigung pruefen."));
  }, [spotCameraActive]);

  useEffect(() => {
    if (placeQuery.trim().length < 3 || selectedPlace?.name === placeQuery) {
      setPlaceOptions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setPlaceLoading(true);
      setPlaceError("");
      try {
        const result = await searchPlaces(placeQuery);
        setPlaceOptions(result);
      } catch (error) {
        setPlaceError(error instanceof Error ? error.message : "Standortsuche nicht erreichbar.");
      } finally {
        setPlaceLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [placeQuery, selectedPlace?.name]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlace) {
      setPlaceError("Bitte waehle einen vorgeschlagenen echten Ort aus.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setPlaceError("");
    try {
      await addFind({
        name: String(form.get("name")),
        place: selectedPlace.name,
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
      setPlaceError("Kamerazugriff ist in diesem Browser nicht verfuegbar.");
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
      <Header eyebrow="Community" title="Essen oder Produkt hinzufuegen" />
      <div className="mb-4 rounded-3xl bg-sage p-5">
        <p className="font-bold text-moss">Kein Login noetig.</p>
        <p className="mt-1 text-sm leading-6 text-ink/70">Du kannst direkt beitragen. Anmeldung ist spaeter nur praktisch, wenn du deine Spots bearbeiten, speichern oder zwischen Geraeten synchronisieren willst.</p>
      </div>
      <form onSubmit={submit} className="grid gap-4 rounded-3xl bg-white p-5 shadow-soft sm:grid-cols-2">
        <div className="rounded-3xl bg-cream p-4 sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="font-bold">Foto</span>
              <p className="mt-1 text-sm text-ink/55">Waehle ein Bild aus der Galerie oder fotografiere den Spot direkt.</p>
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
                <button type="button" onClick={stopSpotCamera} className="rounded-2xl bg-cream px-4 py-3 font-bold text-ink/70">Schliessen</button>
              </div>
            </div>
          )}
          {imageDataUrl && <img src={imageDataUrl} alt="Spot Vorschau" className="mt-3 h-44 w-full rounded-2xl object-cover" />}
        </div>
        <Field name="name" label="Produkt/Gericht" placeholder="z.B. vegane Ube-Schnecke" required />
        <div className="sm:col-span-2">
          <label>
            <span className="font-bold">Restaurant oder Location</span>
            <input value={placeQuery} onChange={(event) => { setPlaceQuery(event.target.value); setSelectedPlace(null); }} className="mt-2 w-full rounded-2xl bg-cream px-4 py-3 outline-none focus:ring-2 focus:ring-moss" placeholder="z.B. Cafe Kranz Koeln, Rewe Ehrenfeld, Kiez Kebab Hamburg" required />
          </label>
          <p className="mt-2 text-xs text-ink/55">Speichern geht nur mit einem ausgewaehlten echten Ort aus der Vorschlagsliste.</p>
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
        <Select name="category" label="Kategorie" options={categories.slice(1)} />
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
          reject(new Error("Canvas nicht verfuegbar."));
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

function readScanHistory(): ScanHistoryItem[] {
  try {
    const value = localStorage.getItem(SCAN_HISTORY_STORAGE_KEY);
    if (!value) return [];
    const items = JSON.parse(value);
    if (!Array.isArray(items)) return [];
    return items.filter(isScanHistoryItem).slice(0, SCAN_HISTORY_LIMIT);
  } catch {
    return [];
  }
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

function scanRowToHistoryItem(row: { id: number; type: string; title: string; subtitle: string; payload?: unknown }): ScanHistoryItem | null {
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  if (isScanHistoryItem(payload)) return { ...payload, id: row.id };
  if (row.type === "product") return null;
  if (row.type === "ingredients") return null;
  if (row.type === "menu") return null;
  return null;
}

function PricingScreen() {
  return (
    <>
      <Header eyebrow="Premium" title="Premium bleibt optional." />
      <section className="grid gap-4 md:grid-cols-2">
        {pricing.map((tier) => (
          <article key={tier.name} className={`rounded-3xl p-6 shadow-soft ${tier.name === "Premium" ? "bg-ink text-white" : "bg-white"}`}>
            <h2 className="text-2xl font-bold">{tier.name}</h2>
            <p className={`mt-2 text-3xl font-bold ${tier.name === "Premium" ? "text-honey" : "text-moss"}`}>{tier.price}</p>
            <ul className="mt-5 space-y-3">
              {tier.perks.map((perk) => <li key={perk} className="flex gap-3"><Check className="shrink-0 text-leaf" /> <span>{perk}</span></li>)}
            </ul>
          </article>
        ))}
      </section>
    </>
  );
}

function ProfileScreen({ setScreen, user, setUser, finds }: { setScreen: (screen: Screen) => void; user: AuthUser | null; setUser: (user: AuthUser | null) => void; finds: Find[] }) {
  const [profileName, setProfileName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editProfileName, setEditProfileName] = useState(user ? getUserDisplayName(user) : "");
  const [privacy, setPrivacy] = useState<ProfilePrivacy>(readProfilePrivacy);
  const [remoteScans, setRemoteScans] = useState<ScanHistoryItem[]>([]);
  const mySpotIds = readMySpotIds();
  const mySpots = finds.filter((find) => find.createdBy === user?.id || mySpotIds.includes(find.id));
  const totalConfirmations = mySpots.reduce((sum, find) => sum + (find.confirmations ?? 0), 0);
  const scans = remoteScans.length > 0 ? remoteScans : readScanHistory();

  useEffect(() => {
    saveProfilePrivacy(privacy);
    if (user) {
      const payload: ProfilePayload = {
        id: user.id,
        profileName: getUserDisplayName(user),
        ...privacy
      };
      void saveUserProfile(payload).catch(console.warn);
    }
  }, [privacy]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetchProfile(user.id).then((profile) => {
      if (!active || !profile) return;
      setPrivacy({
        publicSpots: profile.publicSpots,
        publicScans: profile.publicScans,
        publicComments: profile.publicComments
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
        setMessage("Bitte waehle einen Profilnamen.");
        setLoadingAuth(false);
        return;
      }
      const authUser = authMode === "login" ? await signInWithPassword(email, password) : await signUpWithPassword(email, password, profileName.trim());
      if (authUser) setUser(authUser);
      setMessage(authMode === "login" ? "Du bist eingeloggt." : "Account erstellt. Falls Supabase E-Mail-Bestaetigung verlangt, bitte Postfach pruefen.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Anmeldung gerade nicht moeglich.");
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
      setMessage(error instanceof Error ? error.message : `${provider} Login gerade nicht moeglich.`);
      setLoadingAuth(false);
    }
  }

  async function signOut() {
    await logout();
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
      setUser(updatedUser);
      await saveUserProfile({ id: updatedUser.id, profileName: nextName, ...privacy });
      setEditingProfile(false);
      setMessage("Profil aktualisiert.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profil konnte nicht gespeichert werden.");
    } finally {
      setLoadingAuth(false);
    }
  }

  return (
    <>
      <Header eyebrow="Profil" title={user ? "Willkommen zurueck." : "Kostenlos anmelden"} />
      {user ? (
        <section className="space-y-4">
          <div className="overflow-hidden rounded-3xl bg-ink text-white shadow-soft">
            <div className="grid gap-5 p-6 md:grid-cols-[1fr_0.9fr] md:items-end">
              <div>
                <div className="grid size-16 place-items-center rounded-3xl bg-honey text-2xl font-black text-ink">{getUserDisplayName(user).slice(0, 1).toUpperCase()}</div>
                <p className="mt-5 text-sm font-bold uppercase text-honey">Veggie Profil</p>
                {editingProfile ? (
                  <div className="mt-2 max-w-md">
                    <label>
                      <span className="text-sm font-bold text-white/70">Profilname</span>
                      <input value={editProfileName} onChange={(event) => setEditProfileName(event.target.value)} className="mt-2 w-full rounded-2xl bg-white px-4 py-3 font-bold text-ink outline-none focus:ring-2 focus:ring-honey" />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => void saveProfile()} disabled={loadingAuth} className="rounded-2xl bg-honey px-4 py-2 text-sm font-bold text-ink disabled:opacity-60">Speichern</button>
                      <button onClick={() => { setEditingProfile(false); setEditProfileName(getUserDisplayName(user)); }} className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold text-white">Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <h2 className="mt-1 break-all text-4xl font-bold">{getUserDisplayName(user)}</h2>
                )}
                <p className="mt-2 break-all text-sm font-semibold text-white/55">{user.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ProfileStat label="Spots" value={String(mySpots.length)} />
                <ProfileStat label="Bestaetigt" value={String(totalConfirmations)} />
                <button onClick={() => { setEditingProfile(true); setEditProfileName(getUserDisplayName(user)); }} className="col-span-2 rounded-2xl bg-white/10 p-4 text-left font-bold text-white hover:bg-white/15">Profil bearbeiten</button>
              </div>
            </div>
          </div>
          <section className="grid gap-4 lg:grid-cols-[1fr_0.75fr]">
            <div className="rounded-3xl bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase text-moss">Meine Beitraege</p>
                  <h3 className="mt-1 text-2xl font-bold">Von dir hinzugefuegte Spots</h3>
                </div>
                <button onClick={() => setScreen("add")} className="rounded-2xl bg-moss px-4 py-3 text-sm font-bold text-white">Spot hinzufuegen</button>
              </div>
              <div className="mt-5 space-y-3">
                {mySpots.map((spot) => <ProfileSpotCard key={spot.id} spot={spot} setScreen={setScreen} />)}
                {mySpots.length === 0 && (
                  <div className="rounded-3xl bg-cream p-6 text-center">
                    <Store className="mx-auto text-moss" size={36} />
                    <p className="mt-3 text-lg font-bold">Noch keine eigenen Spots</p>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/60">Fuege deinen ersten Fund hinzu. Danach erscheint er hier in deinem Profil.</p>
                    <button onClick={() => setScreen("add")} className="mt-4 rounded-2xl bg-moss px-5 py-3 font-bold text-white">Ersten Spot teilen</button>
                  </div>
                )}
              </div>
            </div>
            <aside className="space-y-4">
              <div className="rounded-3xl bg-white p-5 shadow-soft">
                <p className="text-sm font-bold uppercase text-moss">Privatsphaere</p>
                <div className="mt-4 space-y-3">
                  <PrivacyToggle label="Geteilte Spots oeffentlich" checked={privacy.publicSpots} onChange={(checked) => setPrivacy((current) => ({ ...current, publicSpots: checked }))} />
                  <PrivacyToggle label="Scans oeffentlich" checked={privacy.publicScans} onChange={(checked) => setPrivacy((current) => ({ ...current, publicScans: checked }))} />
                  <PrivacyToggle label="Kommentare oeffentlich" checked={privacy.publicComments} onChange={(checked) => setPrivacy((current) => ({ ...current, publicComments: checked }))} />
                </div>
                <p className="mt-3 text-xs leading-5 text-ink/50">Standard: Spots oeffentlich, Scans privat.</p>
              </div>
              <div className="rounded-3xl bg-white p-5 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold uppercase text-moss">Meine Scans</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${privacy.publicScans ? "bg-sage text-moss" : "bg-cream text-ink/45"}`}>{privacy.publicScans ? "oeffentlich" : "privat"}</span>
                </div>
                <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                  {scans.map((scan) => <ProfileScanCard key={scan.id} scan={scan} />)}
                  {scans.length === 0 && <p className="rounded-2xl bg-cream p-4 text-sm text-ink/60">Noch keine Scans gespeichert.</p>}
                </div>
              </div>
              <div className="rounded-3xl bg-white p-5 shadow-soft">
                <p className="text-sm font-bold uppercase text-moss">Profilvorteile</p>
                <div className="mt-4 space-y-3 text-sm leading-6 text-ink/70">
                  <p><b>Kommentieren:</b> Teile Updates und Tipps direkt unter Spots.</p>
                  <p><b>Eigene Spots:</b> Deine Beitraege bleiben deinem Profil zugeordnet.</p>
                  <p><b>Naechster Schritt:</b> Lieblingsspots und Sync koennen jetzt sauber an den Account gehangen werden.</p>
                </div>
              </div>
              <div className="rounded-3xl bg-sage p-5">
                <p className="font-bold text-moss">Account</p>
                <p className="mt-2 text-sm leading-6 text-ink/65">Du bist eingeloggt und kannst Community-Funktionen nutzen.</p>
                <button onClick={() => void signOut()} className="mt-4 rounded-2xl bg-white px-5 py-3 font-bold text-moss">Abmelden</button>
              </div>
            </aside>
          </section>
          {message && <p className="rounded-2xl bg-sage px-4 py-3 text-sm font-bold text-moss">{message}</p>}
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl bg-white p-5 shadow-soft">
            <div className="grid size-12 place-items-center rounded-2xl bg-sage text-moss"><LogIn /></div>
              <div className="mt-4 rounded-3xl bg-cream p-4">
                <p className="text-sm font-bold uppercase text-moss">Dein Veggie Profil</p>
                <p className="mt-2 leading-7 text-ink/70">Melde dich mit Google oder E-Mail an. Du kannst weiter ohne Account nutzen, aber Kommentare, Lieblingsspots und spaetere Sync-Funktionen gehoeren zu deinem Profil.</p>
              </div>
              {!authConfigured && <p className="mt-4 rounded-2xl bg-tomato px-4 py-3 text-sm font-bold text-white">Supabase Auth fehlt noch: Setze `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`.</p>}
              <button type="button" onClick={() => void socialLogin("google")} disabled={loadingAuth || !authConfigured} className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border border-oat bg-white px-5 py-4 font-bold text-ink shadow-sm transition hover:bg-cream disabled:opacity-60">
                <GoogleLogo /> Mit Google anmelden
              </button>
              <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase text-ink/40">
                <span className="h-px flex-1 bg-oat" />
                oder mit E-Mail
                <span className="h-px flex-1 bg-oat" />
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-3xl bg-cream p-2">
                <button type="button" onClick={() => setAuthMode("login")} className={`rounded-2xl px-4 py-3 text-sm font-bold ${authMode === "login" ? "bg-moss text-white" : "bg-white text-ink/65"}`}>Anmelden</button>
                <button type="button" onClick={() => setAuthMode("register")} className={`rounded-2xl px-4 py-3 text-sm font-bold ${authMode === "register" ? "bg-moss text-white" : "bg-white text-ink/65"}`}>Registrieren</button>
              </div>
              <form onSubmit={login} className="mt-5 space-y-3">
                {authMode === "register" && (
                  <label>
                    <span className="font-bold">Profilname</span>
                    <input value={profileName} onChange={(event) => setProfileName(event.target.value)} required={authMode === "register"} className="mt-2 w-full rounded-2xl bg-cream px-4 py-3 outline-none focus:ring-2 focus:ring-moss" placeholder="z.B. VeggieNils" />
                  </label>
                )}
                <label>
                  <span className="font-bold">E-Mail</span>
                  <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="mt-2 w-full rounded-2xl bg-cream px-4 py-3 outline-none focus:ring-2 focus:ring-moss" placeholder="du@example.com" />
                </label>
                <label>
                  <span className="font-bold">Passwort</span>
                  <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={6} className="mt-2 w-full rounded-2xl bg-cream px-4 py-3 outline-none focus:ring-2 focus:ring-moss" placeholder="Mindestens 6 Zeichen" />
                </label>
                <button disabled={loadingAuth || !authConfigured} className="w-full rounded-2xl bg-moss px-5 py-3 font-bold text-white shadow-soft disabled:opacity-60">{loadingAuth ? "Bitte warten..." : authMode === "login" ? "Mit E-Mail anmelden" : "Account erstellen"}</button>
                <button type="button" onClick={() => setScreen("add")} className="w-full rounded-2xl bg-sage px-5 py-3 font-bold text-moss">Ohne Login Spot teilen</button>
              </form>
            {message && <p className="mt-4 rounded-2xl bg-sage px-4 py-3 text-sm font-bold text-moss">{message}</p>}
          </div>
          <div className="rounded-3xl bg-ink p-5 text-white shadow-soft">
            <h2 className="text-2xl font-bold">Mit Login bekommst du mehr Kontrolle.</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Kommentieren", "Tipps, Fragen und Updates direkt an Spots schreiben."],
                ["Lieblingsspots", "Orte merken und spaeter schneller wiederfinden."],
                ["Eigene Beitraege", "Deine Spots spaeter bearbeiten oder aktualisieren."],
                ["Scan-Verlauf Sync", "Letzte Scans langfristig mit deinem Account sichern."],
                ["Preis-Alerts", "Benachrichtigung, wenn ein Produkt in deiner Naehe guenstiger auftaucht."],
                ["Vertrauen", "Bestaetigungen von echten Profilen werden nuetzlicher fuer alle."]
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl bg-white/10 p-4">
                  <p className="font-bold text-honey">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/75">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <span className="block text-xs font-bold uppercase text-white/50">{label}</span>
      <b className="mt-1 block text-2xl text-honey">{value}</b>
    </div>
  );
}

function ProfileSpotCard({ spot, setScreen }: { spot: Find; setScreen?: (screen: Screen) => void }) {
  return (
    <article className="flex gap-4 rounded-3xl bg-cream p-4">
      <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-oat text-moss">
        {spot.imageDataUrl ? <img src={spot.imageDataUrl} alt="" className="h-full w-full object-cover" /> : <FindIcon category={spot.category} size={28} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="font-bold">{spot.name}</h4>
            <p className="mt-1 text-sm text-ink/55">{spot.place}</p>
          </div>
          <Badge status={spot.status} />
        </div>
        <p className="mt-2 max-h-12 overflow-hidden text-sm leading-6 text-ink/70">{spot.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-moss">{spot.price}</span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink/50">{spot.confirmations ?? 0} bestaetigt</span>
          {setScreen && <button onClick={() => setScreen("map")} className="rounded-full bg-moss px-3 py-1 text-xs font-bold text-white">Auf Karte ansehen</button>}
        </div>
      </div>
    </article>
  );
}

function ProfileScanCard({ scan }: { scan: ScanHistoryItem }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-cream p-3 text-sm">
      {"photo" in scan && <img src={scan.photo} alt="" className="size-12 shrink-0 rounded-xl object-cover" />}
      {scan.type === "product" && scan.product.imageUrl && <img src={scan.product.imageUrl} alt="" className="size-12 shrink-0 rounded-xl bg-white object-contain p-1" />}
      {scan.type === "product" && !scan.product.imageUrl && <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sage text-moss"><ScanLine size={18} /></span>}
      <div className="min-w-0">
        <b className="block truncate">{scan.title}</b>
        <span className="mt-1 block truncate text-xs text-ink/55">{scan.subtitle}</span>
      </div>
    </div>
  );
}

function PrivacyToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-3">
      <span className="text-sm font-bold">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-5 accent-moss" />
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

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [finds, setFinds] = useState<Find[]>(() => {
    const confirmedIds = readConfirmedSpotIds();
    return initialFinds.map((find) => ({ ...find, confirmations: 0, viewerConfirmed: confirmedIds.includes(find.id) }));
  });

  useEffect(() => {
    let active = true;
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
    let active = true;
    async function loadSpots() {
      try {
        const confirmedIds = readConfirmedSpotIds();
        const items = await fetchCommunitySpots();
        if (active) setFinds(items.map((find: Find) => ({ ...find, viewerConfirmed: confirmedIds.includes(find.id) })));
      } catch (error) {
        console.warn(error);
      }
    }
    void loadSpots();
    return () => {
      active = false;
    };
  }, []);

  const addFind = async (find: CommunitySpotPayload) => {
    const saved = await saveCommunitySpot(find);
    saveMySpotId(saved.id);
    setFinds((current) => [{ ...saved, viewerConfirmed: false }, ...current]);
  };

  const confirmFind = (id: number) => {
    const target = finds.find((find) => find.id === id);
    if (!target || target.viewerConfirmed) return;
    const confirmedIds = Array.from(new Set([...readConfirmedSpotIds(), id]));
    localStorage.setItem("veggie-navigator-confirmed-spots", JSON.stringify(confirmedIds));
    setFinds((current) => current.map((find) => find.id === id ? { ...find, confirmations: (find.confirmations ?? 0) + 1, confirmed: "gerade eben", viewerConfirmed: true } : find));
    void saveSpotConfirmation(id).then((saved) => {
      setFinds((current) => current.map((find) => find.id === id ? { ...saved, viewerConfirmed: true } : find));
    }).catch(console.warn);
  };

  return (
    <Shell screen={screen} setScreen={setScreen}>
      {screen === "home" && <HomeScreen setScreen={setScreen} />}
      {screen === "scanner" && <ScannerScreen user={user} />}
      {screen === "map" && <MapScreen finds={finds} setScreen={setScreen} confirmFind={confirmFind} user={user} />}
      {screen === "add" && <AddFindScreen addFind={addFind} setScreen={setScreen} user={user} />}
      {screen === "pricing" && <PricingScreen />}
      {screen === "profile" && <ProfileScreen setScreen={setScreen} user={user} setUser={setUser} finds={finds} />}
    </Shell>
  );
}

function readConfirmedSpotIds() {
  try {
    const value = localStorage.getItem("veggie-navigator-confirmed-spots");
    return value ? JSON.parse(value) as number[] : [];
  } catch {
    return [];
  }
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
      publicScans: typeof parsed.publicScans === "boolean" ? parsed.publicScans : false,
      publicComments: typeof parsed.publicComments === "boolean" ? parsed.publicComments : true
    };
  } catch {
    return { publicSpots: true, publicScans: false, publicComments: true };
  }
}

function saveProfilePrivacy(privacy: ProfilePrivacy) {
  localStorage.setItem(PROFILE_PRIVACY_STORAGE_KEY, JSON.stringify(privacy));
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

function isSpotComment(comment: unknown): comment is SpotComment {
  if (!comment || typeof comment !== "object") return false;
  const value = comment as Partial<SpotComment>;
  return typeof value.id === "number" && typeof value.author === "string" && typeof value.text === "string" && typeof value.createdAt === "string";
}

function formatCommentDate(value: string) {
  return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function getUserDisplayName(user: AuthUser) {
  const metadata = user.user_metadata || {};
  return String(metadata.profile_name || metadata.full_name || metadata.name || user.email || "Veggie Nutzer");
}
