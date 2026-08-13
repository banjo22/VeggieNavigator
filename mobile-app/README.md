# Veggie Navigator Mobile

Eigenständige native Android-/iOS-App mit React Native, Expo 57, TypeScript Strict Mode und Expo Router. Das Repository enthält keine Webversion mehr. Die App ist keine WebView und enthält keine Server-Secrets.

## Voraussetzungen und Installation

- Node.js und npm
- Expo Go auf dem Smartphone für den schnellen Test
- laufendes Backend aus dem Repository-Root
- Smartphone und Entwicklungsrechner im selben Netzwerk

```powershell
cd "C:\Users\nilso\Documents\Veggie Navigator"
npm install
npm run api

cd mobile-app
npm install
Copy-Item .env.example .env
npm start
```

## Umgebungsvariablen

```text
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8787
EXPO_PUBLIC_SUPABASE_URL=https://<projekt>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<öffentlicher-anon-key>
```

Die API-Adresse muss auf einem echten Gerät die LAN-IP des Rechners verwenden, nicht `localhost`. Der Root-API-Server läuft auf Port `8787`. In Produktion ausschließlich eine HTTPS-Adresse verwenden. Die Supabase-Werte sind erforderlich, weil Konten und Community-Funktionen ausschließlich angemeldet verwendet werden.

Niemals in die App kopieren: `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Datenbankpasswörter, Admin-/Root-Schlüssel oder andere Secrets. OpenAI-Aufrufe laufen ausschließlich über das Backend.

## Start auf Geräten

- Expo Go: `npm start`, anschließend QR-Code scannen.
- Android-Emulator/Gerät: `npm run android`. Für einen nativen Development Build: `npx expo run:android --device`.
- Android per USB: Android Platform Tools installieren, USB-Debugging aktivieren, mit `adb devices` prüfen. Optional kann `adb reverse tcp:8787 tcp:8787` genutzt und `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8787` gesetzt werden.
- iPhone: auf macOS mit Xcode `npm run ios`; auf einem realen iPhone Expo Go per QR-Code. Ein eigener Development Build benötigt Apple-Entwicklerzugang und `npx expo run:ios --device` auf macOS.

Expo Go reicht für die verwendeten Expo-Module aus. Kamera und Galerie fragen Berechtigungen erst bei Nutzung an. Dauerhaft abgelehnte Berechtigungen führen in die Systemeinstellungen.

## Befehle

```powershell
npm run typecheck
npm test
npx expo-doctor
npx expo export --platform android --output-dir dist-android
```

## Architektur

- `app/`: Expo-Router-Screens und native Bottom Tabs
- `src/components/`: wiederverwendbare native UI-Zustände
- `src/store/`: versionierte lokale Profile, Scans und Favoriten
- `src/lib/api.ts`: zeitbegrenzter Backend-Client
- `src/lib/auth.ts`: Supabase-Sitzungen in Expo Secure Store
- `src/data/knowledge.ts`: kleine, versionierte Reise-/Zutatenbasis
- `docs/visual-concept.png`: visuelle Referenz

## Bekannte Einschränkungen

- Kein physisches Gerät war in dieser Umgebung testbar; `adb` ist nicht installiert.
- Produktive Deep-Link-Redirects müssen vor der Store-Auslieferung im Supabase-Dashboard freigeschaltet werden.
- Alternativen erscheinen nur, wenn das Backend belastbare Daten liefert; es werden keine Produktdaten erfunden.
- Restaurantansicht zeigt absichtlich einen ehrlichen Leerzustand.
- `npm audit` meldet 10 moderate transitive Hinweise in der Expo-Werkzeugkette. Kein erzwungenes Breaking-Update wurde ausgeführt.
