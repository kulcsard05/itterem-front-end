# Backend Status — ETag alapú menü gyorsítás

Az ETag-alapú menü gyorsítás most már végig működik.

---

## Állapot: kész

Az alábbi endpointok ETag támogatással működnek:
- `GET /api/Kategoria`
- `GET /api/Keszetelek`
- `GET /api/Koretek`
- `GET /api/Menuk`
- `GET /api/Uditok`

Jelenlegi szerződés:
- a frontend küldi az `If-None-Match` headert, ha már ismer ETag-et
- változatlan adatnál a backend `304 Not Modified` választ ad
- változott adatnál a backend `200 OK` + body + `ETag` headert ad vissza
- adatmódosítás után új ETag keletkezik, így a következő lekérés új `200` választ ad

---

## Elfogadási kritériumok: teljesítve

- mind az 5 endpoint ad `ETag` headert `200` válasznál
- ugyanarra az adatra egymás utáni kérésnél működik a `200` -> `304` revalidáció
- create/update/delete után a következő GET új ETag-gel jön vissza
- frontend refresh esetén változatlan adatra nincs felesleges body letöltés
- auth flow nem sérül, a `401` továbbra is `401`

---

## Jelenlegi frontend együttműködés

A frontend oldalon ehhez már minden készen áll:
- local cache-ből azonnal renderel datasetenként külön kulcsokkal (`menu-cache-*-v5`)
- dataset-fingerprint alapján nem cserél state-et feleslegesen
- endpoint ETag-eket külön tárol (`menu-etags-v1`)
- `304 Not Modified` esetén nem vár body-t, és nem írja felül feleslegesen a state-et
- cache-hiány esetén ledobja az adott dataset ETag-jét, hogy a következő kérés biztosan `200` legyen
- conditional loader függvényeket használ (`get*Conditional`)

Ennek eredménye, hogy a menü frissítés most már cache-first + conditional revalidation módban működik.

---

## Opcionális későbbi továbbfejlesztés

Ha később még kevesebb kérés kell, külön aggregált verzió endpoint adható hozzá, például:
- `GET /api/menu/version`

De jelenleg az ETag + `304` megoldás elegendő és szabványos.

---
---

# Frontend TODO — Status Snapshot (2026-03-31)

Az eredeti lista több pontja már részben vagy teljesen megvalósult. Ez a blokk a jelenlegi állapotot és a maradék tényleges teendőket rögzíti.

---

## 1) i18n — állapot: részben kész, auditálva

### Már elkészült
- `vue-i18n` telepítve van
- központi i18n setup létezik (`src/i18n.js`)
- locale fájlok léteznek (`src/locales/hu.json`, `src/locales/en.json`)
- locale state + perzisztencia létezik (`src/composables/useLocale.js`)
- van nyelvváltó UI és query-param szinkron (`App.vue`, `router.js`)
- több public / auth / account komponens már `useI18n()`-t használ

### Audit alapján továbbra is nyitott
- több admin és employee komponensben maradt hardcode-olt HU szöveg
- több API fallback hibaüzenet még string literálként él
- az order status konstansok és néhány util még magyar literalokra támaszkodik

### Konkrétan most is igaz, mert
- az admin UI-ban továbbra is sok közvetlen magyar felirat van, például [src/components/admin/AdminDashboard.vue](src/components/admin/AdminDashboard.vue), [src/components/admin/AdminTable.vue](src/components/admin/AdminTable.vue), [src/components/admin/AdminEditModal.vue](src/components/admin/AdminEditModal.vue), [src/components/admin/AdminBulkEditModal.vue](src/components/admin/AdminBulkEditModal.vue), [src/components/admin/ConfirmModal.vue](src/components/admin/ConfirmModal.vue), [src/components/admin/EmployeeOrders.vue](src/components/admin/EmployeeOrders.vue) és [src/components/admin/FloatingOrderDetailsPanel.vue](src/components/admin/FloatingOrderDetailsPanel.vue)
- a dolgozói nézetben az `useI18n()` már importálva van, de a legtöbb látható szöveg még nincs locale kulcsokra kötve
- a [src/services/api.js](src/services/api.js) továbbra is sok magyar fallback hibasztringet tartalmaz, például `Rendelések betöltése sikertelen`, `Saját rendelések betöltése sikertelen`, `Hozzávalók betöltése sikertelen`
- a [src/config/constants.js](src/config/constants.js) `ORDER_STATUSES` listája továbbra is magyar literalokat használ (`Függőben`, `Folyamatban`, `Átvehető`, `Átvett`), és erre épül a [src/domain/order/order-utils.js](src/domain/order/order-utils.js) is

