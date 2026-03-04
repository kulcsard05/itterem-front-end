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
