export type PetRow = {
  id: string;
  tipo: "" | "perro" | "gato";
  raza: string;
  nombre: string;
  crateId: string;
  /** Tamaño libre cuando crateId === CUSTOM_CRATE_ID. */
  customCrateSize: string;
  costo: string;
  /**
   * Si `true`, esta mascota viaja con crate cotizado (se muestra el selector
   * de tamaño/valor y se emite una línea de crate en el PDF). Si `false`, no
   * se cotiza crate para este animal.
   */
  hasCrate: boolean;
  /**
   * Solo relevante en IMPO. Indica si el operador ya decidió que hay jaula
   * (sea provista por cliente o por LATAM). `false` = estado A "sin jaula"
   * (no aparece la columna de crate). Cuando `hasCrate=true` se asume `true`.
   * En EXPO se ignora — siempre hay jaula.
   */
  crateRegistered: boolean;
};

export type QuoteItemDetailJson = {
  detail_order: number;
  detail_text: string;
};

export type QuoteItemJson = {
  quote_item_id: string;
  quote_id: string;
  item_number: number | null;
  display_order: number;
  item_name_raw: string;
  item_catalog_id: string;
  item_display_name: string;
  price_raw: string;
  price_amount: string;
  currency: string;
  inline_note: string | null;
  is_zero_priced: boolean;
  crate_size: number | null;
  details: QuoteItemDetailJson[];
};

export type QuoteRow = {
  import_key: string;
  source_filename: string;
  source_sheet: string | null;
  customer_name: string | null;
  origin: string | null;
  destination: string | null;
  formatted_origin?: string | null;
  formatted_destination?: string | null;
  quotation_date_raw: string | null;
  formatted_quotation_date: string | null;
  travel_date_raw: string | null;
  formatted_travel_date: string | null;
  /** DB: `animals_description` o, si vacío, `animals_raw` (import). */
  animals_raw?: string | null;
  animals_count?: number | null;
  animals_description?: string | null;
  quoted_total_raw: string | null;
  quoted_total_amount: string | null;
  currency: string | null;
  shipment_mode: string | null;
  created_at: string;
  items?: QuoteItemJson[];
};

export type LatamFieldRow = {
  id: string;
  source: "json" | "custom" | "impo" | "similar" | "transito" | "crate";
  /** Clave JSON (`vet_fees`) o id único para filas custom. */
  fieldKey: string;
  /** UUID estable del ítem en items_official (cuando aplica). */
  officialUuid?: string;
  title: string;
  price: string;
  /** Texto de ítem / al cliente. */
  description: string;
  /** Referencia operativa (contenido que venía del JSON como aclaración). */
  internalNote: string;
  /** Precio de referencia de la tabla items_official (solo lectura, no va al PDF). */
  priceRef?: string;
  /** Solo para source === "crate": pet.id estable para matching. */
  petId?: string;
  /** Solo para source === "crate": crateId al momento del último sync (para detectar cambios). */
  syncedCrateId?: string;
};

export type RightPaneBudgetLine =
  | {
      kind: "latam";
      id: string;
      rowId: string;
      title: string;
      description: string;
      price: string;
      /** Poblado solo para líneas de crate (source === "crate"). */
      petId?: string;
    }
  | {
      kind: "pet";
      id: string;
      petIndex: number;
      title: string;
      description: string;
      price: string;
    };

export type PlaceholderCtx = {
  origen: string;
  destino: string;
  codigoAeropuerto: string;
  codigoOrigen: string;
  codigoDestino: string;
  cantidadJaulas: string;
  tamano: string;
  tamanoJaulas: string;
  petsDesc: string;
  aerolinea: string;
};

export type VendedorOption = {
  id: string;
  name: string;
  email: string;
};
