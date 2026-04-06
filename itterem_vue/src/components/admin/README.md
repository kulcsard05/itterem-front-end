# Admin Components

English version: [README.en.md](./README.en.md)

Ez a mappa tartalmazza az éttermi frontend szerepkörhöz kötött operációs felületét.

- Az adminisztrátori CRUD felület az `/admin` útvonalon érhető el a [../../router.js](../../router.js) fájlon keresztül, és az [AdminDashboard.vue](./AdminDashboard.vue) komponenst rendereli.
- A dolgozói rendeléskezelő felület a `/rendeleskezeles` útvonalon érhető el a [../../router.js](../../router.js) fájlon keresztül, és az [EmployeeOrders.vue](./EmployeeOrders.vue) komponenst rendereli.
- Az útvonalvédelmet a [../../composables/useAuth.js](../../composables/useAuth.js) közös auth állapota és a [../../shared/utils.js](../../shared/utils.js) permission-denied értesítései biztosítják.
- Minden backend kommunikáció a [../../services/api.js](../../services/api.js) rétegen keresztül történik. Ezek a Vue fájlok az állapotot és a UI-t szervezik, de nem írnak közvetlen fetch logikát a template szintjén.

## Hogyan illeszkedik az admin rész a projektbe

- A projekt egy Vue 3 alkalmazás publikus böngészéssel, fiókoldalakkal, admin dashboarddal és dolgozói műveleti táblával. Az admin mappa ennek az alkalmazásnak az operációs része, nem különálló alprojekt.
- Az [AdminDashboard.vue](./AdminDashboard.vue) konfigurációvezérelt. Nem hardcode-olja az oszlopokat, űrlapmezőket vagy CRUD payload szabályokat entitásonként. Ehelyett ezeket a [../../composables/useAdminEntityConfigs.js](../../composables/useAdminEntityConfigs.js) fájlból olvassa, amely továbbdelegál a [../../composables/admin-entity-configs/buildEntityConfigs.js](../../composables/admin-entity-configs/buildEntityConfigs.js) fájlra és a [../../composables/admin-entity-configs](../../composables/admin-entity-configs) mappában lévő entitás-specifikus konfigurációkra.
- Az [EmployeeOrders.vue](./EmployeeOrders.vue) állapotközpontú és valós idejű működésre épül. Pollingot, SignalR feliratkozásokat, drag-and-drop státuszváltásokat, DTO normalizálást és lokális preference-perzisztenciát kombinál.
- A közös admin CRUD szabályok a [../../admin/admin-helpers.js](../../admin/admin-helpers.js) fájlban élnek. A közös rendelés-normalizálási szabályok a [../../domain/order/order-dto.js](../../domain/order/order-dto.js) és [../../domain/order/order-utils.js](../../domain/order/order-utils.js) fájlokban vannak.

## Admin CRUD folyamat

- Az [AdminDashboard.vue](./AdminDashboard.vue) definiálja a látható füleket: rendelések, menük, kategóriák, hozzávalók, készételek, köretek és üdítők.
- Az adatok a [../../composables/useAdminDataLoader.js](../../composables/useAdminDataLoader.js) segítségével töltődnek be, amely először a [../../storage/admin-cache.js](../../storage/admin-cache.js) alapján hidratál, majd frissít a [../../services/api.js](../../services/api.js) felől.
- Az aktív entitás definíciója a [../../composables/useAdminEntityConfigs.js](../../composables/useAdminEntityConfigs.js) fájlból érkezik. Ez a konfiguráció adja az oszlopokat, űrlapmezőket, validátorokat, payload builder függvényeket, API hívásokat és a bulk műveleti képességeket.
- Az [AdminTable.vue](./AdminTable.vue) rendereli az aktuális fület ezekkel a konfiguráció-alapú oszlopokkal.
- Az [AdminEditModal.vue](./AdminEditModal.vue) és az [AdminFormField.vue](./AdminFormField.vue) ugyanebből a konfigurációból renderel dinamikus űrlapokat.
- Az [AdminBulkEditModal.vue](./AdminBulkEditModal.vue) csak azokat a tömeges műveleteket mutatja, amelyeket az aktuális entitástípus támogat.
- A [ConfirmModal.vue](./ConfirmModal.vue) újrahasznosított komponens egyedi törléshez, tömeges törléshez és bulk hiba utáni folytatás-megerősítéshez.

