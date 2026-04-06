# User Components

English version: [README.en.md](./README.en.md)

Ez a mappa a bejelentkezett felhasználói élményhez tartozó komponenseket tartalmazza: a fiókoldalt, a login és regisztrációs űrlapokat, valamint a globális kosár drawer-t és rendelésleadási felületet.

- A mappa nem csak route-komponenst tartalmaz. A [CartDrawer.vue](./CartDrawer.vue) például nem az `/account` route része, hanem az [../../App.vue](../../App.vue) shell-szintű komponense.
- A fő funkcionális területek itt: auth belépési flow, profiladat-kezelés, saját rendelések megjelenítése, és a kosárból történő checkout.
- A user terület erősen támaszkodik megosztott singleton composable-okra, főleg a [../../composables/useAuth.js](../../composables/useAuth.js), [../../composables/useCart.js](../../composables/useCart.js) és [../../composables/useSignalR.js](../../composables/useSignalR.js) rétegre.

## Hogyan illeszkedik a projektbe

- Az account oldal route-ja a [../../router.js](../../router.js) fájlban van regisztrálva: `/account` -> [UserPage.vue](./UserPage.vue).
- Az [../../App.vue](../../App.vue) a `router-view` számára `auth` propot ad át, ezért a `UserPage` nem maga olvassa közvetlenül a globális auth store-t route-szinten, hanem a szülőtől kapja a jelenlegi auth állapotot.
- Ugyanaz az [../../App.vue](../../App.vue) mountolja a [CartDrawer.vue](./CartDrawer.vue) komponenst is minden nem employee nézet alatt. Emiatt a kosár UX a teljes publikus shell része, nem csak a fiókoldalhoz kötött feature.
- A beléptetés és a regisztráció az [../../services/api.js](../../services/api.js) auth végpontjaira támaszkodik, de a session perzisztálását és lejáratkezelését a [../../composables/useAuth.js](../../composables/useAuth.js) végzi.
- A saját rendeléslista és a kosár két külön adatút: a `UserPage` a `getOwnOrders` API-t használja a historikus/meglévő rendelésekhez, míg a `CartDrawer` a [../../composables/useCart.js](../../composables/useCart.js) singleton állapotából építi a checkout payloadot.
- A felhasználói rendelésfrissítések realtime oldalon a [../../composables/useSignalR.js](../../composables/useSignalR.js) segítségével érkeznek, és a statusznormalizálás a [../../domain/order/order-dto.js](../../domain/order/order-dto.js) rétegen keresztül történik.

## Felhasználói folyamat

1. A felhasználó az `/account` route-on a [UserPage.vue](./UserPage.vue) komponensbe érkezik.
2. Ha nincs bejelentkezve, a `UserPage` lokálisan váltogat a [Login.vue](./Login.vue) és a [Register.vue](./Register.vue) között.
3. Sikeres login után a `UserPage` `login-success` eseményt küld felfelé, az [../../App.vue](../../App.vue) pedig a [../../composables/useAuth.js](../../composables/useAuth.js) `setAuth` műveletével eltárolja az auth állapotot.
4. Bejelentkezett normál felhasználónál a `UserPage` betölti a saját rendeléseket és a szükséges menükatalógus-részleteket, hogy a rendelési tételekből újra megnyitható publikus item payloadot tudjon képezni.
5. A kosárkezelés nem a `UserPage` része: a [CartDrawer.vue](./CartDrawer.vue) az [../../App.vue](../../App.vue) fejlécéből nyílik, a [../../composables/useCart.js](../../composables/useCart.js) állapotát jeleníti meg, majd közvetlen rendelést ad le.

## Komponensreferencia

### [UserPage.vue](./UserPage.vue)

