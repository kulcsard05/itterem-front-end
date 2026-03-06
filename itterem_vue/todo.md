# Backend TODO — ETag alapú menü gyorsítás (frontend már felkészítve)

A frontend már elkészült a feltételes lekérésekhez:
- Küldi: `If-None-Match`
- Kezeli: `304 Not Modified`
- ETag-eket kliensoldalon menti

Most a backend feladata, hogy ETag-et adjon vissza a menü adatokra.

---

## 1) Érintett endpointok

Az alábbi **GET** endpointoknak kell ETag támogatás:
- `GET /api/Kategoria`
- `GET /api/Keszetelek`
- `GET /api/Koretek`
- `GET /api/Menuk`
- `GET /api/Uditok`

Minden endpointnál ugyanaz az elv:
1. Számolj aktuális verziót/hash-t (ETag)
2. Ha request header `If-None-Match` megegyezik az aktuális ETag-gel → `304`
3. Ha nem egyezik → `200` + normál JSON body + `ETag` response header

---

## 2) HTTP szerződés (pontos)

### Kliens → Szerver
- Header: `If-None-Match: "<etag>"`

### Szerver → Kliens
- Válasz `200 OK` esetén:
  - `ETag: "<etag>"`
  - normál JSON body (mint most)
- Válasz `304 Not Modified` esetén:
  - body **ne legyen** (vagy üres)
  - opcionálisan ETag visszaadható, de nem kötelező

### Fontos
- ETag legyen **stabil** ugyanarra az adatra
- ETag változzon bármilyen releváns adatváltozásnál
- Használható weak ETag is: `W/"..."`, de kezdésnek egyszerű strong ETag is jó

---

## 3) ETag előállítás (ajánlott stratégia)

## 3.1 Gyors, megbízható mintázat
Minden endpointhoz állíts elő egy determinisztikus stringet, pl:
- rekordszám
- max `updatedAt` (ha van)
- max `id`
- opcionálisan checksum

Majd erre hash:
- `SHA-256(baseString)`
- ETag = `"{hexHash}"`

Példa base string (`/api/Keszetelek`):
- `count=123|maxUpdatedAt=2026-03-04T10:00:00Z|maxId=456`

Ha nincs `updatedAt` oszlop:
- rövid távon: hash a rendezett rekordokból (id + fő mezők)
- hosszú távon: érdemes minden táblába `updatedAt`-ot bevezetni

## 3.2 Konkrétan mely táblák számítanak
- `/api/Kategoria` → `Kategoria`
- `/api/Keszetelek` → `Keszetelek` (+ ha nested/kapcsolt hozzávalók is jönnek, akkor kapcsolótábla is)
- `/api/Koretek` → `Koretek`
- `/api/Menuk` → `Menuk`
- `/api/Uditok` → `Uditok`

Ha a payload kapcsolt adatot is tartalmaz (pl. készételhez hozzávalók), az ETag-be **kötelező** beleszámítani azt a kapcsolatot is.

---

## 4) Változtatások backend kódban

## 4.1 Közös helper middleware/service
Készíts egy közös utility-t, pl:
- `ComputeEtagForEndpoint(endpointName)`
- `TryHandleIfNoneMatch(request, response, currentEtag)`

Elvárt viselkedés:
1. kiszámolja `currentEtag`
2. beolvassa `If-None-Match`
3. match esetén `304` + return
4. különben controller folytatja, a végén `ETag` header beállítva

## 4.2 Controller szintű alkalmazás
Minden érintett GET metódus elején:
- ETag számítás
- conditional check

Minden 200-as válasz előtt:
- `Response.Headers["ETag"] = currentEtag`

---

## 5) Cache-Control beállítás

Ajánlott response header:
- `Cache-Control: private, max-age=0, must-revalidate`

Miért:
- böngésző revalidál minden alkalommal
- ha nincs változás → olcsó `304`
- ha változott → teljes új adat

---

## 6) Elfogadási kritériumok (Definition of Done)

1. Az 5 endpoint mind ad `ETag` headert 200 esetén
2. Ugyanarra az adatra két egymás utáni kérés:
   - 1. kérés: `200` + body + ETag
   - 2. kérés (If-None-Match): `304`
3. Adatmódosítás után (create/update/delete):
   - következő GET már `200` + új ETag
4. Frontend oldalon frissítéskor (Refresh gomb):
   - változatlan adatra nincs body letöltés (`304`)
   - változáskor frissül a lista
5. Nem törik auth flow:
   - 401 továbbra is 401

---

## 7) Teszt forgatókönyv (kézi)

1. Nyisd meg az appot, `Network` tab
2. Menü endpointokra első kérés: 200 + ETag
3. Nyomj `Refresh`-t a frontendben
4. Elvárt: 304-ok (vagy legalábbis nem minden endpoint 200)
5. Módosíts adminból egy elemet (pl. étel ár)
6. Újra `Refresh`
7. Elvárt: az érintett endpoint 200 + új ETag

---

## 8) Opcionális továbbfejlesztés (később)

