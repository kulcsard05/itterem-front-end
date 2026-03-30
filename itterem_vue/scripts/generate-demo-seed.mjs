import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PEXELS_API_ROOT = 'https://api.pexels.com/v1';
const supportedImageSources = new Set(['placeholder', 'pexels']);
const pexelsSearchCache = new Map();

const sideBannedTerms = [
  'burger',
  'beef',
  'steak',
  'chicken',
  'pizza',
  'salad',
  'meat',
  'shrimp',
  'seafood',
  'fish',
  'sandwich',
  'pasta',
  'platter',
  'board',
];

const drinkBannedTerms = [
  'burger',
  'beef',
  'steak',
  'chicken',
  'pizza',
  'salad',
  'fries',
  'rice',
  'dessert',
  'cake',
  'plate',
  'board',
  'platter',
  'sandwich',
];

const dessertBannedTerms = [
  'burger',
  'beef',
  'steak',
  'chicken',
  'pizza',
  'salad',
  'fries',
  'rice',
  'drink',
  'cocktail',
  'sandwich',
  'plate of food',
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const palettePool = [
  { bg: '#1f2937', accent: '#f59e0b', ink: '#f9fafb' },
  { bg: '#0f766e', accent: '#facc15', ink: '#ecfeff' },
  { bg: '#7c2d12', accent: '#fb7185', ink: '#fff7ed' },
  { bg: '#172554', accent: '#22d3ee', ink: '#eff6ff' },
  { bg: '#3f6212', accent: '#f97316', ink: '#f7fee7' },
  { bg: '#4c1d95', accent: '#2dd4bf', ink: '#f5f3ff' },
  { bg: '#7f1d1d', accent: '#fbbf24', ink: '#fef2f2' },
  { bg: '#083344', accent: '#a3e635', ink: '#ecfeff' },
  { bg: '#312e81', accent: '#fb7185', ink: '#eef2ff' },
  { bg: '#422006', accent: '#38bdf8', ink: '#fffbeb' },
];

function createImageSearch(query, options = {}) {
  return {
    queries: options.queries ?? [query],
    requiredTerms: options.requiredTerms ?? [],
    preferredTerms: options.preferredTerms ?? [],
    bannedTerms: options.bannedTerms ?? [],
    orientation: options.orientation ?? 'landscape',
  };
}

const categories = [
  { name: 'Hamburgerek' },
  { name: 'Pizzák' },
  { name: 'Saláták' },
  { name: 'Tészták' },
  { name: 'Levesek' },
  { name: 'Tálak' },
  { name: 'Desszertek' },
];

const ingredients = [
  { name: 'Briós buci' },
  { name: 'Marhahúspogácsa' },
  { name: 'Cheddar sajt' },
  { name: 'Saláta' },
  { name: 'Paradicsom' },
  { name: 'Lilahagyma' },
  { name: 'Csemege uborka' },
  { name: 'Burgerszósz' },
  { name: 'Bacon' },
  { name: 'BBQ-szósz' },
  { name: 'Mozzarella' },
  { name: 'Paradicsomszósz' },
  { name: 'Bazsalikom' },
  { name: 'Pepperóni szalámi' },
  { name: 'Gomba' },
  { name: 'Olívabogyó' },
  { name: 'Csirkemell' },
  { name: 'Parmezán' },
  { name: 'Kruton' },
  { name: 'Caesar-öntet' },
  { name: 'Uborka' },
  { name: 'Feta sajt' },
  { name: 'Brownie alap' },
  { name: 'Vaníliakrém' },
  { name: 'Eper' },
  { name: 'Pisztáciakrém' },
  { name: 'Jalapenó' },
  { name: 'Lilakáposzta' },
  { name: 'Rántott csirkefilé' },
  { name: 'Majonéz' },
  { name: 'Kéksajt' },
  { name: 'Rukkola' },
  { name: 'Sonka' },
  { name: 'Avokádó' },
  { name: 'Mézes-mustáros öntet' },
  { name: 'Pirított magvak' },
  { name: 'Krémsajt' },
  { name: 'Kekszmorzsa' },
  { name: 'Málna' },
  { name: 'Kukorica' },
  { name: 'Spagetti' },
  { name: 'Penne' },
  { name: 'Tejszín' },
  { name: 'Fokhagyma' },
  { name: 'Darált marhahús' },
  { name: 'Oregánó' },
  { name: 'Pesto' },
  { name: 'Aszalt paradicsom' },
  { name: 'Sütőtök' },
  { name: 'Pirított tökmag' },
  { name: 'Alaplé' },
  { name: 'Sárgarépa' },
  { name: 'Zeller' },
  { name: 'Cérnametélt' },
  { name: 'Burgonya' },
  { name: 'Paprika' },
  { name: 'Rizs' },
  { name: 'Teriyaki szósz' },
  { name: 'Párolt zöldségek' },
  { name: 'Grillcsirke' },
  { name: 'Tzatziki' },
  { name: 'Csicseriborsó' },
];

const dishes = [
  {
    name: 'Füstös burger',
    description: 'Szaftos marhaburger füstös, grillhangulatú ízekkel, puha buciban tálalva.',
    category: 'Hamburgerek',
    price: 3390,
    ingredients: ['Briós buci', 'Marhahúspogácsa', 'Cheddar sajt', 'Bacon', 'Csemege uborka', 'BBQ-szósz', 'Burgerszósz'],
    imageSearch: createImageSearch('single bacon cheeseburger close up', {
      requiredTerms: ['burger'],
      preferredTerms: ['cheeseburger', 'close-up', 'bacon'],
    }),
  },
  {
    name: 'Dupla házi burger',
    description: 'Bőséges, laktató burger két húspogácsával és lágy, bisztróhangulatú tálalással.',
    category: 'Hamburgerek',
    price: 3890,
    ingredients: ['Briós buci', 'Marhahúspogácsa', 'Cheddar sajt', 'Saláta', 'Paradicsom', 'Lilahagyma', 'Burgerszósz'],
    imageSearch: createImageSearch('double cheeseburger close up', {
      requiredTerms: ['burger'],
      preferredTerms: ['double', 'cheeseburger', 'close-up'],
    }),
  },
  {
    name: 'Csípős jalapenós burger',
    description: 'Markáns, csípős karakterű burger olvadt sajttal és lendületes bisztróhangulattal.',
    category: 'Hamburgerek',
    price: 3690,
    ingredients: ['Briós buci', 'Marhahúspogácsa', 'Cheddar sajt', 'Jalapenó', 'Lilahagyma', 'Burgerszósz'],
    imageSearch: createImageSearch('jalapeno burger close up', {
      requiredTerms: ['burger'],
      preferredTerms: ['jalapeno', 'close-up'],
    }),
  },
  {
    name: 'Ropogós csirkeburger',
    description: 'Aranybarnára sült csirkével készült burger, friss és ropogós textúrákkal.',
    category: 'Hamburgerek',
    price: 3490,
    ingredients: ['Briós buci', 'Rántott csirkefilé', 'Saláta', 'Uborka', 'Lilakáposzta', 'Majonéz'],
    imageSearch: createImageSearch('crispy chicken burger close up', {
      requiredTerms: ['burger'],
      preferredTerms: ['chicken burger', 'crispy', 'close-up'],
    }),
  },
  {
    name: 'Margherita pizza',
    description: 'Könnyed, olaszos klasszikus vékony tésztával és frissen sült, illatos karakterrel.',
    category: 'Pizzák',
    price: 2990,
    ingredients: ['Paradicsomszósz', 'Mozzarella', 'Bazsalikom'],
    imageSearch: createImageSearch('whole margherita pizza top view', {
      requiredTerms: ['pizza'],
      preferredTerms: ['margherita', 'top view', 'whole'],
    }),
  },
  {
    name: 'Pepperóni pizza',
    description: 'Karakteres, enyhén csípős pizza gazdag feltéttel és ropogós széllel.',
    category: 'Pizzák',
    price: 3290,
    ingredients: ['Paradicsomszósz', 'Mozzarella', 'Pepperóni szalámi', 'Olívabogyó', 'Gomba'],
    imageSearch: createImageSearch('whole pepperoni pizza top view', {
      requiredTerms: ['pizza'],
      preferredTerms: ['pepperoni', 'top view', 'whole'],
    }),
  },
  {
    name: 'Prosciutto pizza',
    description: 'Elegáns, vékony tésztás pizza friss zöldekkel és könnyed olasz hangulattal.',
    category: 'Pizzák',
    price: 3490,
    ingredients: ['Paradicsomszósz', 'Mozzarella', 'Sonka', 'Rukkola'],
    imageSearch: createImageSearch('prosciutto pizza top view', {
      requiredTerms: ['pizza'],
      preferredTerms: ['prosciutto', 'top view', 'whole'],
    }),
  },
  {
    name: 'Négysajtos pizza',
    description: 'Krémes, telt ízű sajtválogatással készült pizza, gazdag és selymes lecsengéssel.',
    category: 'Pizzák',
    price: 3390,
    ingredients: ['Paradicsomszósz', 'Mozzarella', 'Cheddar sajt', 'Parmezán', 'Kéksajt'],
    imageSearch: createImageSearch('four cheese pizza top view', {
      requiredTerms: ['pizza'],
      preferredTerms: ['cheese pizza', 'top view', 'whole'],
    }),
  },
  {
    name: 'Kerti saláta',
    description: 'Friss, üde saláta könnyű ebédhez vagy vacsorához, ropogós textúrákkal.',
    category: 'Saláták',
    price: 2590,
    ingredients: ['Saláta', 'Paradicsom', 'Uborka', 'Feta sajt', 'Lilahagyma'],
    imageSearch: createImageSearch('green salad bowl only', {
      requiredTerms: ['salad'],
      preferredTerms: ['bowl', 'fresh'],
    }),
  },
  {
    name: 'Caesar saláta',
    description: 'Krémes, mégis friss saláta grillezett csirkével, bisztró stílusban.',
    category: 'Saláták',
    price: 2890,
    ingredients: ['Csirkemell', 'Parmezán', 'Kruton', 'Caesar-öntet', 'Saláta'],
    imageSearch: createImageSearch('caesar salad bowl only', {
      requiredTerms: ['salad'],
      preferredTerms: ['caesar', 'bowl'],
    }),
  },
  {
    name: 'Mediterrán saláta',
    description: 'Napfényes, mediterrán hangulatú saláta sósabb ízekkel és friss zöldségekkel.',
    category: 'Saláták',
    price: 2790,
    ingredients: ['Saláta', 'Paradicsom', 'Uborka', 'Feta sajt', 'Olívabogyó'],
    imageSearch: createImageSearch('mediterranean salad bowl only', {
      requiredTerms: ['salad'],
      preferredTerms: ['mediterranean', 'bowl'],
    }),
  },
  {
    name: 'Avokádós csirkesaláta',
    description: 'Friss és laktató saláta selymes avokádóval, grillezett csirkével és könnyű egyensúllyal.',
    category: 'Saláták',
    price: 3090,
    ingredients: ['Saláta', 'Csirkemell', 'Avokádó', 'Paradicsom', 'Mézes-mustáros öntet', 'Pirított magvak'],
    imageSearch: createImageSearch('avocado chicken salad bowl only', {
      requiredTerms: ['salad'],
      preferredTerms: ['avocado', 'chicken', 'bowl'],
    }),
  },
  {
    name: 'Carbonara spagetti',
    description: 'Krémes, selymes tészta gazdag olasz karakterrel és frissen őrölt borsos lecsengéssel.',
    category: 'Tészták',
    price: 3490,
    ingredients: ['Spagetti', 'Bacon', 'Parmezán', 'Tejszín', 'Fokhagyma'],
    imageSearch: createImageSearch('spaghetti carbonara plate only', {
      requiredTerms: ['carbonara'],
      preferredTerms: ['spaghetti', 'plate', 'pasta'],
    }),
  },
  {
    name: 'Bolognai penne',
    description: 'Laktató, paradicsomos húsraguval készült klasszikus tészta, otthonos bisztróhangulattal.',
    category: 'Tészták',
    price: 3390,
    ingredients: ['Penne', 'Darált marhahús', 'Paradicsomszósz', 'Parmezán', 'Oregánó'],
    imageSearch: createImageSearch('penne bolognese plate only', {
      requiredTerms: ['bolognese'],
      preferredTerms: ['penne', 'plate', 'pasta'],
    }),
  },
  {
    name: 'Pesto csirkés penne',
    description: 'Friss, zöldfűszeres tészta szaftos csirkével és könnyed, mediterrán hangulattal.',
    category: 'Tészták',
    price: 3590,
    ingredients: ['Penne', 'Csirkemell', 'Pesto', 'Parmezán', 'Aszalt paradicsom'],
    imageSearch: createImageSearch('pesto chicken pasta bowl only', {
      requiredTerms: ['pasta'],
      preferredTerms: ['pesto', 'chicken', 'bowl'],
    }),
  },
  {
    name: 'Mozzarellás paradicsomos penne',
    description: 'Könnyed, paradicsomos tészta olvadó mozzarellával és friss bazsalikomos karakterrel.',
    category: 'Tészták',
    price: 3290,
    ingredients: ['Penne', 'Paradicsomszósz', 'Mozzarella', 'Bazsalikom', 'Fokhagyma'],
    imageSearch: createImageSearch('tomato mozzarella pasta plate only', {
      requiredTerms: ['pasta'],
      preferredTerms: ['tomato', 'mozzarella', 'plate'],
    }),
  },
  {
    name: 'Gulyásleves',
    description: 'Tartalmas, magyaros leves gazdag ízekkel és lassan főtt, otthonos karakterrel.',
    category: 'Levesek',
    price: 2590,
    ingredients: ['Marhahúspogácsa', 'Burgonya', 'Paprika', 'Lilahagyma', 'Alaplé'],
    imageSearch: createImageSearch('goulash soup bowl only', {
      requiredTerms: ['soup'],
      preferredTerms: ['goulash', 'bowl'],
    }),
  },
  {
    name: 'Sütőtökkrémleves',
    description: 'Selymes, bársonyos krémleves lágy fűszerekkel és finom, őszi hangulattal.',
    category: 'Levesek',
    price: 2390,
    ingredients: ['Sütőtök', 'Tejszín', 'Alaplé', 'Pirított tökmag'],
    imageSearch: createImageSearch('pumpkin soup bowl only', {
      requiredTerms: ['soup'],
      preferredTerms: ['pumpkin', 'bowl', 'cream soup'],
    }),
  },
  {
    name: 'Házi húsleves',
    description: 'Klasszikus, tiszta húsleves friss zöldségekkel és könnyű, melengető karakterrel.',
    category: 'Levesek',
    price: 2290,
    ingredients: ['Csirkemell', 'Sárgarépa', 'Zeller', 'Cérnametélt', 'Alaplé'],
    imageSearch: createImageSearch('chicken noodle soup bowl only', {
      requiredTerms: ['soup'],
      preferredTerms: ['chicken noodle', 'bowl'],
    }),
  },
  {
    name: 'Paradicsomleves bazsalikommal',
    description: 'Friss, élénk paradicsomos leves üde bazsalikomos jegyekkel és könnyed lecsengéssel.',
    category: 'Levesek',
    price: 2190,
    ingredients: ['Paradicsomszósz', 'Bazsalikom', 'Tejszín', 'Alaplé'],
    imageSearch: createImageSearch('tomato soup bowl only', {
      requiredTerms: ['soup'],
      preferredTerms: ['tomato soup', 'bowl'],
    }),
  },
  {
    name: 'Teriyaki csirketál',
    description: 'Laktató rizstál szaftos csirkével, párolt zöldségekkel és fényes, édeskés szósszal.',
    category: 'Tálak',
    price: 3890,
    ingredients: ['Grillcsirke', 'Rizs', 'Teriyaki szósz', 'Párolt zöldségek'],
    imageSearch: createImageSearch('teriyaki chicken rice bowl only', {
      requiredTerms: ['bowl'],
      preferredTerms: ['teriyaki', 'chicken', 'rice bowl'],
    }),
  },
  {
    name: 'Görög csirketál',
    description: 'Friss, mediterrán tál grillezett csirkével, zöldségekkel és krémes tzatzikivel.',
    category: 'Tálak',
    price: 3790,
    ingredients: ['Grillcsirke', 'Rizs', 'Uborka', 'Paradicsom', 'Feta sajt', 'Tzatziki'],
    imageSearch: createImageSearch('greek chicken bowl only', {
      requiredTerms: ['bowl'],
      preferredTerms: ['greek', 'chicken', 'rice bowl'],
    }),
  },
  {
    name: 'BBQ csirketál',
    description: 'Füstös, tartalmas tál roppanós körettel és szaftos csirkével, bisztró stílusban.',
    category: 'Tálak',
    price: 3990,
    ingredients: ['Grillcsirke', 'Rizs', 'BBQ-szósz', 'Kukorica', 'Párolt zöldségek'],
    imageSearch: createImageSearch('bbq chicken rice bowl only', {
      requiredTerms: ['bowl'],
      preferredTerms: ['bbq', 'chicken', 'rice bowl'],
    }),
  },
  {
    name: 'Vegán zöldségtál',
    description: 'Színes, friss tál sok zöldséggel, pergős rizzsel és kiegyensúlyozott, könnyed összhatással.',
    category: 'Tálak',
    price: 3490,
    ingredients: ['Rizs', 'Párolt zöldségek', 'Csicseriborsó', 'Avokádó'],
    imageSearch: createImageSearch('veggie rice bowl only', {
      requiredTerms: ['bowl'],
      preferredTerms: ['veggie', 'vegetable', 'rice bowl'],
    }),
  },
  {
    name: 'Csokis brownie',
    description: 'Sűrű, csokoládés desszert puha belsővel és kényeztető lezárással.',
    category: 'Desszertek',
    price: 1990,
    ingredients: ['Brownie alap', 'Vaníliakrém', 'Eper'],
    imageSearch: createImageSearch('brownie dessert plate only', {
      requiredTerms: ['brownie'],
      preferredTerms: ['dessert', 'plate'],
      bannedTerms: dessertBannedTerms,
    }),
  },
  {
    name: 'Pisztáciás szelet',
    description: 'Légies, elegáns desszert finom pisztáciás karakterrel és cukrászdai hangulattal.',
    category: 'Desszertek',
    price: 2190,
    ingredients: ['Vaníliakrém', 'Pisztáciakrém', 'Eper'],
    imageSearch: createImageSearch('pistachio cake slice plate only', {
      requiredTerms: ['pistachio'],
      preferredTerms: ['cake', 'slice', 'dessert'],
      bannedTerms: dessertBannedTerms,
    }),
  },
  {
    name: 'New York sajttorta',
    description: 'Krémes, selymes sajttorta letisztult desszertélménnyel és klasszikus cukrászdai hangulattal.',
    category: 'Desszertek',
    price: 2290,
    ingredients: ['Krémsajt', 'Kekszmorzsa', 'Eper'],
    imageSearch: createImageSearch('new york cheesecake slice plate only', {
      requiredTerms: ['cheesecake'],
      preferredTerms: ['slice', 'dessert', 'plate'],
      bannedTerms: dessertBannedTerms,
    }),
  },
  {
    name: 'Málnás sajttorta',
    description: 'Gyümölcsös, könnyed sajttorta friss málnaízzel és elegáns tálalással.',
    category: 'Desszertek',
    price: 2390,
    ingredients: ['Krémsajt', 'Kekszmorzsa', 'Málna'],
    imageSearch: createImageSearch('raspberry cheesecake slice plate only', {
      requiredTerms: ['cheesecake'],
      preferredTerms: ['raspberry', 'slice', 'dessert'],
      bannedTerms: dessertBannedTerms,
    }),
  },
];

const sides = [
  {
    name: 'Hasábburgonya',
    description: 'Aranybarnára sütött klasszikus köret, kívül ropogós, belül puha.',
    price: 1190,
    imageSearch: createImageSearch('french fries basket only', {
      requiredTerms: ['fries'],
      preferredTerms: ['french fries', 'basket', 'close-up'],
      bannedTerms: sideBannedTerms,
    }),
  },
  {
    name: 'Édesburgonya',
    description: 'Enyhén édeskés, sütőben karamellizált köret modern tálaláshoz.',
    price: 1390,
    imageSearch: createImageSearch('sweet potato fries basket only', {
      requiredTerms: ['sweet potato', 'fries'],
      preferredTerms: ['basket', 'close-up'],
      bannedTerms: sideBannedTerms,
    }),
  },
  {
    name: 'Fűszeres rizs',
    description: 'Illatos, pergős köret, amely jól kíséri a könnyebb fogásokat.',
    price: 990,
    imageSearch: createImageSearch('plain seasoned rice bowl', {
      requiredTerms: ['rice'],
      preferredTerms: ['bowl', 'plain', 'seasoned rice'],
      bannedTerms: [...sideBannedTerms, 'shrimp', 'prawn'],
    }),
  },
  {
    name: 'Hagymakarika',
    description: 'Ropogós bundában sült kísérő, amely snackként is erős választás.',
    price: 1290,
    imageSearch: createImageSearch('onion rings basket only', {
      queries: ['onion rings basket only', 'crispy onion rings close up'],
      requiredTerms: ['onion rings'],
      preferredTerms: ['basket', 'close-up'],
      bannedTerms: [...sideBannedTerms, 'potato salad'],
    }),
  },
  {
    name: 'Sült zöldségek',
    description: 'Színes, sütőben pirult zöldségválogatás könnyedebb összeállításokhoz.',
    price: 1490,
    imageSearch: createImageSearch('roasted vegetables only', {
      requiredTerms: ['roasted'],
      preferredTerms: ['vegetables', 'tray'],
      bannedTerms: sideBannedTerms,
    }),
  },
  {
    name: 'Coleslaw',
    description: 'Hűs, roppanós káposztasaláta könnyed, frissítő kísérőként.',
    price: 1090,
    imageSearch: createImageSearch('coleslaw bowl only', {
      requiredTerms: ['coleslaw'],
      preferredTerms: ['bowl'],
      bannedTerms: [...sideBannedTerms, 'burger'],
    }),
  },
  {
    name: 'Burgonyagerezdák',
    description: 'Fűszeres, rusztikus burgonyaköret ropogós szélekkel és tartalmas textúrával.',
    price: 1590,
    imageSearch: createImageSearch('potato wedges basket only', {
      requiredTerms: ['potato'],
      preferredTerms: ['wedges', 'basket', 'close-up'],
      bannedTerms: [...sideBannedTerms, 'burger', 'steak'],
    }),
  },
  {
    name: 'Grillezett kukorica',
    description: 'Enyhén füstös, grillezett kukorica egyszerű és karakteres köretként.',
    price: 1190,
    imageSearch: createImageSearch('grilled corn on cob only', {
      requiredTerms: ['corn'],
      preferredTerms: ['grilled corn', 'cob'],
      bannedTerms: sideBannedTerms,
    }),
  },
];

const drinks = [
  {
    name: 'Limonádé',
    price: 890,
    imageSearch: createImageSearch('lemonade glass only', {
      requiredTerms: ['lemonade'],
      preferredTerms: ['glass', 'drink'],
      bannedTerms: drinkBannedTerms,
      orientation: 'portrait',
    }),
  },
  {
    name: 'Cola',
    price: 790,
    imageSearch: createImageSearch('cola glass with ice only', {
      requiredTerms: ['glass'],
      preferredTerms: ['cola', 'ice'],
      bannedTerms: drinkBannedTerms,
      orientation: 'portrait',
    }),
  },
  {
    name: 'Jeges tea',
    price: 850,
    imageSearch: createImageSearch('iced tea glass with lemon only', {
      requiredTerms: ['iced tea'],
      preferredTerms: ['glass', 'lemon'],
      bannedTerms: drinkBannedTerms,
      orientation: 'portrait',
    }),
  },
  {
    name: 'Szódavíz',
    price: 690,
    imageSearch: createImageSearch('sparkling water glass only', {
      requiredTerms: ['glass'],
      preferredTerms: ['sparkling water', 'water'],
      bannedTerms: drinkBannedTerms,
      orientation: 'portrait',
    }),
  },
  {
    name: 'Almás fröccs',
    price: 950,
    imageSearch: createImageSearch('apple sparkling drink glass only', {
      requiredTerms: ['glass'],
      preferredTerms: ['apple', 'sparkling'],
      bannedTerms: [...drinkBannedTerms, 'aperol', 'orange'],
      orientation: 'portrait',
    }),
  },
  {
    name: 'Narancslé',
    price: 890,
    imageSearch: createImageSearch('orange juice glass only', {
      requiredTerms: ['orange juice'],
      preferredTerms: ['glass'],
      bannedTerms: drinkBannedTerms,
      orientation: 'portrait',
    }),
  },
  {
    name: 'Málnás limonádé',
    price: 990,
    imageSearch: createImageSearch('raspberry lemonade glass only', {
      requiredTerms: ['lemonade'],
      preferredTerms: ['raspberry', 'glass'],
      bannedTerms: drinkBannedTerms,
      orientation: 'portrait',
    }),
  },
  {
    name: 'Barackos jeges tea',
    price: 930,
    imageSearch: createImageSearch('peach iced tea glass only', {
      requiredTerms: ['tea'],
      preferredTerms: ['peach', 'iced tea', 'glass'],
      bannedTerms: drinkBannedTerms,
      orientation: 'portrait',
    }),
  },
];

function normalizeSearchText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replaceAll(/\p{Diacritic}/gu, '');
}

