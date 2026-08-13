# Mobile Implementation Report

## Webversion entfernt

- Vite-/React-Webfrontend, statische Builds und lokale Web-Sicherung wurden gelöscht.
- Web-exklusive API-Routen für Kommentare, Gäste, Preisvergleich sowie Browser-Profil/Verlauf/Favoriten wurden entfernt.
- Das verbleibende Backend akzeptiert nur noch authentifizierte Mobile-Aufrufe für persönliche und Community-Funktionen.
- Web-Kommentare, Gastbestätigungen, Gastreaktionen und Gast-Scanlimits wurden in der Live-Datenbank geleert.
- `supabase/20260813_remove_web_version.sql` entfernt abschließend die alten Tabellen und Spalten; Mobile-Konten und Mobile-Daten bleiben bestehen.

## Community-Spots v2

- Native Kartenansicht für Android/iOS mit Standortanzeige, Marker-Auswahl und Listenmodus.
- Suche und Filter nach Status beziehungsweise Community-Bestätigung.
- Spot-Erstellung mit Ortssuche, aktuellem Standort, Rückwärts-Geocoding, Kategorie, Preis, Beschreibung und komprimiertem Foto-Upload.
- Eigene Detailansicht mit Navigation, Bestätigungen sowie Like/Dislike-Reaktionen.
- Mobile API-Aufrufe sind an die Supabase-Session gebunden; Besitzer- und Nutzer-IDs werden serverseitig aus dem Access Token abgeleitet.
- Additive Datenbankmigration ergänzt Indizes, RLS-Eigentümerregeln und den öffentlichen, schreibgeschützten Nutzerordner-Bucket `community-spot-images`.

## Ausgangszustand

- Auth-Paket war vorhanden, aber es gab keinen AuthProvider, keine Auth-Screens, keinen Reset-/Deep-Link-Flow und keine kontobezogene Navigation.
- Profil, Scans und Favoriten wurden ausschließlich lokal gespeichert.
- Der Scanner verwendete bereits `expo-camera`, hatte aber keine Kontosynchronisierung und kein haptisches Feedback. Ohne `mobile-app/.env` konnten Produktanfragen keine gültige Mobile-Sitzung mitsenden.
- Zutatenanalyse nutzte lokal eine alte, unstrukturierte Kopie in `server.mjs`, während nur die Vercel Function gehärtet war. Dies war die konkrete Ursache unterschiedlicher beziehungsweise unzuverlässiger Ergebnisse.
- Bestehende Aktivitätsendpunkte vertrauten teilweise frei übermittelten Nutzer-IDs. Die Mobile-App verwendet diese für private Daten nicht mehr, sondern direkte RLS-geschützte Supabase-Zugriffe.

## Implementierung

- Zentraler `AuthProvider`: Registrierung, Anmeldung, Abmeldung, Session-Restore, Auto-Refresh, E-Mail-Bestätigung, Passwort-Reset und Deep Links.
- Zentrale Supabase-Datenschicht für Profile, Präferenzen, Scans, Favoriten, Löschanfrage und temporäre Uploads.
- Optimistische lokale Anzeige mit Supabase-Synchronisierung und Rücknahme bei Favoritenfehlern.
- Scanner: EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Berechtigungen, Systemeinstellungen, Deduplizierung, Haptik, Blitz und manuelle Eingabe.
- Unbekannte Barcodes führen ohne erfundene Produktdaten zum Zutatenfoto und werden mit der Analyse-ID verknüpft.
- Bilder werden als JPEG auf 1600 Pixel verkleinert, komprimiert, in `user-uploads/{user_id}/...` hochgeladen, fünf Minuten signiert und danach gelöscht.
- Lokale Entwicklung und Vercel verwenden denselben authentifizierten OpenAI-Handler.
- Strukturierte Zutaten- und Menüantworten werden serverseitig reduziert und validiert; ungültige Klassifikationen fallen auf `unclear` zurück.
- Verlauf: Kontosynchronisierung, Pull-to-refresh, Typ-/Statusfilter, clientseitige Pagination und Löschung.
- Favoriten: Supabase-Upsert, Unique Constraint, Suche und Entfernung.
- Profil: Anzeigename, Ernährungsweise, Ziel, Ausschlüsse, E-Mail, Passwort-Reset, Abmeldung und Löschanforderung.
- Diagnose: `/api/mobile-health` und `npm run diagnose`, beide ohne Ausgabe von Geheimnissen.

## Umgebungsvariablen

Im Root benötigt: `OPENAI_API_KEY`, `OPENAI_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`.

Für `mobile-app/.env` erforderlich: `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` oder kompatibel `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

Öffentlich: API-Basis-URL, Supabase Project URL, Publishable-/Anon-Key. Geheim: OpenAI-Key, Service Role, Datenbankpasswort, Management-Token.

## Datenbank

Migration: `supabase/20260804_mobile_app_v1.sql` erstellt/erweitert `profiles`, `user_preferences`, `scan_history`, `product_favorites`, Scanlimits, Indizes, Trigger und private Storage-Policies. `supabase/20260804_community_spots_mobile_v2.sql` enthält ausschließlich das mobile Community-Schema.

RLS: Eigentümer-Policies für SELECT/INSERT/UPDATE/DELETE auf Profilen, Präferenzen, Scans, Favoriten und `storage.objects`. Der Bucket `user-uploads` ist privat, auf 6 MiB und JPEG/PNG begrenzt.

Status: Web-exklusive Live-Datensätze wurden geleert. Die DDL-Bereinigung `supabase/20260813_remove_web_version.sql` muss noch einmal im Supabase SQL Editor ausgeführt werden, da kein Datenbank-/Managementzugang vorliegt.

## Tests

| Prüfung | Ergebnis |
|---|---|
| `npm run typecheck` in `mobile-app` | erfolgreich |
| `npm test` in `mobile-app` | 6/6 erfolgreich |
| `npx expo-doctor` | 20/20 erfolgreich |
| `npm run test:backend` | 6/6 erfolgreich |
| `node --check server.mjs` und Analysehandler | erfolgreich |
| `/api/mobile-health` lokal | HTTP 200; Backendkonfiguration vorhanden |
| Entfernte Webrouten | HTTP 404 |
| Mobile Community Auth-Guard | HTTP 401 ohne Token, erfolgreich |
| Android Hermes Export | erfolgreich |
| Physisches Gerät | nicht möglich; `adb` fehlt |
| Live Auth/RLS mit zwei Nutzern | blockiert, Migration und Mobile-Env fehlen |
| Live OpenAI-Fotoanalyse | nicht ausgeführt; erfordert gültige Nutzersitzung und angewendete Migration |

Verbleibende konkrete Schritte stehen in [USER_ACTIONS_REQUIRED.md](USER_ACTIONS_REQUIRED.md).