- Cél: az account route központi konténere, amely egyaránt kezeli az auth nélküli belépési felületet és a bejelentkezett felhasználó profil/rendelés nézetét.
- Hogyan működik: a komponens egy `auth` propot kap az [../../App.vue](../../App.vue) felől. Ennek alapján dönti el, hogy a login/register képernyőt vagy a felhasználói profiloldalt renderelje.
- Hogyan működik: auth nélküli állapotban nem route-váltással kezeli a login és register nézetet, hanem lokális `currentForm` state alapján vált a [Login.vue](./Login.vue) és a [Register.vue](./Register.vue) között. Ez egyszerűen tartja az auth UX-et, és nem igényel külön route-okat.
- Hogyan működik: bejelentkezett állapotban a komponens nem csak profiladatot mutat. A telefonszám szerkesztését is kezeli, validálja az inputot, majd az [../../services/api.js](../../services/api.js) `updatePhone` hívásán keresztül ment. Siker után `login-success` eseménnyel frissíti a felső auth állapotot, hogy az [../../composables/useAuth.js](../../composables/useAuth.js) singleton is az új értéket tárolja.
- Hogyan működik: normál usernél betölti a saját rendeléseket a `getOwnOrders` API-val, az eredményt a [../../domain/order/order-dto.js](../../domain/order/order-dto.js) `normalizeOrderDto` függvényein futtatja át, majd dátum szerint rendezi.
- Hogyan működik: admin és employee account esetén tudatosan nem tölti be sem a saját rendeléseket, sem a publikus itemkatalógusokat. Ez összhangban van a router szerepkör-logikájával és az employee guarddal a [../../router.js](../../router.js) fájlban.
- Hogyan működik: a rendelési tételek kattinthatók. A komponens ehhez betölti a meal/side/menu/drink katalógusokat, majd a [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js) `createItemPayload` függvényével olyan payloadot épít, amit az [../../App.vue](../../App.vue) ugyanúgy tud továbbadni a publikus [../public/MenuItemPage.vue](../public/MenuItemPage.vue) felé, mintha a felhasználó közvetlenül az étlapról nyitotta volna meg az elemet.
- Hogyan működik: realtime rendelésstátusz-frissítésekhez feliratkozik az `OrderUpdated` SignalR eseményre a [../../composables/useSignalR.js](../../composables/useSignalR.js) `on` API-ján keresztül. A beérkező payload feldolgozásához az `extractOrderUpdateEvent` helper-t használja, majd vagy azonnal frissíti a státuszt, vagy újratölti a saját rendeléseket, és rövid success notice-t jelenít meg.
- Hogyan működik: a rendelésstátuszt a [../common/OrderStatusBadge.vue](../common/OrderStatusBadge.vue) jeleníti meg, így a státuszszínek és badge megjelenés a user és admin felület között egységes marad.
- Fő függőségek: [../../App.vue](../../App.vue), [../../router.js](../../router.js), [../../services/api.js](../../services/api.js), [../../composables/useSignalR.js](../../composables/useSignalR.js), [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js), [../../domain/order/order-dto.js](../../domain/order/order-dto.js), [../../shared/utils.js](../../shared/utils.js), [../common/OrderStatusBadge.vue](../common/OrderStatusBadge.vue), [../public/MenuItemPage.vue](../public/MenuItemPage.vue).

### [CartDrawer.vue](./CartDrawer.vue)

- Cél: globális jobb oldali drawer a kosár tartalmának megjelenítésére és a checkout indítására.
- Hogyan működik: a komponens `open` és `auth` propokat kap az [../../App.vue](../../App.vue) felől. Maga nem dönti el, mikor van nyitva, csak a szülő shell által kezelt állapotot rendereli.
- Hogyan működik: a teljes kosárállapotot a [../../composables/useCart.js](../../composables/useCart.js) singletonból olvassa. Emiatt ugyanaz a kosár adatforrás szolgálja ki a publikus étlap kosárgombjait és a drawer checkout felületét is.
- Hogyan működik: a tételszintű mennyiségkezelést nem saját lokális másolaton végzi, hanem közvetlenül a `useCart` `addItem`, `decrementItem`, `removeItem` és `clearCart` műveleteit hívja. Ez biztosítja, hogy a drawer és a többi kosárfüggő UI mindig szinkronban maradjon.
- Hogyan működik: rendeléskor a [../../composables/useCart.js](../../composables/useCart.js) `buildOrderItems` függvényével állítja elő az API payloadot, majd az [../../services/api.js](../../services/api.js) `placeOrder` végpontjára küldi. A folyamatot a [../../composables/usePromiseTimeout.js](../../composables/usePromiseTimeout.js) timeout wrapper védi, ezért a lassú backend válasz külön kezelhető user-facing hibává válik.
- Hogyan működik: ha nincs bejelentkezett user vagy a kosár nem tartalmaz érvényes tételt, a komponens nem enged rendelni. A user azonosítót a [../../shared/utils.js](../../shared/utils.js) `resolveUserId` helperével oldja fel.
- Hogyan működik: sikeres rendelés után success állapotot mutat, törli a kosarat, majd `order-success` eseményt küld a szülő felé. A drawer lezárása ettől még továbbra is az [../../App.vue](../../App.vue) felelőssége marad.
- Hogyan működik: a termékképekhez a [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue) komponenst használja, miközben a tényleges képforrást a `useCart` `resolveImage` helper adja.
- Fő függőségek: [../../App.vue](../../App.vue), [../../composables/useCart.js](../../composables/useCart.js), [../../composables/usePromiseTimeout.js](../../composables/usePromiseTimeout.js), [../../services/api.js](../../services/api.js), [../../shared/utils.js](../../shared/utils.js), [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue).

### [Login.vue](./Login.vue)