function scorePexelsPhoto(photo, request) {
  const text = normalizeSearchText([photo.alt, photo.url].filter(Boolean).join(' '));
  let score = 0;

  for (const term of request.requiredTerms ?? []) {
    score += text.includes(normalizeSearchText(term)) ? 14 : -18;
  }

  for (const term of request.preferredTerms ?? []) {
    if (text.includes(normalizeSearchText(term))) {
      score += 6;
    }
  }

  for (const term of request.bannedTerms ?? []) {
    if (text.includes(normalizeSearchText(term))) {
      score -= 20;
    }
  }

  return score;
}

const menus = [
  {
    name: 'Füstös menü',
    dish: 'Füstös burger',
    side: 'Hasábburgonya',
    drink: 'Cola',
    price: 4690,
    imageSearch: createImageSearch('burger combo meal fries cola', {
      requiredTerms: ['burger'],
      preferredTerms: ['combo', 'fries', 'cola'],
    }),
  },
  {
    name: 'Dupla menü',
    dish: 'Dupla házi burger',
    side: 'Édesburgonya',
    drink: 'Limonádé',
    price: 5190,
    imageSearch: createImageSearch('double burger combo meal', {
      requiredTerms: ['burger'],
      preferredTerms: ['combo', 'fries', 'drink'],
    }),
  },
  {
    name: 'Jalapenós menü',
    dish: 'Csípős jalapenós burger',
    side: 'Hagymakarika',
    drink: 'Limonádé',
    price: 4990,
    imageSearch: createImageSearch('spicy burger combo meal', {
      requiredTerms: ['burger'],
      preferredTerms: ['combo', 'spicy', 'drink'],
    }),
  },
  {
    name: 'Csirkeburger menü',
    dish: 'Ropogós csirkeburger',
    side: 'Burgonyagerezdák',
    drink: 'Barackos jeges tea',
    price: 5190,
    imageSearch: createImageSearch('chicken burger combo meal', {
      requiredTerms: ['burger'],
      preferredTerms: ['chicken burger', 'combo'],
    }),
  },
  {
    name: 'Margherita menü',
    dish: 'Margherita pizza',
    side: 'Hagymakarika',
    drink: 'Jeges tea',
    price: 4590,
    imageSearch: createImageSearch('pizza combo meal drink', {
      requiredTerms: ['pizza'],
      preferredTerms: ['combo', 'drink'],
    }),
  },
  {
    name: 'Pepperóni menü',
    dish: 'Pepperóni pizza',
    side: 'Hasábburgonya',
    drink: 'Cola',
    price: 4890,
    imageSearch: createImageSearch('pepperoni pizza combo meal', {
      requiredTerms: ['pizza'],
      preferredTerms: ['pepperoni', 'combo'],
    }),
  },
  {
    name: 'Prosciutto menü',
    dish: 'Prosciutto pizza',
    side: 'Coleslaw',
    drink: 'Narancslé',
    price: 4990,
    imageSearch: createImageSearch('prosciutto pizza combo meal', {
      requiredTerms: ['pizza'],
      preferredTerms: ['combo', 'drink'],
    }),
  },
  {
    name: 'Négysajtos menü',
    dish: 'Négysajtos pizza',
    side: 'Grillezett kukorica',
    drink: 'Málnás limonádé',
    price: 4890,
    imageSearch: createImageSearch('cheese pizza combo meal', {
      requiredTerms: ['pizza'],
      preferredTerms: ['combo', 'drink'],
    }),
  },
  {
    name: 'Caesar ebédmenü',
    dish: 'Caesar saláta',
    side: 'Fűszeres rizs',
    drink: 'Szódavíz',
    price: 4290,
    imageSearch: createImageSearch('chicken salad lunch set restaurant', {
      requiredTerms: ['salad'],
      preferredTerms: ['lunch', 'set'],
    }),
  },
  {
    name: 'Kerti ebédmenü',
    dish: 'Kerti saláta',
    side: 'Sült zöldségek',
    drink: 'Almás fröccs',
    price: 4390,
    imageSearch: createImageSearch('fresh salad lunch set', {
      requiredTerms: ['salad'],
      preferredTerms: ['lunch', 'set'],
    }),
  },
  {
    name: 'Mediterrán ebédmenü',
    dish: 'Mediterrán saláta',
    side: 'Grillezett kukorica',
    drink: 'Narancslé',
    price: 4490,
    imageSearch: createImageSearch('mediterranean salad lunch set', {
      requiredTerms: ['salad'],
      preferredTerms: ['mediterranean', 'lunch'],
    }),
  },
  {
    name: 'Avokádós ebédmenü',
    dish: 'Avokádós csirkesaláta',
    side: 'Coleslaw',
    drink: 'Málnás limonádé',
    price: 4690,
    imageSearch: createImageSearch('avocado chicken salad lunch set', {
      requiredTerms: ['salad'],
      preferredTerms: ['avocado', 'lunch'],
    }),
  },
  {
    name: 'Carbonara menü',
    dish: 'Carbonara spagetti',
    side: 'Grillezett kukorica',
    drink: 'Limonádé',
    price: 5190,
    imageSearch: createImageSearch('carbonara pasta lunch set', {
      requiredTerms: ['pasta'],
      preferredTerms: ['carbonara', 'lunch', 'set'],
    }),
  },
  {
    name: 'Bolognai menü',
    dish: 'Bolognai penne',
    side: 'Hasábburgonya',
    drink: 'Cola',
    price: 4990,
    imageSearch: createImageSearch('bolognese pasta lunch set', {
      requiredTerms: ['pasta'],
      preferredTerms: ['bolognese', 'lunch', 'set'],
    }),
  },
  {
    name: 'Pesto tésztamenü',
    dish: 'Pesto csirkés penne',
    side: 'Édesburgonya',
    drink: 'Jeges tea',
    price: 5290,
    imageSearch: createImageSearch('pesto chicken pasta lunch set', {
      requiredTerms: ['pasta'],
      preferredTerms: ['pesto', 'chicken', 'set'],
    }),
  },
  {
    name: 'Teriyaki tál menü',
    dish: 'Teriyaki csirketál',
    side: 'Sült zöldségek',
    drink: 'Barackos jeges tea',
    price: 5590,
    imageSearch: createImageSearch('teriyaki chicken bowl lunch set', {
      requiredTerms: ['bowl'],
      preferredTerms: ['teriyaki', 'chicken', 'set'],
    }),
  },
  {
    name: 'Görög tál menü',
    dish: 'Görög csirketál',
    side: 'Coleslaw',
    drink: 'Narancslé',
    price: 5490,
    imageSearch: createImageSearch('greek chicken bowl lunch set', {
      requiredTerms: ['bowl'],
      preferredTerms: ['greek', 'chicken', 'set'],
    }),
  },
  {
    name: 'Vegán tál menü',
    dish: 'Vegán zöldségtál',
    side: 'Sült zöldségek',
    drink: 'Málnás limonádé',
    price: 4990,
    imageSearch: createImageSearch('veggie rice bowl lunch set', {
      requiredTerms: ['bowl'],
      preferredTerms: ['veggie', 'rice bowl', 'set'],
    }),
  },
];

