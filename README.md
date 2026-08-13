# Veggie Navigator Mobile

Dieses Repository enthält ausschließlich die Expo-App für Android und iOS sowie das dafür benötigte Node-/Vercel-API-Backend. Eine Webversion wird nicht mehr ausgeliefert.

## Struktur

- `mobile-app/` – Expo-/React-Native-App
- `api/` – serverlose Mobile-API-Routen
- `lib/` – gemeinsam genutzte Backendlogik
- `server.mjs` – lokaler Mobile-API-Server
- `supabase/` – Mobile-Datenbankschema und Migrationen

## Lokal starten

Backend:

```powershell
npm install
npm run api
```

Mobile-App in einem zweiten Terminal:

```powershell
cd mobile-app
npm install
npx expo start --clear
```

Die benötigten Umgebungsvariablen und Supabase-Schritte stehen in `USER_ACTIONS_REQUIRED.md`.
