# Itterem Frontend (Vue + Vite)

English version: [README.en.md](./README.en.md)

Az Itterem éttermi alkalmazás frontend kliense.

## Követelmények

- Node.js 20+
- npm 10+

Opcionális az automatikus backend-felderítéshez lokális fejlesztés közben:

- Python 3.10+
- Python-függőség: `psutil` (lásd: `devtools/server_discovery_helper/requirements.txt`)

## Telepítés

```bash
npm install
```

## Környezeti beállítások

Hozz létre egy lokális környezeti fájlt:

```bash
cp .env.example .env
```

Példa:

```env
VITE_API_BASE_URL=http://localhost:7200
```

Megjegyzések:

- A `.env` fájl nincs verziókezelve.
- A `VITE_API_BASE_URL` értékét a discovery launcher futás közben is megadhatja.

## Fejlesztői parancsok

- `npm run dev`
	- Elindítja a discovery-t ismerő launchert (`scripts/dev-with-discovery.mjs`).
	- Először megpróbálja felderíteni a backendet, és csak utána esik vissza a `VITE_API_BASE_URL` használatára.

- `npm run dev:discover`
	- Ugyanaz, mint a `npm run dev`.

- `npm run dev:raw`
	- Sima Vite indítás discovery logika nélkül.

- `npm run generate:seed -- --image-source placeholder`
	- Demo SQL seed adatokat generál lokálisan renderelt helykitöltő képekkel.
	- Akkor hasznos, ha teljesen offline futást szeretnél külső kép API nélkül.

- `npm run generate:seed -- --image-source pexels`
	- Demo SQL seed adatokat generál a Pexelsről letöltött ételfotókkal.
	- Létrehozza az SQL import fájlt és az attribúciós manifestet is.

## Build

```bash
npm run build
```

## Production build előnézet

```bash
npm run preview
```

Megjegyzések:

- A `npm run preview -- --host` már újrabuildel kiszolgálás előtt, így az előnézet mindig az aktuális forrást tükrözi.
- Ha az előnézeti oldalt egy másik LAN-eszközről nyitod meg, és a `VITE_API_BASE_URL` `localhost`-ra mutat, az alkalmazás visszaesik a same-origin `/api` és `/orderHub` kérésekre, így a Vite preview vissza tud proxyzni a gépeden futó backendhez.

## Demo seed generátor

A projekt tartalmaz egy katalógus seed generátort itt: `scripts/generate-demo-seed.mjs`.

Jelenlegi korlátozás:

- a seed generátor jelenleg csak macOS-en használható, mert mind a placeholder, mind a Pexels képfeldolgozás a beépített `sips` eszközt használja JPEG blobok előállításához

Mit csinál:

- SQL insert sorokat készít kategóriákhoz, hozzávalókhoz, készételekhez, köretekhez, üdítőkhöz és menükhöz
- a képeket közvetlenül a generált SQL-be ágyazza be
- támogatja a helykitöltő képes és a valódi Pexels-fotós módot is
- Pexels módnál képattribúciós metaadatot is ír

Generált fájlok:

- `generated-demo-seed.sql`
- `generated-demo-seed-image-attribution.json`

Megjegyzések:

- az SQL fájl szándékosan nagy, mert a képek hexadecimális BLOB értékként vannak beágyazva
- a Pexels mód helyi API kulcsot igényel a `.env.local` fájlban
- a script a `sips` eszközt használja a képek JPEG BLOB formára normalizálásához, ezért jelenleg macOS-függő

A részletes használat, beállítás és hibaelhárítás a [DEMO_SEED_README.md](./DEMO_SEED_README.md) fájlban található.

## Discovery helper megjegyzések

- A helper forrása a `devtools/server_discovery_helper` alatt van.
- A frontend helper kapcsolati beállításai:
	- `VITE_DISCOVERY_HELPER_HOST`
	- `VITE_DISCOVERY_HELPER_PORT`
- A launcher ezeket a belső felülbírálásokat is elfogadja:
	- `ITTEREM_DISCOVERY_HELPER_HOST`
	- `ITTEREM_DISCOVERY_HELPER_PORT`
	- `ITTEREM_DISCOVERY_TIMEOUT_MS`
	- `ITTEREM_DISCOVERY_SKIP=1`

## Fő alkalmazásstruktúra

- `src/components` UI komponensek
- `src/composables` megosztott állapot és alkalmazáslogika
- `src/services` backend API réteg
- `src/domain` doménspecifikus DTO- és normalizáló segédek
- `src/shared` keresztmetszeti utility függvények
- `src/config` alkalmazáskonstansok és konfiguráció
- `src/router.js` route- és szerepkörvédelmi logika
- `src/locales` nyelvi erőforrások

## Függőségek

- `vue`, `vue-router`, `vue-i18n`
	- Az alap keretrendszer, a route-szintű szerepkör- és nyelvkezelés, valamint a lokalizáció.

- `@microsoft/signalr`
	- Valós idejű rendelésfrissítésekhez az account és dolgozói rendeléskezelő folyamatokban.
	- A kapcsolat életciklusa a `src/composables/useSignalR.js` fájlban van központosítva.

- `vuedraggable`
	- Drag-and-drop interakció kizárólag a dolgozói rendelésstátusz táblán.
	- A `src/components/admin/EmployeeOrders.vue` használja a státuszváltásokhoz.

- `tailwindcss`, `postcss`, `autoprefixer`, `@tailwindcss/postcss`
	- Utility-first stílusrendszer és CSS utófeldolgozás a Vite buildben.

- `@vitejs/plugin-vue`, `vite`
	- Vue SFC transzformáció és helyi fejlesztői/build eszközlánc.