function parseArgs(argv) {
  const args = {
    output: path.join(projectRoot, 'generated-demo-seed.sql'),
    imageSource: process.env.SEED_IMAGE_SOURCE ?? 'placeholder',
    attributionOutput: path.join(projectRoot, 'generated-demo-seed-image-attribution.json'),
    pexelsApiKey: process.env.PEXELS_API_KEY ?? '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--output') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('Missing value for --output');
      }
      args.output = path.resolve(projectRoot, next);
      index += 1;
    } else if (current === '--image-source') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('Missing value for --image-source');
      }
      args.imageSource = next;
      index += 1;
    } else if (current === '--attribution-output') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('Missing value for --attribution-output');
      }
      args.attributionOutput = path.resolve(projectRoot, next);
      index += 1;
    } else if (current === '--pexels-api-key') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('Missing value for --pexels-api-key');
      }
      args.pexelsApiKey = next;
      index += 1;
    }
  }

  if (!supportedImageSources.has(args.imageSource)) {
    throw new Error(`Unsupported --image-source value: ${args.imageSource}`);
  }

  return args;
}

function sqlString(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
}

function sqlBlob(buffer) {
  return `0x${buffer.toString('hex').toUpperCase()}`;
}

function escapeSvgText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function pickPalette(index) {
  return palettePool[index % palettePool.length];
}

