# Erforderliche Nutzeraktionen

## A. Bereits automatisch erledigt

- Mobile-App auf Expo 57 mit zentraler Auth-, Daten- und Sync-Schicht konfiguriert.
- Registrierung, Anmeldung, Abmeldung, Session-Wiederherstellung, E-Mail-Bestätigung und Passwort-Reset implementiert.
- Kamera, Barcodeformate, Deduplizierung, Haptik, Taschenlampe und manuelle Eingabe eingerichtet.
- Zutaten-/Menübilder werden komprimiert, privat hochgeladen, kurz signiert und nach der Analyse gelöscht.
- Backend nutzt denselben authentifizierten Analysehandler lokal und auf Vercel.
- Strukturierte OpenAI-Antworten werden serverseitig validiert.
- Additive Migration mit Tabellenänderungen, Indizes, Constraints, Trigger, RLS und privatem Storage-Bucket erstellt.
- Die frühere Webversion, ihre Sicherungskopie und ausschließlich webbasierte API-Routen wurden entfernt.
- Mobile-TypeScript, Expo Doctor sowie Unit-/Backendtests wurden ausgeführt.

## B. Vom Nutzer benötigte Zugangsdaten

Prüfe in `mobile-app/.env` die folgenden öffentlichen Mobile-Werte:

```text
[ ] EXPO_PUBLIC_SUPABASE_URL
    Zu finden unter:
    Supabase Dashboard → Project Settings → API / Connect → Project URL

[ ] EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    Bevorzugt finden unter:
    Supabase Dashboard → Project Settings → API / Connect → Publishable key
    Alternativ wird EXPO_PUBLIC_SUPABASE_ANON_KEY mit dem vorhandenen Legacy-Anon-Key unterstützt.

[ ] EXPO_PUBLIC_API_BASE_URL
    Für dieses lokale Netzwerk aktuell:
    http://192.168.178.24:8787
    Die IP kann sich nach Router-/Netzwerkwechsel ändern.
```

Erstelle die Datei aus der Vorlage:

```powershell
cd "C:\Users\nilso\Documents\Veggie Navigator\mobile-app"
Copy-Item .env.example .env
```

Im Root-Backend werden nur noch `OPENAI_API_KEY`, `OPENAI_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` und `PORT` benötigt. Keine geheimen Servervariablen in `mobile-app/.env` kopieren. Nur Project URL und Publishable-/Anon-Key sind für einen öffentlichen Client bestimmt.

## C. Supabase-Dashboard-Aktionen

1. Öffne Supabase → SQL Editor → New query.
2. Führe einmalig [supabase/20260813_remove_web_version.sql](supabase/20260813_remove_web_version.sql) aus. Es entfernt Web-Kommentare, Gastdaten und alte Web-Spalten, erhält aber Mobile-Konten, Scans, Favoriten und Spots.
3. Führe vollständig [supabase/20260804_mobile_app_v1.sql](supabase/20260804_mobile_app_v1.sql) aus.
4. Führe anschließend [supabase/20260804_community_spots_mobile_v2.sql](supabase/20260804_community_spots_mobile_v2.sql) aus.
5. Prüfe danach unter Storage, dass der private Bucket `user-uploads` und der öffentliche Bucket `community-spot-images` existieren.
6. Prüfe unter Authentication → Providers, dass Email aktiviert ist.
7. Entferne unter Authentication → URL Configuration alle früheren Website-/Vercel-URLs und behalte nur:

```text
veggienavigator://sign-in
veggienavigator://reset-password
exp://*/--/sign-in
exp://*/--/reset-password
```

8. Entscheide unter Authentication → Email, ob E-Mail-Bestätigung für Entwicklung erforderlich ist. Für Produktion sollte sie aktiviert bleiben.
9. Führe RLS-Gegenprüfungen aus [supabase/rls-mobile-checks.sql](supabase/rls-mobile-checks.sql) mit Nutzer A, Nutzer B und anonym. Fremde/private Zeilen müssen jeweils unsichtbar sein.

Die web-exklusiven Tabelleninhalte wurden bereits über die Supabase-API geleert. Das endgültige Löschen der Tabellen und Spalten benötigt den SQL Editor, weil Supabase CLI, `DATABASE_URL` und Managementzugang fehlen.

## D. Start auf dem Handy

Terminal 1 – Backend:

```powershell
cd "C:\Users\nilso\Documents\Veggie Navigator"
npm run api
```

Terminal 2 – Mobile-App:

```powershell
cd "C:\Users\nilso\Documents\Veggie Navigator\mobile-app"
npm install
npx expo start --clear
```

- Handy und Computer müssen im selben WLAN sein.
- Öffne Expo Go und scanne den QR-Code.
- `localhost` auf dem Handy ist das Handy selbst; verwende die LAN-Adresse oben.
- Expo Go genügt für die aktuell verwendeten Module.
- Für Android per USB zunächst Android Platform Tools installieren, USB-Debugging aktivieren und `adb devices` ausführen. Danach optional `adb reverse tcp:8787 tcp:8787` und `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8787` verwenden.
- Für einen Development Build: `npx expo run:android --device`. iOS-Gerätebuilds benötigen macOS/Xcode: `npx expo run:ios --device`.

Gerätecheck: Registrierung → E-Mail bestätigen → anmelden → Onboarding → Community-Spots öffnen → Standort erlauben → Spot mit Foto anlegen → Marker und Detailseite prüfen → Spot bestätigen/liken → Barcode scannen → Zutatenfoto → Ergebnis/Favorit → App vollständig schließen → erneut öffnen → Session und Daten prüfen.

## E. Produktionsbereitstellung

- Vercel: `OPENAI_API_KEY`, `OPENAI_MODEL`, `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` ausschließlich unter Project Settings → Environment Variables setzen.
- EAS: `EXPO_PUBLIC_API_BASE_URL` auf die produktive HTTPS-Backendadresse setzen; Supabase Project URL und Publishable Key als öffentliche EAS-Variablen setzen.
- Niemals Service Role oder OpenAI-Key als `EXPO_PUBLIC_*` speichern.
- Android: `npx eas build --platform android --profile production`.
- iOS: `npx eas build --platform ios --profile production`.
- Vor Store-Einreichung: App-Datenschutzangaben, Support-/Datenschutz-URLs, Screenshots, App-Signing, Play-Console-Testtrack beziehungsweise TestFlight und Kontolöschprozess vervollständigen.
- Produktiv ausschließlich HTTPS verwenden; die lokale HTTP-LAN-Adresse ist nur für Entwicklung.