## Dolgozói rendelésfolyamat

- Az [EmployeeOrders.vue](./EmployeeOrders.vue) a [../../services/api.js](../../services/api.js) segítségével tölti be a nyitott rendeléseket, normalizálja őket a [../../domain/order/order-dto.js](../../domain/order/order-dto.js) fájllal, majd pending, processing és ready oszlopokba rendezi a [../../composables/useOrderColumns.js](../../composables/useOrderColumns.js) használatával.
- A valós idejű frissítések a [../../composables/useSignalR.js](../../composables/useSignalR.js) felől érkeznek, és a [../../composables/useEmployeeOrdersBoot.js](../../composables/useEmployeeOrdersBoot.js) valamint a [../../composables/useEmployeeOrderRealtimeEvents.js](../../composables/useEmployeeOrderRealtimeEvents.js) koordinálja őket.
- Az oszlopok közötti kártyahúzás a [../../composables/useOrderStatusDnD.js](../../composables/useOrderStatusDnD.js) segítségével perzisztálja az új státuszt, amely az `updateOrderStatus` függvényt hívja a [../../services/api.js](../../services/api.js) fájlból.
- Az úszó részletpanelt a [FloatingOrderDetailsPanel.vue](./FloatingOrderDetailsPanel.vue) rendereli, de a mozgatás, átméretezés és preferenciák mentése a [../../composables/useFloatingPanel.js](../../composables/useFloatingPanel.js) felelőssége.

## Komponensreferencia

### [AdminDashboard.vue](./AdminDashboard.vue)

- Cél: a fő adminisztrátori shell minden adminisztrált entitás CRUD és bulk műveleteihez.
- Hogyan működik: egy `activeTab` állapotot, entitásonként egy-egy adatreferenciát, fülönként keresőkifejezéseket, valamint szerkesztési, törlési, bulk szerkesztési és bulk törlési modal állapotot tart fenn. Mountoláskor meghívja a `loadAdminData()` függvényt a [../../composables/useAdminDataLoader.js](../../composables/useAdminDataLoader.js) fájlból.
- Hogyan működik: az aktuális entitástípust a kiválasztott fülből számolja, majd az oszlopokat, mezőket, validátorokat és API műveleteket a [../../composables/useAdminEntityConfigs.js](../../composables/useAdminEntityConfigs.js) segítségével keresi ki. Ez a composable vékony wrapper a [../../composables/admin-entity-configs/buildEntityConfigs.js](../../composables/admin-entity-configs/buildEntityConfigs.js) körül, amely összerakja a [../../composables/admin-entity-configs/orderConfig.js](../../composables/admin-entity-configs/orderConfig.js), [../../composables/admin-entity-configs/menuConfig.js](../../composables/admin-entity-configs/menuConfig.js), [../../composables/admin-entity-configs/mealConfig.js](../../composables/admin-entity-configs/mealConfig.js), [../../composables/admin-entity-configs/categoryConfig.js](../../composables/admin-entity-configs/categoryConfig.js), [../../composables/admin-entity-configs/ingredientConfig.js](../../composables/admin-entity-configs/ingredientConfig.js), [../../composables/admin-entity-configs/sideConfig.js](../../composables/admin-entity-configs/sideConfig.js) és [../../composables/admin-entity-configs/drinkConfig.js](../../composables/admin-entity-configs/drinkConfig.js) modulokat.
- Hogyan működik: a keresés ékezetfüggetlen. A komponens normalizálja a lekérdezést és az egyes sorok látható értékeit is, ezért a keresés konzisztensen működik nevek, formázott oszlopok és az elérhetőségi badge-ek esetén is.
- Hogyan működik: a kijelölés a [../../composables/useAdminSelectionState.js](../../composables/useAdminSelectionState.js) composable-re van delegálva, amely kezeli a `selectedIds` állapotot, levezeti a `selectedItems` értéket, és megadja, hogy az aktuális entitás konfigurációja alapján engedélyezett-e a bulk edit vagy a bulk delete.
- Hogyan működik: a bulk szerkesztési logika a [../../composables/useAdminBulkActionEngine.js](../../composables/useAdminBulkActionEngine.js) fájlba van kiszervezve. Ez validálja a kért bulk műveletet, entitásspecifikus update payloadot épít, sorban futtatja a műveleteket, és a [../../composables/useAdminBulkFailurePrompt.js](../../composables/useAdminBulkFailurePrompt.js) segítségével kérdez rá, hogy folytatódjon-e a feldolgozás egyedi hibák után.
- Hogyan működik: a képelőnézeteket a [../../composables/useObjectUrlPreview.js](../../composables/useObjectUrlPreview.js) kezeli. A meglévő backend kép látható marad, amíg a felhasználó nem választ új fájlt, ekkor ideiglenes object URL váltja fel.
- Hogyan működik: a készétel szerkesztés plusz részletlekérést használ. Mielőtt megnyitja a meal modalt, meghívja a `getMealById` függvényt a [../../services/api.js](../../services/api.js) fájlból, hogy a form a teljes hozzávalólistát kapja meg, ne csak a tábla snapshotját.
- Hogyan működik: a gyermekkomponensek `defineAsyncComponent` segítségével lustán töltődnek be, így a route első betöltésekor nem kell minden modalt és táblát azonnal lehúzni.
- Fő függőségek: [AdminTable.vue](./AdminTable.vue), [AdminEditModal.vue](./AdminEditModal.vue), [AdminBulkEditModal.vue](./AdminBulkEditModal.vue), [ConfirmModal.vue](./ConfirmModal.vue), [../common/ErrorAlert.vue](../common/ErrorAlert.vue), [../../composables/useAdminDataLoader.js](../../composables/useAdminDataLoader.js), [../../composables/useAdminEntityConfigs.js](../../composables/useAdminEntityConfigs.js), [../../composables/useAdminSelectionState.js](../../composables/useAdminSelectionState.js), [../../composables/useAdminBulkActionEngine.js](../../composables/useAdminBulkActionEngine.js), [../../composables/useAdminBulkFailurePrompt.js](../../composables/useAdminBulkFailurePrompt.js), [../../composables/useObjectUrlPreview.js](../../composables/useObjectUrlPreview.js), [../../composables/useAuth.js](../../composables/useAuth.js), [../../services/api.js](../../services/api.js), [../../shared/utils.js](../../shared/utils.js) és [../../storage/admin-cache.js](../../storage/admin-cache.js).