async function ensureSipsAvailable() {
  try {
    await execFileAsync('sips', ['--help']);
  } catch {
    throw new Error('The generator requires the macOS `sips` tool to create JPEG blobs.');
  }
}

function ensurePexelsConfigured(apiKey) {
  if (!apiKey) {
    throw new Error('Pexels image mode requires a PEXELS_API_KEY environment variable or --pexels-api-key.');
  }
  if (typeof fetch !== 'function') {
    throw new Error('This Node.js runtime does not provide fetch(). Use Node 18 or newer for Pexels image mode.');
  }
}

async function renderJpegBuffer(tempDir, slug, imageSpec) {
  const svgPath = path.join(tempDir, `${slug}.svg`);
  const jpgPath = path.join(tempDir, `${slug}.jpg`);
  const { bg, accent, ink } = imageSpec.palette;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}" />
      <stop offset="100%" stop-color="${accent}" />
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#wash)" />
  <circle cx="990" cy="170" r="220" fill="${accent}" fill-opacity="0.28" />
  <circle cx="220" cy="700" r="260" fill="${ink}" fill-opacity="0.10" />
  <rect x="70" y="78" width="1060" height="644" rx="44" fill="#111827" fill-opacity="0.22" stroke="${ink}" stroke-opacity="0.34" stroke-width="4" />
  <text x="100" y="148" font-size="30" font-family="Helvetica" fill="${ink}" opacity="0.8" letter-spacing="5">${escapeSvgText(imageSpec.badge)}</text>
  <text x="100" y="330" font-size="98" font-weight="700" font-family="Helvetica" fill="${ink}">${escapeSvgText(imageSpec.title)}</text>
  <text x="100" y="414" font-size="38" font-family="Helvetica" fill="${ink}" opacity="0.9">${escapeSvgText(imageSpec.subtitle)}</text>
  <text x="100" y="682" font-size="34" font-family="Helvetica" fill="${ink}" opacity="0.8">${escapeSvgText(imageSpec.footer)}</text>
