# Common Components

English version: [README.en.md](./README.en.md)

Ez a mappa olyan kis, újrahasznosítható UI építőelemeket tartalmaz, amelyeket több különböző felületi terület is közösen használ.

- Ezek a komponensek nem feature-konténerek, hanem közös prezentációs primitívek.
- A céljuk az ismétlődő UI minták egységesítése, hogy az admin, public és user felületek ne külön-külön implementálják ugyanazt.
- A komponensek többsége stateless vagy csak minimális lokális UI állapotot tart fenn.

## Hogyan illeszkedik a projektbe

- A `common` komponensek a [../admin](../admin), [../public](../public) és [../user](../user) mappákból is importálhatók.
- Ezek a fájlok általában nem birtokolnak üzleti logikát, API hívást vagy globális állapotot.
- Ahol mégis van belső állapot, az UI-specifikus viselkedéshez tartozik, például képbetöltési állapot vagy fallback időzítés.

## Komponensreferencia

### [ErrorAlert.vue](./ErrorAlert.vue)

- Cél: egységes, egyszerű hibamegjelenítő blokk minden olyan helyre, ahol egy szülőkomponens csak egy szöveges hibaüzenetet akar megjeleníteni.
- Hogyan működik: két propot fogad, egy `message` stringet és egy opcionális `wrapperClass` értéket. Ha a `message` üres, a komponens nem renderel semmit.
- Hogyan működik: a vizuális stílus fix, ezért a komponens egységes piros alert megjelenést ad több különböző felületen is. A szülő csak a külső spacinget és elhelyezést tudja finoman hangolni a `wrapperClass` segítségével.
- Hogyan működik: nem kezel hibákat, nem normalizál üzeneteket, és nem fordít locale kulcsokat. A hibaüzenetet a szülő vagy a szolgáltatási réteg állítja elő.
- Hol használja a projekt: főként az admin modalok és panelek, például [../admin/AdminDashboard.vue](../admin/AdminDashboard.vue), [../admin/AdminEditModal.vue](../admin/AdminEditModal.vue), [../admin/AdminBulkEditModal.vue](../admin/AdminBulkEditModal.vue) és [../admin/ConfirmModal.vue](../admin/ConfirmModal.vue).
- Fő függőségek: nincs külső logikai függősége; tisztán prop-alapú prezentációs komponens.

### [ImageWithFallback.vue](./ImageWithFallback.vue)

- Cél: közös képmegjelenítő komponens olyan helyekre, ahol a kép hiányozhat, lassan jöhet meg vagy betöltési hibát adhat.
- Hogyan működik: a komponens egy kis állapotgépet tart fenn `loading`, `loaded` és `error` állapotokkal. Ez alapján dönti el, hogy a tényleges képet, a skeleton placeholdert vagy a fallback nézetet jelenítse meg.
- Hogyan működik: ha van `src`, a komponens megpróbálja betölteni a képet, és az `@load` illetve `@error` események alapján vált állapotot. Ha nincs `src`, nem azonnal dob fallbackre, hanem egy rövid késleltetés után. Ez az `emptyFallbackDelayMs` prop miatt van, hogy a nagyon rövid ideig üres vagy késve érkező források ne villogjanak feleslegesen.
- Hogyan működik: a skeleton és fallback nézet szintén konfigurálható class propokkal (`wrapperClass`, `imgClass`, `skeletonClass`, `fallbackClass`), így a komponens ugyanazt a logikát többféle layoutban is újra tudja használni.
- Hogyan működik: a fallback ikon vizuálisan jelenik meg, a `fallbackLabel` pedig képernyőolvasó számára adhat szöveget `sr-only` módon.
- Hol használja a projekt: a public és user felület több helyen is, például [../public/MenuItemPage.vue](../public/MenuItemPage.vue), [../public/QuickBuyModal.vue](../public/QuickBuyModal.vue), [../public/MenuItemCardShell.vue](../public/MenuItemCardShell.vue) és [../user/CartDrawer.vue](../user/CartDrawer.vue).
- Fő függőségek: Vue reaktivitás (`computed`, `ref`, `watch`, `onBeforeUnmount`); nincs domain- vagy API-függősége.

### [OrderStatusBadge.vue](./OrderStatusBadge.vue)

- Cél: egységes státusz badge a rendelésstátuszok megjelenítéséhez több különböző nézetben.
- Hogyan működik: a `status` propból kiszámolja a megfelelő vizuális osztályt az [../../config/constants.js](../../config/constants.js) fájl `ORDER_STATUS_CLASSES` objektuma alapján. Ha nincs ismert státusz, a `fallbackClass` lép életbe.
- Hogyan működik: a megjelenített címkét a `label` prop felülírhatja. Ha nincs explicit címke, akkor a `status` szöveges értékét mutatja, végső fallbackként pedig `-` jelenik meg.
- Hogyan működik: a badge alap mérete és megjelenése a `baseClass` propból jön, az extra finomhangolás pedig `extraClass` segítségével adható hozzá. Emiatt ugyanaz a komponens használható kompakt táblacellában és nagyobb részletpanelen is.
- Hol használja a projekt: admin és user felületen is, például [../admin/AdminTable.vue](../admin/AdminTable.vue), [../admin/FloatingOrderDetailsPanel.vue](../admin/FloatingOrderDetailsPanel.vue) és [../user/UserPage.vue](../user/UserPage.vue).
- Fő függőségek: [../../config/constants.js](../../config/constants.js) a státusz -> CSS osztály megfeleltetéshez.

## Kapcsolódó fájlok, amelyeket érdemes együtt olvasni

- [../../config/constants.js](../../config/constants.js) az `OrderStatusBadge` vizuális státusztérképéhez.
- [../admin/AdminDashboard.vue](../admin/AdminDashboard.vue), [../admin/AdminEditModal.vue](../admin/AdminEditModal.vue), [../admin/AdminBulkEditModal.vue](../admin/AdminBulkEditModal.vue) és [../admin/ConfirmModal.vue](../admin/ConfirmModal.vue), mert ezek mutatják, hogyan használja az admin UI az `ErrorAlert` komponenst.
- [../public/MenuItemCardShell.vue](../public/MenuItemCardShell.vue), [../public/MenuItemPage.vue](../public/MenuItemPage.vue), [../public/QuickBuyModal.vue](../public/QuickBuyModal.vue) és [../user/CartDrawer.vue](../user/CartDrawer.vue), mert ezek jó példák az `ImageWithFallback` használatára különböző layoutokban.
- [../admin/AdminTable.vue](../admin/AdminTable.vue), [../admin/FloatingOrderDetailsPanel.vue](../admin/FloatingOrderDetailsPanel.vue) és [../user/UserPage.vue](../user/UserPage.vue), mert ezek mutatják, hogyan skálázódik az `OrderStatusBadge` többféle felületi környezetben.

## Karbantartási szabályok

- Ezek a komponensek maradjanak általános célúak. Ha egy prop vagy viselkedés csak egyetlen feature-nek kellene, először azt mérlegeld, hogy nem inkább a feature komponensben kell-e megoldani.
- Ne tegyél ide API hívást, route logikát vagy auth-specifikus viselkedést.
- A vizuális újrahasznosíthatóság fontosabb, mint az egyetlen felületre optimalizált rövidítés.
- Ha egy komponens több helyen eltérő spacinget vagy méretet igényel, inkább class propot adj hozzá, ne készíts külön klón komponenst.
