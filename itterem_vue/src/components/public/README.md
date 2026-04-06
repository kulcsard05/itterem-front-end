# Public Components

English version: [README.en.md](./README.en.md)

Ez a mappa a vendégoldali, publikus élmény komponenseit tartalmazza: az étlap böngészését, a termék részletező nézetet, a gyorsrendelési modalt, az információs oldalakat és az ezekhez tartozó kisebb UI építőelemeket.

- Ez a projekt elsődleges customer-facing felülete: a legtöbb látogató először ezekkel a komponensekkel találkozik.
- A mappa egyszerre tartalmaz route-szintű nézeteket és kisebb, újrahasznosítható publikus UI elemeket.
- A nehezebb állapotkezelés és adat-előkészítés jellemzően composable-okba van kiszervezve, ezért a komponensek többsége inkább orchestration és prezentáció.

## Hogyan illeszkedik a projektbe

- A publikus route-ok regisztrációja a [../../router.js](../../router.js) fájlban történik: `/` -> `MenuView`, `/item` -> `MenuItemPage`, `/about` -> `AboutUs`, catch-all -> `NotFound`.
- A teljes oldalkeretről a [../../App.vue](../../App.vue) gondoskodik. Az App adja a fejlécet, a `router-view` eseménykezelőit, a kosár drawer-t és a globális láblécet is.
- A publikus menüadatok közös, modul-szintű store-szerű forrása a [../../composables/useMenuData.js](../../composables/useMenuData.js). Ez kezeli a localStorage cache-t, az adatkészletek összehangolását és a képreferenciák perzisztálását.
- A hálózati frissítés logikája a [../../composables/useMenuCatalogRefresh.js](../../composables/useMenuCatalogRefresh.js) composable-ban van. Ez endpointonként végez feltételes lekérést, státuszkövetést és háttérben képcache-elést.
- A menüelemek megjelenítéséhez szükséges közös név, ár, kép, meta és menüfelbontás logikát a [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js) és a [../../menu/menu-utils.js](../../menu/menu-utils.js) adja.
- A legtöbb képes publikus komponens a [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue) közös komponenst használja, ezért a képbetöltési/fallback viselkedés itt is egységes.

## Publikus felhasználói folyamat

1. A [MenuView.vue](./MenuView.vue) cache-ből és API-ból felépíti az étlapot, majd tabok és listák szerint kirendereli a termékeket.
2. Ha a felhasználó megnyit egy elemet, a `MenuView` `open-item` eseményt küld az [../../App.vue](../../App.vue) felé. Az App eltárolja a kiválasztott elemet `sessionStorage`-ban, majd átnavigál a `MenuItemPage` route-ra.
3. A [MenuItemPage.vue](./MenuItemPage.vue) nem önálló `id` alapú lekérést végez. A route a szülőből kapott `itemData` propra támaszkodik, ezért közvetlen megnyitáskor visszalép a menüre, ha nincs elérhető állapot.
4. A kosárba helyezés két útvonalon történik: a normál flow az App felé küld `add-to-cart` eseményt, a gyorsrendelés pedig a [QuickBuyModal.vue](./QuickBuyModal.vue) komponensben közvetlen rendelésleadást indít.
5. A [FooterSection.vue](./FooterSection.vue) nem csak az `about` oldalon jelenik meg: az [../../App.vue](../../App.vue) mountolja minden nem employee nézet alatt, ezért ez gyakorlatilag az egész publikus shell része.

## Komponensreferencia

### [MenuView.vue](./MenuView.vue)