- Cél: a belépési űrlap a nem autentikált account nézethez.
- Hogyan működik: lokális reaktív state-ben tartja az email, jelszó, loading és field error állapotot. Nem tárol auth sessiont és nem módosít globális state-et közvetlenül.
- Hogyan működik: a mezővalidáció kliensoldalon történik, az email formátumát a [../../shared/utils.js](../../shared/utils.js) `isValidEmail` helperrel ellenőrzi. A validációt `watch` figyeli, de csak az első submit kísérlet után, így az űrlap nem zajos rögtön betöltéskor.
- Hogyan működik: sikeres submit esetén az [../../services/api.js](../../services/api.js) `login` függvényét hívja, majd a visszakapott user payloadot `login-success` eseményben felfelé adja. A tényleges session-perzisztálás nem itt történik, hanem a szülőn keresztül a [../../composables/useAuth.js](../../composables/useAuth.js) rétegben.
- Hogyan működik: a komponens `switch` eseménnyel kéri a [UserPage.vue](./UserPage.vue) szülőtől a regisztrációs nézetre váltást.
- Fő függőségek: [../../services/api.js](../../services/api.js), [../../shared/utils.js](../../shared/utils.js), [UserPage.vue](./UserPage.vue).

### [Register.vue](./Register.vue)

- Cél: új account létrehozására szolgáló regisztrációs űrlap.
- Hogyan működik: a komponens lokálisan kezeli a teljes form state-et, beleértve a success és error visszajelzéseket is. A mezővalidációban emailhez és telefonszámhoz shared helper függvényeket használ, a jelszó minimumhosszt pedig a [../../config/constants.js](../../config/constants.js) `PASSWORD_MIN_LENGTH` konstansából veszi.
- Hogyan működik: submitkor az [../../services/api.js](../../services/api.js) `register` végpontjára küld payloadot. Fontos részlet, hogy a backend mezőnév itt `telefonSzam` alakban kerül küldésre, ezért ezt a szerződést dokumentáltan érdemes megőrizni.
- Hogyan működik: sikeres regisztráció után nem léptet be automatikusan. Ehelyett success üzenetet mutat, reseteli az űrlapot, majd rövid timeout után `switch` eseménnyel visszaküldi a felhasználót a login nézetre.
- Hogyan működik: a timeout takarítását `onUnmounted` kezeli, hogy a nézetváltás után ne maradjon lógó timer.
- Fő függőségek: [../../services/api.js](../../services/api.js), [../../shared/utils.js](../../shared/utils.js), [../../config/constants.js](../../config/constants.js), [UserPage.vue](./UserPage.vue).

## Kapcsolódó fájlok, amelyeket érdemes együtt olvasni

- [../../App.vue](../../App.vue), mert itt történik az `auth` prop átadása a `UserPage` felé, a `login-success` és `logout` események feldolgozása, valamint a `CartDrawer` shell-szintű mountolása.
- [../../router.js](../../router.js), mert ez mutatja az account route helyét és az employee/admin jogosultsági logikát.
- [../../composables/useAuth.js](../../composables/useAuth.js), mert ez a session-perzisztálás, szerepkörszámítás és auth lejárat központi singletonja.
- [../../composables/useCart.js](../../composables/useCart.js), mert a drawer működésének lényege itt van: storage-hidratálás, mennyiségkezelés és order payload építés.
- [../../composables/useSignalR.js](../../composables/useSignalR.js), mert ez magyarázza a felhasználói rendelésfrissítések realtime viselkedését.
- [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js), mert a `UserPage` ezzel alakítja át a rendelési tételeket újranyitható publikus item payloadokká.
- [../../services/api.js](../../services/api.js), mert a login, register, updatePhone, getOwnOrders és placeOrder hívások innen jönnek.
- [../../domain/order/order-dto.js](../../domain/order/order-dto.js) és [../../domain/order/order-utils.js](../../domain/order/order-utils.js), mert a user saját rendeléslistája ezek normalizált alakjára támaszkodik.
- [../common/OrderStatusBadge.vue](../common/OrderStatusBadge.vue) és [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue), mert a user felület két fontos közös UI primitívje ezekre épül.
- [../public/MenuItemPage.vue](../public/MenuItemPage.vue), mert a `UserPage` rendelési tételeinek navigációja végül ugyanebbe a publikus részletező flow-ba vezet.

## Karbantartási szabályok

- Az auth állapot forrása maradjon egyértelműen a [../../composables/useAuth.js](../../composables/useAuth.js). A login és register komponensek ne kezdjenek saját session-logikát építeni.
- A kosár UI és a checkout payload ne duplikálja a `useCart` logikáját. Ha új kosárfelület kell, azt ugyanarra a singleton API-ra építsd.
- A `UserPage` order-entry -> menu-item navigációja érzékeny szerződés: ha az item payload formátuma változik, azt a [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js) és az [../../App.vue](../../App.vue) flow-jával együtt kell kezelni.
- Az employee/admin kivételeket őrizd meg. A jelenlegi viselkedés szerint a saját rendeléslista és a publikus itemkatalógusok csak normál user accountnál töltődnek be.