### [AdminTable.vue](./AdminTable.vue)

- Cél: az újrahasznosítható táblakomponens, amelyet az admin dashboard minden füle használ.
- Hogyan működik: a szülő egy `columns` tömböt és egy `items` tömböt ad át. A komponens nem tudja, mi az order, meal vagy menu, csak annyit tud, hogyan kell általános oszlopokat, opcionális formázókat, státusz badge-eket és elérhetőségi badge-eket megjeleníteni.
- Hogyan működik: a keresőmezőt teljesen a szülő vezérli. Ez a komponens csak `update:searchQuery` eseményt bocsát ki, miközben a szűrést az [AdminDashboard.vue](./AdminDashboard.vue) birtokolja.
- Hogyan működik: a sorkijelölés támogatja az egyszerű kattintás-szerű kijelölést és a pointer-alapú drag selectiont. A `pointerdown`, `pointerenter` és `pointerup` handlerek lehetővé teszik, hogy a felhasználó több checkboxot gyorsan végighúzva váltson.
- Hogyan működik: a fejléc checkbox a DOM `indeterminate` állapotát használja, amelyet egy `watch` szinkronizál, ezért a részleges kijelölés helyesen jelenik meg.
- Hogyan működik: a műveleti gombok is generikusak. A komponens `create`, `edit`, `delete`, `toggle-select-all` és `toggle-select-item` eseményeket bocsát ki, a tényleges mutációkat a szülő végzi.
- Fő függőségek: [../common/OrderStatusBadge.vue](../common/OrderStatusBadge.vue) és [../../shared/utils.js](../../shared/utils.js).

### [AdminEditModal.vue](./AdminEditModal.vue)