Ha még kevesebb kérés kell:
- új endpoint: `GET /api/menu/version`
- visszaad egy aggregált verziót minden menü adatra
- frontend csak változáskor húzza be az 5 listát

De jelenleg az ETag + 304 teljesen elegendő és szabványos.

---

## 9) Megjegyzés a jelenlegi frontend implementációról

A frontend már:
- local cache-ből azonnal renderel (`menu-cache-v1`)
- dataset-fingerprint alapján nem cserél state-et feleslegesen
- endpoint ETag-eket külön tárol (`menu-etags-v1`)
- conditional loader függvényeket használ (`get*Conditional`)

Tehát backend oldalon az ETag visszaadás után az optimalizáció azonnal aktiválódik.

---
---

# Frontend TODO — Deferred Improvements

Az alábbi fejlesztéseket külön tervezzük, itt gyűjtjük az előkészítést és példákat.

---

## 1) i18n — Nemzetköziesítés

### Probléma
Minden szöveg hardcode-olva magyar nyelven van a `.vue` fálokban és JS modulokban.
Példák: `'Rendelés leadva.'`, `'Szerkesztés'`, `'Sikeres regisztráció!'`, `'Mentés sikertelen'`.

### Javasolt stratégia
- **vue-i18n** csomag telepítése
- Locale fájlok: `src/locales/hu.json`, `src/locales/en.json`
- Globális `$t()` + Composition API `useI18n()`

### Lépések
1. `npm install vue-i18n`
2. `src/i18n.js` plugin setup
3. Locale fájlok kialakítása
4. Komponensek átírása `$t()` hívásokra
5. Nyelváváltó UI (opcionális)

### Példa — Plugin setup

```js
// src/i18n.js
import { createI18n } from 'vue-i18n';
import hu from './locales/hu.json';

export const i18n = createI18n({
  locale: 'hu',
  fallbackLocale: 'hu',
  messages: { hu },
});
```

```js
// src/main.js
import { i18n } from './i18n.js';
app.use(i18n);
```

### Példa — Locale fájl (hu.json, részlet)

```json
{
  "quickBuy": {
    "title": "Gyors rendelés",
    "loginRequired": "A rendeléshez be kell jelentkezni.",
    "orderPlaced": "Rendelés leadva.",
    "orderFailed": "Rendelés leadása sikertelen.",
    "ordering": "Rendelés folyamatban…",
    "placeOrder": "Rendelés leadása",
    "cancel": "Mégsem",
    "close": "Bezárás",
    "quantity": "Mennyiség",
    "unitPrice": "Egységár",
    "total": "Összesen"
  },
  "admin": {
    "edit": "Szerkesztés",
    "saveFailed": "Mentés sikertelen",
    "deleteFailed": "Törlés sikertelen",
    "back": "Vissza"
  },
  "orderStatuses": {
    "pending": "Függőben",
    "inProgress": "Folyamatban",
    "ready": "Átvehető",
    "pickedUp": "Átvett"
  }
}
```

### Példa — Komponens használat

```vue
<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<template>
  <h2>{{ t('quickBuy.title') }}</h2>
  <button>{{ t('quickBuy.placeOrder') }}</button>
</template>
```

### Hatókör
Érintett fájlok (nagyjából mindegyik template + néhány JS/composable):
- Összes `src/components/**/*.vue`
- `src/composables/useAdminEntityConfigs.js` (entity label-ek, message-ek)
- `src/admin-helpers.js` (validator hibaüzenetek)
- `src/constants.js` (ORDER_STATUSES)

---

## 2) DTO Casing — PascalCase / camelCase egységesítés

### Probléma
A backend ASP.NET Core PascalCase-ben küldi a DTO-kat (`EtelId`, `Nev`, `Ar`, `Mennyiseg`).
A frontend jelenleg PascalCase property neveket használ mindenhol, keveredik a JS konvencióval.

### Javasolt stratégia
- Axios/fetch interceptor vagy normalizáló réteg az API modulban
- Backend response → camelCase mapping beérkezéskor
- Frontend request → PascalCase mapping küldéskor
- Fokozatos átállás: először az `order-dto.js` minta kiterjesztése

### Megjegyzés
Alternatíva: backend oldali `JsonSerializerOptions` → `camelCase`. Ez egyszerűbb lenne, de backendhez hozzáférés kell.

### Lépések
1. Döntés: frontend-oldalon mapping VAGY backend `System.Text.Json` camelCase policy
2. Mapping utility írás (ha frontend-oldali)
3. API réteg módosítás
4. Komponensek fokozatos átírása

### Példa — Frontend-oldali mapping utility

```js
// src/dto-mapper.js

/** PascalCase → camelCase */
function toCamel(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/** camelCase → PascalCase */
function toPascal(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Rekurzív kulcs-mapping objektumra/tömbre */
export function mapKeys(obj, transform) {
  if (Array.isArray(obj)) return obj.map(item => mapKeys(item, transform));
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [transform(k), mapKeys(v, transform)])
    );
  }
  return obj;
}

export const fromBackend = (data) => mapKeys(data, toCamel);
export const toBackend = (data) => mapKeys(data, toPascal);
```