- Cél: a fő étlapoldal és a publikus termékkatalógus központi konténerkomponense.
- Hogyan működik: `defineAsyncComponent` segítségével lusta betöltéssel húzza be a kisebb publikus segédkomponenseket, például az [AsyncStatePanel.vue](./AsyncStatePanel.vue), [EndpointStatusBadges.vue](./EndpointStatusBadges.vue), [MenuAddToCartButton.vue](./MenuAddToCartButton.vue), [MenuItemCardShell.vue](./MenuItemCardShell.vue), [MenuQuickOrderButton.vue](./MenuQuickOrderButton.vue) és [QuickBuyModal.vue](./QuickBuyModal.vue) fájlokat. Ez csökkenti a kezdeti bundle terhelést.
- Hogyan működik: a közös menüadathalmazokat a [../../composables/useMenuData.js](../../composables/useMenuData.js) composable-ból olvassa. Ezért a publikus menü, a kosárhidratálás és más fogyasztók ugyanazokra a reaktív datasetekre támaszkodnak.
- Hogyan működik: a [../../composables/useMenuCatalogRefresh.js](../../composables/useMenuCatalogRefresh.js) segítségével végez frissítést, ami endpointonként külön tölti a kategóriákat, készételeket, köreteket, menüket és üdítőket. A komponens ennek állapotát használja loading, error és debug státusz megjelenítéshez.
- Hogyan működik: az aktív tabot a [../../composables/usePersistedMenuTab.js](../../composables/usePersistedMenuTab.js) perzisztálja localStorage-ba, így oldalfrissítés után is ugyanott marad a felhasználó.
- Hogyan működik: a készétel szekciókat a [../../composables/useMealSections.js](../../composables/useMealSections.js) állítja össze kategóriák alapján. Emiatt a komponensnek nem kell kézzel kezelnie, hogy a backend nested kategória-adatot vagy lapos meal listát adott-e vissza.
- Hogyan működik: az elemekből detail payloadot a [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js) gyárt. Ugyanez a réteg számolja a menük meta sorát, az összetevő címkéket és a felbontott meal/side/drink adatokat is.
- Hogyan működik: az `add to cart` visszajelzés animációját a [../../composables/useTransientSetAnimation.js](../../composables/useTransientSetAnimation.js) kezeli kulcs-alapon, ezért több kártya animációja külön-külön is stabilan vezérelhető.
- Hogyan működik: a komponens nem maga módosítja a globális kosarat. Ehelyett `open-item` és `add-to-cart` eseményeket küld felfelé az [../../App.vue](../../App.vue) felé, ahol a route váltás és a kosárkezelés ténylegesen történik.
- Hogyan működik: a gyorsrendeléshez lokálisan nyitja a [QuickBuyModal.vue](./QuickBuyModal.vue) modalt, mert ez a flow nem a normál kosárba helyezésen keresztül fut.
- Fő függőségek: [../../composables/useMenuData.js](../../composables/useMenuData.js), [../../composables/useMenuCatalogRefresh.js](../../composables/useMenuCatalogRefresh.js), [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js), [../../composables/usePersistedMenuTab.js](../../composables/usePersistedMenuTab.js), [../../composables/useMealSections.js](../../composables/useMealSections.js), [../../composables/useTransientSetAnimation.js](../../composables/useTransientSetAnimation.js), [../../composables/useCart.js](../../composables/useCart.js), [../../composables/useAuth.js](../../composables/useAuth.js), [../../composables/useMenuImageCache.js](../../composables/useMenuImageCache.js), [../../storage/menu-etags.js](../../storage/menu-etags.js).

### [MenuItemPage.vue](./MenuItemPage.vue)

- Cél: a kiválasztott étel, köret, ital vagy menü részletes nézete.
- Hogyan működik: a komponens `itemData` propot kap a route shellből, amit az [../../App.vue](../../App.vue) ad át a `router-view`-nak. Ha ez hiányzik, a komponens visszanavigál a menüre, tehát ez jelenleg nem klasszikus mélylinkelhető részletező oldal.
- Hogyan működik: a menü típusú elemeknél a komponens a payload `menuBreakdown` mezőjét használja arra, hogy a meal/side/drink részek külön-külön is megnyithatók legyenek. Ez az `open-item` eseményen keresztül visszacsatol a szülő navigációs logikájába.
- Hogyan működik: a képet a [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue) jeleníti meg, ezért a hiányzó vagy későn érkező kép ugyanazzal a fallback viselkedéssel jelenik meg, mint a kártyanézetekben.
- Hogyan működik: az összetevők megjelenítését saját lokális UI állapottal kapcsolja ki-be, a kosárba helyezést pedig nem saját maga végzi el, hanem `add-to-cart` eseményt küld felfelé.
- Hogyan működik: a vissza gomb a `back` eseményt használja, amit az [../../App.vue](../../App.vue) a menü route-ra fordít le.
- Fő függőségek: [../../App.vue](../../App.vue), [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue), [../../shared/utils.js](../../shared/utils.js), [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js) által előállított payload struktúra.

### [QuickBuyModal.vue](./QuickBuyModal.vue)

- Cél: gyorsrendelési modal azoknak a felhasználóknak, akik egyetlen tételt közvetlenül, kosár használata nélkül akarnak leadni.
- Hogyan működik: a komponens a kiválasztott item payloadból dolgozik, megjeleníti az elem nevét, árát, képét és a mennyiséget, majd közvetlenül rendelési API hívást indít.
- Hogyan működik: a rendelés előtt ellenőrzi, hogy van-e érvényes felhasználó és rendelhető elem. A mennyiség kezelését a [../../config/constants.js](../../config/constants.js) `MAX_ORDER_QUANTITY` konstansa korlátozza.
- Hogyan működik: az API hívást a [../../services/api.js](../../services/api.js) `placeOrder` függvényén keresztül küldi el, de ezt a [../../composables/usePromiseTimeout.js](../../composables/usePromiseTimeout.js) timeout wrapperével futtatja. Így a felület külön tud kezelni lassú backend választ és tényleges hibát.
- Hogyan működik: a backend payload összeállításánál shared helper függvényeket használ a [../../shared/utils.js](../../shared/utils.js) rétegből, például felhasználó- és itemazonosító feloldáshoz. Emiatt a modal nem duplikálja a rendelési normalizációs logikát.
- Hogyan működik: a sikeres és hibás állapotot lokálisan kezeli, majd `close` eseménnyel zárható. Ez tudatosan különálló flow a normál kosárkezeléstől.
- Fő függőségek: [../../services/api.js](../../services/api.js), [../../composables/usePromiseTimeout.js](../../composables/usePromiseTimeout.js), [../../config/constants.js](../../config/constants.js), [../../shared/utils.js](../../shared/utils.js), [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue).

