# Itterem Frontend — Tennivalók

## Magas prioritás

- [ ] **Regisztráció & CRUD – JSON body**: Az összes `mutate()` / `register()` hívásban az adatokat jelenleg query paraméterként küldi a frontend. A backend módosítása után át kell térni JSON body küldésre. (Nincs szükség frontend módosításra a backend-változtatás előtt.)
- [ ] **Kosár funkció implementálása**:
  - `Cart.vue` komponens: tételek listája, darabszám, összeg
  - `useCart` composable: állapot kezelés (localStorage-ban tárolva)
  - „Kosárba" gomb aktiválása a `MenuItemPage.vue`-ban
  - Rendelés leadás oldal (`OrderPage.vue`) + `POST /api/Order` vagy hasonló végpont
  - Rendelés megerősítő visszajelzés
- [ ] **JWT token lejárat kezelése**: A lejárt tokennel érkező 401-es API válasz esetén automatikusan ki kell jelentkeztetni a felhasználót. Megoldás: interceptor az `api.js`-ben, vagy `response.status === 401` ellenőrzés minden API hívás után.

## Közepes prioritás

- [ ] **Elfelejtett jelszó funkció**: Backend végpont szükséges hozzá. Ha elkészül, a `Login.vue`-ban a szürke gomb aktiválható.
- [ ] **Felhasználói adatok szerkesztése**: Név és e-mail cím módosítása a `UserPage.vue`-ban (backend végpont szükséges).
- [ ] **Rendelési előzmények oldal** (`OrderHistory.vue`): A bejelentkezett felhasználó korábbi rendeléseit listázza.
- [ ] **Admin hibakezelés – általánosítás**: Az `AdminDashboard.vue`-ban a mentési / törlési hibaüzenetek (`'Missing id.'`, `'Save failed'`, `'Delete failed'`) még angolul vannak, ezeket is magyarosítani kell.

## Alacsony prioritás

- [ ] **Kedvencek funkció**: Étel/ital kedvencnek jelölése, külön „Kedvencek" oldal.
- [ ] **Push / in-app értesítések**: Rendelés állapotának változásakor értesítés a felhasználónak.
- [ ] **Sötét téma**: Tailwind `dark:` osztályok hozzáadása a fő komponensekhez.
- [ ] **PWA támogatás**: `vite-plugin-pwa` és `manifest.json` konfigurálása offline elérhetőséghez.
- [ ] **tailwind.config.cjs törlése**: A Tailwind v4 nem olvassa a config fájlt (az `@tailwindcss/postcss` plugint használja). A fájl dead code, törölhető ha nem tervez visszaváltást v3-ra.

## Technikai adósság

- [ ] **Regisztrációnál a visszatérési forma**: Ha a backend visszaküldi az újonnan létrehozott felhasználó adatait, a `Register.vue` kezelje azt (pl. automatikus bejelentkezés regisztráció után).
- [ ] **E2E tesztek**: Cypress vagy Playwright tesztek a bejelentkezési folyamathoz és az admin CRUD műveletekhez.
- [ ] **Hozzáférési jogok finomhangolása**: A router guard jelenleg a `jogosultsag` mezőt ellenőrzi (`== 2` = admin). Ha több jogosultsági szint lesz, ezeket érdemes nevesített konstansokba kiszervezni.
