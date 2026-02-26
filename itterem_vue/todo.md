# Itterem Frontend — Tennivalók

## Magas prioritás

- [ ] **Backend szerződés egységesítése (param nevek + nullák)**:
  - `Kategoria` legyen a kanonikus név (ne `Kategora`).
  - `Keszetelek`: a frontend mostantól csak `kategoriaId` paramot küld create/update esetén is (backend igazodjon ehhez).
  - `Menuk`: backend engedje a nullable `keszetelId` / `koretId` / `uditoId` mezőket (frontend validáció: készétel VAGY köret kötelező).
  - `Menuk` listázás/frissítés mindenhol FK ID-kat adjon vissza (`keszetelId`, `koretId`, `uditoId`).

- [x] **Regisztráció – JSON body**: A `register()` az adatokat JSON body-ban küldi (`teljesNev`, `email`, `jelszo`, `telefonszam`) a `POST /api/Registration` végpontra.
- [x] **Kosár funkció implementálása**:
  - `CartDrawer.vue` komponens: tételek listája, darabszám, összeg, rendelés leadás
  - `useCart` composable: állapot kezelés (localStorage-ban tárolva), `buildOrderItems()` segédfüggvény
  - „Kosárba" gomb aktív a `MenuItemPage.vue`-ban (`add-to-cart` esemény)
  - Rendelés leadás a `CartDrawer.vue`-ban + `placeOrder()` → `POST /api/Order`
  - Rendelés megerősítő visszajelzés (siker / hiba üzenet a drawerben)
- [x] **JWT token lejárat kezelése**: A `requestOk()` helper a 401-es válasz esetén automatikusan kijelentkezteti a felhasználót (`clearStoredAuth({ emitEvent: true })`), az `AUTH_EXPIRED_MESSAGE` üzenetet adja vissza.

## Közepes prioritás

- [ ] **Elfelejtett jelszó funkció**: Backend végpont szükséges hozzá. Ha elkészül, a `Login.vue`-ban a szürke gomb aktiválható.
- [ ] **Felhasználói adatok szerkesztése**: Név és e-mail cím módosítása a `UserPage.vue`-ban (backend végpont szükséges).
- [ ] **Rendelési előzmények oldal** (`OrderHistory.vue`): A bejelentkezett felhasználó korábbi rendeléseit listázza.
- [ ] **Admin hibakezelés – általánosítás**: Az `AdminDashboard.vue`-ban a mentési / törlési hibaüzenetek (`'Missing id.'`, `'Save failed'`, `'Delete failed'`) még angolul vannak, ezeket is magyarosítani kell.

## Alacsony prioritás

- [ ] **Kedvencek funkció**: Étel/ital kedvencnek jelölése, külön „Kedvencek" oldal.
- [ ] **Push / in-app értesítések**: Rendelés állapotának változásakor értesítés a felhasználónak.
- [ ] **SSE auth átalakítás cookie-ra (később)**:
  - Jelenleg (dev) az SSE `EventSource` JWT-t query paramként kap: `?access_token=...`.
  - Cél: httpOnly cookie alapú auth SSE-hez (EventSource header nélkül is működik).
  - Backend:
    - Login után állítson be httpOnly sütit (pl. `Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=None` vagy `Lax` dev/prod szerint).
    - CORS: `AllowCredentials()` + explicit origin (nem lehet `*`).
    - SSE endpointoknál a cookie-ból olvassa a tokent/identitást (vagy cookie auth scheme).
  - Frontend:
    - `EventSource(url, { withCredentials: true })`.
    - Fetch kéréseknél opcionálisan átállás cookie auth-ra (vagy marad Bearer header, de akkor kétféle auth lesz).
  - Megjegyzés: query param token kerülhet logokba/analyticsba; cookie-s megoldás tisztább hosszú távon.
- [ ] **Sötét téma**: Tailwind `dark:` osztályok hozzáadása a fő komponensekhez.
- [ ] **PWA támogatás**: `vite-plugin-pwa` és `manifest.json` konfigurálása offline elérhetőséghez.
- [ ] **tailwind.config.cjs törlése**: A Tailwind v4 nem olvassa a config fájlt (az `@tailwindcss/postcss` plugint használja). A fájl dead code, törölhető ha nem tervez visszaváltást v3-ra.

## Technikai adósság

- [ ] **Regisztrációnál a visszatérési forma**: Ha a backend visszaküldi az újonnan létrehozott felhasználó adatait, a `Register.vue` kezelje azt (pl. automatikus bejelentkezés regisztráció után).
- [ ] **E2E tesztek**: Cypress vagy Playwright tesztek a bejelentkezési folyamathoz és az admin CRUD műveletekhez.
- [ ] **Hozzáférési jogok finomhangolása**: A router guard jelenleg a `jogosultsag` mezőt ellenőrzi (`== 2` = admin). Ha több jogosultsági szint lesz, ezeket érdemes nevesített konstansokba kiszervezni.


keszetel post/put kep nullable