- Cél: egyetlen entitás létrehozási/szerkesztési modalja.
- Hogyan működik: a `fields` tömböt és a `form` objektumot az [AdminDashboard.vue](./AdminDashboard.vue) adja át. Az egyes meződefiníciókat az [AdminFormField.vue](./AdminFormField.vue) rendereli, így ugyanaz a modal sok különböző entitástípust tud kezelni.
- Hogyan működik: edit módban felül megjelenít egy csak olvasható `id` mezőt. Create módban ez eltűnik, és a műveleti gomb felirata mentésről létrehozásra vált.
- Hogyan működik: a kép feltöltése opcionális és konfigurációvezérelt. Ha a `showImageUpload` igaz, a modal megmutatja az aktuális képelőnézetet, valamint egy file inputot, amely `image-selected` eseményt küld vissza a szülőnek.
- Hogyan működik: soha nem módosítja helyben a bejövő form objektumot. Minden mezőváltozás egy klónozott objektumot küld vissza `update:form` eseményként, így a parent ownership egyértelmű marad.
- Fő függőségek: [AdminFormField.vue](./AdminFormField.vue), [../common/ErrorAlert.vue](../common/ErrorAlert.vue) és [../../shared/utils.js](../../shared/utils.js).

### [AdminFormField.vue](./AdminFormField.vue)

- Cél: a mezőszintű renderer az [AdminEditModal.vue](./AdminEditModal.vue) mögött.
- Hogyan működik: a `field.type` alapján vált, és `textarea`, `multiselect`, `select`, `number` vagy sima szöveg input variánsokat renderel.
- Hogyan működik: `multiselect` mezőknél saját ékezetfüggetlen keresőmezőt ad, lokálisan szűri az opciólistát, és string-normalizált halmazként kezeli a kijelölést. Ezt főleg a készétel hozzávaló-hozzárendelés használja.
- Hogyan működik: szándékosan buta a validálás szempontjából. A konfiguráció és a szülőmodal dönt arról, mi számít érvényesnek; ez a komponens csak megjeleníti a megadott meződefiníciót és `update:modelValue` eseményt küld.
- Fő függőségek: [../../shared/utils.js](../../shared/utils.js).

### [AdminBulkEditModal.vue](./AdminBulkEditModal.vue)

- Cél: a bulk műveleti modal, amelyet akkor használ a rendszer, ha az aktuális entitástípus támogat tömeges státusz-, elérhetőség- vagy árváltoztatást.
- Hogyan működik: az engedélyezett műveletlistát a [AdminDashboard.vue](./AdminDashboard.vue) által átadott `capabilities` objektumból számolja ki. Ez azt jelenti, hogy a UI automatikusan változik, ha az entitáskonfiguráció megváltozik.
- Hogyan működik: a kiválasztott művelet határozza meg, melyik másodlagos vezérlő jelenik meg. A státusz műveletek státusz selectet, az elérhetőségi műveletek igen/nem selectet, az árműveletek numerikus delta inputot renderelnek.
- Hogyan működik: ez a komponens nem hajtja végre saját maga a bulk módosítást. Egy parent-owned form objektumot szerkeszt és `save` eseményt bocsát ki, miközben a tényleges payload építést és queue feldolgozást a [../../composables/useAdminBulkActionEngine.js](../../composables/useAdminBulkActionEngine.js) végzi.
- Fő függőségek: [../common/ErrorAlert.vue](../common/ErrorAlert.vue), [../../config/constants.js](../../config/constants.js) és [../../shared/utils.js](../../shared/utils.js).

### [ConfirmModal.vue](./ConfirmModal.vue)

- Cél: közös megerősítő dialógus veszélyes vagy megszakító műveletekhez.
- Hogyan működik: címet, üzenetet, opcionális részletlistát, confirm/cancel feliratokat és egy variánst fogad, amely a confirm gomb stílusát változtatja.
- Hogyan működik: mivel tetszőleges részlet stringeket fogad, az [AdminDashboard.vue](./AdminDashboard.vue) újra tudja használni egyedi törléshez, tömeges törléshez és részleges bulk hiba utáni folytatás/leállítás promptokhoz.
- Hogyan működik: tisztán prezentációs komponens. `confirm` és `cancel` eseményeket bocsát ki, az összes állapotváltást a szülő végzi.
- Fő függőségek: [../common/ErrorAlert.vue](../common/ErrorAlert.vue).

### [EmployeeOrders.vue](./EmployeeOrders.vue)