### [AboutUs.vue](./AboutUs.vue)

- Cél: a publikus bemutatkozó oldal, amely a márkát, történetet, értékeket és csapattagokat mutatja be.
- Hogyan működik: a tartalom nem backendből jön, hanem teljesen az i18n rétegből épül fel. A komponens a fordítási kulcsokból összeállított struktúrákat rendereli ki.
- Hogyan működik: a csapattag lista is locale-alapú adatokból készül, ezért a komponens szöveges tartalma nyelvváltáskor újrarenderelődik külön kézi mapping réteg nélkül.
- Hogyan működik: nincs benne API hívás, globális store-logika vagy route-őr. Ez egy tisztán tartalomközpontú publikus nézet.
- Fő függőségek: [../../i18n.js](../../i18n.js), [../../locales/hu.json](../../locales/hu.json), [../../locales/en.json](../../locales/en.json).

### [AsyncStatePanel.vue](./AsyncStatePanel.vue)

- Cél: kis wrapper komponens a loading, error és empty állapot egységes megjelenítésére.
- Hogyan működik: három állapotpropot fogad (`isLoading`, `errorText`, `isEmpty`), és prioritás alapján választja ki, hogy melyik panelt renderelje. Ha egyik állapot sem aktív, akkor az alapértelmezett slot tartalmát mutatja.
- Hogyan működik: a komponens sem adatbetöltést, sem hibaértelmezést nem végez. A szülő kizárólag kész állapotjeleket ad át neki.
- Hol használja a projekt: jelenleg a [MenuView.vue](./MenuView.vue) több listanézetében.
- Fő függőségek: nincs üzleti logikai függősége.

### [EndpointStatusBadges.vue](./EndpointStatusBadges.vue)

- Cél: kis diagnosztikai badge-sor az egyes menü endpointok frissítési státuszának megmutatására.
- Hogyan működik: egy `items` tömböt és egy `statusByKey` objektumot kap, majd minden elemhez kiírja az adott státuszértéket. Maga nem számol státuszt, csak megjeleníti azt.
- Hogyan működik: a komponens akkor hasznos, amikor a [MenuView.vue](./MenuView.vue) fejlesztői vagy debug nézetében külön látni kell, hogy melyik adatkészlet jött `200`, `304` vagy hibás állapottal.
- Fő függőségek: nincs külön logikai függősége; teljesen propvezérelt.

### [FooterSection.vue](./FooterSection.vue)

- Cél: az alkalmazás publikus lábléce márkanévvel, kapcsolati adatokkal, nyitvatartással és térképpel.
- Hogyan működik: a statikus tartalom nagy része fordítási kulcsból jön, a komponens csak az aktuális évet számolja ki lokálisan.
- Hogyan működik: a kontakt linkek (`tel:`, `mailto:`) és a Google Maps iframe közvetlenül a template-ben vannak rögzítve, tehát ezek jelenleg nem adminból konfigurálható adatok.
- Hogyan működik: bár fizikailag a `public` mappában van, ténylegesen az [../../App.vue](../../App.vue) használja shell-szinten minden nem employee route alatt.
- Fő függőségek: [../../App.vue](../../App.vue), [../../i18n.js](../../i18n.js), [../../locales/hu.json](../../locales/hu.json), [../../locales/en.json](../../locales/en.json).

### [MenuAddToCartButton.vue](./MenuAddToCartButton.vue)

- Cél: egységes „kosárba” CTA a menükártyákon.
- Hogyan működik: a `count` prop alapján vált színt és ikont, így ugyanaz a gomb tudja jelezni, hogy az adott tételből már került valami a kosárba.
- Hogyan működik: maga a komponens nem ismeri a kosár állapotát, csak a kapott számot és labelt rendereli. Kattintáskor egyszerűen `add` eseményt bocsát ki.
- Hogyan működik: az `isAnimating` prop egy CSS `cart-pop` animációt kapcsol rá. Ennek triggerelését a szülő, tipikusan a [MenuView.vue](./MenuView.vue), a [../../composables/useTransientSetAnimation.js](../../composables/useTransientSetAnimation.js) segítségével vezérli.
- Fő függőségek: nincs üzleti logikai függősége; teljesen prop- és event-alapú.