</svg>`.trim();

  await writeFile(svgPath, svg, 'utf8');
  await execFileAsync('sips', ['-s', 'format', 'jpeg', svgPath, '--out', jpgPath]);
  return readFile(jpgPath);
}

function guessImageExtension(contentType, url) {
  if (contentType?.includes('png')) {
    return 'png';
  }
  if (contentType?.includes('webp')) {
    return 'webp';
  }
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
    return 'jpg';
  }

  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.png')) {
    return 'png';
  }
  if (pathname.endsWith('.webp')) {
    return 'webp';
  }
  return 'jpg';
}

async function normalizeToJpegBuffer(tempDir, slug, inputBuffer, inputExtension) {
  const inputPath = path.join(tempDir, `${slug}.${inputExtension}`);
  const outputPath = path.join(tempDir, `${slug}.jpg`);

  await writeFile(inputPath, inputBuffer);
  await execFileAsync('sips', ['-s', 'format', 'jpeg', inputPath, '--out', outputPath]);
  return readFile(outputPath);
}

function makeSlug(prefix, id) {
  return `${prefix}-${String(id).padStart(2, '0')}`;
}

async function attachImages(records, prefix, builder) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'itterem-seed-'));

  try {
    for (const record of records) {
      const imageSpec = builder(record);
      record.image = await renderJpegBuffer(tempDir, makeSlug(prefix, record.id), imageSpec);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Image API request failed (${response.status}): ${detail.slice(0, 240)}`);
  }

  return response.json();
}