- Cél: a dolgozói, valós idejű konyhai és átadási tábla.
- Hogyan működik: mountoláskor a [../../composables/useEmployeeOrdersBoot.js](../../composables/useEmployeeOrdersBoot.js) inicializálja az úszó panelt, betölti a rendeléseket, betölti a kiegészítő katalógusadatokat, feliratkozik a SignalR eseményekre, elindítja a pollingot, majd unmountkor mindezt takarítja.
- Hogyan működik: a rendeléseket a [../../domain/order/order-dto.js](../../domain/order/order-dto.js) normalizálja, majd a [../../composables/useOrderColumns.js](../../composables/useOrderColumns.js) pending, processing és ready listákba rendezi. Ez a composable belső `orderIndex` mapet tart fenn, hogy a frissítések és mozgatások gyorsak legyenek.
- Hogyan működik: a realtime frissítéseket a [../../composables/useEmployeeOrderRealtimeEvents.js](../../composables/useEmployeeOrderRealtimeEvents.js) koordinálja. Az új rendelések közvetlenül a megfelelő listába illeszthetők, a státuszfrissítések pedig helyben módosíthatják a meglévő kártyát. Ha drag vagy mentés fut, a composable halasztott teljes frissítést kér, ahelyett hogy beleütközne az aktuális interakcióba.
- Hogyan működik: az oszlopok közötti drag-and-dropot a `vuedraggable` adja, de a perzisztálást a [../../composables/useOrderStatusDnD.js](../../composables/useOrderStatusDnD.js) végzi. Ez validálja a húzott rendelést, ellenőrzi, hogy a kártya valóban a várt oszlopba került-e, perzisztálja az új státuszt a [../../services/api.js](../../services/api.js) segítségével, újratölti a rendeléseket, és rövid cooldownt alkalmaz az azonnali race condition frissítések elkerülésére.
- Hogyan működik: dupla aktiválásra egy kártya a következő státuszra ugrik drag nélkül. Ehhez a [../../config/constants.js](../../config/constants.js) közös `ORDER_STATUSES` listáját és ugyanazt az `updateOrderStatus` API függvényt használja, mint a drag-and-drop.
- Hogyan működik: a board layout állapot lokálisan perzisztálódik. Az összecsukott/kinyitott oszlopok, a kártyamegjelenítési mód és az idősáv küszöbök a [../../storage/storage-utils.js](../../storage/storage-utils.js) segítségével local storage-ba kerülnek. A részletpanel pozícióját, méretét és betűméretét külön a [../../composables/useFloatingPanel.js](../../composables/useFloatingPanel.js) kezeli.
- Hogyan működik: a részletpanel hozzávalólistáját a [../../composables/useOrderIngredientsLookup.js](../../composables/useOrderIngredientsLookup.js) számolja ki, amely betöltött meal és menu adatokkal kereszt-referál, és szükség esetén id-ről névre fallbackel.
- Hogyan működik: a tisztán UI jellegű levezetések, például az eltelt idő feliratok, a kiválasztott kártya kiemelése, a realtime indikátor színe és az oszloponkénti darabszámok a [../../composables/useEmployeeOrderDisplay.js](../../composables/useEmployeeOrderDisplay.js) és [../../composables/useEmployeeOrderBoardColumns.js](../../composables/useEmployeeOrderBoardColumns.js) fájlokból jönnek.
- Fő függőségek: [FloatingOrderDetailsPanel.vue](./FloatingOrderDetailsPanel.vue), [../../composables/useSignalR.js](../../composables/useSignalR.js), [../../composables/useEmployeeOrdersBoot.js](../../composables/useEmployeeOrdersBoot.js), [../../composables/useEmployeeOrderRealtimeEvents.js](../../composables/useEmployeeOrderRealtimeEvents.js), [../../composables/useOrderColumns.js](../../composables/useOrderColumns.js), [../../composables/useOrderStatusDnD.js](../../composables/useOrderStatusDnD.js), [../../composables/useFloatingPanel.js](../../composables/useFloatingPanel.js), [../../composables/useEmployeeOrderDisplay.js](../../composables/useEmployeeOrderDisplay.js), [../../composables/useEmployeeOrderBoardColumns.js](../../composables/useEmployeeOrderBoardColumns.js), [../../composables/useOrderIngredientsLookup.js](../../composables/useOrderIngredientsLookup.js), [../../composables/useAuth.js](../../composables/useAuth.js), [../../services/api.js](../../services/api.js), [../../domain/order/order-dto.js](../../domain/order/order-dto.js), [../../domain/order/order-utils.js](../../domain/order/order-utils.js), [../../shared/utils.js](../../shared/utils.js), [../../storage/storage-utils.js](../../storage/storage-utils.js) és [../../config/constants.js](../../config/constants.js).