### Következő érdemi szelet
1. admin modalok és táblák szövegeinek kiszervezése locale kulcsokra
2. `src/services/api.js` fallback üzeneteinek áthelyezése locale kulcsokra vagy lokalizálható boundary-ra
3. order status literalok leválasztása a `constants` / `order-utils` / `shared/utils` rétegről
4. csak ezután érdemes bundle-optimalizációként locale lazy-loadot mérlegelni

### Megjegyzés
A korábbi TODO-ban szereplő alaplépések, mint a `vue-i18n` telepítés, plugin setup és nyelvváltó UI, már nem TODO-k. A mostani hiányosság már nem az infrastruktúra, hanem a hardcode-olt UI és hibaüzenetek következetes kitakarítása.

---

## 2) DTO Casing — állapot: részben megkezdve

### Jelenlegi állapot
- általános, teljes appra kiterjedő PascalCase/camelCase mapper nincs
- az order domainben már van normalizáló réteg (`normalizeOrderDto` minta)
- a menü/admin entity-k többsége továbbra is backend-alakú DTO-kkal dolgozik

### Döntési pont
- ha van backend hozzáférés, a backend oldali `camelCase` serializer policy a tisztább megoldás
- ha nincs, akkor frontend oldalon az API boundary-ban kell entity-csoportonként normalizálni

### Javasolt ütemezés
1. kategóriák / készételek / köretek / üdítők
2. menük
3. admin CRUD payloadok
4. auth / profile payloadok

### Kockázat
Nagy churn, ezért egyszerre csak egy entity-családot érdemes átállítani.

---

## 3) CSRF védelem — állapot: lezárt / jelenleg nem szükséges

### Döntés
A jelenlegi JWT Bearer + `Authorization` header alapú megoldás mellett külön CSRF token bevezetése nem szükséges.

### Mikor kell újranyitni
Ha az auth valaha cookie-alapúvá válik, akkor ez a téma újra előkerül, és XSRF token szükséges lesz.

---

## 4) Pinia — State Management migráció

### Állapot
Még nincs elkezdve.

### Ami ezt jelzi
- nincs `pinia` dependency
- nincs `src/stores/` mappa
- a shared state továbbra is module-szintű singleton `ref` mintával fut a composable-ökben

### Megítélés
Ez jelenleg inkább DX / tesztelhetőség / jövőbeli SSR téma, nem sürgős funkcionális hiány.

### Ha egyszer elindul
1. `useAuth.js`
2. `useCart.js`
3. `useMenuData.js`
4. `useOrderColumns.js`
5. `useMenuImageCache.js`

---

## 5) Refactor / performance follow-up backlog — frissített állapot

### Az eredeti listából már elkészült
- `useAdminBulkFailurePrompt` extraction megtörtént
- `useAdminDataLoader` extraction megtörtént
- `useAdminEntityConfigs` szét lett bontva kisebb modulokra
- admin modalok async importtal töltődnek
- több public komponens async importtal töltődik
- dev-only ServerDiscovery már lazy boundary mögött van

### Továbbra is nyitott
- `AdminDashboard.vue` még mindig túl sok edit/delete orchestration logikát tartalmaz
- az admin modal event surface még mindig zajos a parent és child komponensek között
- `EmployeeOrders.vue` még mindig statikusan importálja a `vuedraggable` csomagot
- a SignalR boundary még nem lazy, mert a `useSignalR.js` statikusan importálja a csomagot
- nincs teszt setup könnyű component smoke / behavior tesztekhez
- az operation feedback success/error szövegek még több helyen duplikáltak
- a composable naming / layout konvenciók README dokumentálása még nyitott

### Javasolt következő sorrend
1. `vuedraggable` lazy-load az employee nézethez
2. SignalR lazy boundary route- vagy feature-szinten
3. `AdminDashboard` edit/delete orchestration további kiszervezése composable-ökbe
4. admin i18n sweep
5. lightweight smoke / behavior teszt alapok

### Teszt megjegyzés
Jelenleg nincs bevezetett frontend teszt runner a projektben, ezért a tesztes backlog első lépése maga a minimális teszt infrastruktúra kiválasztása.
