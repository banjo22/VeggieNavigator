# Veggie Navigator

Klickbarer MVP-Prototyp fuer eine mobile-first Webapp rund um vegane, vegetarische und flexitarische Food-Entscheidungen.

## Setup

```bash
npm install
npm run api
npm run dev
```

Danach die lokale Vite-URL im Browser oeffnen. `npm run api` startet lokal den API-Server auf Port 8787, Vite leitet `/api` automatisch dorthin weiter. Fuer eine gebaute Version mit API-Server:

```bash
npm run app
```

## API Keys

Kopiere `.env.example` zu `.env`, setze die Variablen im Terminal oder trage sie bei Vercel unter `Project Settings -> Environment Variables` ein:

- `OPENAI_API_KEY` aktiviert echte KI-Analyse fuer Zutatenfotos.
- `OPENAI_MODEL` ist standardmaessig `gpt-4.1-mini`.
- `GOOGLE_MAPS_API_KEY` aktiviert Google Places fuer echte Standortvorschlaege. Ohne Key nutzt der Server OpenStreetMap Nominatim als reale freie Quelle.
- `SUPABASE_URL` ist die Project URL aus deinem Supabase-Projekt.
- `SUPABASE_SERVICE_ROLE_KEY` ist der geheime Service-Role-Key fuer die serverseitigen API-Routen. Nicht mit `VITE_` prefixen und nicht im Frontend verwenden.

## Supabase

Lege die Tabelle in Supabase unter `SQL Editor` mit dem Script aus `supabase/schema.sql` an. Danach lokal `.env` befuellen:

```bash
SUPABASE_URL=https://dein-projekt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=dein-service-role-key
```

Die App nutzt Supabase fuer Community-Spots:

- `GET /api/community-spots` laedt Spots aus der Tabelle `community_spots`.
- `POST /api/community-spots` speichert neue Spots.
- `POST /api/community-spots/confirm` zaehlt Spot-Bestaetigungen hoch.

## Vercel Deploy

Die App ist fuer Vercel vorbereitet:

- Frontend: Vite Build nach `dist`
- API: Vercel Functions in `api/`
- Konfiguration: `vercel.json`

Vercel-Einstellungen:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

Nach jedem `git push` deployed Vercel automatisch eine neue Version. Custom Domains werden in Vercel unter `Project Settings -> Domains` verbunden.

## Struktur

- `src/App.tsx` enthaelt die Screens, Navigation und interaktiven UI-Zustaende.
- `src/data/mockData.ts` enthaelt Kategorien, leere Startdaten und Pricing.
- `api/` enthaelt die Vercel Functions fuer Preise, Standortsuche und KI-Analyse.
- `src/styles.css` enthaelt Tailwind-Basisstyles und kleine globale UI-Details.

## Echte Dienste und Mock-Daten

Der Prototyp nutzt jetzt erste echte externe Dienste direkt aus dem Browser:

- Produkt-Scanner: Open Food Facts API fuer Barcode-Abfragen
- Kamera-Scanner: Browser BarcodeDetector API, wo vom Browser unterstuetzt
- Preisvergleich: Open Food Facts Open Prices fuer echte Crowd-Preise
- Zutatenfoto: OpenAI Responses API mit Bildanalyse, wenn `OPENAI_API_KEY` gesetzt ist
- Standortvorschlaege: Google Places API mit Key, sonst OpenStreetMap Nominatim
- Karte: OpenStreetMap Embed fuer echte Kartenansicht
- Community-Spots: Supabase/Postgres, wenn `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` gesetzt sind

Weiterhin als MVP-Logik oder lueckenhaft umgesetzt:

- Laden-Verfuegbarkeit und deutsche Supermarkt-Abdeckung bei Preisen
- Login/Auth
- Premium-Zahlungen
