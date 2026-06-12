import { Camera, Check, Coffee, Crown, Home, Loader2, LogIn, MapPinned, MenuSquare, Plus, ScanLine, Search, ShoppingBag, Sparkles, Star, Store, UploadCloud, Utensils, UserRound } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  analyzeMenuPhoto,
  analyzeIngredientPhoto,
  fetchPriceOptions,
  searchPlaces,
  type IngredientAnalysis,
  type PlaceSuggestion,
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
import { fetchProductByBarcode, type ProductResult } from "./services/openFoodFacts";

type Screen = "home" | "scanner" | "map" | "add" | "pricing" | "profile";
type Find = CommunitySpot & { confirmations?: number; viewerConfirmed?: boolean };
type BarcodeResult = { rawValue: string };

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

function ScannerScreen() {
  const [scanMode, setScanMode] = useState<"ingredients" | "menu">("ingredients");
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<ProductResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState<PriceOption[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [analysis, setAnalysis] = useState<IngredientAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [menuPhoto, setMenuPhoto] = useState("");
  const [menuText, setMenuText] = useState("");
  const [menuLoading, setMenuLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [photoCameraActive, setPhotoCameraActive] = useState(false);
  const [ingredientPhoto, setIngredientPhoto] = useState("");
  const [ingredientMessage, setIngredientMessage] = useState("");
  const [menuMessage, setMenuMessage] = useState("");
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
      setMenuPhoto(imageDataUrl);
      void runMenuAnalysis(imageDataUrl);
    }
  }

  function handleIngredientUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = String(reader.result);
      if (scanMode === "ingredients") {
        setIngredientPhoto(imageDataUrl);
        void runIngredientAnalysis(imageDataUrl);
      } else {
        setMenuPhoto(imageDataUrl);
        void runMenuAnalysis(imageDataUrl);
      }
    };
    reader.readAsDataURL(file);
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

  async function runMenuAnalysis(imageDataUrl: string) {
    analysisAbortRef.current?.abort();
    if (analysisTimeoutRef.current) window.clearTimeout(analysisTimeoutRef.current);
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    analysisTimeoutRef.current = window.setTimeout(() => controller.abort(), 95000);
    setMenuLoading(true);
    setMenuText("");
    setMenuMessage("Speisekarte wird analysiert.");
    try {
      const result = await analyzeMenuPhoto(imageDataUrl, controller.signal);
      setMenuText(result);
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
      setMenuPhoto("");
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
      setMenuPhoto("");
      setMenuText("");
      setMenuMessage("");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    setAnalysisLoading(false);
    setMenuLoading(false);
  }

  const hasCurrentScan = scanMode === "ingredients" ? Boolean(ingredientPhoto || analysis || analysisLoading) : Boolean(menuPhoto || menuText || menuLoading);

  return (
    <>
      <Header eyebrow="Scanner" title="Was willst du scannen?" />
      <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <section className="rounded-3xl bg-white p-5 shadow-soft">
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
                    <Camera className="mr-2" size={18} /> Kamera scannen
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
            <label className="mt-4 flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed border-oat bg-white p-5">
              <UploadCloud className="text-moss" />
              <span className="mt-2 font-bold">{scanMode === "ingredients" ? "Zutatenliste fotografieren" : "Speisekarte fotografieren"}</span>
              <span className="mt-1 text-sm text-ink/55">{scanMode === "ingredients" ? "KI prueft Zutaten." : "Optionen werden knapp sortiert."}</span>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleIngredientUpload} className="hidden" />
            </label>
            <button onClick={() => void startPhotoCamera()} className="mt-3 inline-flex items-center justify-center rounded-2xl bg-moss px-5 py-3 font-bold text-white shadow-soft">
              <Camera className="mr-2" size={18} /> Kamera direkt nutzen
            </button>
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
            {scanMode === "menu" && menuPhoto && <img src={menuPhoto} alt="Speisekarte Vorschau" className="mt-4 max-h-52 w-full rounded-3xl object-cover" />}
            {((scanMode === "ingredients" && analysisLoading) || (scanMode === "menu" && menuLoading)) && <LoadingAnalysis label={scanMode === "ingredients" ? "Zutaten werden gecheckt" : "Speisekarte wird gecheckt"} onCancel={cancelAnalysis} />}
            {scanMode === "ingredients" && analysis && <AnalysisBox title="KI-Ergebnis" badge={analysis.status}><p>{analysis.explanation}</p>{analysis.problematicIngredients?.length > 0 && <p className="mt-2 font-semibold text-tomato">Kritisch: {analysis.problematicIngredients.join(", ")}</p>}</AnalysisBox>}
            {scanMode === "menu" && menuText && <AnalysisBox title="Speisekarte"><p className="whitespace-pre-wrap">{menuText}</p></AnalysisBox>}
            {hasCurrentScan && !analysisLoading && !menuLoading && <button onClick={resetCurrentScan} className="mt-4 rounded-full bg-white px-5 py-3 text-sm font-bold text-moss shadow-sm">{scanMode === "ingredients" ? "Neue Zutatenliste scannen" : "Neue Speisekarte scannen"}</button>}
            {scanMode === "ingredients" && ingredientMessage && <p className="mt-3 text-sm font-semibold text-tomato">{ingredientMessage}</p>}
            {scanMode === "menu" && menuMessage && <p className="mt-3 text-sm font-semibold text-tomato">{menuMessage}</p>}
          </div>
        </section>
        <section className="rounded-3xl bg-white p-5 shadow-soft">
          {scanMode === "ingredients" && product ? <ProductResultCard product={product} prices={prices} pricesLoading={pricesLoading} /> : (
            <div className="grid h-full min-h-72 place-items-center rounded-3xl bg-cream p-6 text-center">
              <div>
                <p className="text-lg font-bold">{scanMode === "ingredients" ? "Noch kein Produkt geprueft" : "Speisekarten-Check"}</p>
                <p className="mt-2 text-sm leading-6 text-ink/60">{scanMode === "ingredients" ? "Scanne Barcode oder Zutatenfoto." : "Lade eine Speisekarte hoch. Ergebnis: 3 klare Listen."}</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ProductResultCard({ product, prices, pricesLoading }: { product: ProductResult; prices: PriceOption[]; pricesLoading: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">{product.name}</h2>
        <Badge status={product.status} />
      </div>
      <p className="mt-2 text-sm font-semibold text-moss">Quelle: {product.source}</p>
      <p className="mt-3 leading-7 text-ink/70">{product.reason}</p>
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

function MapScreen({ finds, setScreen, confirmFind }: { finds: Find[]; setScreen: (screen: Screen) => void; confirmFind: (id: number) => void }) {
  const [active, setActive] = useState(categories[0]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const visible = active === categories[0] ? finds : finds.filter((find) => find.category === active);
  const mappable = visible.filter((find) => Number.isFinite(find.lat) && Number.isFinite(find.lng));
  const selected = visible.find((find) => find.id === selectedId) ?? mappable[0] ?? visible[0] ?? null;
  const center = selected && Number.isFinite(selected.lat) && Number.isFinite(selected.lng) ? selected : mappable[0] ?? null;
  const bbox = mappable.length > 0 ? getMapBounds(mappable) : null;
  const mapUrl = bbox ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.minLng}%2C${bbox.minLat}%2C${bbox.maxLng}%2C${bbox.maxLat}&layer=mapnik` : "";

  return (
    <>
      <Header eyebrow="In der Naehe" title="Community-Spots" action={<button onClick={() => setScreen("add")} className="rounded-2xl bg-moss p-3 text-white shadow-soft" aria-label="Spot hinzufuegen"><Plus /></button>} />
      <button onClick={() => setScreen("add")} className="mb-4 flex w-full items-center gap-4 rounded-3xl bg-moss p-5 text-left text-white shadow-soft">
        <span className="grid size-12 place-items-center rounded-2xl bg-white text-moss"><Plus /></span>
        <span><span className="block text-xl font-bold">Spot hinzufuegen</span><span className="text-sm text-white/80">Gerade etwas Gutes entdeckt? Teile es ohne Anmeldung.</span></span>
      </button>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => <button key={category} onClick={() => setActive(category)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${active === category ? "bg-moss text-white" : "bg-white"}`}>{category}</button>)}
      </div>
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="relative min-h-96 overflow-hidden rounded-3xl bg-sage shadow-soft">
          {bbox && center ? (
            <>
              <iframe title="OpenStreetMap Karte" src={mapUrl} className="absolute inset-0 h-full w-full border-0" loading="lazy" />
              <div className="absolute inset-0">
                {mappable.map((find) => {
                  const position = getMarkerPosition(find, bbox);
                  const isSelected = find.id === selected?.id;
                  return (
                    <button key={find.id} onClick={() => setSelectedId(find.id)} className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white shadow-soft ring-4 ring-white/85 transition ${isSelected ? "size-14 bg-tomato" : "size-11 bg-moss hover:scale-105"}`} style={{ left: `${position.left}%`, top: `${position.top}%` }} aria-label={`${find.name} auswaehlen`}>
                      <FindIcon category={find.category} size={isSelected ? 24 : 19} />
                    </button>
                  );
                })}
              </div>
              <div className="absolute bottom-4 right-4 max-w-56 rounded-2xl bg-white/95 p-3 text-sm shadow-soft backdrop-blur"><b>{selected?.name}</b><p className="mt-1 text-xs text-ink/60">{selected?.place}</p><p className="mt-1 text-xs font-bold text-moss">{selected?.price}</p></div>
              <a href={`https://www.openstreetmap.org/?mlat=${center.lat}&mlon=${center.lng}#map=15/${center.lat}/${center.lng}`} target="_blank" rel="noreferrer" className="absolute bottom-4 left-4 rounded-2xl bg-white/95 px-4 py-3 text-sm font-bold text-moss backdrop-blur">In OpenStreetMap oeffnen</a>
            </>
          ) : (
            <div className="grid min-h-96 place-items-center p-6 text-center">
              <div>
                <MapPinned className="mx-auto text-moss" size={44} />
                <p className="mt-3 text-lg font-bold">Noch keine Spots auf der Karte</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/60">Sobald du ein Produkt oder Gericht mit echter Location hinzufuegst, erscheint es hier.</p>
                <button onClick={() => setScreen("add")} className="mt-5 rounded-2xl bg-moss px-5 py-3 font-bold text-white shadow-soft">Ersten Spot hinzufuegen</button>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {visible.map((find) => <FindCard key={find.id} find={find} confirmFind={confirmFind} selected={find.id === selectedId} selectFind={() => setSelectedId(find.id)} />)}
          {visible.length === 0 && <p className="rounded-2xl bg-white p-5 text-ink/60">In dieser Kategorie gibt es noch keinen Spot. Fueg den ersten hinzu.</p>}
        </div>
      </section>
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

function FindCard({ find, confirmFind, selected, selectFind }: { find: Find; confirmFind: (id: number) => void; selected: boolean; selectFind: () => void }) {
  const confirmations = find.confirmations ?? 0;
  const isConfirmed = find.viewerConfirmed ?? false;
  return (
    <article className={`rounded-3xl bg-white p-4 shadow-soft ring-2 transition ${selected ? "ring-moss" : "ring-transparent"}`}>
      <button onClick={selectFind} className="flex w-full gap-4 text-left">
        <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-oat text-moss"><FindIcon category={find.category} size={28} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-bold">{find.name}</h2>
            <Badge status={find.status} />
          </div>
          <p className="mt-1 text-sm text-ink/60">{find.place} - {find.distance}</p>
          <p className="mt-2 text-sm leading-6">{find.description}</p>
          <p className="mt-2 text-sm font-semibold text-moss">{find.price} - zuletzt bestaetigt {find.confirmed} - {find.rating}/5</p>
        </div>
      </button>
      <button onClick={() => confirmFind(find.id)} disabled={isConfirmed} className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${isConfirmed ? "bg-cream text-ink/45" : "bg-sage text-moss"}`}>
        <Check size={16} /> {isConfirmed ? "Spot bestaetigt" : "Spot bestaetigen"} {confirmations > 0 && `(${confirmations})`}
      </button>
    </article>
  );
}

function AddFindScreen({ addFind, setScreen }: { addFind: (find: Find) => void; setScreen: (screen: Screen) => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeOptions, setPlaceOptions] = useState<PlaceSuggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState("");

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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlace) {
      setPlaceError("Bitte waehle einen vorgeschlagenen echten Ort aus.");
      return;
    }
    const form = new FormData(event.currentTarget);
    addFind({
      id: Date.now(),
      name: String(form.get("name")),
      place: selectedPlace.name,
      distance: "0,9 km",
      price: String(form.get("price") || "Preis offen"),
      status: form.get("status") as VeggieStatus,
      category: String(form.get("category")),
      confirmed: "gerade eben",
      rating: "neu",
      confirmations: 1,
      lat: selectedPlace.lat,
      lng: selectedPlace.lng,
      description: String(form.get("description"))
    });
    setSubmitted(true);
  }
  return (
    <>
      <Header eyebrow="Community" title="Essen oder Produkt hinzufuegen" />
      <div className="mb-4 rounded-3xl bg-sage p-5">
        <p className="font-bold text-moss">Kein Login noetig.</p>
        <p className="mt-1 text-sm leading-6 text-ink/70">Du kannst direkt beitragen. Anmeldung ist spaeter nur praktisch, wenn du deine Spots bearbeiten, speichern oder zwischen Geraeten synchronisieren willst.</p>
      </div>
      <form onSubmit={submit} className="grid gap-4 rounded-3xl bg-white p-5 shadow-soft sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="font-bold">Foto</span><input type="file" accept="image/*" capture="environment" className="mt-2 w-full rounded-2xl bg-cream px-4 py-3 text-sm" /></label>
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
        <Field name="price" label="Preis optional" placeholder="3,20 EUR" />
        <Select name="status" label="Einordnung" options={["vegan", "vegetarisch"]} />
        <Select name="category" label="Kategorie" options={categories.slice(1)} />
        <label className="sm:col-span-2"><span className="font-bold">Kurze Beschreibung</span><textarea name="description" required className="mt-2 min-h-28 w-full rounded-2xl bg-cream px-4 py-3 outline-none focus:ring-2 focus:ring-moss" placeholder="Was macht den Spot besonders? Was sollte man beim Bestellen beachten?" /></label>
        <button className="rounded-2xl bg-moss px-5 py-4 text-lg font-bold text-white shadow-soft sm:col-span-2">Spot auf die Karte bringen</button>
        {submitted && <button type="button" onClick={() => setScreen("map")} className="rounded-2xl bg-sage px-5 py-3 font-bold text-moss sm:col-span-2"><Check className="mr-2 inline" size={18} /> Gespeichert, zur Karte</button>}
      </form>
    </>
  );
}

function Field({ name, label, placeholder, required = false }: { name: string; label: string; placeholder: string; required?: boolean }) {
  return <label><span className="font-bold">{label}</span><input name={name} required={required} className="mt-2 w-full rounded-2xl bg-cream px-4 py-3 outline-none focus:ring-2 focus:ring-moss" placeholder={placeholder} /></label>;
}

function Select({ name, label, options }: { name: string; label: string; options: string[] }) {
  return <label><span className="font-bold">{label}</span><select name={name} className="mt-2 w-full rounded-2xl bg-cream px-4 py-3 outline-none focus:ring-2 focus:ring-moss">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
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

function ProfileScreen({ setScreen }: { setScreen: (screen: Screen) => void }) {
  return (
    <>
      <Header eyebrow="Profil" title="Optional anmelden" />
      <section className="rounded-3xl bg-white p-5 shadow-soft">
        <div className="grid size-12 place-items-center rounded-2xl bg-sage text-moss"><LogIn /></div>
        <p className="mt-4 leading-7 text-ink/70">Du kannst die App ohne Account nutzen und Spots beitragen. Ein Login ist nur Komfort: eigene Spots verwalten, Lieblingsorte speichern, spaeter Sync und Benachrichtigungen.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="rounded-2xl bg-moss px-5 py-3 font-bold text-white">Kostenlos anmelden</button>
          <button onClick={() => setScreen("add")} className="rounded-2xl bg-sage px-5 py-3 font-bold text-moss">Ohne Login Spot teilen</button>
        </div>
      </section>
    </>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [finds, setFinds] = useState<Find[]>(() => {
    const confirmedIds = readConfirmedSpotIds();
    return initialFinds.map((find) => ({ ...find, confirmations: 0, viewerConfirmed: confirmedIds.includes(find.id) }));
  });
  const addFind = (find: Find) => setFinds((current) => [find, ...current]);
  const confirmFind = (id: number) => setFinds((current) => {
    const target = current.find((find) => find.id === id);
    if (!target || target.viewerConfirmed) return current;
    const confirmedIds = Array.from(new Set([...readConfirmedSpotIds(), id]));
    localStorage.setItem("veggie-navigator-confirmed-spots", JSON.stringify(confirmedIds));
    return current.map((find) => find.id === id ? { ...find, confirmations: (find.confirmations ?? 0) + 1, confirmed: "gerade eben", viewerConfirmed: true } : find);
  });

  return (
    <Shell screen={screen} setScreen={setScreen}>
      {screen === "home" && <HomeScreen setScreen={setScreen} />}
      {screen === "scanner" && <ScannerScreen />}
      {screen === "map" && <MapScreen finds={finds} setScreen={setScreen} confirmFind={confirmFind} />}
      {screen === "add" && <AddFindScreen addFind={addFind} setScreen={setScreen} />}
      {screen === "pricing" && <PricingScreen />}
      {screen === "profile" && <ProfileScreen setScreen={setScreen} />}
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