### [FloatingOrderDetailsPanel.vue](./FloatingOrderDetailsPanel.vue)

- Cél: a jelenleg kiválasztott rendelés mozgatható, átméretezhető részletnézete az [EmployeeOrders.vue](./EmployeeOrders.vue) mellett.
- Hogyan működik: nagyrészt prezentációs komponens. A szülő adja át a kiválasztott rendelést, az előre számolt entry view modelleket, az aktuális geometriát, az aktuális betűméretet és az összes drag/resize handlert.
- Hogyan működik: a `defineExpose` segítségével kiteszi a gyökérelemet, így az [EmployeeOrders.vue](./EmployeeOrders.vue) és a [../../composables/useFloatingPanel.js](../../composables/useFloatingPanel.js) reagálni tud arra, ha a panel tényleges DOM eleme megváltozik.
- Hogyan működik: a fejléc kezeli a drag gesztusokat, a jobb alsó és szélső resize fogantyúk végzik az átméretezést, a bezáró gomb pedig egyszerűen `close-panel` eseményt küld vissza a szülőnek.
- Hogyan működik: a státuszrenderelés a közös badge komponensre van delegálva, miközben az időbélyegek és vásárlói adatok formázását megosztott utilityk végzik.
- Fő függőségek: [../common/OrderStatusBadge.vue](../common/OrderStatusBadge.vue), [../../shared/utils.js](../../shared/utils.js) és a szülő által kezelt handlerek a [../../composables/useFloatingPanel.js](../../composables/useFloatingPanel.js) fájlból.

## Kapcsolódó fájlok, amelyeket érdemes ezzel együtt olvasni

- [../../router.js](../../router.js) az útvonal-szintű szerepkörvédelemhez és a route belépési pontokhoz.
- [../../composables/useAuth.js](../../composables/useAuth.js) a közös auth állapothoz, amelyet a route guardok és action guardok használnak.
- [../../services/api.js](../../services/api.js) az összes itt használt CRUD függvényhez, order státusz update-hez és admin dataset lekéréshez.
- [../../composables/useAdminEntityConfigs.js](../../composables/useAdminEntityConfigs.js) és [../../composables/admin-entity-configs](../../composables/admin-entity-configs) a konfigurációvezérelt admin sémához.
- [../../admin/admin-helpers.js](../../admin/admin-helpers.js) a közös validálási, payload- és árkorrekciós szabályokhoz.
- [../../composables/useAdminDataLoader.js](../../composables/useAdminDataLoader.js) és [../../storage/admin-cache.js](../../storage/admin-cache.js) a cache-first admin betöltéshez.
- [../../composables/useSignalR.js](../../composables/useSignalR.js) az alkalmazásszintű SignalR singletonhoz, amelyet a dolgozói folyamatok használnak.
- [../../domain/order/order-dto.js](../../domain/order/order-dto.js) és [../../domain/order/order-utils.js](../../domain/order/order-utils.js) a backend szerződés normalizálásához a rendelések körül.

## Karbantartási megjegyzések

- Óvatosan kezeld a prop és emit szerződéseket. Az [AdminDashboard.vue](./AdminDashboard.vue), [AdminTable.vue](./AdminTable.vue) és a modal komponensek ezek mentén szorosan kapcsolódnak egymáshoz, még ha a renderelés generikusnak is tűnik.
- Ha admin entitásviselkedést módosítasz, először a megfelelő konfigurációt frissítsd a [../../composables/admin-entity-configs](../../composables/admin-entity-configs) alatt, ne az [AdminDashboard.vue](./AdminDashboard.vue) fájlba tegyél újabb feltételes logikát.
- Ha a dolgozói board viselkedését változtatod, nézd meg együtt a polling és a SignalR folyamatokat is. A board szándékosan defenzív, és drag/save ablakok alatt inkább halasztott újratöltést választ, mint optimista helyi mutációt.