function makePexelsPhotoIdentity(photo) {
  return photo.src?.original ?? photo.src?.large ?? photo.src?.landscape ?? photo.url;
}

function normalizePhotographerKey(value) {
  return String(value ?? '').trim().toLowerCase();
}

async function fetchPexelsPhoto(apiKey, request, usedPhotoKeys = new Set(), usedPhotographerKeys = new Set()) {
  const queries = request.queries ?? [request.query];
  const orientation = request.orientation ?? 'landscape';
  const cacheKey = JSON.stringify({
    queries,
    orientation,
    requiredTerms: request.requiredTerms ?? [],
    preferredTerms: request.preferredTerms ?? [],
    bannedTerms: request.bannedTerms ?? [],
  });

  let candidates = pexelsSearchCache.get(cacheKey);

  if (!candidates) {
    const candidateMap = new Map();

    for (const query of queries) {
      const url = new URL(`${PEXELS_API_ROOT}/search`);
      url.searchParams.set('query', query);
      url.searchParams.set('per_page', '8');
      url.searchParams.set('orientation', orientation);
      url.searchParams.set('size', 'large');
      url.searchParams.set('locale', 'en-US');

      const data = await fetchJson(url, {
        headers: {
          Authorization: apiKey,
        },
      });

      for (const photo of data.photos ?? []) {
        const candidate = {
          photo,
          query,
          score: scorePexelsPhoto(photo, request),
          identity: makePexelsPhotoIdentity(photo),
          photographerKey: normalizePhotographerKey(photo.photographer),
        };
        const existing = candidateMap.get(candidate.identity);
        if (!existing || candidate.score > existing.score) {
          candidateMap.set(candidate.identity, candidate);
        }
      }
    }

    candidates = [...candidateMap.values()].sort((left, right) => right.score - left.score);
    pexelsSearchCache.set(cacheKey, candidates);
  }

  const rankedCandidates = candidates
    .map((candidate) => ({
      ...candidate,
      adjustedScore: candidate.score - (usedPhotographerKeys.has(candidate.photographerKey) ? 10 : 0),
    }))
    .sort((left, right) => right.adjustedScore - left.adjustedScore);

  const bestCandidate = rankedCandidates.find((candidate) => !usedPhotoKeys.has(candidate.identity)) ?? rankedCandidates[0];
  if (!bestCandidate) {
    throw new Error(`No Pexels image found for query set: ${queries.join(', ')}`);
  }

  const { photo, query, score, identity, photographerKey } = bestCandidate;
  const result = {
    identity,
    photographerKey,
    query,
    score,
    photoPage: photo.url,
    photographer: photo.photographer,
    photographerUrl: photo.photographer_url,
    sourceUrl: photo.src?.landscape ?? photo.src?.large ?? photo.src?.original,
    alt: photo.alt ?? '',
  };

  return result;
}

