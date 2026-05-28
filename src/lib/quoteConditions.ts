/**
 * Condiciones dinámicas del cotizador.
 *
 * Al agregar/modificar una condición acá, actualizar también la sección
 * "Condiciones dinámicas del cotizador" en `fe/src/lib/appInsightsSpecs.md`
 * para que la doc liste qué se remueve/agrega y por qué.
 */
import {
  destIsLatamNonArgUsaCanadaEU,
  destIsOceania,
  destIsPanama,
  destIsSouthAfrica,
  originIs,
} from "@/lib/countryGroups";

export type TradeDirectionChoice = "impo" | "expo" | "ambas" | "transito";

export type QuoteCtx = {
  operation: TradeDirectionChoice;
  origin: string;
  destination: string;
};

export type QuoteCondition = {
  id: string;
  match: (ctx: QuoteCtx) => boolean;
  removeItemUuids: string[];
  addItemUuids: string[];
};

function isExpo(op: TradeDirectionChoice): boolean {
  return op === "expo" || op === "ambas";
}

export const quoteConditions: QuoteCondition[] = [
  {
    id: "expo-arg-oceania-sudafrica-tramites-sanitarios",
    match: ({ operation, origin, destination }) =>
      isExpo(operation) &&
      originIs(origin, "argentina") &&
      (destIsOceania(destination) || destIsSouthAfrica(destination)),
    removeItemUuids: [
      "9ca241f0-8a06-453e-b9aa-c31c84c9c884", // RNATT (Argentina EXPO)
      "f7ec58b1-0d6d-4b2f-917c-d8a64710c657", // Veterinary Fees (Argentina EXPO)
      "d1dddc97-4bd5-4ba7-aaae-6ac128ee4f6f", // International Travel Certificate (Argentina EXPO)
    ],
    addItemUuids: [
      "3cbf6b78-450e-4f0c-aaee-31c5f44eb0d7", // Trámites sanitarios (orphan)
    ],
  },
  {
    id: "expo-panama-legalizacion-consular",
    match: ({ operation, destination }) =>
      isExpo(operation) && destIsPanama(destination),
    removeItemUuids: [],
    addItemUuids: [
      "11a041bf-7e5c-4938-aa6c-d0425c288996", // Legalización consular (orphan)
    ],
  },
  {
    id: "expo-arg-latam-usa-eu-international-health-certificate",
    match: ({ operation, origin, destination }) =>
      isExpo(operation) &&
      originIs(origin, "argentina") &&
      destIsLatamNonArgUsaCanadaEU(destination),
    removeItemUuids: [
      "f7ec58b1-0d6d-4b2f-917c-d8a64710c657", // Veterinary Fees (Argentina EXPO)
    ],
    addItemUuids: [],
    // precio e notas del IHC (d1dddc97) se actualizan dinámicamente en demo-coti desde arg_expo_precios
  },
];
