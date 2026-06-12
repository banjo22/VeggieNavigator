# Veggie Navigator

Klickbarer MVP-Prototyp fuer eine mobile-first Webapp rund um vegane, vegetarische und flexitarische Food-Entscheidungen.

## Setup

```bash
npm install
npm run dev
npm run api
```

Danach die lokale Vite-URL im Browser oeffnen. Fuer eine gebaute Version mit API-Server:

```bash
npm run app
```

## API Keys

Kopiere `.env.example` zu `.env` oder setze die Variablen im Terminal:

- `OPENAI_API_KEY` aktiviert echte KI-Analyse fuer Zutatenfotos.
- `OPENAI_MODEL` ist standardmaessig `gpt-4.1-mini`.
- `GOOGLE_MAPS_API_KEY` aktiviert Google Places fuer echte Standortvorschlaege. Ohne Key nutzt der Server OpenStreetMap Nominatim als reale freie Quelle.

## Struktur

- `src/App.tsx` enthaelt die Screens, Navigation und interaktiven UI-Zustaende.
- `src/data/mockData.ts` enthaelt alle Mock-Daten fuer Produkte, Menues, Community-Funde und Pricing.
- `src/styles.css` enthaelt Tailwind-Basisstyles und kleine globale UI-Details.

## Echte Dienste und Mock-Daten

Der Prototyp nutzt jetzt erste echte externe Dienste direkt aus dem Browser:

- Produkt-Scanner: Open Food Facts API fuer Barcode-Abfragen
- Kamera-Scanner: Browser BarcodeDetector API, wo vom Browser unterstuetzt
- Preisvergleich: Open Food Facts Open Prices fuer echte Crowd-Preise
- Zutatenfoto: OpenAI Responses API mit Bildanalyse, wenn `OPENAI_API_KEY` gesetzt ist
- Standortvorschlaege: Google Places API mit Key, sonst OpenStreetMap Nominatim
- Karte: OpenStreetMap Embed fuer echte Kartenansicht

Weiterhin als MVP-/Mock-Logik oder lueckenhaft umgesetzt:

- Laden-Verfuegbarkeit und deutsche Supermarkt-Abdeckung bei Preisen
- Speisekarten-Analyse
- Community-Funde und gespeicherte Funde
- Login/Auth
- Premium-Zahlungen

Im Code sind Kommentare markiert fuer spaetere Anbindungen an KI-Bildanalyse, Community-Datenbank, Authentifizierung, Haendlerpreise und erweiterte Kartenanbieter.
