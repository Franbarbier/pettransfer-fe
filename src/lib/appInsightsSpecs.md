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

### `toCountryKey(country: string): string`

Normaliza el nombre del país: lowercase + strip acentos + espacios → `_`.

---

## Agregar una fórmula nueva

1. Agregar la entrada en `FORMULAS` dentro de `expoItemPriceFormulas.ts`, usando como key `toFormulaKey(item_en)` del ítem correspondiente en la tabla `items_official`.
2. Usar `tiered(...prices)` para precios escalonados por cantidad de mascotas, o `perPet(price)` para precio × mascota.
3. No hace falta tocar `demo-coti/page.tsx` — `resolveOfficialPrice` lo levanta automáticamente.
