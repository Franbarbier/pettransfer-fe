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
const EXPO_FORMULAS: Record<string, Record<string, PriceFormula>> = {
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

// IMPO formulas: countryKey → airportKey → itemKey → formula.
// La clave especial `_any` agrupa fórmulas que aplican al país sin importar el aeropuerto.
const ANY_AIRPORT = "_any";

const IMPO_FORMULAS: Record<string, Record<string, Record<string, PriceFormula>>> = {
  usa: {
    mia: {
      customs_clearance_mia_airport: tiered(575, 605, 635),
    },
  },
  argentina: {
    eze: {
      customs_clearance_eze_airport:  tiered(1780, 2130, 2480, 2830),
      mandatory_fixed_import_taxes:   tiered(280, 380, 450, 470),
      home_delivery:                  tiered(180, 180, 180, 380),
    },
    [ANY_AIRPORT]: {
      poa_power_of_attorney:          tiered(120),
    },
  },
  chile: {
    scl: {
      customs_clearance:                  tiered(980, 1100, 1220),
      home_delivery:                      tiered(180, 210, 280),
    },
  },
  mexico: {
    mex: {
      customs_clearance_mex_airport:      tiered(1200, 1430, 1680, 1830),
      airline_fee_to_transfer_to_warehouse: tiered(180, 230, 280, 320),
      warehouse_access:                   tiered(120, 140, 160, 180),
      home_delivery_in_metro_mexico_city: tiered(280, 300, 350, 400),
    },
    cun: {
      customs_clearance_cun_airport:      tiered(1350, 1500, 1650),
      warehouse_access:                   tiered(190, 240, 290),
    },
  },
  brasil: {
    gig: {
      customs_clearance_gig_airport:      tiered(1110, 1140, 1200),
      warehouse_and_airport_taxes:        tiered(120, 140, 160),
      mandatory_import_taxes:             tiered(80, 160, 240),
      home_delivery_metro_rio_de_janeiro: tiered(210, 210, 270),
    },
    gru: {
      customs_clearance_gru_airport:      tiered(950, 980, 1010),
      warehouse_and_airport_taxes:        tiered(170, 190, 240),
      home_delivery_metro_so_paulo:       tiered(200, 200, 250),
    },
    vcp: {
      customs_clearance_vcp_airport:      tiered(1110, 1140, 1200),
      warehouse_and_airport_taxes:        tiered(120, 140, 160),
      mandatory_import_taxes:             tiered(80, 160, 240),
      home_delivery:                      tiered(220, 220, 270),
    },
  },
};

/**
 * Devuelve el precio calculado para un ítem IMPO, o null si no hay fórmula.
 * countryKey, airportKey e itemKey deben estar normalizados.
 * Si no hay fórmula específica para el aeropuerto, prueba con la del país (`_any`).
 */
export function computeImpoItemPrice(
  countryKey: string,
  airportKey: string,
  itemKey: string,
  ctx: ExpoItemPriceCtx,
): string | null {
  const formula =
    IMPO_FORMULAS[countryKey]?.[airportKey]?.[itemKey] ??
    IMPO_FORMULAS[countryKey]?.[ANY_AIRPORT]?.[itemKey];
  const result = formula?.(ctx);
  return result != null ? String(result) : null;
}

/**
 * Devuelve el precio calculado como string "USD XXX", o null si no hay fórmula para ese ítem.
 * countryKey y itemKey deben estar normalizados con toCountryKey / toFormulaKey.
 */
export function computeExpoItemPrice(
  countryKey: string,
  itemKey: string,
  ctx: ExpoItemPriceCtx,
): string | null {
  const result = EXPO_FORMULAS[countryKey]?.[itemKey]?.(ctx);
  return result != null ? String(result) : null;
}