### Példa — API integráció

```js
// src/api.js — a meglévő requestJsonOrThrow módosítása
import { fromBackend, toBackend } from './dto-mapper.js';

// Response olvasáskor:
const json = await response.json();
return fromBackend(json);

// Request küldéskor:
body: JSON.stringify(toBackend(payload)),
```

### Példa — Backend-oldali megoldás (ha lehetséges, egyszerűbb)

```csharp
// Program.cs
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });
```

### Hatókör & kockázat
- Az összes `.vue` fájl + composable + helper érinti (property nevek mindenhol)
- A `normalizeOrderDto` már kezeli a dupla casing-et — ez kiterjeszthető
- **Nagy volumenű változás** — javasolt ütemezés: egy entity-csoport egyszerre

---

## 3) CSRF védelem

### Elemzés
A backend JWT Bearer tokent használ (`Authorization: Bearer <token>`).
A JWT Bearer auth **immunis a CSRF támadásokra**, mert a böngésző nem küldi
automatikusan az `Authorization` headert cross-origin requesteknél.

### Eredmény
**Nem szükséges CSRF tokent bevezetni.**

A jelenlegi architektúra (JWT Bearer, token localStorage-ból olvasva, manuálisan
illesztve a headerbe) önmagában védi a CSRF ellen.

### Javaslat (opcionális biztonsági erősítés)
Ha a jövőben cookie-alapú auth-ra váltanánk, CSRF token szükséges lenne:

```csharp
// Backend — ASP.NET Core anti-forgery
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-XSRF-TOKEN";
    options.Cookie.Name = "XSRF-TOKEN";
    options.Cookie.SameSite = SameSiteMode.Strict;
});
```

```js
// Frontend — XSRF token olvasás cookie-ból
function getXsrfToken() {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

// fetch híváshoz:
headers: {
  'X-XSRF-TOKEN': getXsrfToken(),
}
```

**De jelenleg erre nincs szükség.**

---

## 4) Pinia — State Management migráció

### Probléma
Jelenleg a shared state module-szintű singleton ref-ekkel van megoldva
a composable-ökben. Ez működik, de:
- Nincs DevTools integráció (nem látszanak a store-ok)
- Nincs time-travel debugging
- Nehezebb tesztelni (modul-szintű side effect)
- SSR-nél problémás lenne (shared state request-ek közt)

### Jelenlegi minta (ami lecserélendő)

```js
// src/composables/useAuth.js — jelenlegi
const auth = ref(null);  // modul szintű singleton

export function useAuth() {
  const isLoggedIn = computed(() => Boolean(auth.value?.token));
  function setAuth(user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    auth.value = user;
  }
  return { auth, isLoggedIn, setAuth, ... };
}
```

### Javasolt Pinia store

```js
// src/stores/auth.js
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { ROLE_ADMIN, ROLE_EMPLOYEE, AUTH_STORAGE_KEY } from '../constants.js';
import { readStoredAuth } from '../storage-utils.js';

export const useAuthStore = defineStore('auth', () => {
  // --- State ---
  const auth = ref(null);

  // --- Getters ---
  const isLoggedIn = computed(() => Boolean(auth.value?.token));
  const isAdmin = computed(() => Number(auth.value?.jogosultsag) === ROLE_ADMIN);
  const isEmployee = computed(() =>
    [ROLE_EMPLOYEE, ROLE_ADMIN].includes(Number(auth.value?.jogosultsag))
  );

  // --- Actions ---
  function setAuth(user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    auth.value = user;
  }

  function clearAuth() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    auth.value = null;
  }

  // --- Init ---
  try {
    auth.value = readStoredAuth();
  } catch {
    auth.value = null;
  }

  return { auth, isLoggedIn, isAdmin, isEmployee, setAuth, clearAuth };
});
```

### Lépések
1. `npm install pinia`
2. Plugin setup `main.js`-ben
3. Store fájlok létrehozása `src/stores/` mappában
4. Composable-ök fokozatos migrálása (auth → cart → menuData → orderColumns)
5. Komponensek átírása `useAuthStore()` stb. használatára

### Példa — Plugin setup

```js
// src/main.js
import { createPinia } from 'pinia';

const pinia = createPinia();
app.use(pinia);
```

### Példa — Komponensben használat

```vue
<script setup>
import { useAuthStore } from '../stores/auth.js';
const authStore = useAuthStore();
// authStore.isLoggedIn, authStore.setAuth(user), stb.
</script>
```

### Migrálandó composable-ök (prioritás sorrendben)
1. `useAuth.js` → `stores/auth.js`
2. `useCart.js` → `stores/cart.js`
3. `useMenuData.js` → `stores/menuData.js`
4. `useOrderColumns.js` → `stores/orderColumns.js`
5. `useMenuImageCache.js` → `stores/menuImageCache.js`

### Kockázat
- **Közepes volumen** — 5 composable átírás + összes felhasználó komponens
- A singleton ref minta már jól működik, a migráció elsősorban DX és tesztelhetőség miatt éri meg
- Javasolt: egyenként migrálni, nem egyszerre
