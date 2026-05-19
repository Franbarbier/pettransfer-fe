# Lógica de precios de ítems oficiales

Este módulo forma parte del formulario de cotización (`app/demo-coti/page.tsx`).
Cuando el usuario elige origen y destino, los ítems de la tabla `items_official` se cargan automáticamente en el presupuesto; es en ese momento cuando se resuelve el precio de cada ítem.

---

## Flujo de resolución de precio

Cada ítem pasa por `resolveOfficialPrice(item)` (definida en `demo-coti/page.tsx`), que sigue este orden:

### 1. Fórmula por cantidad de animales — `computeExpoItemPrice`

Busca si existe una fórmula en `expoItemPriceFormulas.ts` para ese ítem.
Normaliza `item.country` con `toCountryKey` (ej: `"Costa Rica"` → `"costa_rica"`)
y `item.item_en` con `toFormulaKey` (ej: `"Veterinary Fees"` → `"veterinary_fees"`).

Si hay fórmula, calcula el precio con el `animalCount` actual del formulario y devuelve algo como `"USD 250"` (1 mascota), `"USD 350"` (2), `"USD 450"` (3). Ese valor va directo al campo **Precio** del ítem en el presupuesto.

Ítems con fórmula (según país):

| item_en | formula key |
|---|---|
| RNATT | `rnatt` |
| Export Customs Clearance | `export_customs_clearance` |
| Veterinary Fees | `veterinary_fees` |
| International Travel Certificate | `international_travel_certificate` |
| International Travel Certificate – Americas | `international_travel_certificate_americas` |
| International Travel Certificate – Non-Americas | `international_travel_certificate_non_americas` |
| International Travel Certificate – EU / South America | `international_travel_certificate_eu_south_america` |
| International Travel Certificate – UK / USA | `international_travel_certificate_uk_usa` |
| EU Transit Certificate | `eu_transit_certificate` |
| Domestic Forwarding | `domestic_forwarding` |

### 2. Precio fijo "siempre" (fallback)

Si no hay fórmula, mira si `price_ref` contiene la palabra `"siempre"` (ej: `"USD 120 siempre"`, `"USD 350 siempre"`). Si la encuentra, extrae el monto con regex y lo pone en **Precio**.

Ítems así: `Airline Tender` (USD 120), `LATAM Pet Transport Fee` (USD 350), `Export Customs Clearance` de México/Costa Rica (USD 255 / USD 205).

### 3. Sin precio (referencia interna)

Si no hay fórmula ni "siempre", el **Precio queda vacío** y el usuario lo completa a mano. El `price_ref` original se muestra como "Precio ref." debajo de la Nota interna — solo lectura, como orientación operativa.

Ítems así: `Travel Crate`, `Air Freight`, `Collection / Pick-up`, `Boarding / Lodging`, etc.

---

## Funciones exportadas

### `computeExpoItemPrice(countryKey, itemKey, ctx)`

Devuelve `"USD XXX"` si existe una fórmula para la combinación país/ítem, o `null` si no.
`ctx` es `{ animalCount, dogs, cats }` — en la práctica solo `animalCount` afecta los cálculos actuales.

### `toFormulaKey(itemEn: string): string`

Normaliza el nombre en inglés del ítem a clave de fórmula:
- lowercase
- reemplaza guiones (`-`, `–`, `—`) por espacio
- elimina caracteres no alfanuméricos
- reemplaza espacios con `_`

### `toCountryKey(country: string | null | undefined): string`

Normaliza el nombre del país: lowercase + strip acentos + espacios → `_`.
Devuelve `""` si recibe `null`/`undefined`/string vacío (los ítems "huérfanos" tienen `country = NULL`).

---

## Agregar una fórmula nueva

1. Agregar la entrada en `FORMULAS` dentro de `expoItemPriceFormulas.ts`, usando como key `toFormulaKey(item_en)` del ítem correspondiente en la tabla `items_official`.
2. Usar `tiered(...prices)` para precios escalonados por cantidad de mascotas, o `perPet(price)` para precio × mascota.
3. No hace falta tocar `demo-coti/page.tsx` — `resolveOfficialPrice` lo levanta automáticamente.

---

# Condiciones dinámicas del cotizador

Archivo: `fe/src/lib/quoteConditions.ts`

Cuando cambia operación / origen / destino, se evalúan condiciones declarativas que pueden **remover** ítems del presupuesto y **agregar** otros (típicamente ítems "huérfanos" con `operation_type = NULL` en `items_official`).

Cada condición declara:
- `id` — string único kebab-case.
- `match(ctx)` — función pura sobre `{ operation, origin, destination }` que devuelve `true` cuando aplica.
- `removeItemUuids` — UUIDs de `items_official` a remover del presupuesto si están presentes.
- `addItemUuids` — UUIDs a agregar (resueltos contra `officialOrphanItems`).

La aplicación es automática: se integra con el auto-add EXPO en `demo-coti/page.tsx` vía `matchedConditionsSig`, que entra como parte de la firma del effect. Cuando cambia el destino y la condición deja de matchear, los ítems vuelven al estado por defecto.

El usuario puede agregar manualmente los ítems removidos si lo necesita — las condiciones no ocultan opciones del panel "Sugerencias", solo afectan el contenido inicial del presupuesto.

> **Al agregar una condición nueva, anotarla acá abajo además de en el archivo.**

## Condiciones activas

### `expo-arg-oceania-sudafrica-tramites-sanitarios`

**Aplica cuando**: operación EXPO (o ambas) + origen Argentina + destino en Oceanía o Sudáfrica.

**Remueve** (Argentina EXPO):
- RNATT (`9ca241f0-8a06-453e-b9aa-c31c84c9c884`)
- Veterinary Fees (`f7ec58b1-0d6d-4b2f-917c-d8a64710c657`)
- International Travel Certificate (`d1dddc97-4bd5-4ba7-aaae-6ac128ee4f6f`)

**Agrega** (orphan):
- Trámites sanitarios (`3cbf6b78-450e-4f0c-aaee-31c5f44eb0d7`) — el campo `notes` contiene una URL de Dropbox con la info para cotizar. La URL se renderiza como hipervínculo gracias al componente `LinkifiedText`.

Países considerados Oceanía: ver `OCEANIA_COUNTRIES` en `fe/src/lib/countryGroups.ts`.

### `expo-panama-legalizacion-consular`

**Aplica cuando**: operación EXPO (o ambas) + destino Panamá (cualquier origen).

**Remueve**: nada.

**Agrega** (orphan):
- Legalización consular (`11a041bf-7e5c-4938-aa6c-d0425c288996`)

### `expo-arg-latam-usa-eu-international-health-certificate`

**Aplica cuando**: operación EXPO (o ambas) + origen Argentina + destino en LATAM (sin Argentina), Norteamérica (USA/Canadá/Puerto Rico) o Unión Europea.

Países cubiertos: ver `LATAM_NON_ARG`, `NORTH_AMERICA` y `EU_COUNTRIES` en `fe/src/lib/countryGroups.ts` y helper `destIsLatamNonArgUsaCanadaEU`.

**Remueve** (Argentina EXPO):
- Veterinary Fees (`f7ec58b1-0d6d-4b2f-917c-d8a64710c657`) — referido como "vet check" por el equipo.

**Agrega** (orphan):
- International Health Certificate (`c2eb0178-12e3-4a0d-853d-40f26de4cbf0`) — el campo `notes` contiene un Google Sheets con la tabla de precios por destino. Se renderiza como hipervínculo vía `LinkifiedText`.