### [MenuItemCardShell.vue](./MenuItemCardShell.vue)

- Cél: közös kártyakeret a publikus étlap elemeihez.
- Hogyan működik: a szöveges és akciós tartalom sloton keresztül érkezik, a képrész viszont standardizáltan a [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue) komponenssel jelenik meg.
- Hogyan működik: a komponens teljes felülete kattintható, és `open` eseményt bocsát ki. Emiatt a navigációs döntés a szülőnél marad, a kártya maga csak egységes vizuális konténer.
- Hogyan működik: a `group` class miatt a belső elemek, például a [MenuQuickOrderButton.vue](./MenuQuickOrderButton.vue), hover-állapotokra tudnak reagálni.
- Fő függőségek: [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue).

### [MenuQuickOrderButton.vue](./MenuQuickOrderButton.vue)

- Cél: másodlagos CTA a gyorsrendelési flow indításához.
- Hogyan működik: kizárólag egy label propot fogad és `quick-order` eseményt küld. Nem kezel modalt és nem beszél API-val.
- Hogyan működik: mobilon mindig látható, nagyobb képernyőn viszont csak hoverra jelenik meg, ezért jól illeszkedik a kártyás lista progresszív feltárásához.
- Hol használja a projekt: a [MenuView.vue](./MenuView.vue) a kártyákon.
- Fő függőségek: nincs külön logikai függősége.

### [NotFound.vue](./NotFound.vue)

- Cél: catch-all 404 oldal minden nem létező publikus route-ra.
- Hogyan működik: a szövegek fordításból jönnek, a visszalépés pedig a Vue Routeren keresztül a menü route-ra navigál.
- Hogyan működik: nincs saját üzleti logikája, de fontos UX biztosíték, hogy a felhasználó zsákutca helyett vissza tudjon térni az elsődleges publikus felületre.
- Fő függőségek: [../../router.js](../../router.js), [../../i18n.js](../../i18n.js).

## Kapcsolódó fájlok, amelyeket érdemes együtt olvasni

- [../../App.vue](../../App.vue), mert itt dől el a publikus route-komponensek eseménykezelése, a `selectedMenuItem` session-tárolása és a globális `FooterSection` mountolása.
- [../../router.js](../../router.js), mert ez mutatja meg, melyik publikus komponens milyen URL-ről érkezik.
- [../../composables/useMenuData.js](../../composables/useMenuData.js), [../../composables/useMenuCatalogRefresh.js](../../composables/useMenuCatalogRefresh.js), [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js), [../../composables/usePersistedMenuTab.js](../../composables/usePersistedMenuTab.js) és [../../composables/useMealSections.js](../../composables/useMealSections.js), mert a publikus menüviselkedés lényegi része ezekben van.
- [../../composables/useTransientSetAnimation.js](../../composables/useTransientSetAnimation.js), mert ez magyarázza a kosárgomb rövid állapotanimációját.
- [../../composables/usePromiseTimeout.js](../../composables/usePromiseTimeout.js), mert ez magyarázza a gyorsrendelési timeout kezelést.
- [../../services/api.js](../../services/api.js), mert a `QuickBuyModal` közvetlenül innen rendel.
- [../../menu/menu-utils.js](../../menu/menu-utils.js) és [../../shared/utils.js](../../shared/utils.js), mert a publikus nézetek által használt item/meta/helper logika több ponton innen jön.
- [../common/ImageWithFallback.vue](../common/ImageWithFallback.vue), mert a publikus UI képes részei nagyrészt erre épülnek.

## Karbantartási szabályok

- A route-szintű üzleti orchestration maradjon a nagyobb publikus konténerekben vagy composable-okban. A kisebb gomb- és shell-komponensek maradjanak egyszerűek.
- Ha új publikus nézetnek menüitem payload kell, ne építs külön adatformátumot. Használd a [../../composables/useMenuItemPresentation.js](../../composables/useMenuItemPresentation.js) közös struktúráját.
- Ha új állapotpanelre van szükség, először nézd meg, hogy az [AsyncStatePanel.vue](./AsyncStatePanel.vue) bővíthető-e, mielőtt új párhuzamos mintát hozol létre.
- A `MenuItemPage` jelenlegi session-alapú route szerződése fontos korlát. Ha később valódi deep link támogatás kell, azt nem ebben az egy komponensben, hanem az [../../App.vue](../../App.vue), [../../router.js](../../router.js) és az adatbetöltési flow együttmódosításával kell megoldani.