async function downloadImageBuffer(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Image download failed (${response.status}) for ${url}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') ?? '',
  };
}

async function attachPexelsImages(records, prefix, builder, apiKey, attributions, usedPhotoKeys, usedPhotographerKeys) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'itterem-seed-'));

  try {
    for (const record of records) {
      const request = builder(record);
      const photo = await fetchPexelsPhoto(apiKey, request, usedPhotoKeys, usedPhotographerKeys);
      const downloaded = await downloadImageBuffer(photo.sourceUrl);

      record.image = await normalizeToJpegBuffer(
        tempDir,
        makeSlug(prefix, record.id),
        downloaded.buffer,
        guessImageExtension(downloaded.contentType, photo.sourceUrl)
      );
      usedPhotoKeys.add(photo.identity);
      if (photo.photographerKey) {
        usedPhotographerKeys.add(photo.photographerKey);
      }

      attributions.push({
        type: prefix,
        recordId: record.id,
        name: record.name,
        query: request.query,
        selectedQuery: photo.query,
        score: photo.score,
        provider: 'Pexels',
        photoPage: photo.photoPage,
        sourceUrl: photo.sourceUrl,
        photographer: photo.photographer,
        photographerUrl: photo.photographerUrl,
        alt: photo.alt,
      });
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function resolveIdsByName(records) {
  return new Map(records.map((record) => [record.name, record.id]));
}

function buildDataset() {
  const categoryRows = categories.map((record, index) => ({
    id: index + 1,
    name: record.name,
  }));

  const ingredientRows = ingredients.map((record, index) => ({
    id: index + 1,
    name: record.name,
  }));

  const categoryIds = resolveIdsByName(categoryRows);
  const ingredientIds = resolveIdsByName(ingredientRows);

  const dishRows = dishes.map((record, index) => ({
    id: index + 1,
    name: record.name,
    description: record.description,
    imageSearch: record.imageSearch,
    available: 1,
    categoryId: categoryIds.get(record.category),
    price: record.price,
    ingredientIds: record.ingredients.map((ingredientName) => ingredientIds.get(ingredientName)),
  }));

  const sideRows = sides.map((record, index) => ({
    id: index + 1,
    name: record.name,
    description: record.description,
    imageSearch: record.imageSearch,
    available: 1,
    price: record.price,
  }));

  const drinkRows = drinks.map((record, index) => ({
    id: index + 1,
    name: record.name,
    imageSearch: record.imageSearch,
    available: 1,
    price: record.price,
  }));

  const dishIds = resolveIdsByName(dishRows);
  const sideIds = resolveIdsByName(sideRows);
  const drinkIds = resolveIdsByName(drinkRows);

  const menuRows = menus.map((record, index) => ({
    id: index + 1,
    name: record.name,
    dishId: dishIds.get(record.dish),
    sideId: sideIds.get(record.side),
    drinkId: drinkIds.get(record.drink),
    dishName: record.dish,
    sideName: record.side,
    drinkName: record.drink,
    imageSearch: record.imageSearch,
    available: 1,
    price: record.price,
  }));

  const dishIngredientRows = dishRows.flatMap((dish) =>
    dish.ingredientIds.map((ingredientId) => ({ dishId: dish.id, ingredientId }))
  );

  return {
    categoryRows,
    ingredientRows,
    dishRows,
    sideRows,
    drinkRows,
    menuRows,
    dishIngredientRows,
  };
}

function validateDataset(dataset) {
  for (const dish of dataset.dishRows) {
    if (!dish.categoryId) {
      throw new Error(`Missing category for dish ${dish.name}`);
    }
    if (dish.ingredientIds.some((ingredientId) => !ingredientId)) {
      throw new Error(`Missing ingredient mapping for dish ${dish.name}`);
    }
  }

  for (const menu of dataset.menuRows) {
    if (!menu.dishId || !menu.sideId || !menu.drinkId) {
      throw new Error(`Missing relation for menu ${menu.name}`);
    }
  }
}

function buildSql(dataset) {
  const lines = [
    '-- Generált demó seed az Itterem backend sémájához.',
    `-- Generálva: ${new Date().toISOString()}.`,
    '-- A script újratölti a katalógus táblákat, és kiüríti a rendeles_elemek táblát az idegen kulcsok miatt.',
    'SET NAMES utf8mb4;',
    'SET FOREIGN_KEY_CHECKS = 0;',
    '',
    'DELETE FROM rendeles_elemek;',
    'DELETE FROM menuk;',
    'DELETE FROM keszetel_hozzavalok_kapcsolo;',
    'DELETE FROM keszetelek;',
    'DELETE FROM koretek;',
    'DELETE FROM uditok;',
    'DELETE FROM hozzavalok;',
    'DELETE FROM kategoria;',
    '',
    'ALTER TABLE kategoria AUTO_INCREMENT = 1;',
    'ALTER TABLE hozzavalok AUTO_INCREMENT = 1;',
    'ALTER TABLE keszetelek AUTO_INCREMENT = 1;',
    'ALTER TABLE koretek AUTO_INCREMENT = 1;',
    'ALTER TABLE uditok AUTO_INCREMENT = 1;',
    'ALTER TABLE menuk AUTO_INCREMENT = 1;',
    '',
    '-- Kategóriák',
  ];

  for (const row of dataset.categoryRows) {
    lines.push(
      `INSERT INTO kategoria (id, nev) VALUES (${row.id}, ${sqlString(row.name)});`
    );
  }

  lines.push('', '-- Hozzávalók');
  for (const row of dataset.ingredientRows) {
    lines.push(
      `INSERT INTO hozzavalok (id, hozzavalo_nev) VALUES (${row.id}, ${sqlString(row.name)});`
    );
  }

  lines.push('', '-- Készételek');
  for (const row of dataset.dishRows) {
    lines.push(
      `INSERT INTO keszetelek (id, nev, leiras, elerheto, kategoria_id, ar, kep) VALUES (${row.id}, ${sqlString(row.name)}, ${sqlString(row.description)}, ${row.available}, ${row.categoryId}, ${row.price}, ${sqlBlob(row.image)});`
    );
  }

  lines.push('', '-- Készételek és hozzávalók kapcsolatai');
  for (const row of dataset.dishIngredientRows) {
    lines.push(
      `INSERT INTO keszetel_hozzavalok_kapcsolo (keszetel_id, hozzavalok_id) VALUES (${row.dishId}, ${row.ingredientId});`
    );
  }

  lines.push('', '-- Köretek');
  for (const row of dataset.sideRows) {
    lines.push(
      `INSERT INTO koretek (id, nev, leiras, elerheto, ar, kep) VALUES (${row.id}, ${sqlString(row.name)}, ${sqlString(row.description)}, ${row.available}, ${row.price}, ${sqlBlob(row.image)});`
    );
  }

  lines.push('', '-- Üdítők');
  for (const row of dataset.drinkRows) {
    lines.push(
      `INSERT INTO uditok (id, nev, elerheto, ar, kep) VALUES (${row.id}, ${sqlString(row.name)}, ${row.available}, ${row.price}, ${sqlBlob(row.image)});`
    );
  }

  lines.push('', '-- Menük');
  for (const row of dataset.menuRows) {
    lines.push(
      `INSERT INTO menuk (id, menu_nev, keszetel_id, koret_id, udito_id, elerheto, ar, kep) VALUES (${row.id}, ${sqlString(row.name)}, ${row.dishId}, ${row.sideId}, ${row.drinkId}, ${row.available}, ${row.price}, ${sqlBlob(row.image)});`
    );
  }

  lines.push('', 'SET FOREIGN_KEY_CHECKS = 1;', '');
  return `${lines.join('\n')}`;
}

function buildAttributionManifest(attributions) {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      provider: 'Pexels',
      note: 'If these downloaded images are shown publicly, keep visible attribution to Pexels and the photographer.',
      items: attributions,
    },
    null,
    2
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureSipsAvailable();
  if (args.imageSource === 'pexels') {
    ensurePexelsConfigured(args.pexelsApiKey);
  }

  const dataset = buildDataset();
  validateDataset(dataset);
  const imageAttributions = [];

  if (args.imageSource === 'pexels') {
    const usedPexelsPhotoKeys = new Set();
    const usedDishPhotographers = new Set();
    const usedSidePhotographers = new Set();
    const usedDrinkPhotographers = new Set();
    const usedMenuPhotographers = new Set();

    await attachPexelsImages(dataset.dishRows, 'dish', (record) => ({
      ...record.imageSearch,
      kind: 'dish',
    }), args.pexelsApiKey, imageAttributions, usedPexelsPhotoKeys, usedDishPhotographers);

    await attachPexelsImages(dataset.sideRows, 'side', (record) => ({
      ...record.imageSearch,
      kind: 'side',
    }), args.pexelsApiKey, imageAttributions, usedPexelsPhotoKeys, usedSidePhotographers);

    await attachPexelsImages(dataset.drinkRows, 'drink', (record) => ({
      ...record.imageSearch,
      kind: 'drink',
    }), args.pexelsApiKey, imageAttributions, usedPexelsPhotoKeys, usedDrinkPhotographers);

    await attachPexelsImages(dataset.menuRows, 'menu', (record) => ({
      ...record.imageSearch,
      kind: 'menu',
    }), args.pexelsApiKey, imageAttributions, usedPexelsPhotoKeys, usedMenuPhotographers);
  } else {
    await attachImages(dataset.dishRows, 'dish', (record) => ({
      palette: pickPalette(record.id - 1),
      badge: 'ETEL',
      title: record.name,
      subtitle: record.description,
      footer: `${record.price} HUF`,
    }));

    await attachImages(dataset.sideRows, 'side', (record) => ({
      palette: pickPalette(record.id + 7),
      badge: 'KÖRET',
      title: record.name,
      subtitle: record.description,
      footer: `${record.price} HUF`,
    }));

    await attachImages(dataset.drinkRows, 'drink', (record) => ({
      palette: pickPalette(record.id + 13),
      badge: 'ÜDÍTŐ',
      title: record.name,
      subtitle: 'Friss demókép a katalógushoz',
      footer: `${record.price} HUF`,
    }));

    await attachImages(dataset.menuRows, 'menu', (record) => ({
      palette: pickPalette(record.id + 19),
      badge: 'MENU',
      title: record.name,
      subtitle: `${record.dishName} + ${record.sideName} + ${record.drinkName}`,
      footer: `${record.price} HUF`,
    }));
  }

  const sql = buildSql(dataset);
  await writeFile(args.output, sql, 'utf8');

  if (args.imageSource === 'pexels') {
    await writeFile(args.attributionOutput, buildAttributionManifest(imageAttributions), 'utf8');
  }

  console.log(`Generálva: ${path.relative(projectRoot, args.output)}`);
  console.log(`Képforrás: ${args.imageSource}`);
  if (args.imageSource === 'pexels') {
    console.log(`Attribúció: ${path.relative(projectRoot, args.attributionOutput)}`);
  }
  console.log(`Kategóriák: ${dataset.categoryRows.length}`);
  console.log(`Hozzávalók: ${dataset.ingredientRows.length}`);
  console.log(`Készételek: ${dataset.dishRows.length}`);
  console.log(`Köretek: ${dataset.sideRows.length}`);
  console.log(`Üdítők: ${dataset.drinkRows.length}`);
  console.log(`Menük: ${dataset.menuRows.length}`);
  console.log(`Készételek-hozzávalók kapcsolatok: ${dataset.dishIngredientRows.length}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});