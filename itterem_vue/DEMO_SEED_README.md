# Demo Seed Generator

This document describes the demo seed generator that was added for the Itterem frontend workspace, what it generates, and how to use Pexels-backed image seeding safely.

## Purpose

The generator exists to produce realistic SQL seed data for the backend database, including image blobs that match the backend's `byte[]` / `mediumblob` image model.

Instead of creating a folder of images plus a separate import step, the generator writes a ready-to-import SQL file where the images are embedded directly into insert statements.

## What Was Added

The generator lives at `scripts/generate-demo-seed.mjs`.

It now supports:

- Hungarian demo content with accented text
- multiple catalog entity types:
	- categories
	- ingredients
	- meals
	- sides
	- drinks
	- menus
- embedded JPEG image blobs in SQL
- two image modes:
	- `placeholder`
	- `pexels`
- attribution output for downloaded Pexels images
- duplicate-image avoidance
- near-duplicate reduction by preferring different photographers within item groups
- a larger seeded catalog with extra categories and menu combinations

## Current Dataset Shape

The generator currently creates:

- 7 categories
- 62 ingredients
- 28 dishes
- 8 sides
- 8 drinks
- 18 menus

Additional categories added during this work:

- `Tészták`
- `Levesek`
- `Tálak`

Examples of added meals:

- `Carbonara spagetti`
- `Bolognai penne`
- `Pesto csirkés penne`
- `Mozzarellás paradicsomos penne`
- `Gulyásleves`
- `Sütőtökkrémleves`
- `Házi húsleves`
- `Paradicsomleves bazsalikommal`
- `Teriyaki csirketál`
- `Görög csirketál`
- `BBQ csirketál`
- `Vegán zöldségtál`

## Output Files

Running the generator produces:

- `generated-demo-seed.sql`
	- the importable SQL seed file
	- contains BLOB image data as large hex strings
- `generated-demo-seed-image-attribution.json`
	- written when `pexels` mode is used
	- records which Pexels photo was selected for each generated item

## Requirements

- Node.js 20+
- npm 10+
- macOS `sips`

Why `sips` is needed:

- placeholder SVGs are converted into JPEGs with it
- downloaded images are normalized into JPEG blobs before being written into SQL

## Image Modes

### Placeholder Mode

Use this when you want a predictable, offline run without calling an image service.

Command:

```bash
npm run generate:seed -- --image-source placeholder
```

Behavior:

- creates branded placeholder images locally
- still writes image blobs into SQL
- does not require a Pexels API key
- does not create the attribution manifest

### Pexels Mode

Use this when you want real food images downloaded and embedded into the SQL seed.

Command:

```bash
npm run generate:seed -- --image-source pexels
```

Behavior:

- queries Pexels for food-related images
- downloads the selected image
- converts it into a JPEG blob
- embeds that blob in the SQL output
- writes attribution metadata into `generated-demo-seed-image-attribution.json`

## Pexels Setup

Store the Pexels API key locally in `.env.local`.

Example:

```env
PEXELS_API_KEY=your_key_here
```

Important notes:

- `.env.local` should stay local and must not be committed
- `package.json` already loads `.env.local` automatically for the generator command
- you do not need to export the variable manually if you use `npm run generate:seed`

## How Pexels Selection Works

The generator does not just take the first search result anymore.

It now:

- searches multiple Pexels results per query
- scores results based on:
	- required terms
	- preferred terms
	- banned terms
- avoids exact duplicate photo reuse
- reduces near-duplicate picks by preferring different photographers within groups

This was added because simple first-result matching produced bad results such as:

- onion rings with steak on the same plate
- rice with shrimp instead of plain rice
- multiple burgers with nearly identical styling

## Usage Flow

### 1. Generate the SQL

For placeholders:

```bash
npm run generate:seed -- --image-source placeholder
```

For Pexels:

```bash
npm run generate:seed -- --image-source pexels
```

### 2. Import the SQL into the Backend Database

Import `generated-demo-seed.sql` into the backend database using your usual MySQL or MariaDB workflow.

The generated SQL:

- clears the relevant catalog tables in foreign-key-safe order
- resets auto-increment counters
- inserts categories, ingredients, meals, sides, drinks, menu records, and relationship rows

### 3. Verify the Backend Data

Useful endpoints to inspect after import:

- `/api/Kategoria`
- `/api/Keszetelek`
- `/api/Koretek`
- `/api/Uditok`
- `/api/Menuk`

If these endpoints return the new seeded names, then the SQL import worked.

## Why the SQL File Looks Strange

The SQL file can look unchanged at a glance because image blobs dominate the file size.

Important details:

- the file is expected to be very large
- image data appears as long `0x...` hex blobs
- editor diff views are not a good way to visually judge image changes

Better verification methods:

- check the file modification timestamp
- check a SHA-256 hash before and after generation
- inspect the attribution JSON
- query the backend API after import

## Attribution

When Pexels mode is used, the generator writes attribution records including:

- item type
- item name
- selected query
- Pexels photo page
- source URL
- photographer name
- photographer profile URL
- alt text

If these downloaded images are shown publicly, keep visible attribution to Pexels and the photographer.

## Troubleshooting

### The generator runs but the SQL file looks the same

Possible reasons:

- the visible part of the SQL has not changed much, but the image blobs have
- the editor did not refresh the file view yet

Recommended checks:

- rerun the generator
- check file timestamp and hash
- inspect `generated-demo-seed-image-attribution.json`

### The import works but the frontend still looks old

This usually means the frontend has not refreshed its catalog state yet.

Checks:

- verify the backend API directly
- reload the frontend page completely
- navigate away and back to the menu page
- if needed, clear frontend cache layers and reload

### Images still feel too similar

There are two levels of duplication to think about:

- exact duplicates
	- same photo reused literally
- near-duplicates
	- different photos from the same photographer or same food series

The generator now reduces both, but image APIs are still imperfect and some categories may need tighter item-specific query tuning.

### Some images are not the exact dish you want

This is a search-quality issue rather than a SQL issue.

Typical fixes:

- narrow the query text
- add stronger required terms
- add banned terms for unwanted food types
- add alternative query variants for the same item

## Related Files

- `scripts/generate-demo-seed.mjs`
- `generated-demo-seed.sql`
- `generated-demo-seed-image-attribution.json`
- `package.json`
- `.env.local`

## Recommended Workflow

1. Add or refine dataset items in `scripts/generate-demo-seed.mjs`.
2. Run `npm run generate:seed -- --image-source pexels`.
3. Inspect `generated-demo-seed-image-attribution.json` for bad matches.
4. Import `generated-demo-seed.sql` into the backend database.
5. Verify the backend endpoints.
6. Reload the frontend and check the rendered catalog.