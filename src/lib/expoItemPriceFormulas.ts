export type ExpoItemPriceCtx = {
  animalCount: number;
  dogs: number;
  cats: number;
};

type PriceFormula = (ctx: ExpoItemPriceCtx) => number | null;

/** Precio escalonado según cantidad total de mascotas. Usa el último valor para cantidades mayores al array. */
function tiered(...prices: number[]): PriceFormula {
  return ({ animalCount }) => {
    if (animalCount <= 0) return null;
    return prices[Math.min(animalCount - 1, prices.length - 1)];
  };
}

/** Precio fijo por mascota. */
function perPet(pricePerPet: number): PriceFormula {
  return ({ animalCount }) => (animalCount > 0 ? animalCount * pricePerPet : null);
}

/**
 * Normaliza item_en a clave de fórmula.
 * Ej: "International Travel Certificate – Americas" → "international_travel_certificate_americas"
 */
export function toFormulaKey(itemEn: string): string {
  return itemEn
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

/** Normaliza nombre de país a clave de fórmula. Ej: "Costa Rica" → "costa_rica" */
export function toCountryKey(country: string | null | undefined): string {
  if (!country) return "";
  return country
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_");
}

// Keys derived from toFormulaKey(item_en) for each items_official EXPO row.
const FORMULAS: Record<string, Record<string, PriceFormula>> = {
  argentina: {
    rnatt:                                              tiered(1778, 2068, 2258),
    export_customs_clearance:                           tiered(200),
  },
  brasil: {
    veterinary_fees:                                    tiered(250, 350, 450),
    international_travel_certificate_eu_south_america:  tiered(450, 530, 610),
    international_travel_certificate_uk_usa:            tiered(600, 680, 760),
    export_customs_clearance:                           tiered(480, 480, 580),
  },
  chile: {
    veterinary_fees:                                    tiered(200, 260, 340),
    international_travel_certificate_americas:          tiered(320, 450, 450),
    international_travel_certificate_non_americas:      tiered(350, 410, 470),
    eu_transit_certificate:                             perPet(120),
  },
  colombia: {
    international_travel_certificate:                   tiered(190, 290, 390),
    domestic_forwarding:                                tiered(780, 880, 980),
  },
  costa_rica: {
    veterinary_fees:                                    tiered(150, 210, 270),
    international_travel_certificate_americas:          tiered(280, 360, 440),
    international_travel_certificate_non_americas:      tiered(280, 360, 440),
    eu_transit_certificate:                             perPet(120),
  },
  ecuador: {
    international_travel_certificate:                   tiered(220, 280, 340),
    domestic_forwarding:                                tiered(780, 880, 980),
  },
  mexico: {
    veterinary_fees:                                    tiered(200, 260, 340),
    international_travel_certificate_americas:          tiered(180, 260, 340),
    international_travel_certificate_non_americas:      tiered(320, 380, 460),
    eu_transit_certificate:                             perPet(120),
  },
};

/**
 * Devuelve el precio calculado como string "USD XXX", o null si no hay fórmula para ese ítem.
 * countryKey y itemKey deben estar normalizados con toCountryKey / toFormulaKey.
 */
export function computeExpoItemPrice(
  countryKey: string,
  itemKey: string,
  ctx: ExpoItemPriceCtx,
): string | null {
  const result = FORMULAS[countryKey]?.[itemKey]?.(ctx);
  return result != null ? String(result) : null;
}
