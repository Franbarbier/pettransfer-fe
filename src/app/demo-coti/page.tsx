"use client";

import Image from "next/image";
import {
  Fragment,
  type ChangeEventHandler,
  type ReactElement,
  type TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import headerBanner from "@/assets/header1.png";
import {
  type CrateTariffsByCountryData,
  defaultCostoFromCrateSelection,
  defaultCrateIdForCat,
  defaultCrateIdForDanger,
  filterCrateOptionsForPet,
  formatCrateDescription,
  formatCrateOptionLabel,
  getCrateOptionsForOrigin,
  isBrachyBreed,
  isDangerBreed,
  resolveCrateCountryKey,
} from "@/lib/crateTariffsByCountry";
import { BreedCombobox } from "@/components/BreedCombobox";
import { EmailAutocomplete } from "@/components/EmailAutocomplete";
import { EmailTagInput } from "@/components/EmailTagInput";
import { RichTextEditor } from "@/components/RichTextEditor";
import { plainTextToHtml } from "@/components/RichTextEditor/plainTextToHtml";
import { useBreeds } from "@/hooks/useBreeds";
import { useItemsOfficial, type OfficialItem } from "@/hooks/useItemsOfficial";
import { quoteConditions, type TradeDirectionChoice } from "@/lib/quoteConditions";
import { lookupArgExpoRow, type ArgExpoPrecioRow } from "@/lib/argExpoPrecios";
import { LinkifiedText } from "@/components/linkified-text";
import {
  type LocationSuggestOption,
  parseLocationSuggestList,
} from "@/lib/quoteLocationSuggestions";
import {
  getApiBaseUrl,
  resolveEmailTemplate,
  type EmailTemplateContext,
} from "@/services/api";
import {
  type FolderMatch,
  searchYaCotizados,
  APP_TESTING_PATH,
} from "@/lib/dropboxSearch";
import { buildEmlBase64 } from "@/lib/buildEml";
import { QuotePrintLayout, type QuotePrintData, type QuotePrintCallbacks } from "@/components/QuotePrintLayout";
import { type PdfLang } from "@/lib/pdfLabels";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

const apiBase = getApiBaseUrl().replace(/\/$/, "");

const INITIAL_DISCLAIMER_CONTRACT =
  "a. This price does not include cost of insurance of the animal.\n" +
  "b. Prices charged by third parties may vary, in which case we will inform if there are any variation in the customer's charges.\n" +
  "c. Payment: 100% in advance";

const INITIAL_DISCLAIMER_CONTRACT_ES =
  "a. Este precio no incluye el costo del seguro del animal.\n" +
  "b. Los precios cobrados por terceros pueden variar, en cuyo caso informaremos si hay variaciones en los cargos al cliente.\n" +
  "c. Pago: 100% por adelantado";

type VendedorOption = {
  id: string;
  name: string;
  email: string;
};

/** Clave en localStorage para recordar el último vendedor seleccionado (solo el id). */
const SELECTED_VENDEDOR_STORAGE_KEY = "demo-coti:selected-salesperson";

/** Formato fijo de la línea "Contact" en el PDF con los datos del vendedor elegido. */
function formatVendedorDisclaimer(v: VendedorOption): string {
  return `${v.name} — ${v.email}`;
}

const INITIAL_DISCLAIMER_CONTACT =
  "Mariela Gherghi — mariela@latampettransport.com";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-400";

const labelClass =
  "mb-1 block text-sm font-medium text-zinc-700";

const fieldLabelClass =
  "mb-0.5 block text-xs font-medium text-zinc-600";

/** Inputs en la vista PDF: sin borde/padding, mismo aspecto que texto. */
const pdfPlainClass =
  "min-w-0 border-0 bg-transparent p-0 shadow-none outline-none ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus-visible:outline-none";

const pdfFieldTextClass = `${pdfPlainClass} w-full flex-1 text-[12px] font-normal leading-tight text-zinc-950 placeholder:text-zinc-400`;

/**
 * Campo numérico en la vista PDF: ancho acotado a ~7 dígitos (con miles) para
 * que el prefijo "USD" quede pegado al número y no se separe cuando el valor
 * es corto.
 */
const pdfFieldMonoClass = `${pdfPlainClass} w-[4.5rem] max-w-[4.5rem] text-right font-mono text-[11px] tabular-nums leading-tight text-zinc-950 placeholder:text-zinc-400`;

const pdfFieldDescClass = `${pdfPlainClass} mt-px block w-full resize-none text-[10px] leading-snug text-zinc-700 placeholder:text-zinc-400`;

const pdfDisclaimerAreaClass = `${pdfPlainClass} block w-full resize-y text-[10px] leading-snug text-zinc-800 placeholder:text-zinc-400`;

const MAX_ANIMALS = 20;

/** Devuelve la fecha local de hoy en formato YYYY-MM-DD para `<input type="date">`. */
function todayLocalIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const SPANISH_MONTHS_LONG = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/**
 * Formatea una fecha YYYY-MM-DD como "Mes Día, Año" en español
 * (ej. "Agosto 16, 2026"). Si la fecha es inválida o vacía devuelve "".
 */
function formatIsoDateAsSpanishLong(iso: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!month || month < 1 || month > 12) return "";
  if (!day || day < 1 || day > 31) return "";
  return `${SPANISH_MONTHS_LONG[month - 1]} ${day}, ${year}`;
}

const CUSTOM_CRATE_ID = "__custom_crate__";

type PetRow = {
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

type QuoteItemDetailJson = {
  detail_order: number;
  detail_text: string;
};

type QuoteItemJson = {
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

type QuoteRow = {
  import_key: string;
  source_filename: string;
  source_sheet: string | null;
  customer_name: string | null;
  origin: string | null;
  destination: string | null;
  fwd?: string | null;
  notes?: string | null;
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

type OutlookMailStatus = {
  configured: boolean;
  connected: boolean;
  email?: string;
  displayName?: string;
  error?: string;
};

type EmailThread = {
  id: string;
  subject: string;
  conversationId: string;
  receivedDateTime: string;
  isDraft: boolean;
  from: { emailAddress: { name: string; address: string } };
};

type AppSessionInfo = {
  email: string;
  name: string;
  provider: "microsoft";
  issuedAt: number;
  expiresAt: number;
  microsoftScope?: string;
};

function quoteAnimalsDisplay(q: QuoteRow): string {
  const desc = q.animals_description?.trim();
  if (desc) return desc;
  const raw = q.animals_raw?.trim();
  if (raw) return raw;
  const n = q.animals_count;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) {
    return n === 1 ? "1 animal" : `${n} animales`;
  }
  return "—";
}

/** Suma todos los enteros que aparecen en el texto (ej. "1 perro y 1 gato" → 2). */
function sumDigitsInText(text: string): number {
  const matches = text.match(/\d+/g);
  if (!matches) return 0;
  return matches.reduce((acc, s) => acc + parseInt(s, 10), 0);
}

/**
 * Marca el inicio del footer del XLS original; todo lo que aparece desde acá suele
 * ser condiciones genéricas que se importan mal como ítems/detalles.
 */
const QUOTE_FOOTER_TRIGGER = "conditions of contract";

function containsQuoteFooterTrigger(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.toLowerCase().includes(QUOTE_FOOTER_TRIGGER);
}

/**
 * Recorta el array de ítems (ya ordenado por `display_order`) en cuanto aparece
 * el texto del footer. Si el match está en el título o la nota del ítem,
 * descarta ese ítem y los siguientes. Si el match está en un `detail`,
 * descarta los `details` desde ese punto y también los ítems posteriores.
 */
function stripQuoteItemsAfterFooter(
  items: QuoteItemJson[] | undefined | null,
): QuoteItemJson[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.display_order - b.display_order);
  const result: QuoteItemJson[] = [];
  for (const it of sorted) {
    if (
      containsQuoteFooterTrigger(it.item_name_raw) ||
      containsQuoteFooterTrigger(it.item_display_name) ||
      containsQuoteFooterTrigger(it.inline_note)
    ) {
      return result;
    }
    const detailsSorted = [...(it.details ?? [])].sort(
      (a, b) => a.detail_order - b.detail_order,
    );
    const cutIdx = detailsSorted.findIndex((d) =>
      containsQuoteFooterTrigger(d.detail_text),
    );
    if (cutIdx === -1) {
      result.push(it);
      continue;
    }
    const trimmedDetails = detailsSorted.slice(0, cutIdx);
    result.push({ ...it, details: trimmedDetails });
    return result;
  }
  return result;
}

function stripFooterFromQuotes(quotes: QuoteRow[]): QuoteRow[] {
  return quotes.map((q) => ({
    ...q,
    items: stripQuoteItemsAfterFooter(q.items),
  }));
}

function emptyPet(isExpo = false): PetRow {
  return {
    id: crypto.randomUUID(),
    tipo: "",
    raza: "",
    nombre: "",
    crateId: "",
    customCrateSize: "",
    costo: "",
    hasCrate: isExpo,
    crateRegistered: isExpo,
  };
}


type LatamFieldRow = {
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
  /** Solo para source === "crate": quién provee la jaula. */
  crateProvider?: "latam" | "client";
  title_es?: string;
  title_en?: string;
  description_es?: string;
  description_en?: string;
};

/**
 * Clases de color para distinguir ítems del presupuesto según su origen.
 * Las mismas tintas se usan en los paneles IMPO/EXPO para que el usuario
 * asocie visualmente el ítem con la fuente de donde salió.
 *
 * - `impo`  → sky (celeste) — templates IMPO por destino.
 * - `json`  → violet (violeta) — guía EXPO por origen (JSON LATAM).
 * - `custom` / `similar` → gris neutro (sin tinta).
 */
function latamRowThemeClasses(source: LatamFieldRow["source"]): string {
  switch (source) {
    case "crate":
      return "border-amber-200 bg-amber-50/70 ring-amber-100/80";
    case "impo":
      return "border-sky-200 bg-sky-50/70 ring-sky-100/80";
    case "json":
      return "border-violet-200 bg-violet-50/70 ring-violet-100/80";
    case "transito":
      return "border-emerald-200 bg-emerald-50/70 ring-emerald-100/80";
    case "similar":
    case "custom":
    default:
      return "border-zinc-200/90 bg-zinc-50/40 ring-zinc-100/80";
  }
}

type RightPaneBudgetLine =
  | {
      kind: "latam";
      id: string;
      rowId: string;
      title: string;
      description: string;
      price: string;
      source: LatamFieldRow["source"];
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

const LATAM_CUSTOM_SELECT_VALUE = "__custom__";
const LATAM_ORPHAN_CREATE_VALUE = "__orphan_create__";

function newLatamRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `latam-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}


function truncateForOption(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/** Mismo dibujo que `src/assets/icons/user-svgrepo-com.svg`. */
function UserFieldIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="6" r="4" fill="currentColor" />
      <path
        d="M20 17.5C20 19.9853 20 22 12 22C4 22 4 19.9853 4 17.5C4 15.0147 7.58172 13 12 13C16.4183 13 20 15.0147 20 17.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function formatAnimalsLine(count: number, petsList: PetRow[], lang: "es" | "en" = "en", breeds: import("@/hooks/useBreeds").Breed[] = []): string {
  if (count <= 0) return "—";
  const rows = petsList.slice(0, count);
  const parts = rows.map((p, i) => {
    const tipoLabel = lang === "es"
      ? (p.tipo === "perro" ? "Perro" : p.tipo === "gato" ? "Gato" : "Mascota")
      : (p.tipo === "perro" ? "Dog" : p.tipo === "gato" ? "Cat" : "Pet");
    const name = p.nombre.trim() || `#${i + 1}`;
    const razaEs = p.raza.trim();
    const raza = lang === "en" && razaEs
      ? (breeds.find((b) => b.name_es === razaEs)?.name_en ?? razaEs)
      : razaEs;
    const core = `${tipoLabel} · ${name}`;
    return raza ? `${core} (${raza})` : core;
  });
  const line = parts.join(" | ");
  return line || `${count} animal(s)`;
}

/** Suma importes tipo "270", "270 USD", "1.234,56" (aprox.). */
function parseBudgetAmount(s: string): number | null {
  const t = s.trim();
  if (!t || t === "—") return null;
  const noSpace = t.replace(/\s/g, "");
  const commaDecimal =
    /^-?[\d.]+,\d{1,2}$/.test(noSpace) && noSpace.includes(",")
      ? noSpace.replace(/\./g, "").replace(",", ".")
      : noSpace.replace(/,/g, "");
  const m = commaDecimal.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Extrae código IATA (3 letras mayúsculas) de un campo de texto. Si no encuentra, devuelve el texto completo. */
function extractIataCode(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const paren = t.match(/\(([A-Z]{3})\)/);
  if (paren) return paren[1];
  const word = t.match(/\b([A-Z]{3})\b/);
  if (word) return word[1];
  return t;
}

type PlaceholderCtx = {
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

function resolvePlaceholders(text: string, ctx: PlaceholderCtx): string {
  return text
    .replace(/\[ORIGEN\]/g, ctx.origen || "[ORIGEN]")
    .replace(/\[destino\]/g, ctx.destino || "[destino]")
    .replace(/\[código aeropuerto\]/g, ctx.codigoAeropuerto)
    .replace(/\[codigo origen\]/g, ctx.codigoOrigen)
    .replace(/\[codigo destino\]/g, ctx.codigoDestino)
    .replace(/\[cantidad de jaulas\]/g, ctx.cantidadJaulas || "[cantidad de jaulas]")
    .replace(/\[tamaño\]/g, ctx.tamano || "[tamaño]")
    .replace(/\[tamaño de jaulas\]/g, ctx.tamanoJaulas || "[tamaño de jaulas]")
    .replace(/\[cantidad y tipo de mascotas\]/g, ctx.petsDesc || "[cantidad y tipo de mascotas]")
    .replace(/\[aerolinea\]/g, ctx.aerolinea || "[aerolinea]");
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Altura del textarea según el contenido (sin scroll interno). */
function AutoHeightDescriptionTextarea({
  className,
  minHeightPx = 44,
  value,
  onChange,
  style,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows" | "onChange"> & {
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  minHeightPx?: number;
}): ReactElement {
  const ref = useRef<HTMLTextAreaElement>(null);
  const v = value ?? "";

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, minHeightPx)}px`;
  }, [minHeightPx]);

  useLayoutEffect(() => {
    resize();
  }, [v, resize]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={v}
      onChange={(e) => {
        onChange(e);
        requestAnimationFrame(resize);
      }}
      className={className}
      style={{ overflow: "hidden", resize: "none", ...style }}
      {...rest}
    />
  );
}


type SortableLatamRowProps = {
  row: LatamFieldRow;
  rowIdx: number;
  placeholderCtx: PlaceholderCtx;
  updateLatamRow: (id: string, patch: Partial<Pick<LatamFieldRow, "title" | "price" | "description">>) => void;
  removeLatamRow: (id: string) => void;
  removeCrateFromPet: (petIndex: number) => void;
  unregisterCrate: (petIndex: number) => void;
  pets: PetRow[];
  isOverlay?: boolean;
};

function SortableLatamRow({
  row,
  rowIdx,
  placeholderCtx,
  updateLatamRow,
  removeLatamRow,
  removeCrateFromPet,
  unregisterCrate,
  pets,
  isOverlay = false,
}: SortableLatamRowProps): ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="listitem"
      className={`relative flex items-start gap-3 rounded-lg border p-3 shadow-sm ring-1 transition ${latamRowThemeClasses(row.source)}${isDragging && !isOverlay ? " opacity-40" : ""}${isOverlay ? " rotate-[0.5deg] shadow-2xl" : ""}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...listeners}
        {...attributes}
        className="mt-1 flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing"
        aria-label={`Reordenar ítem ${rowIdx + 1}: ${row.title || "sin título"}`}
        title="Arrastrá para reordenar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden
        >
          <circle cx="9" cy="6" r="1.6" />
          <circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" />
          <circle cx="15" cy="18" r="1.6" />
        </svg>
      </button>
      <span
        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-[11px] font-bold tabular-nums text-zinc-600 shadow-sm"
        aria-hidden
      >
        {rowIdx + 1}
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
          <div className="min-w-0 flex-1">
            <label
              htmlFor={`dc02-latam-title-${row.id}`}
              className={fieldLabelClass}
            >
              Título
            </label>
            <input
              id={`dc02-latam-title-${row.id}`}
              type="text"
              autoComplete="off"
              value={row.title}
              onChange={(e) =>
                updateLatamRow(row.id, { title: e.target.value })
              }
              className={inputClass}
            />
          </div>
          <div className="w-full shrink-0 sm:w-[7.5rem] md:w-36">
            <label
              htmlFor={`dc02-latam-price-${row.id}`}
              className={fieldLabelClass}
            >
              Precio
            </label>
            <input
              id={`dc02-latam-price-${row.id}`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={row.price}
              onChange={(e) =>
                updateLatamRow(row.id, {
                  price: e.target.value.replace(/[^0-9.,]/g, ""),
                })
              }
              className={`${inputClass} tabular-nums`}
              placeholder="—"
            />
          </div>
        </div>
        {row.source === "crate" ? (
          <p className="font-mono text-[10px] text-amber-600/70">
            {row.crateProvider === "client" ? "Crate · cliente provee" : "Crate · LATAM provee"}
          </p>
        ) : row.source === "impo" || row.source === "similar" ? (
          <p className="font-mono text-[10px] text-zinc-400">
            {row.source === "impo" ? "IMPO · " : "Similar · "}
            {row.fieldKey}
          </p>
        ) : null}
        <div>
          <label
            htmlFor={`dc02-latam-desc-${row.id}`}
            className={fieldLabelClass}
          >
            Descripción
          </label>
          <AutoHeightDescriptionTextarea
            id={`dc02-latam-desc-${row.id}`}
            value={resolvePlaceholders(row.description, placeholderCtx)}
            onChange={(e) =>
              updateLatamRow(row.id, { description: e.target.value })
            }
            minHeightPx={52}
            className={`${inputClass} font-sans`}
            placeholder="Texto para el ítem / cotización"
          />
        </div>
        {row.source !== "crate" ? (
          <div>
            <p className={fieldLabelClass}>Nota interna</p>
            {row.internalNote.trim() !== "" ? (
              <LinkifiedText
                text={row.internalNote}
                className="text-[11px] leading-relaxed text-zinc-500"
              />
            ) : (
              <p className="text-[11px] leading-relaxed text-zinc-500">—</p>
            )}
            {row.priceRef ? (
              <p className="mt-1 font-mono text-[10px] text-zinc-400">
                Precio ref.: {row.priceRef}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {row.source === "crate" && row.petId ? (
        <div className="mt-7 flex shrink-0 flex-col gap-1 sm:mt-8">
          <button
            type="button"
            onClick={() => {
              const petIndex = pets.findIndex((p) => p.id === row.petId);
              if (petIndex >= 0) removeCrateFromPet(petIndex);
            }}
            className="shrink-0 rounded-md p-2 text-zinc-500 transition hover:bg-amber-50 hover:text-amber-700"
            aria-label={`Quitar jaula de cotización: ${row.title}`}
            title="Quitar como ítem a cotizar (cliente provee)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              const petIndex = pets.findIndex((p) => p.id === row.petId);
              if (petIndex >= 0) unregisterCrate(petIndex);
            }}
            className="shrink-0 rounded-md p-2 text-zinc-500 transition hover:bg-red-50 hover:text-red-700"
            aria-label={`Quitar jaula de cotización: ${row.title}`}
            title="Quitar jaula (sin crate en la cotización)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" x2="10" y1="11" y2="17" />
              <line x1="14" x2="14" y1="11" y2="17" />
            </svg>
          </button>
        </div>
      ) : row.source === "crate" ? null : (
        <button
          type="button"
          onClick={() => removeLatamRow(row.id)}
          className="mt-7 shrink-0 rounded-md p-2 text-zinc-500 transition hover:bg-red-50 hover:text-red-700 sm:mt-8"
          aria-label={`Quitar ${row.title}`}
          title="Eliminar fila"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden
          >
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" x2="10" y1="11" y2="17" />
            <line x1="14" x2="14" y1="11" y2="17" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function DemoCoti01Page(): React.JSX.Element {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [fwd, setFwd] = useState("");
  const [notes, setNotes] = useState("");
  const [tradeDirection, setTradeDirection] =
    useState<TradeDirectionChoice>("impo");
  const [transitCountry, setTransitCountry] = useState<"argentina" | "chile">(
    "argentina",
  );
  const [originOpen, setOriginOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);
  const [originSuggestions, setOriginSuggestions] = useState<
    LocationSuggestOption[]
  >([]);
  const [destSuggestions, setDestSuggestions] = useState<
    LocationSuggestOption[]
  >([]);
  const [loadingSuggestO, setLoadingSuggestO] = useState(false);
  const [loadingSuggestD, setLoadingSuggestD] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [quoteExpanded, setQuoteExpanded] = useState<Record<string, boolean>>({});

  const [crateTariffsData, setCrateTariffsData] =
    useState<CrateTariffsByCountryData | null>(null);
  const [crateTariffsLoading, setCrateTariffsLoading] = useState(true);
  const [crateTariffsError, setCrateTariffsError] = useState<string | null>(
    null,
  );

  const [customerName, setCustomerName] = useState("");
  const [agentName, setAgentName] = useState("");
  const [animalCount, setAnimalCount] = useState(1);
  const [pets, setPets] = useState<PetRow[]>([emptyPet()]);
  const [quotedDate, setQuotedDate] = useState(() => todayLocalIsoDate());
  const [travelDate, setTravelDate] = useState("");
  const [aerolinea, setAerolinea] = useState("");
  const [disclaimerContract, setDisclaimerContract] = useState(
    INITIAL_DISCLAIMER_CONTRACT,
  );
  const [disclaimerContact, setDisclaimerContact] = useState(
    INITIAL_DISCLAIMER_CONTACT,
  );
  const [vendedores, setVendedores] = useState<VendedorOption[]>([]);
  const [selectedVendedorId, setSelectedVendedorId] = useState<string>("");
  const [vendedoresLoading, setVendedoresLoading] = useState(false);
  const [vendedoresError, setVendedoresError] = useState<string | null>(null);
  const [currentAppSession, setCurrentAppSession] = useState<AppSessionInfo | null>(
    null,
  );
  const [vendedoresManagerOpen, setVendedoresManagerOpen] = useState(false);
  const [vendedorDraftName, setVendedorDraftName] = useState("");
  const [vendedorDraftEmail, setVendedorDraftEmail] = useState("");
  const [vendedorDraftSubmitting, setVendedorDraftSubmitting] = useState(false);
  const [editingVendedorId, setEditingVendedorId] = useState<string | null>(
    null,
  );
  const [editVendedorName, setEditVendedorName] = useState("");
  const [editVendedorEmail, setEditVendedorEmail] = useState("");
  const [editVendedorSubmitting, setEditVendedorSubmitting] = useState(false);
  const [latamRows, setLatamRows] = useState<LatamFieldRow[]>([]);
  const [argExpoPrecios, setArgExpoPrecios] = useState<ArgExpoPrecioRow[]>([]);
  /** Claves de filas de crate excluidas explícitamente por el usuario (petId).
   *  Si una clave está acá, el effect de sync no genera la fila correspondiente. */
  const [excludedCrateKeys, setExcludedCrateKeys] = useState<Set<string>>(() => new Set());
  const [latamCustomFormOpen, setLatamCustomFormOpen] = useState(false);
  const [latamCustomTitle, setLatamCustomTitle] = useState("");
  const [latamCustomDesc, setLatamCustomDesc] = useState("");
  const [latamCustomPrice, setLatamCustomPrice] = useState("");
  const [officialItemModalOpen, setOfficialItemModalOpen] = useState(false);
  const [officialItemEn, setOfficialItemEn] = useState("");
  const [officialItemEs, setOfficialItemEs] = useState("");
  const [officialPriceRef, setOfficialPriceRef] = useState("");
  const [officialDescEn, setOfficialDescEn] = useState("");
  const [officialDescEs, setOfficialDescEs] = useState("");
  const [officialNotes, setOfficialNotes] = useState("");
  const [officialAirport, setOfficialAirport] = useState("");
  const [officialCountry, setOfficialCountry] = useState("");
  const [officialSubmitting, setOfficialSubmitting] = useState(false);
  const [officialError, setOfficialError] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(true);
  const [pdfLang, setPdfLang] = useState<PdfLang>("en");
  const [emailDrawerOpen, setEmailDrawerOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailCc, setEmailCc] = useState<string[]>([]);
  const [emailDownloadPdf, setEmailDownloadPdf] = useState(true);
  const [emailSending, setEmailSending] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [savingQuote, setSavingQuote] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [emailResult, setEmailResult] = useState<"ok" | "error" | null>(null);
  const [emailError, setEmailError] = useState("");
  const [emailTemplateLoading, setEmailTemplateLoading] = useState(false);
  const [emailTemplateCode, setEmailTemplateCode] = useState("");
  const [ccRecommendedAgent, setCcRecommendedAgent] = useState(false);
  const [tipoOperacion, setTipoOperacion] = useState<"EXPO" | "IMPO">("EXPO");
  const [referidoStarwood, setReferidoStarwood] = useState(false);
  const [recommendedAgentName, setRecommendedAgentName] = useState("");
  const [recommendedAgentEmail, setRecommendedAgentEmail] = useState("");
  const [threadResults, setThreadResults] = useState<EmailThread[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadSearchError, setThreadSearchError] = useState("");
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [dbxUploadStatus, setDbxUploadStatus] = useState<"idle" | "uploading" | "done" | "error" | "not-found">("idle");
  const [dbxUploadError, setDbxUploadError] = useState<string | null>(null);
  const [dbxMatchedFolderName, setDbxMatchedFolderName] = useState<string | null>(null);
  const [dbxFolderLink, setDbxFolderLink] = useState<string | null>(null);
  const [dbxUploadModalOpen, setDbxUploadModalOpen] = useState(false);

  const [outlookConnectModalOpen, setOutlookConnectModalOpen] = useState(false);
  const [outlookStatus, setOutlookStatus] = useState<OutlookMailStatus | null>(
    null,
  );
  const [outlookStatusLoading, setOutlookStatusLoading] = useState(true);
  const [outlookDisconnecting, setOutlookDisconnecting] = useState(false);
  const [similarQuotesTableOpen, setSimilarQuotesTableOpen] =
    useState(false);
  const [impoGuidePanelOpen, setImpoGuidePanelOpen] = useState(false);
  const [expoGuidePanelOpen, setExpoGuidePanelOpen] = useState(false);
  const [deletedToast, setDeletedToast] = useState<{
    item: LatamFieldRow;
    index: number;
  } | null>(null);
  const deletedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Cotizaciones similares: primero las que coinciden en cantidad de mascotas (# animales del formulario). */
  const similarQuotesSortedByPetMatch = useMemo(() => {
    const list = [...quotes];
    list.sort((a, b) => {
      const ca = sumDigitsInText(quoteAnimalsDisplay(a));
      const cb = sumDigitsInText(quoteAnimalsDisplay(b));
      const ma = ca === animalCount;
      const mb = cb === animalCount;
      if (ma === mb) return 0;
      return ma ? -1 : 1;
    });
    return list;
  }, [quotes, animalCount]);

  const originWrapRef = useRef<HTMLDivElement>(null);
  const destWrapRef = useRef<HTMLDivElement>(null);
  const isFirstOutlookCheckRef = useRef(true);

  const debouncedOrigin = useDebounced(origin, 280);
  const debouncedDest = useDebounced(destination, 280);

  const loadOutlookStatus = useCallback(async (): Promise<void> => {
    setOutlookStatusLoading(true);
    try {
      const res = await fetch("/api/microsoft/oauth/status", {
        cache: "no-store",
      });
      const data = (await res.json()) as OutlookMailStatus;
      setOutlookStatus(data);
    } catch (e) {
      setOutlookStatus({
        configured: false,
        connected: false,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setOutlookStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOutlookStatus();
  }, [loadOutlookStatus]);

  useEffect(() => {
    if (outlookStatusLoading) return;
    if (!isFirstOutlookCheckRef.current) return;
    isFirstOutlookCheckRef.current = false;
    if (outlookStatus && !outlookStatus.connected) {
      setOutlookConnectModalOpen(true);
    }
  }, [outlookStatusLoading, outlookStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outlook = params.get("outlook");
    const outlookMessage = params.get("outlook_message");
    if (!outlook) return;

    if (outlook === "connected") {
      setEmailResult(null);
      setEmailError("");
      setOutlookConnectModalOpen(false);
      setEmailDrawerOpen(true);
      void loadOutlookStatus();
    } else if (outlook === "error") {
      setEmailResult("error");
      setEmailError(outlookMessage || "No se pudo conectar la cuenta Outlook.");
      setOutlookConnectModalOpen(false);
      setEmailDrawerOpen(true);
      void loadOutlookStatus();
    }

    params.delete("outlook");
    params.delete("outlook_message");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, [loadOutlookStatus]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setCurrentAppSession(null);
          return;
        }
        const body = (await res.json()) as {
          authenticated?: boolean;
          session?: AppSessionInfo;
        };
        if (!cancelled) {
          setCurrentAppSession(body.authenticated ? (body.session ?? null) : null);
        }
      } catch {
        if (!cancelled) {
          setCurrentAppSession(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      setVendedoresLoading(true);
      setVendedoresError(null);
      try {
        const fetchSalespeople = async (): Promise<VendedorOption[]> => {
          const res = await fetch(`${apiBase}/salespeople`);
          const body: unknown = await res.json().catch(() => ({}));
          if (!res.ok) {
            const err =
              typeof body === "object" && body !== null && "error" in body
                ? String((body as { error: unknown }).error)
                : res.statusText;
            throw new Error(err);
          }
          if (
            typeof body === "object" &&
            body !== null &&
            "salespeople" in body &&
            Array.isArray((body as { salespeople: unknown }).salespeople)
          ) {
            return (body as { salespeople: VendedorOption[] }).salespeople.map((v) => ({
              id: v.id,
              name: v.name,
              email: v.email,
            }));
          }
          return [];
        };

        let list = await fetchSalespeople();
        let loggedSalespersonId = "";

        if (currentAppSession?.email) {
          const normalizedEmail = currentAppSession.email.trim().toLowerCase();
          let match = list.find(
            (v) => v.email.trim().toLowerCase() === normalizedEmail,
          );

          if (!match) {
            const createRes = await fetch(`${apiBase}/salespeople`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name: currentAppSession.name.trim() || normalizedEmail,
                email: normalizedEmail,
              }),
            });

            if (createRes.ok) {
              const createdBody = (await createRes.json().catch(() => ({}))) as {
                salesperson?: VendedorOption;
              };
              if (createdBody.salesperson) {
                match = createdBody.salesperson;
                list = [...list, createdBody.salesperson].sort((a, b) =>
                  a.name.localeCompare(b.name),
                );
              }
            } else if (createRes.status === 409) {
              list = await fetchSalespeople();
              match = list.find(
                (v) => v.email.trim().toLowerCase() === normalizedEmail,
              );
            } else {
              const createBody: unknown = await createRes.json().catch(() => ({}));
              const err =
                typeof createBody === "object" &&
                createBody !== null &&
                "error" in createBody
                  ? JSON.stringify((createBody as { error: unknown }).error)
                  : createRes.statusText;
              throw new Error(
                err || "No se pudo crear el vendedor para el usuario actual.",
              );
            }
          }

          if (match) {
            loggedSalespersonId = match.id;
          }
        }

        setVendedores(list);
        try {
          const stored = localStorage.getItem(SELECTED_VENDEDOR_STORAGE_KEY);
          const resolved =
            loggedSalespersonId ||
            (stored && list.some((v) => v.id === stored) ? stored : "") ||
            list[0]?.id ||
            "";
          setSelectedVendedorId(resolved);
        } catch {
          setSelectedVendedorId(loggedSalespersonId || list[0]?.id || "");
        }
      } catch (e: unknown) {
        setVendedoresError(e instanceof Error ? e.message : String(e));
      } finally {
        setVendedoresLoading(false);
      }
    })();
  }, [currentAppSession]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${apiBase}/arg-expo-precios`);
        if (!res.ok) return;
        const data = (await res.json()) as { precios: ArgExpoPrecioRow[] };
        setArgExpoPrecios(data.precios);
      } catch {
        // degradación silenciosa: el IHC dinámico no se agrega si falla el fetch
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedVendedorId) return;
    try {
      localStorage.setItem(SELECTED_VENDEDOR_STORAGE_KEY, selectedVendedorId);
    } catch {
    }
  }, [selectedVendedorId]);

  useEffect(() => {
    if (vendedores.length === 0) return;
    if (!vendedores.some((v) => v.id === selectedVendedorId)) {
      setSelectedVendedorId(vendedores[0].id);
    }
  }, [vendedores, selectedVendedorId]);

  useEffect(() => {
    const v = vendedores.find((x) => x.id === selectedVendedorId);
    if (v) setDisclaimerContact(formatVendedorDisclaimer(v));
  }, [selectedVendedorId, vendedores]);

  const { breeds } = useBreeds();

  const {
    officialExpoItems,
    officialImpoItems,
    officialOrphanItems,
    officialExpoMatchedPais,
    officialImpoMatchedPais,
    officialLoading,
    refetchOfficial,
  } = useItemsOfficial(tradeDirection, debouncedOrigin, debouncedDest);

  const officialExpoItemsForPanel = useMemo(() => {
    const CRATE_KEYS = ["travel crate", "crate pre-delivery"];
    return (officialExpoItems ?? []).filter(
      (item) => !CRATE_KEYS.includes(item.item_en.toLowerCase()),
    );
  }, [officialExpoItems]);

  const matchedConditions = useMemo(
    () =>
      quoteConditions.filter((c) =>
        c.match({
          operation: tradeDirection,
          origin: debouncedOrigin,
          destination: debouncedDest,
        }),
      ),
    [tradeDirection, debouncedOrigin, debouncedDest],
  );

  const conditionRemoveUuids = useMemo(
    () => new Set(matchedConditions.flatMap((c) => c.removeItemUuids)),
    [matchedConditions],
  );

  const conditionAddUuids = useMemo(
    () => matchedConditions.flatMap((c) => c.addItemUuids),
    [matchedConditions],
  );

  const matchedConditionsSig = useMemo(
    () => matchedConditions.map((c) => c.id).sort().join(","),
    [matchedConditions],
  );

  // Basado en `destination` (sin debounce) para remover ítems de condición inmediatamente
  // al cambiar de país, sin esperar los 280ms del debounce.
  const immediateMatchedConditionsSig = useMemo(
    () =>
      quoteConditions
        .filter((c) =>
          c.match({ operation: tradeDirection, origin: debouncedOrigin, destination }),
        )
        .map((c) => c.id)
        .sort()
        .join(","),
    [tradeDirection, debouncedOrigin, destination],
  );

  useEffect(() => {
    setLatamRows((prev) =>
      prev.filter(
        (r) => !(r.source === "custom" && r.fieldKey.startsWith("condition_")),
      ),
    );
  }, [immediateMatchedConditionsSig]);

  useEffect(() => {
    setLatamCustomFormOpen(false);
    setLatamCustomTitle("");
    setLatamCustomDesc("");
    setLatamRows((prev) =>
      prev.filter(
        (r) =>
          r.source !== "json" &&
          !(r.source === "custom" && r.fieldKey.startsWith("condition_")),
      ),
    );
  }, [officialExpoMatchedPais, matchedConditionsSig]);

  const latamJsonOptionsToAdd = useMemo(() => {
    if (!officialExpoItemsForPanel.length) return [];
    const usedJson = new Set(
      latamRows.filter((r) => r.source === "json").map((r) => r.fieldKey),
    );
    return officialExpoItemsForPanel
      .filter((item) => !usedJson.has(`official_expo_${item.id}`))
      .map((item) => ({
        key: `official_expo_${item.id}`,
        title: item.item_en || item.item_es,
        internalNotePreview: [item.price_ref, item.notes].filter(Boolean).join(" · "),
      }));
  }, [officialExpoItemsForPanel, latamRows]);

  const latamImpoOptionsToAdd = useMemo(() => {
    if (!officialImpoItems?.length) return [];
    const usedImpo = new Set(
      latamRows.filter((r) => r.source === "impo").map((r) => r.fieldKey),
    );
    return officialImpoItems
      .filter((item) => !usedImpo.has(`official_impo_${item.id}`))
      .map((item) => ({
        key: `official_impo_${item.id}`,
        title: item.item_en || item.item_es,
        internalNotePreview: [item.airport, item.price_ref, item.notes].filter(Boolean).join(" · "),
      }));
  }, [officialImpoItems, latamRows]);

  const latamTransitoOptionsToAdd = useMemo(() => {
    if (tradeDirection !== "transito") return [];
    const transitLabel = transitCountry === "argentina" ? "Argentina" : "Chile";
    const all = [
      {
        key: "transito_reception",
        title: "Reception and assistance during connection flights",
        price: "USD 350",
        description: "",
        internalNote: "",
        internalNotePreview: "USD 350",
      },
      {
        key: `transito_cargo_${transitCountry}`,
        title: `Cargo freight ${transitLabel} - ${destination}`,
        price: "",
        description: "",
        internalNote: "proveedor + USD 1.000",
        internalNotePreview: "proveedor + USD 1.000",
      },
      {
        key: "transito_latam_fees",
        title: "LATAM Pet Transport fees",
        price: "USD 350",
        description: "",
        internalNote: "",
        internalNotePreview: "USD 350",
      },
    ];
    const usedTransito = new Set(
      latamRows.filter((r) => r.source === "transito").map((r) => r.fieldKey),
    );
    return all.filter((opt) => !usedTransito.has(opt.key));
  }, [tradeDirection, transitCountry, destination, latamRows]);

  const latamOrphanOptionsToAdd = useMemo(() => {
    if (!officialOrphanItems.length) return [];
    const usedOrphan = new Set(
      latamRows.filter((r) => r.source === "custom").map((r) => r.fieldKey),
    );
    return officialOrphanItems
      .filter((item) => !usedOrphan.has(`orphan_${item.id}`))
      .map((item) => ({
        key: `orphan_${item.id}`,
        title: item.item_en || item.item_es,
        internalNotePreview: [item.country, item.price_ref, item.notes].filter(Boolean).join(" · "),
      }));
  }, [officialOrphanItems, latamRows]);

  function removeLatamRow(rowId: string): void {
    const index = latamRows.findIndex((r) => r.id === rowId);
    if (index === -1) return;
    const item = latamRows[index]!;
    if (deletedToastTimerRef.current) clearTimeout(deletedToastTimerRef.current);
    setDeletedToast({ item, index });
    deletedToastTimerRef.current = setTimeout(() => setDeletedToast(null), 5000);
    setLatamRows((prev) => prev.filter((r) => r.id !== rowId));
  }

  function undoDeleteLatamRow(): void {
    if (!deletedToast) return;
    if (deletedToastTimerRef.current) clearTimeout(deletedToastTimerRef.current);
    const { item, index } = deletedToast;
    setLatamRows((prev) => {
      const next = [...prev];
      next.splice(index, 0, item);
      return next;
    });
    setDeletedToast(null);
  }

  async function apiAddVendedor(name: string, email: string): Promise<boolean> {
    const n = name.trim();
    const e = email.trim();
    if (n === "" || e === "") return false;
    setVendedorDraftSubmitting(true);
    setVendedoresError(null);
    try {
      const res = await fetch(`${apiBase}/salespeople`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: n, email: e }),
      });
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          typeof body === "object" && body !== null && "error" in body
            ? JSON.stringify((body as { error: unknown }).error)
            : res.statusText;
        setVendedoresError(err);
        return false;
      }
      if (
        typeof body === "object" &&
        body !== null &&
        "salesperson" in body &&
        typeof (body as { salesperson: unknown }).salesperson === "object"
      ) {
        const v = (body as { salesperson: VendedorOption }).salesperson;
        setVendedores((prev) =>
          [...prev, v].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setSelectedVendedorId(v.id);
        return true;
      }
      return false;
    } catch (err: unknown) {
      setVendedoresError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setVendedorDraftSubmitting(false);
    }
  }

  async function apiUpdateVendedor(
    id: string,
    name: string,
    email: string,
  ): Promise<void> {
    const n = name.trim();
    const e = email.trim();
    if (n === "" || e === "") return;
    setEditVendedorSubmitting(true);
    setVendedoresError(null);
    try {
      const res = await fetch(
        `${apiBase}/salespeople/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: n, email: e }),
        },
      );
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          typeof body === "object" && body !== null && "error" in body
            ? JSON.stringify((body as { error: unknown }).error)
            : res.statusText;
        setVendedoresError(err);
        return;
      }
      if (
        typeof body === "object" &&
        body !== null &&
        "salesperson" in body &&
        typeof (body as { salesperson: unknown }).salesperson === "object"
      ) {
        const v = (body as { salesperson: VendedorOption }).salesperson;
        setVendedores((prev) =>
          prev
            .map((x) => (x.id === v.id ? v : x))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
    } catch (err: unknown) {
      setVendedoresError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditVendedorSubmitting(false);
    }
  }

  async function apiRemoveVendedor(id: string): Promise<void> {
    setVendedoresError(null);
    try {
      const res = await fetch(
        `${apiBase}/salespeople/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 204) {
        const body: unknown = await res.json().catch(() => ({}));
        const err =
          typeof body === "object" && body !== null && "error" in body
            ? String((body as { error: unknown }).error)
            : res.statusText;
        setVendedoresError(err);
        return;
      }
      setVendedores((prev) => prev.filter((v) => v.id !== id));
    } catch (err: unknown) {
      setVendedoresError(err instanceof Error ? err.message : String(err));
    }
  }

  function startEditingVendedor(v: VendedorOption): void {
    setEditingVendedorId(v.id);
    setEditVendedorName(v.name);
    setEditVendedorEmail(v.email);
  }

  function cancelEditingVendedor(): void {
    setEditingVendedorId(null);
    setEditVendedorName("");
    setEditVendedorEmail("");
  }

  async function submitEditingVendedor(): Promise<void> {
    if (!editingVendedorId) return;
    await apiUpdateVendedor(
      editingVendedorId,
      editVendedorName,
      editVendedorEmail,
    );
    if (!vendedoresError) cancelEditingVendedor();
  }

  async function submitNewVendedor(): Promise<void> {
    const ok = await apiAddVendedor(vendedorDraftName, vendedorDraftEmail);
    if (ok) {
      setVendedorDraftName("");
      setVendedorDraftEmail("");
    }
  }

  function handleLatamRowDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;
    setLatamRows((prev) => {
      const oldIndex = prev.findIndex((r) => r.id === active.id);
      const newIndex = prev.findIndex((r) => r.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  /** Quita la mascota en esa posición y baja la cantidad de animales (mín. 1). */
  function removePetAtBudgetIndex(petIndex: number): void {
    setPets((prev) => prev.filter((_, i) => i !== petIndex));
    setAnimalCount((c) => Math.max(1, c - 1));
  }

  function updateLatamRow(
    rowId: string,
    patch: Partial<Pick<LatamFieldRow, "title" | "price" | "description">>,
  ): void {
    setLatamRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
    );
    if (patch.price !== undefined) {
      const row = latamRows.find((r) => r.id === rowId);
      if (row?.source === "crate" && row.petId) {
        const petIndex = pets.findIndex((p) => p.id === row.petId);
        if (petIndex >= 0) {
          setPets((prev) =>
            prev.map((p, i) => (i === petIndex ? { ...p, costo: patch.price! } : p)),
          );
        }
      }
    }
  }

  function updateLatamRowForPdf(
    rowId: string,
    patch: Partial<Pick<LatamFieldRow, "title" | "price" | "description">>,
    lang: PdfLang,
  ): void {
    setLatamRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const next: Partial<LatamFieldRow> = {};
        if (patch.title !== undefined) {
          if (lang === "en") next.title_en = patch.title;
          else next.title_es = patch.title;
        }
        if (patch.description !== undefined) {
          if (lang === "en") next.description_en = patch.description;
          else next.description_es = patch.description;
        }
        if (patch.price !== undefined) next.price = patch.price;
        return { ...r, ...next };
      }),
    );
    if (patch.price !== undefined) {
      const row = latamRows.find((r) => r.id === rowId);
      if (row?.source === "crate" && row.petId) {
        const petIndex = pets.findIndex((p) => p.id === row.petId);
        if (petIndex >= 0) {
          setPets((prev) =>
            prev.map((p, i) => (i === petIndex ? { ...p, costo: patch.price! } : p)),
          );
        }
      }
    }
  }

  function handlePdfLangToggle(): void {
    const next: PdfLang = pdfLang === "en" ? "es" : "en";
    setPdfLang(next);
    if (next === "es" && disclaimerContract === INITIAL_DISCLAIMER_CONTRACT) {
      setDisclaimerContract(INITIAL_DISCLAIMER_CONTRACT_ES);
    } else if (next === "en" && disclaimerContract === INITIAL_DISCLAIMER_CONTRACT_ES) {
      setDisclaimerContract(INITIAL_DISCLAIMER_CONTRACT);
    }
  }

  function resolveOfficialPrice(item: OfficialItem): { price: string; priceRef: string | undefined } {
    const tiers = [item.price_1, item.price_2, item.price_3, item.price_4].filter((v) => v != null);
    if (tiers.length > 0) {
      const value = tiers[Math.min(animalCount - 1, tiers.length - 1)];
      return { price: value ?? "", priceRef: item.price_ref ?? undefined };
    }
    const pr = item.price_ref;
    if (pr?.toLowerCase().includes("siempre")) {
      const match = pr.match(/USD\s*([\d,.]+)/i);
      return { price: match ? match[1].trim() : "", priceRef: pr };
    }
    return { price: "", priceRef: pr ?? undefined };
  }

  function addOfficialImpoItem(item: OfficialItem): void {
    const key = `official_impo_${item.id}`;
    const { price, priceRef } = resolveOfficialPrice(item);
    setLatamRows((prev) => {
      if (prev.some((r) => r.source === "impo" && r.fieldKey === key)) return prev;
      return [
        ...prev,
        {
          id: newLatamRowId(),
          source: "impo",
          fieldKey: key,
          officialUuid: item.uuid,
          title: item.item_en || item.item_es,
          title_en: item.item_en || item.item_es,
          title_es: item.item_es || item.item_en,
          price,
          description: item.description_en ?? item.description_es ?? "",
          description_en: item.description_en ?? item.description_es ?? "",
          description_es: item.description_es ?? item.description_en ?? "",
          internalNote: item.notes ?? "",
          priceRef,
        },
      ];
    });
  }

  function addTransitoOption(transitoKey: string): void {
    const opt = latamTransitoOptionsToAdd.find((o) => o.key === transitoKey);
    if (!opt) return;
    setLatamRows((prev) => {
      if (prev.some((r) => r.source === "transito" && r.fieldKey === transitoKey)) return prev;
      return [
        ...prev,
        {
          id: newLatamRowId(),
          source: "transito",
          fieldKey: transitoKey,
          title: opt.title,
          price: opt.price,
          description: opt.description,
          internalNote: opt.internalNote,
        },
      ];
    });
  }

  function addOrphanItem(orphanKey: string): void {
    const item = officialOrphanItems.find((i) => `orphan_${i.id}` === orphanKey);
    if (!item) return;
    setLatamRows((prev) => {
      if (prev.some((r) => r.source === "custom" && r.fieldKey === orphanKey)) return prev;
      const { price, priceRef } = resolveOfficialPrice(item);
      return [
        ...prev,
        {
          id: newLatamRowId(),
          source: "custom",
          fieldKey: orphanKey,
          officialUuid: item.uuid,
          title: item.item_en || item.item_es,
          title_en: item.item_en || item.item_es,
          title_es: item.item_es || item.item_en,
          price,
          description: item.description_en ?? item.description_es ?? "",
          description_en: item.description_en ?? item.description_es ?? "",
          description_es: item.description_es ?? item.description_en ?? "",
          internalNote: item.notes ?? "",
          priceRef,
        },
      ];
    });
  }

  const addImpoItemsForAirport = useCallback((airport: string | null): void => {
    if (!officialImpoItems?.length) return;
    const airportItems = officialImpoItems.filter((i) => i.airport === airport);
    if (!airportItems.length) return;
    setLatamRows((prev) => {
      const existingKeys = new Set(
        prev.filter((r) => r.source === "impo").map((r) => r.fieldKey),
      );
      const newRows: LatamFieldRow[] = [];
      for (const item of airportItems) {
        const key = `official_impo_${item.id}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        const { price, priceRef } = resolveOfficialPrice(item);
        newRows.push({
          id: newLatamRowId(),
          source: "impo",
          fieldKey: key,
          officialUuid: item.uuid,
          title: item.item_en || item.item_es,
          title_en: item.item_en || item.item_es,
          title_es: item.item_es || item.item_en,
          price,
          description: item.description_en ?? item.description_es ?? "",
          description_en: item.description_en ?? item.description_es ?? "",
          description_es: item.description_es ?? item.description_en ?? "",
          internalNote: item.notes ?? "",
          priceRef,
        });
      }
      if (newRows.length === 0) return prev;
      return [...prev, ...newRows];
    });
  }, [officialImpoItems]);

  function addLatamJsonRow(jsonKey: string): void {
    const item = officialExpoItemsForPanel.find(
      (i) => `official_expo_${i.id}` === jsonKey,
    );
    if (!item) return;
    setLatamRows((prev) => {
      if (prev.some((r) => r.source === "json" && r.fieldKey === jsonKey)) return prev;
      return [
        ...prev,
        (() => {
          const { price, priceRef } = resolveOfficialPrice(item);
          return {
            id: newLatamRowId(),
            source: "json" as const,
            fieldKey: jsonKey,
            officialUuid: item.uuid,
            title: item.item_en || item.item_es,
            title_en: item.item_en || item.item_es,
            title_es: item.item_es || item.item_en,
            price,
            description: item.description_en ?? item.description_es ?? "",
            description_en: item.description_en ?? item.description_es ?? "",
            description_es: item.description_es ?? item.description_en ?? "",
            internalNote: item.notes ?? "",
            priceRef,
          };
        })(),
      ];
    });
  }


  const addAllLatamJsonGuideItems = useCallback((): void => {
    if (!officialExpoItemsForPanel.length) return;
    setLatamRows((prev) => {
      const usedJson = new Set(
        prev.filter((r) => r.source === "json").map((r) => r.fieldKey),
      );
      const usedConditionUuids = new Set(
        prev
          .filter((r) => r.source === "custom" && r.fieldKey.startsWith("condition_"))
          .map((r) => r.officialUuid)
          .filter((u): u is string => !!u),
      );
      const newRows: LatamFieldRow[] = [];
      for (const item of officialExpoItemsForPanel) {
        if (conditionRemoveUuids.has(item.uuid)) continue;
        const key = `official_expo_${item.id}`;
        if (usedJson.has(key)) continue;
        usedJson.add(key);
        const { price, priceRef } = resolveOfficialPrice(item);
        newRows.push({
          id: newLatamRowId(),
          source: "json",
          fieldKey: key,
          officialUuid: item.uuid,
          title: item.item_en || item.item_es,
          title_en: item.item_en || item.item_es,
          title_es: item.item_es || item.item_en,
          price,
          description: item.description_en ?? item.description_es ?? "",
          description_en: item.description_en ?? item.description_es ?? "",
          description_es: item.description_es ?? item.description_en ?? "",
          internalNote: item.notes ?? "",
          priceRef,
        });
      }
      for (const uuid of conditionAddUuids) {
        if (usedConditionUuids.has(uuid)) continue;
        const item = officialOrphanItems.find((i) => i.uuid === uuid);
        if (!item) continue;
        usedConditionUuids.add(uuid);
        const { price, priceRef } = resolveOfficialPrice(item);
        newRows.push({
          id: newLatamRowId(),
          source: "custom",
          fieldKey: `condition_${uuid}`,
          officialUuid: uuid,
          title: item.item_en || item.item_es,
          title_en: item.item_en || item.item_es,
          title_es: item.item_es || item.item_en,
          price,
          description: item.description_en ?? item.description_es ?? "",
          description_en: item.description_en ?? item.description_es ?? "",
          description_es: item.description_es ?? item.description_en ?? "",
          internalNote: item.notes ?? "",
          priceRef,
        });
      }
      if (newRows.length === 0) return prev;
      return [...prev, ...newRows];
    });
  }, [officialExpoItemsForPanel, conditionRemoveUuids, conditionAddUuids, officialOrphanItems]);

  function submitLatamCustom(): void {
    const t = latamCustomTitle.trim();
    if (t === "") return;
    setLatamRows((prev) => [
      ...prev,
      {
        id: newLatamRowId(),
        source: "custom",
        fieldKey: `custom-${newLatamRowId()}`,
        title: t,
        price: latamCustomPrice.trim(),
        description: latamCustomDesc.trim(),
        internalNote: "",
      },
    ]);
    setLatamCustomTitle("");
    setLatamCustomDesc("");
    setLatamCustomPrice("");
    setLatamCustomFormOpen(false);
  }

  function officialItemBtnLabel(): string {
    return "Crear ítem personalizado";
  }

  function openOfficialItemModal(): void {
    setOfficialItemEn("");
    setOfficialItemEs("");
    setOfficialPriceRef("");
    setOfficialDescEn("");
    setOfficialDescEs("");
    setOfficialNotes("");
    setOfficialAirport("");
    setOfficialCountry("");
    setOfficialError(null);
    setOfficialItemModalOpen(true);
  }

  async function submitOfficialItem(): Promise<void> {
    if (!officialItemEn.trim() && !officialItemEs.trim()) return;
    setOfficialSubmitting(true);
    setOfficialError(null);
    try {
      const base = getApiBaseUrl().replace(/\/$/, "");
      const resp = await fetch(`${base}/items-official`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation_type: null,
          airport: officialAirport.trim() || null,
          country: officialCountry.trim() || null,
          item_en: officialItemEn.trim(),
          item_es: officialItemEs.trim(),
          price_ref: officialPriceRef.trim() || null,
          description_en: officialDescEn.trim() || null,
          description_es: officialDescEs.trim() || null,
          notes: officialNotes.trim() || null,
        }),
      });
      if (!resp.ok) {
        const err = (await resp.json()) as { error?: string };
        throw new Error(err.error ?? `Error ${resp.status}`);
      }
      refetchOfficial();
      setOfficialItemModalOpen(false);
    } catch (e: unknown) {
      setOfficialError(e instanceof Error ? e.message : String(e));
    } finally {
      setOfficialSubmitting(false);
    }
  }

  /**
   * Auto-agregado de ítems IMPO y EXPO.
   *
   * Los paneles "IMPO — templates" y "EXPO — guía JSON" arrancan colapsados y
   * sus ítems ya quedan cargados en el presupuesto para que el usuario los
   * edite o elimine. Para evitar que se re-inyecten cuando el usuario los
   * quita, guardamos en un ref la "firma" del último set auto-agregado (país
   * destino + template para IMPO, country_key del JSON para EXPO) y solo
   * volvemos a agregar cuando esa firma cambia (nuevo destino/origen o
   * cambio de dirección).
   */
  const autoAddedImpoSigRef = useRef<string | null>(null);
  const autoAddedExpoSigRef = useRef<string | null>(null);
  const autoAddedTransitoSigRef = useRef<string | null>(null);

  useEffect(() => {
    if (officialLoading) return;
    const includeImpo = tradeDirection === "impo" || tradeDirection === "ambas";
    if (!includeImpo || !officialImpoItems?.length) {
      autoAddedImpoSigRef.current = null;
      return;
    }
    const iataDestino = extractIataCode(destination).toUpperCase();
    const itemsForAirport = iataDestino
      ? officialImpoItems.filter((it) => it.airport?.toUpperCase() === iataDestino)
      : [];
    const sig = `official_impo|${officialImpoMatchedPais ?? ""}|${iataDestino}`;
    if (autoAddedImpoSigRef.current === sig) return;
    setLatamRows((prev) => prev.filter((r) => r.source !== "impo"));
    autoAddedImpoSigRef.current = sig;
    if (!itemsForAirport.length) return;
    setLatamRows((prev) => {
      const existingKeys = new Set(
        prev.filter((r) => r.source === "impo").map((r) => r.fieldKey),
      );
      const newRows: LatamFieldRow[] = [];
      for (const item of itemsForAirport) {
        const key = `official_impo_${item.id}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        const { price, priceRef } = resolveOfficialPrice(item);
        newRows.push({
          id: newLatamRowId(),
          source: "impo",
          fieldKey: key,
          officialUuid: item.uuid,
          title: item.item_en || item.item_es,
          title_en: item.item_en || item.item_es,
          title_es: item.item_es || item.item_en,
          price,
          description: item.description_en ?? item.description_es ?? "",
          description_en: item.description_en ?? item.description_es ?? "",
          description_es: item.description_es ?? item.description_en ?? "",
          internalNote: item.notes ?? "",
          priceRef,
        });
      }
      if (newRows.length === 0) return prev;
      return [...prev, ...newRows];
    });
  }, [officialImpoItems, officialImpoMatchedPais, officialLoading, tradeDirection, destination]);

  useEffect(() => {
    const includeExpo = tradeDirection === "expo" || tradeDirection === "ambas";
    if (!includeExpo || !officialExpoItemsForPanel.length) {
      autoAddedExpoSigRef.current = null;
      return;
    }
    const sig = `${officialExpoMatchedPais ?? ""}|${matchedConditionsSig}`;
    if (autoAddedExpoSigRef.current === sig) return;
    autoAddedExpoSigRef.current = sig;
    addAllLatamJsonGuideItems();
  }, [addAllLatamJsonGuideItems, officialExpoItemsForPanel, officialExpoMatchedPais, tradeDirection, matchedConditionsSig]);

  useEffect(() => {
    if (tradeDirection !== "transito") {
      autoAddedTransitoSigRef.current = null;
      return;
    }
    const transitLabel = transitCountry === "argentina" ? "Argentina" : "Chile";
    const sig = `${transitCountry}|${destination}`;
    if (autoAddedTransitoSigRef.current === sig) return;
    autoAddedTransitoSigRef.current = sig;
    setLatamRows((prev) => prev.filter((r) => r.source !== "transito"));
    const rows: LatamFieldRow[] = [
      {
        id: newLatamRowId(),
        source: "transito",
        fieldKey: "transito_reception",
        title: "Reception and assistance during connection flights",
        price: "USD 350",
        description: "",
        internalNote: "",
      },
      {
        id: newLatamRowId(),
        source: "transito",
        fieldKey: `transito_cargo_${transitCountry}`,
        title: `Cargo freight ${transitLabel} - ${destination}`,
        price: "",
        description: "",
        internalNote: "proveedor + USD 1.000",
      },
      {
        id: newLatamRowId(),
        source: "transito",
        fieldKey: "transito_latam_fees",
        title: "LATAM Pet Transport fees",
        price: "USD 350",
        description: "",
        internalNote: "",
      },
    ];
    setLatamRows((prev) => [...prev, ...rows]);
  }, [tradeDirection, transitCountry, destination]);

  /**
   * Si el usuario cambia la dirección y deja de incluir IMPO/EXPO, quitamos
   * del presupuesto las filas auto-agregadas desde esa fuente para que no
   * queden "huérfanas".
   */
  useEffect(() => {
    if (tradeDirection === "expo") {
      setLatamRows((prev) => prev.filter((r) => r.source !== "impo"));
    }
    if (tradeDirection === "impo") {
      setLatamRows((prev) => prev.filter((r) => r.source !== "json"));
    }
    if (tradeDirection === "transito") {
      setLatamRows((prev) =>
        prev.filter((r) => r.source !== "impo" && r.source !== "json"),
      );
    }
    if (tradeDirection !== "transito") {
      setLatamRows((prev) => prev.filter((r) => r.source !== "transito"));
    }
    if (tradeDirection === "impo" || tradeDirection === "transito") {
      setFwd("");
    }
  }, [tradeDirection]);

  /** Actualiza precios de items oficiales con tarifas por cantidad cuando cambia animalCount. */
  useEffect(() => {
    setLatamRows((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        let item: OfficialItem | undefined;
        if (row.fieldKey.startsWith("official_expo_")) {
          const id = row.fieldKey.slice("official_expo_".length);
          item = (officialExpoItemsForPanel ?? []).find((i) => i.id === id);
        } else if (row.fieldKey.startsWith("official_impo_")) {
          const id = row.fieldKey.slice("official_impo_".length);
          item = officialImpoItems?.find((i) => i.id === id);
        } else if (row.fieldKey.startsWith("orphan_")) {
          const id = row.fieldKey.slice("orphan_".length);
          item = officialOrphanItems.find((i) => i.id === id);
        }
        if (!item) return row;
        const { price } = resolveOfficialPrice(item);
        if (!price || price === row.price) return row;
        changed = true;
        return { ...row, price };
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animalCount]);

  /** Cuando la condición expo-arg-latam-usa-eu está activa, actualiza precio e internalNote
   *  del item "International Health Certificate" (uuid d1dddc97) con datos de arg_expo_precios. */
  useEffect(() => {
    const IHC_UUID = "d1dddc97-4bd5-4ba7-aaae-6ac128ee4f6f";
    const isActive = matchedConditions.some(
      (c) => c.id === "expo-arg-latam-usa-eu-international-health-certificate",
    );
    if (!isActive || argExpoPrecios.length === 0) return;

    const found = lookupArgExpoRow(debouncedDest, animalCount, argExpoPrecios);
    if (!found) return;

    setLatamRows((prev) => {
      const idx = prev.findIndex((r) => r.officialUuid === IHC_UUID);
      if (idx === -1) return prev;
      const row = prev[idx];
      if (row.price === found.precio_usd && row.internalNote === (found.notas ?? "")) return prev;
      const next = [...prev];
      next[idx] = { ...row, price: found.precio_usd, internalNote: found.notas ?? "" };
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedConditions, animalCount, debouncedDest, argExpoPrecios, officialExpoMatchedPais]);

  /** Copia título, descripción (nota + detalles) y precio de un ítem de cotización similar al presupuesto PDF. */
  function importSimilarQuote(q: QuoteRow): void {
    setCustomerName(q.customer_name ?? "");
    setOrigin(q.origin ?? "");
    setDestination(q.destination ?? "");
    setFwd(q.fwd ?? "");
    setNotes(q.notes ?? "");

    const count = Math.max(1, Math.min(q.animals_count ?? 1, MAX_ANIMALS));
    setAnimalCount(count);
    setPets(
      Array.from({ length: count }, () => emptyPet(tradeDirection !== "impo")),
    );

    const items = [...(q.items ?? [])].sort(
      (a, b) => a.display_order - b.display_order,
    );
    const internalBits = [
      `Cotización similar · ${q.import_key}`,
      q.source_filename?.trim(),
    ].filter(Boolean);
    const internalNote = internalBits.join(" · ");
    const rows: LatamFieldRow[] = items.map((it) => {
      const title = (it.item_name_raw || it.item_display_name || "").trim() || "Ítem";
      const descParts: string[] = [];
      if (it.inline_note?.trim()) descParts.push(it.inline_note.trim());
      const det = [...(it.details ?? [])].sort(
        (a, b) => a.detail_order - b.detail_order,
      );
      for (const d of det) {
        const t = d.detail_text?.trim();
        if (t) descParts.push(t);
      }
      const price = [it.price_raw || it.price_amount, it.currency]
        .filter(Boolean)
        .join(" ");
      return {
        id: newLatamRowId(),
        source: "similar",
        fieldKey: `similar-${it.quote_item_id}`,
        title,
        price,
        description: descParts.join("\n\n"),
        internalNote,
      };
    });
    setLatamRows(rows);
  }

  function addSimilarQuoteItemToPdf(q: QuoteRow, it: QuoteItemJson): void {
    const title = (it.item_name_raw || it.item_display_name || "").trim() || "Ítem";
    const descParts: string[] = [];
    if (it.inline_note?.trim()) {
      descParts.push(it.inline_note.trim());
    }
    const det = [...(it.details ?? [])].sort(
      (a, b) => a.detail_order - b.detail_order,
    );
    for (const d of det) {
      const t = d.detail_text?.trim();
      if (t) descParts.push(t);
    }
    const description = descParts.join("\n\n");
    const price = [it.price_raw || it.price_amount, it.currency]
      .filter(Boolean)
      .join(" ");
    const internalBits = [
      `Cotización similar · ${q.import_key}`,
      q.source_filename?.trim(),
    ].filter(Boolean);
    setLatamRows((prev) => [
      ...prev,
      {
        id: newLatamRowId(),
        source: "similar",
        fieldKey: `similar-${it.quote_item_id}`,
        title,
        price,
        description,
        internalNote: internalBits.join(" · "),
      },
    ]);
  }

  const crateOptionsForOrigin = useMemo(
    () => getCrateOptionsForOrigin(crateTariffsData, origin),
    [crateTariffsData, origin],
  );

  /** Sincroniza ítems de crate en latamRows (siempre primeros) con el estado de mascotas. */
  useEffect(() => {
    setLatamRows((prev) => {
      const nonCrateRows = prev.filter((r) => r.source !== "crate");
      const n = Math.min(animalCount, pets.length);
      const existingByPetId = new Map<string, LatamFieldRow>();
      for (const r of prev) {
        if (r.source === "crate" && r.petId) existingByPetId.set(r.petId, r);
      }
      const crateRows: LatamFieldRow[] = [];
      for (let i = 0; i < n; i++) {
        const p = pets[i];
        if (excludedCrateKeys.has(p.id)) continue;
        const isCustom = p.crateId === CUSTOM_CRATE_ID;
        const crate = isCustom ? null : crateOptionsForOrigin.find((c) => c.id === p.crateId);
        const sizeToken = isCustom ? p.customCrateSize.trim() : (crate?.size_code ?? "");
        const sizeLabel = sizeToken ? ` #${sizeToken}` : "";
        if (p.hasCrate) {
          const existing = existingByPetId.get(p.id);
          const crateIdChanged = existing?.syncedCrateId !== p.crateId;
          const providerChanged = existing?.crateProvider !== "latam";
          const defaultDescEn = formatCrateDescription(sizeToken, "en");
          const defaultDescEs = formatCrateDescription(sizeToken, "es");
          const useDefaultDesc = isCustom || !existing || crateIdChanged || providerChanged;
          const title = `Crate${sizeLabel}`;
          crateRows.push({
            id: existing?.id ?? newLatamRowId(),
            source: "crate",
            fieldKey: `crate-${p.id}`,
            petId: p.id,
            syncedCrateId: p.crateId,
            crateProvider: "latam",
            title,
            title_en: title,
            title_es: `Jaula${sizeLabel}`,
            price: p.costo,
            description: useDefaultDesc ? defaultDescEn : existing.description,
            description_en: useDefaultDesc ? defaultDescEn : (existing.description_en ?? existing.description),
            description_es: useDefaultDesc ? defaultDescEs : (existing.description_es ?? defaultDescEs),
            internalNote: "",
          });
        } else if (p.crateRegistered && !p.hasCrate) {
          const existing = existingByPetId.get(p.id);
          const crateIdChanged = existing?.syncedCrateId !== p.crateId;
          const providerChanged = existing?.crateProvider !== "client";
          const title = `Crate${sizeLabel}`;
          const title_es = `Jaula${sizeLabel}`;
          const defaultDescEn = `Client will provide crate${sizeLabel}.\nCrate must meet IATA regulations.`;
          const defaultDescEs = `El cliente proveerá la jaula${sizeLabel}.\nLa jaula debe cumplir con la normativa IATA.`;
          const useDefault = !existing || crateIdChanged || providerChanged;
          crateRows.push({
            id: existing?.id ?? newLatamRowId(),
            source: "crate",
            fieldKey: `crate-${p.id}`,
            petId: p.id,
            syncedCrateId: p.crateId,
            crateProvider: "client",
            title,
            title_en: title,
            title_es,
            price: "0",
            description: useDefault ? defaultDescEn : existing.description,
            description_en: useDefault ? defaultDescEn : (existing.description_en ?? existing.description),
            description_es: useDefault ? defaultDescEs : (existing.description_es ?? defaultDescEs),
            internalNote: "",
          });
        }
      }
      return [...crateRows, ...nonCrateRows];
    });
  }, [pets, animalCount, crateOptionsForOrigin, excludedCrateKeys]);

  /** Vista previa PDF: ítems LATAM (crates ya incluidos primero via latamRows). */
  const rightPaneBudgetLines = useMemo((): RightPaneBudgetLine[] => {
    return latamRows.map((r) => ({
      kind: "latam" as const,
      id: r.id,
      rowId: r.id,
      title: pdfLang === "en" ? (r.title_en ?? r.title) : (r.title_es ?? r.title),
      description: pdfLang === "en" ? (r.description_en ?? r.description) : (r.description_es ?? r.description),
      price: r.price,
      source: r.source,
      petId: r.petId,
    }));
  }, [latamRows, pdfLang]);

  const rightPaneBudgetTotal = useMemo(() => {
    let sum = 0;
    for (const line of rightPaneBudgetLines) {
      const v = parseBudgetAmount(line.price);
      if (v !== null) sum += v;
    }
    return sum;
  }, [rightPaneBudgetLines]);

  const placeholderCtx = useMemo((): PlaceholderCtx => {
    const n = Math.min(animalCount, pets.length);
    const activePets = pets.slice(0, n);
    let dogs = 0, cats = 0;
    for (const p of activePets) {
      if (p.tipo === "perro") dogs++;
      else if (p.tipo === "gato") cats++;
    }
    const descParts: string[] = [];
    if (dogs > 0) descParts.push(`${dogs} ${dogs === 1 ? "perro" : "perros"}`);
    if (cats > 0) descParts.push(`${cats} ${cats === 1 ? "gato" : "gatos"}`);
    const petsDesc = descParts.join(" y ");

    const crateCount = activePets.filter((p) => p.hasCrate).length;
    const uniqueSizes = [
      ...new Set(
        activePets
          .filter((p) => p.hasCrate && p.crateId)
          .map((p) =>
            p.crateId === CUSTOM_CRATE_ID
              ? p.customCrateSize.trim()
              : (crateOptionsForOrigin.find((c) => c.id === p.crateId)?.size_code ?? ""),
          )
          .filter(Boolean),
      ),
    ];
    const allSizes = activePets
      .filter((p) => p.hasCrate && p.crateId)
      .map((p) =>
        p.crateId === CUSTOM_CRATE_ID
          ? p.customCrateSize.trim()
          : (crateOptionsForOrigin.find((c) => c.id === p.crateId)?.size_code ?? ""),
      )
      .filter(Boolean);
    const formatSize = (s: string) => (/^\d/.test(s) ? `#${s}` : s);

    const iataOrigin = extractIataCode(origin);
    const iataDestino = extractIataCode(destination);

    return {
      origen: origin.trim() || "[ORIGEN]",
      destino: destination.trim() || "[destino]",
      codigoAeropuerto: iataOrigin || origin.trim() || "[código aeropuerto]",
      codigoOrigen: iataOrigin || origin.trim() || "[codigo origen]",
      codigoDestino: iataDestino || destination.trim() || "[codigo destino]",
      cantidadJaulas: crateCount > 0 ? String(crateCount) : "",
      tamano: uniqueSizes.join(", "),
      tamanoJaulas: allSizes.map(formatSize).join(", "),
      petsDesc,
      aerolinea,
    };
  }, [animalCount, pets, crateOptionsForOrigin, origin, destination, aerolinea]);

  const printData = useMemo((): QuotePrintData => ({
    customerName,
    agentName,
    origin,
    destination,
    fwd,
    quotedDate,
    travelDate,
    petsLine: formatAnimalsLine(animalCount, pets, pdfLang, breeds),
    budgetLines: rightPaneBudgetLines.map((line) => ({
      id: line.id,
      rowId: line.kind === "latam" ? line.rowId : undefined,
      title: line.title,
      description: resolvePlaceholders(line.description, placeholderCtx),
      price: line.price,
      category:
        line.kind === "latam" && line.source === "impo"
          ? ("impo" as const)
          : line.kind === "latam" && line.source === "json"
            ? ("expo" as const)
            : ("other" as const),
    })),
    total: rightPaneBudgetTotal,
    disclaimerContract,
    disclaimerContact,
    salesman: vendedores.find((v) => v.id === selectedVendedorId),
  }), [customerName, agentName, origin, destination, fwd, quotedDate, travelDate, animalCount, pets, pdfLang, breeds, rightPaneBudgetLines, rightPaneBudgetTotal, placeholderCtx, disclaimerContract, disclaimerContact, vendedores, selectedVendedorId]);

  const detectedCrateCountryKey = useMemo(
    () => resolveCrateCountryKey(origin),
    [origin],
  );

  useEffect(() => {
    const isImpo = tradeDirection === "impo";
    setPets((prev) =>
      prev.map((p) => {
        const danger = isDangerBreed(p.raza, breeds);
        if (danger && !isImpo) {
          const lar82Id = defaultCrateIdForDanger(crateOptionsForOrigin);
          const costo = defaultCostoFromCrateSelection(crateTariffsData, origin, lar82Id);
          if (p.hasCrate && p.crateId === lar82Id && p.costo === costo) return p;
          return { ...p, crateRegistered: true, hasCrate: true, crateId: lar82Id, costo };
        }
        const allowed = filterCrateOptionsForPet(crateOptionsForOrigin, p.tipo);
        const validIds = new Set(allowed.map((c) => c.id));
        let crateId = p.crateId;
        let costo = p.costo;
        if (crateId && crateId !== CUSTOM_CRATE_ID && !validIds.has(crateId)) {
          crateId = "";
          costo = "";
        }
        if (p.hasCrate && p.tipo === "gato" && !crateId) {
          const def = defaultCrateIdForCat(crateOptionsForOrigin);
          if (def) {
            crateId = def;
            costo = defaultCostoFromCrateSelection(crateTariffsData, origin, def);
          }
        }
        if (crateId === p.crateId && costo === p.costo) return p;
        return { ...p, crateId, costo };
      }),
    );
  }, [crateOptionsForOrigin, crateTariffsData, origin, tradeDirection]);

  // Cuando la raza cambia a peligrosa y los efectos de origen/tarifas ya corrieron,
  // asigna LAR 82 de inmediato sin esperar cambio de crateOptionsForOrigin.
  // En IMPO no auto-marca: el operador decide manualmente si incluir el crate.
  useEffect(() => {
    if (tradeDirection === "impo") return;
    const needsFill = pets.some(
      (p) => isDangerBreed(p.raza, breeds) && (!p.hasCrate || p.crateId !== defaultCrateIdForDanger(crateOptionsForOrigin)),
    );
    if (!needsFill) return;
    const lar82Id = defaultCrateIdForDanger(crateOptionsForOrigin);
    setPets((prev) =>
      prev.map((p) => {
        if (!isDangerBreed(p.raza, breeds) || (p.hasCrate && p.crateId === lar82Id)) return p;
        const costo = defaultCostoFromCrateSelection(crateTariffsData, origin, lar82Id);
        return { ...p, crateRegistered: true, hasCrate: true, crateId: lar82Id, costo };
      }),
    );
  }, [pets, crateOptionsForOrigin, crateTariffsData, origin, tradeDirection]);

  useEffect(() => {
    if (tradeDirection === "impo") return;
    setPets((prev) =>
      prev.map((p) =>
        p.crateRegistered ? p : { ...p, hasCrate: true, crateRegistered: true },
      ),
    );
  }, [tradeDirection]);

  useEffect(() => {
    void (async () => {
      setCrateTariffsLoading(true);
      setCrateTariffsError(null);
      try {
        const res = await fetch(
          `${apiBase}/quotes/crate-tariffs-by-country`,
        );
        const body: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          const err =
            typeof body === "object" && body !== null && "error" in body
              ? String((body as { error: unknown }).error)
              : res.statusText;
          setCrateTariffsError(err);
          setCrateTariffsData(null);
          return;
        }
        if (
          typeof body === "object" &&
          body !== null &&
          "countries" in body &&
          typeof (body as { countries: unknown }).countries === "object" &&
          (body as { countries: unknown }).countries !== null
        ) {
          setCrateTariffsData(body as CrateTariffsByCountryData);
        } else {
          setCrateTariffsError("Formato de tarifas inválido");
          setCrateTariffsData(null);
        }
      } catch (e: unknown) {
        setCrateTariffsError(e instanceof Error ? e.message : String(e));
        setCrateTariffsData(null);
      } finally {
        setCrateTariffsLoading(false);
      }
    })();
  }, []);

  const fetchOriginSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setOriginSuggestions([]);
      return;
    }
    setLoadingSuggestO(true);
    setSuggestError(null);
    try {
      const params = new URLSearchParams({ q: q.trim() });
      const res = await fetch(
        `${apiBase}/quotes/suggest/origins?${params.toString()}`,
      );
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          typeof body === "object" && body !== null && "error" in body
            ? String((body as { error: unknown }).error)
            : res.statusText;
        setSuggestError(err);
        setOriginSuggestions([]);
        return;
      }
      const rawOrigins =
        typeof body === "object" &&
        body !== null &&
        "origins" in body
          ? (body as { origins: unknown }).origins
          : [];
      setOriginSuggestions(parseLocationSuggestList(rawOrigins));
    } catch (e: unknown) {
      setSuggestError(e instanceof Error ? e.message : String(e));
      setOriginSuggestions([]);
    } finally {
      setLoadingSuggestO(false);
    }
  }, []);

  const fetchDestSuggestions = useCallback(async (q: string) => {
      if (q.trim().length < 2) {
        setDestSuggestions([]);
        return;
      }
      setLoadingSuggestD(true);
      setSuggestError(null);
      try {
        const params = new URLSearchParams({ q: q.trim() });
        const res = await fetch(
          `${apiBase}/quotes/suggest/destinations?${params.toString()}`,
        );
        const body: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          const err =
            typeof body === "object" && body !== null && "error" in body
              ? String((body as { error: unknown }).error)
              : res.statusText;
          setSuggestError(err);
          setDestSuggestions([]);
          return;
        }
        const rawDests =
          typeof body === "object" &&
          body !== null &&
          "destinations" in body
            ? (body as { destinations: unknown }).destinations
            : [];
        setDestSuggestions(parseLocationSuggestList(rawDests));
      } catch (e: unknown) {
        setSuggestError(e instanceof Error ? e.message : String(e));
        setDestSuggestions([]);
      } finally {
        setLoadingSuggestD(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchOriginSuggestions(debouncedOrigin);
  }, [debouncedOrigin, fetchOriginSuggestions]);

  useEffect(() => {
    void fetchDestSuggestions(debouncedDest);
  }, [debouncedDest, fetchDestSuggestions]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (originWrapRef.current && !originWrapRef.current.contains(t)) {
        setOriginOpen(false);
      }
      if (destWrapRef.current && !destWrapRef.current.contains(t)) {
        setDestOpen(false);
      }
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(t)) {
        setActionsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const searchQuotes = useCallback(async (oRaw: string, dRaw: string) => {
    const o = oRaw.trim();
    if (o.length === 0) {
      setQuotesError("Completá el origen.");
      return;
    }
    setLoadingQuotes(true);
    setQuotesError(null);
    try {
      const params = new URLSearchParams({ origin: o });
      const d = dRaw.trim();
      if (d.length > 0) {
        params.set("destination", d);
      }
      params.set("limit", "100");
      const res = await fetch(`${apiBase}/quotes/search?${params.toString()}`);
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          typeof body === "object" && body !== null && "error" in body
            ? String((body as { error: unknown }).error)
            : res.statusText;
        setQuotesError(err);
        setQuotes([]);
        setQuoteExpanded({});
        return;
      }
      const list =
        typeof body === "object" &&
        body !== null &&
        "quotes" in body &&
        Array.isArray((body as { quotes: unknown }).quotes)
          ? (body as { quotes: QuoteRow[] }).quotes
          : [];
      setQuotes(stripFooterFromQuotes(list));
      setQuoteExpanded({});
    } catch (e: unknown) {
      setQuotesError(e instanceof Error ? e.message : String(e));
      setQuotes([]);
      setQuoteExpanded({});
    } finally {
      setLoadingQuotes(false);
    }
  }, []);

  function onAnimalCountChange(raw: string): void {
    let n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) {
      n = 1;
    }
    n = Math.min(n, MAX_ANIMALS);
    setAnimalCount(n);
    setPets((prev) => {
      if (n <= prev.length) {
        return prev.slice(0, n);
      }
      return [
        ...prev,
        ...Array.from({ length: n - prev.length }, () => emptyPet(tradeDirection !== "impo")),
      ];
    });
  }

  function updatePet(
    index: number,
    patch: Partial<PetRow>,
  ): void {
    setPets((prev) => {
      const next = [...prev];
      const merged = { ...next[index], ...patch };
      const isImpo = tradeDirection === "impo";
      if (Object.prototype.hasOwnProperty.call(patch, "raza")) {
        const danger = isDangerBreed(merged.raza, breeds);
        if (danger && !isImpo) {
          merged.hasCrate = true;
          merged.crateRegistered = true;
          const lar82Id = defaultCrateIdForDanger(crateOptionsForOrigin);
          if (lar82Id) {
            merged.crateId = lar82Id;
            merged.costo = defaultCostoFromCrateSelection(
              crateTariffsData,
              origin,
              lar82Id,
            );
          }
        }
      }
      if (Object.prototype.hasOwnProperty.call(patch, "tipo")) {
        const danger = isDangerBreed(merged.raza, breeds);
        const allowed = filterCrateOptionsForPet(
          crateOptionsForOrigin,
          merged.tipo,
          danger,
        );
        const validIds = new Set(allowed.map((c) => c.id));
        if (merged.crateId && !validIds.has(merged.crateId)) {
          merged.crateId = "";
          merged.costo = "";
        }
        if (merged.hasCrate && merged.tipo === "gato" && !merged.crateId) {
          const def = defaultCrateIdForCat(crateOptionsForOrigin);
          if (def) {
            merged.crateId = def;
            merged.costo = defaultCostoFromCrateSelection(
              crateTariffsData,
              origin,
              def,
            );
          }
        }
      }
      next[index] = merged;
      return next;
    });
  }

  function addCrateToPet(index: number): void {
    setPets((prev) => {
      const next = [...prev];
      const p = next[index];
      if (!p || p.hasCrate) return prev;
      let crateId = p.crateId;
      let costo = p.costo;
      if (isDangerBreed(p.raza, breeds) && !crateId) {
        const def = defaultCrateIdForDanger(crateOptionsForOrigin);
        if (def) {
          crateId = def;
          costo = defaultCostoFromCrateSelection(crateTariffsData, origin, def);
        }
      } else if (p.tipo === "gato" && !crateId) {
        const def = defaultCrateIdForCat(crateOptionsForOrigin);
        if (def) {
          crateId = def;
          costo = defaultCostoFromCrateSelection(crateTariffsData, origin, def);
        }
      }
      if (crateId && crateId !== CUSTOM_CRATE_ID && !costo) {
        costo = defaultCostoFromCrateSelection(crateTariffsData, origin, crateId);
      }
      next[index] = { ...p, crateRegistered: true, hasCrate: true, crateId, costo };
      return next;
    });
    setExcludedCrateKeys((prev) => {
      const target = pets[index]?.id;
      if (!target || !prev.has(target)) return prev;
      const next = new Set(prev);
      next.delete(target);
      return next;
    });
  }

  /** Pasa una mascota del estado "sin jaula" al estado "cliente provee". */
  function registerCrateAsClient(index: number): void {
    setPets((prev) => {
      const next = [...prev];
      const p = next[index];
      if (!p || p.crateRegistered) return prev;
      next[index] = { ...p, crateRegistered: true, hasCrate: false, costo: "" };
      return next;
    });
    setExcludedCrateKeys((prev) => {
      const target = pets[index]?.id;
      if (!target || !prev.has(target)) return prev;
      const next = new Set(prev);
      next.delete(target);
      return next;
    });
  }

  /** IMPO: vuelve al estado A "sin jaula" (quita el ítem del presupuesto). */
  function unregisterCrate(index: number): void {
    setPets((prev) => {
      const next = [...prev];
      const p = next[index];
      if (!p) return prev;
      next[index] = { ...p, crateRegistered: false, hasCrate: false, costo: "" };
      return next;
    });
  }

  function removeCrateFromPet(index: number): void {
    setPets((prev) => {
      const next = [...prev];
      const p = next[index];
      if (!p || !p.hasCrate) return prev;
      next[index] = { ...p, hasCrate: false, costo: "" };
      return next;
    });
  }


  const crateSelectPlaceholder = crateTariffsLoading
    ? "Cargando tarifas de jaula…"
    : crateTariffsError
      ? "Error al cargar tarifas"
      : !origin.trim()
        ? "Elegí origen (país) primero"
        : crateOptionsForOrigin.length === 0
          ? "Sin tarifas de jaula para este origen"
          : "Jaula / tamaño";

  function buildQuoteFilename(): string {
    const activePets = pets.slice(0, Math.min(animalCount, pets.length));
    const crateSizes = activePets
      .filter((p) => p.hasCrate && p.crateId)
      .map((p) =>
        p.crateId === CUSTOM_CRATE_ID
          ? p.customCrateSize.trim()
          : (crateOptionsForOrigin.find((c) => c.id === p.crateId)?.size_code ?? ""),
      )
      .filter(Boolean);
    const cratesStr = crateSizes.length > 0 ? `#${crateSizes.join("-")}` : "";

    // "Colombia (BOG)" → "BOG Colombia" | "EZE, Argentina (EZE)" → "EZE Argentina" | "Australia" → "Australia"
    const locationLabel = (loc: string): string => {
      const iata = extractIataCode(loc);
      const rest = loc
        .replace(/\([^)]*\)/g, " ")
        .replace(/,/g, " ")
        .replace(/\b[A-Z]{3}\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!rest) return iata;
      if (!iata || iata === rest) return rest;
      return `${iata} ${rest}`;
    };

    const origen = locationLabel(origin);
    const destino = locationLabel(destination);
    const cliente = customerName.trim();
    const agente = agentName.trim();
    const suffix = [cratesStr, cliente, agente].filter(Boolean).join(" ");

    let name: string;
    switch (tradeDirection) {
      case "expo":
        name = `EXPO ${destino} dde ${origen} ${suffix}`;
        break;
      case "impo":
        name = `IMPO ${origen} en ${destino} ${suffix}`;
        break;
      case "ambas":
        name = `IMPO ${origen} en ${destino} EXPO ${destino} dde ${origen} ${suffix}`;
        break;
      case "transito": {
        const transitLabel = transitCountry === "argentina" ? "Argentina" : "Chile";
        name = `TRANSITO ${origen} ${destino} en ${transitLabel} ${suffix}`;
        break;
      }
      default:
        name = `cotizacion ${suffix}`;
    }

    return `cot ${name.trim()}.pdf`;
  }

  async function uploadAndTagYaCotizados(
    pdfBase64: string,
    match: FolderMatch,
  ): Promise<{ uploadedFilePath: string; originalFolderPath: string; renamedFolderPath: string }> {
    const filename = buildQuoteFilename();

    const folderPath = match.pathDisplay;
    if (!folderPath) throw new Error("Sin ruta de carpeta en Dropbox.");

    const uploadRes = await fetch("/api/dropbox/test-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfBase64, filename, folderPath }),
    });
    const uploadData = (await uploadRes.json()) as {
      ok: boolean;
      upload?: { pathDisplay: string | null };
      error?: string;
    };
    if (!uploadRes.ok || !uploadData.ok) throw new Error(uploadData.error ?? `Error de upload ${uploadRes.status}`);

    const lastSlash = folderPath.lastIndexOf("/");
    const parent = folderPath.substring(0, lastSlash);
    const folderName = folderPath.substring(lastSlash + 1);
    const alreadyTagged = folderName.startsWith("cotizado por app ");
    const newPath = alreadyTagged ? folderPath : `${parent}/cotizado por app ${folderName}`;

    const uploadedFilePath = `${newPath}/${filename}`;

    if (!alreadyTagged) {
      const moveRes = await fetch("/api/dropbox/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move", fromPath: folderPath, toPath: newPath }),
      });
      const moveData = (await moveRes.json()) as { ok: boolean; error?: string };
      const isConflict = moveData.error?.includes("conflict");
      if (!moveRes.ok || !moveData.ok) {
        if (!isConflict) throw new Error(moveData.error ?? `Error al renombrar ${moveRes.status}`);
        // Conflicto = la carpeta destino ya existe → ya está taggeada, continuar
      }
    }

    return { uploadedFilePath, originalFolderPath: folderPath, renamedFolderPath: newPath };
  }

  async function handleDownloadPdfOnly(): Promise<void> {
    setPdfDownloading(true);
    try {
      const pdfBase64 = await generatePdfBase64();
      const filename = buildQuoteFilename();
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${pdfBase64}`;
      link.download = filename;
      link.click();
    } catch (e) {
      console.error("[demo-coti] Error descargando PDF:", e instanceof Error ? e.message : e);
    } finally {
      setPdfDownloading(false);
    }
  }

  async function handleSaveQuoteOnly(): Promise<void> {
    setSavingQuote(true);
    try {
      const activePets = pets.slice(0, Math.min(animalCount, pets.length));
      const dogs = activePets.filter((p) => p.tipo === "perro").length;
      const cats = activePets.filter((p) => p.tipo === "gato").length;
      const parts: string[] = [];
      if (dogs > 0) parts.push(`${dogs} perro${dogs > 1 ? "s" : ""}`);
      if (cats > 0) parts.push(`${cats} gato${cats > 1 ? "s" : ""}`);
      const animalsDescription =
        parts.join(" y ") || `${animalCount} mascota${animalCount > 1 ? "s" : ""}`;

      const latamRowsById = new Map(latamRows.map((r) => [r.id, r]));
      const items = rightPaneBudgetLines.map((line) => {
        const lineId = line.kind === "latam" ? line.rowId : line.id;
        const row = line.kind === "latam" ? latamRowsById.get(line.rowId) : undefined;
        const source =
          row?.source === "crate"
            ? "custom"
            : ((row?.source ?? "custom") as "json" | "custom" | "impo" | "similar");
        return {
          fieldKey: row?.fieldKey ?? lineId,
          title: line.title,
          description: line.description,
          price: line.price,
          source,
        };
      });

      const res = await fetch(`${apiBase}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          origin,
          destination,
          fwd,
          notes,
          quotedDate,
          travelDate,
          animalsCount: animalCount,
          animalsDescription,
          items,
          totalAmount: rightPaneBudgetTotal,
          status: "draft",
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      setEmailResult("ok");
      setActionsMenuOpen(false);
    } catch (e) {
      console.error("[demo-coti] Error guardando cotización:", e instanceof Error ? e.message : e);
      setEmailError(e instanceof Error ? e.message : String(e));
      setEmailResult("error");
    } finally {
      setSavingQuote(false);
    }
  }

  function handleSendPdfClick(): void {
    const missing: string[] = [];
    if (!customerName.trim()) missing.push("Cliente");
    if (!origin.trim()) missing.push("Origen");
    if (!destination.trim()) missing.push("Destino");
    if (!quotedDate.trim()) missing.push("Fecha de cotización");
    const activePets = pets.slice(0, animalCount);
    if (activePets.some((p) => !p.tipo)) missing.push("Tipo de mascota sin completar");
    if (latamRows.length === 0) missing.push("Sin ítems cotizados");

    if (missing.length > 0) {
      const list = missing.map((f) => `• ${f}`).join("\n");
      const ok = window.confirm(
        `Faltan los siguientes campos:\n\n${list}\n\n¿Querés continuar de todas formas?`,
      );
      if (!ok) return;
    }
    openEmailDrawer();
  }

  function parseLoc(loc: string): { city: string; country: string } {
    const parts = loc.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { city: parts.slice(0, parts.length - 1).join(", "), country: parts[parts.length - 1] };
    }
    return { city: "", country: parts[0] ?? "" };
  }

  function buildPetTypeLabel(petsList: PetRow[], count: number): string {
    const active = petsList.slice(0, count);
    const dogs = active.filter((p) => p.tipo === "perro").length;
    const cats = active.filter((p) => p.tipo === "gato").length;
    if (dogs > 0 && cats === 0) return dogs === 1 ? "dog" : "dogs";
    if (cats > 0 && dogs === 0) return cats === 1 ? "cat" : "cats";
    return count === 1 ? "pet" : "pets";
  }

  const LATAM_COVERED = new Set(["argentina","brazil","brasil","mexico","méxico","costa rica","paraguay","uruguay","bolivia","chile","colombia","ecuador"]);

  function buildTemplateContext(): EmailTemplateContext {
    const { country: destCountry } = parseLoc(destination);
    const lower = destCountry.toLowerCase().trim();
    const paisDestino: "argentina" | "mexico" | "otro" =
      lower === "argentina" ? "argentina" :
      (lower === "mexico" || lower === "méxico") ? "mexico" : "otro";
    const destCubierto = LATAM_COVERED.has(lower);
    const clienteEsAgente = agentName.trim().length > 0;

    return {
      tipo_operacion: tipoOperacion,
      tipo_cliente: clienteEsAgente ? "agente" : "retail",
      referido_starwood: clienteEsAgente ? null : referidoStarwood,
      destino_cubierto_latam: tipoOperacion === "IMPO" ? null : destCubierto,
      pais_destino: tipoOperacion === "EXPO" ? null : paisDestino,
    };
  }

  async function fetchAndApplyTemplate(): Promise<void> {
    setEmailTemplateLoading(true);
    try {
      const { city: originCity, country: originCountry } = parseLoc(origin);
      const { city: destCity, country: destCountry } = parseLoc(destination);
      const resolved = await resolveEmailTemplate(buildTemplateContext(), {
        client_name: customerName.trim(),
        pet_type: buildPetTypeLabel(pets, animalCount),
        origin_city: originCity,
        destination_city: destCity,
        origin_country: originCountry,
        destination_country: destCountry,
        recommended_agent: recommendedAgentName.trim(),
      });
      setEmailBody(plainTextToHtml(resolved.body));
      setEmailTemplateCode(resolved.template_code);
      setCcRecommendedAgent(resolved.cc_recommended_agent);
      if (resolved.cc_recommended_agent && recommendedAgentEmail.trim()) {
        setEmailCc([recommendedAgentEmail.trim()]);
      }
    } catch (e: unknown) {
      console.error("[demo-coti] Error resolviendo template de mail:", e instanceof Error ? e.message : e);
    } finally {
      setEmailTemplateLoading(false);
    }
  }

  function openEmailDrawer(): void {
    const name = customerName.trim();
    const subject = name
      ? `Cotización LATAM Pet Transport — ${name}`
      : "Cotización LATAM Pet Transport";
    setEmailSubject(subject);
    setEmailBody("");
    setEmailCc([]);
    setEmailTemplateCode("");
    setCcRecommendedAgent(false);
    setRecommendedAgentName(agentName.trim());
    setEmailResult(null);
    setEmailError("");
    setThreadResults([]);
    setThreadSearchError("");
    setSelectedThread(null);
    setDbxUploadStatus("idle");
    setDbxUploadError(null);
    setDbxUploadModalOpen(false);
    setEmailDrawerOpen(true);
    void fetchAndApplyTemplate();
  }

  async function generatePdfBase64(): Promise<string> {
    const mainEl = document.querySelector<HTMLElement>("[data-pdf-main]");
    const tailEl = document.querySelector<HTMLElement>("[data-pdf-tail]");
    if (!mainEl || !tailEl) throw new Error("No se encontró el contenido del PDF (main/tail).");

    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const A4_WIDTH_PX = 794;

    const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfPageH = pdf.internal.pageSize.getHeight();
    const pageMarginPx = 0;
    const usableH = pdfPageH - pageMarginPx * 2;

    // ── Mover wrapper on-screen para que html2canvas capture (no soporta off-screen extremo) ──
    const wrapper = mainEl.parentElement;
    const originalWrapperStyle = wrapper?.getAttribute("style") ?? "";
    if (wrapper) {
      wrapper.style.position = "fixed";
      wrapper.style.left = "0px";
      wrapper.style.top = "0px";
      wrapper.style.zIndex = "-1";
      wrapper.style.opacity = "0";
      wrapper.style.pointerEvents = "none";
    }

    // Reemplazo de textareas → divs en LIVE DOM para que scrollHeight refleje contenido real
    type TaReplacement = { ta: HTMLTextAreaElement; div: HTMLDivElement };
    const taReplacements: TaReplacement[] = [];
    [mainEl, tailEl].forEach((el) => {
      el.querySelectorAll<HTMLTextAreaElement>("textarea").forEach((ta) => {
        const div = document.createElement("div");
        div.textContent = ta.value;
        div.className = ta.className;
        div.style.whiteSpace = "pre-wrap";
        div.style.height = "auto";
        div.style.overflow = "visible";
        ta.parentNode!.insertBefore(div, ta);
        ta.style.display = "none";
        taReplacements.push({ ta, div });
      });
    });

    const mainH = mainEl.scrollHeight;
    const tailH = tailEl.scrollHeight;

    // Break points (en CSS px relativo a mainEl) — usaremos esto para no cortar texto horizontalmente.
    const mainTop = mainEl.getBoundingClientRect().top;
    const breakPointsCss: number[] = [];
    mainEl.querySelectorAll<HTMLElement>("[data-atomic]").forEach((r) => {
      breakPointsCss.push(r.getBoundingClientRect().top - mainTop);
    });

    const sharedOnclone = (cloneDoc: Document, cloneEl: HTMLElement) => {
      let parent = cloneEl.parentElement;
      while (parent && parent !== cloneDoc.body) {
        parent.style.cssText = "width:auto;max-width:none;padding:0;margin:0;overflow:visible;border:none;box-shadow:none;border-radius:0;";
        parent = parent.parentElement;
      }
      cloneEl.style.width = `${A4_WIDTH_PX}px`;
      cloneEl.style.minWidth = `${A4_WIDTH_PX}px`;
      cloneEl.style.height = "auto";
      cloneEl.style.overflow = "visible";

      cloneEl.querySelectorAll<HTMLElement>(".items-center").forEach((el) => {
        el.style.display = "flex";
        el.style.alignItems = "center";
        if (el.classList.contains("justify-center")) el.style.justifyContent = "center";
        if (el.classList.contains("justify-between")) el.style.justifyContent = "space-between";
        if (el.classList.contains("justify-end")) el.style.justifyContent = "flex-end";
      });


      cloneEl.querySelectorAll<SVGElement>("svg").forEach((svg) => {
        svg.style.display = "block";
        svg.style.width = "14px";
        svg.style.height = "14px";
        svg.style.flexShrink = "0";
        svg.style.transform = "translateY(2px)";
      });

      cloneEl.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
        if (input.type === "date") {
          input.style.opacity = "0";
          input.style.position = "absolute";
          return;
        }
        const span = cloneDoc.createElement("span");
        span.textContent = input.value || "";
        span.className = input.className;
        input.parentNode?.replaceChild(span, input);
      });

      cloneEl.querySelectorAll<HTMLElement>("button, [data-page-break]").forEach((el) => {
        el.style.display = "none";
      });
    };

    let mainCanvas: HTMLCanvasElement;
    let tailCanvas: HTMLCanvasElement;
    try {
      mainCanvas = await html2canvas(mainEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#d6d6cc",
        width: A4_WIDTH_PX,
        height: mainH,
        windowWidth: A4_WIDTH_PX,
        windowHeight: mainH,
        scrollX: 0,
        scrollY: 0,
        onclone: sharedOnclone,
      });
      tailCanvas = await html2canvas(tailEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#d6d6cc",
        width: A4_WIDTH_PX,
        height: tailH,
        windowWidth: A4_WIDTH_PX,
        windowHeight: tailH,
        scrollX: 0,
        scrollY: 0,
        onclone: sharedOnclone,
      });
    } finally {
      taReplacements.forEach(({ ta, div }) => {
        ta.style.display = "";
        div.parentNode?.removeChild(div);
      });
      if (wrapper) {
        if (originalWrapperStyle) wrapper.setAttribute("style", originalWrapperStyle);
        else wrapper.removeAttribute("style");
      }
    }

    // Slicing: paginamos sólo el Main; el Tail va siempre al fondo de la última PDF page.
    const pixelsPerPoint = mainCanvas.width / pdfW;
    const mainCanvasH = mainCanvas.height;
    const pdfPageHPx = Math.ceil(usableH * pixelsPerPoint);
    const padPx = Math.round(pdfPageHPx * 0.05);

    // Convertir break points de CSS px a canvas px (multiplicando por scale=2)
    const cssToCanvas = mainCanvas.width / A4_WIDTH_PX;
    const breakPoints = breakPointsCss.map((y) => Math.round(y * cssToCanvas)).sort((a, b) => a - b);

    type PdfPageSlice = { srcY: number; srcH: number; drawY: number };
    const pageSlices: PdfPageSlice[] = [];
    if (mainCanvasH <= pdfPageHPx) {
      pageSlices.push({ srcY: 0, srcH: mainCanvasH, drawY: 0 });
    } else {
      let consumed = 0;
      let isFirst = true;
      while (consumed < mainCanvasH) {
        const topPad = isFirst ? 0 : padPx;
        const remaining = mainCanvasH - consumed;
        if (remaining <= pdfPageHPx - topPad) {
          pageSlices.push({ srcY: consumed, srcH: remaining, drawY: topPad });
          consumed = mainCanvasH;
        } else {
          const maxCut = consumed + (pdfPageHPx - topPad - padPx);
          // Snap al break point más alto en (consumed, maxCut]
          let snapped = maxCut;
          for (let k = breakPoints.length - 1; k >= 0; k--) {
            if (breakPoints[k] > consumed && breakPoints[k] <= maxCut) {
              snapped = breakPoints[k];
              break;
            }
          }
          pageSlices.push({ srcY: consumed, srcH: snapped - consumed, drawY: topPad });
          consumed = snapped;
        }
        isFirst = false;
      }
    }

    // Escalar tail al ancho de la página
    const tailDrawW = mainCanvas.width;
    const tailDrawH = Math.round(tailCanvas.height * (tailDrawW / tailCanvas.width));
    const tailDrawY = pdfPageHPx - tailDrawH;

    for (let i = 0; i < pageSlices.length; i++) {
      if (i > 0) pdf.addPage();
      const { srcY, srcH, drawY } = pageSlices[i];
      const isLast = i === pageSlices.length - 1;
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = mainCanvas.width;
      pageCanvas.height = pdfPageHPx;
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#d6d6cc";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(mainCanvas, 0, srcY, mainCanvas.width, srcH, 0, drawY, mainCanvas.width, srcH);
        if (isLast) {
          ctx.drawImage(tailCanvas, 0, 0, tailCanvas.width, tailCanvas.height, 0, tailDrawY, tailDrawW, tailDrawH);
        }
      }
      pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, pageMarginPx, pdfW, usableH);
    }

    return pdf.output("datauristring").split(",")[1];
  }

  async function handleSearchThreads(): Promise<void> {
    setThreadLoading(true);
    setThreadSearchError("");
    setThreadResults([]);
    setSelectedThread(null);
    try {
      const res = await fetch(`/api/microsoft/messages?email=${encodeURIComponent(emailTo.trim())}`);
      const data = (await res.json()) as { messages?: EmailThread[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error buscando hilos");
      setThreadResults(data.messages ?? []);
      if ((data.messages ?? []).length === 0) setThreadSearchError("No se encontraron hilos previos con este contacto.");
    } catch (e) {
      setThreadSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setThreadLoading(false);
    }
  }

  async function handleSendEmail(): Promise<void> {
    setEmailSending(true);
    setEmailResult(null);
    setEmailError("");
    try {
      const pdfBase64 = await generatePdfBase64();

      const filename = buildQuoteFilename();

      if (emailDownloadPdf) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${pdfBase64}`;
        link.download = filename;
        link.click();
      }

      const emailRes = await fetch("/api/send-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo, cc: emailCc.length > 0 ? emailCc : undefined, pdfBase64, customerName, filename, subject: emailSubject, body: emailBody, replyToMessageId: selectedThread?.id }),
      });
      const emailResData = (await emailRes.json()) as { ok?: boolean; from?: string; error?: string };
      if (!emailRes.ok) {
        throw new Error(emailResData.error ?? "Error desconocido");
      }
      const senderEmail = emailResData.from ?? "";

      // Guardar la quote en la DB
      const activePets = pets.slice(0, Math.min(animalCount, pets.length));
      const dogs = activePets.filter((p) => p.tipo === "perro").length;
      const cats = activePets.filter((p) => p.tipo === "gato").length;
      const parts: string[] = [];
      if (dogs > 0) parts.push(`${dogs} perro${dogs > 1 ? "s" : ""}`);
      if (cats > 0) parts.push(`${cats} gato${cats > 1 ? "s" : ""}`);
      const animalsDescription = parts.join(" y ") || `${animalCount} mascota${animalCount > 1 ? "s" : ""}`;

      const latamRowsById = new Map(latamRows.map((r) => [r.id, r]));
      const items = rightPaneBudgetLines.map((line) => {
        const lineId = line.kind === "latam" ? line.rowId : line.id;
        const row = line.kind === "latam" ? latamRowsById.get(line.rowId) : undefined;
        const source = row?.source === "crate" ? "custom" : ((row?.source ?? "custom") as "json" | "custom" | "impo" | "similar");
        return {
          fieldKey: row?.fieldKey ?? lineId,
          title: line.title,
          description: line.description,
          price: line.price,
          source,
        };
      });

      void fetch(`${apiBase}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          origin,
          destination,
          fwd,
          notes,
          quotedDate,
          travelDate,
          animalsCount: animalCount,
          animalsDescription,
          items,
          totalAmount: rightPaneBudgetTotal,
          status: "sent",
          emailSentTo: emailTo,
        }),
      }).catch((e: unknown) => {
        console.error("[demo-coti] Error guardando quote:", e instanceof Error ? e.message : e);
      });

      setEmailResult("ok");
      setCustomerName("");
      setAgentName("");
      setOrigin("");
      setDestination("");
      setFwd("");
      setNotes("");
      setTravelDate("");
      setAerolinea("");
      setAnimalCount(1);
      setPets([emptyPet(tradeDirection !== "impo")]);
      setLatamRows([]);
      setDbxUploadModalOpen(true);
      setDbxUploadStatus("uploading");
      setDbxMatchedFolderName(null);
      setDbxFolderLink(null);
      setDbxUploadError(null);

      void (async () => {
        try {
          const searchResult = await searchYaCotizados(
            { customerName, operation: tradeDirection, origin, destination },
            APP_TESTING_PATH,
          );
          if (searchResult.matches.length === 0) {
            setDbxUploadStatus("not-found");
            return;
          }
          const match = searchResult.matches[0];
          setDbxMatchedFolderName(match.name);
          const revertData = await uploadAndTagYaCotizados(pdfBase64, match);

          // Subir .eml junto al PDF (falla silenciosa para no bloquear el flujo)
          try {
            const emlBase64 = buildEmlBase64({
              from: senderEmail,
              to: emailTo,
              cc: emailCc.length > 0 ? emailCc.join(", ") : undefined,
              subject: emailSubject,
              body: emailBody,
              attachmentBase64: pdfBase64,
              attachmentFilename: filename,
            });
            await fetch("/api/dropbox/test-upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pdfBase64: emlBase64,
                filename: "mail con cot.eml",
                folderPath: revertData.renamedFolderPath,
              }),
            });
          } catch (emlErr) {
            console.error("[demo-coti] Error subiendo .eml:", emlErr instanceof Error ? emlErr.message : emlErr);
          }

          const encodedPath = revertData.renamedFolderPath
            .split("/")
            .map(encodeURIComponent)
            .join("/");
          setDbxFolderLink(`https://www.dropbox.com/home${encodedPath}`);
          setDbxUploadStatus("done");
        } catch (e) {
          setDbxUploadError(e instanceof Error ? e.message : String(e));
          setDbxUploadStatus("error");
        }
      })();
    } catch (e) {
      setEmailResult("error");
      setEmailError(e instanceof Error ? e.message : String(e));
    } finally {
      setEmailSending(false);
    }
  }


  async function handleDisconnectOutlook(): Promise<void> {
    setOutlookDisconnecting(true);
    try {
      await fetch("/api/microsoft/oauth/disconnect", { method: "POST" });
      setEmailResult(null);
      setEmailError("");
      await loadOutlookStatus();
    } catch (e) {
      setEmailResult("error");
      setEmailError(
        e instanceof Error ? e.message : "No se pudo desconectar Outlook.",
      );
    } finally {
      setOutlookDisconnecting(false);
    }
  }

  return (
    <main className="min-h-screen w-full bg-white px-6 py-6 text-zinc-900">
      <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2 py-1 shadow-md">
          <span className="sr-only" id="dc02-vendedor-select-label">
            Vendedor de la firma
          </span>
          <select
            value={selectedVendedorId}
            onChange={(e) => setSelectedVendedorId(e.target.value)}
            className="min-w-[9rem] max-w-[14rem] cursor-pointer rounded bg-transparent px-1 py-0.5 text-xs font-medium text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-400"
            aria-labelledby="dc02-vendedor-select-label"
            title="Vendedor asignado al PDF"
            disabled={vendedores.length === 0 || vendedoresLoading}
          >
            {vendedoresLoading ? (
              <option value="">Cargando…</option>
            ) : vendedores.length === 0 ? (
              <option value="">Sin vendedores</option>
            ) : null}
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setVendedoresManagerOpen(true)}
            className="ml-0.5 rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
            aria-label="Administrar vendedores"
            title="Agregar, editar o eliminar vendedores"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          onClick={handleSendPdfClick}
          className="rounded-full border border-zinc-600 bg-zinc-700 px-3 py-2 text-xs font-medium text-white shadow-md transition hover:bg-zinc-800"
          aria-label="Enviar cotización por email"
          title="Enviar cotización por email"
        >
          Enviar PDF
        </button>
        <button
          type="button"
          onClick={handlePdfLangToggle}
          className="rounded-full border border-zinc-500 bg-zinc-600 px-3 py-2 text-xs font-medium text-white shadow-md transition hover:bg-zinc-700"
          aria-label={`Cambiar idioma del PDF a ${pdfLang === "en" ? "español" : "inglés"}`}
          title={`PDF en ${pdfLang === "en" ? "English" : "Español"} — clic para cambiar`}
        >
          {pdfLang === "en" ? "EN" : "ES"}
        </button>
        <button
          type="button"
          onClick={() => setPdfPreviewOpen((v) => !v)}
          className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-white shadow-md transition hover:bg-zinc-900"
          aria-pressed={pdfPreviewOpen}
          aria-label={
            pdfPreviewOpen
              ? "Ocultar visualizador PDF"
              : "Mostrar visualizador PDF"
          }
        >
          {pdfPreviewOpen ? "Ocultar PDF" : "Vista PDF"}
        </button>
      </div>
      {vendedoresManagerOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Administrar vendedores"
          onClick={() => {
            setVendedoresManagerOpen(false);
            cancelEditingVendedor();
          }}
        >
          <div
            className="mt-14 w-full max-w-md rounded-xl bg-white p-4 shadow-2xl sm:mt-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">
                Vendedores
              </h3>
              <button
                type="button"
                onClick={() => {
                  setVendedoresManagerOpen(false);
                  cancelEditingVendedor();
                }}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            {vendedoresError ? (
              <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-800">
                {vendedoresError}
              </p>
            ) : null}
            <ul className="mb-3 max-h-[45vh] space-y-2 overflow-auto pr-1">
              {vendedoresLoading && vendedores.length === 0 ? (
                <li className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-center text-xs text-zinc-500">
                  Cargando vendedores…
                </li>
              ) : null}
              {!vendedoresLoading && vendedores.length === 0 ? (
                <li className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-center text-xs text-zinc-500">
                  Todavía no hay vendedores. Agregá uno abajo.
                </li>
              ) : null}
              {vendedores.map((v) => {
                const isEditing = editingVendedorId === v.id;
                const isSelected = selectedVendedorId === v.id;
                return (
                  <li
                    key={v.id}
                    className={`rounded-lg border p-2 ${
                      isSelected
                        ? "border-emerald-300 bg-emerald-50/50"
                        : "border-zinc-200 bg-white"
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editVendedorName}
                          onChange={(e) => setEditVendedorName(e.target.value)}
                          placeholder="Nombre"
                          className={inputClass}
                          autoFocus
                        />
                        <input
                          type="email"
                          value={editVendedorEmail}
                          onChange={(e) => setEditVendedorEmail(e.target.value)}
                          placeholder="Email"
                          className={inputClass}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void submitEditingVendedor();
                            }}
                            disabled={
                              editVendedorSubmitting ||
                              editVendedorName.trim() === "" ||
                              editVendedorEmail.trim() === ""
                            }
                            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {editVendedorSubmitting ? "Guardando…" : "Guardar"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditingVendedor}
                            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="dc02-vendedor-radio"
                            checked={isSelected}
                            onChange={() => setSelectedVendedorId(v.id)}
                            className="h-3.5 w-3.5 accent-emerald-600"
                            aria-label={`Seleccionar ${v.name}`}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-zinc-900">
                              {v.name}
                            </span>
                            <span className="block truncate text-[11px] text-zinc-500">
                              {v.email}
                            </span>
                          </span>
                        </label>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditingVendedor(v)}
                            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                            aria-label={`Editar ${v.name}`}
                            title="Editar"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-3.5 w-3.5"
                              aria-hidden
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void apiRemoveVendedor(v.id);
                            }}
                            disabled={vendedores.length <= 1}
                            className="rounded-md p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
                            aria-label={`Eliminar ${v.name}`}
                            title={
                              vendedores.length <= 1
                                ? "No se puede eliminar el último vendedor"
                                : "Eliminar"
                            }
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-3.5 w-3.5"
                              aria-hidden
                            >
                              <path d="M3 6h18" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" x2="10" y1="11" y2="17" />
                              <line x1="14" x2="14" y1="11" y2="17" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/40 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                Nuevo vendedor
              </p>
              <div className="space-y-2">
                <input
                  type="text"
                  value={vendedorDraftName}
                  onChange={(e) => setVendedorDraftName(e.target.value)}
                  placeholder="Nombre"
                  className={inputClass}
                />
                <input
                  type="email"
                  value={vendedorDraftEmail}
                  onChange={(e) => setVendedorDraftEmail(e.target.value)}
                  placeholder="Email"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => {
                    void submitNewVendedor();
                  }}
                  disabled={
                    vendedorDraftSubmitting ||
                    vendedorDraftName.trim() === "" ||
                    vendedorDraftEmail.trim() === ""
                  }
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {vendedorDraftSubmitting ? "Agregando…" : "Agregar vendedor"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <h1 className="text-xl font-semibold">Demo cotizaciones</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Origen y destino: al menos 2 caracteres para sugerencias desde la API
        (igual que en{" "}
        <code className="rounded bg-zinc-200 px-1">
          /demo-coti
        </code>
        ). El panel derecho queda libre para el próximo paso.
      </p>

      {[suggestError, quotesError, crateTariffsError].filter(Boolean).length > 0 ? (
        <p className="mt-4 text-sm text-red-600">
          {[suggestError, quotesError, crateTariffsError].filter(Boolean).join(" · ")}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <section
          className={`w-full shrink-0 ${pdfPreviewOpen ? "lg:w-1/2 lg:max-w-[50%]" : "lg:max-w-none"}`}
        >
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 border-b border-zinc-100 pb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" aria-hidden />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Datos del traslado
                </h3>
              </div>
              <div className="space-y-4">
              <div>
              <label htmlFor="dc02-customer" className={labelClass}>
                Nombre del cliente
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="dc02-customer"
                  type="text"
                  autoComplete="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={`${inputClass} flex-1`}
                  placeholder="Cliente"
                />
                <input
                  id="dc02-agent"
                  type="text"
                  autoComplete="organization"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className={`${inputClass} !w-[30%] max-w-[30%] shrink-0`}
                  placeholder="Agent"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div ref={originWrapRef} className="relative min-w-0">
                <label htmlFor="dc02-origin" className={labelClass}>
                  Origen
                </label>
                <input
                  id="dc02-origin"
                  type="text"
                  autoComplete="off"
                  value={origin}
                  onChange={(e) => {
                    setOrigin(e.target.value);
                    setOriginOpen(true);
                  }}
                  onFocus={() => setOriginOpen(true)}
                  className={inputClass}
                  placeholder="Ej. EZE"
                />
                {originOpen &&
                  origin.trim().length >= 2 &&
                  (originSuggestions.length > 0 || loadingSuggestO) && (
                    <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-300 bg-white py-1 text-sm shadow-lg">
                      {loadingSuggestO && (
                        <li className="px-3 py-2 text-zinc-500">Buscando…</li>
                      )}
                      {originSuggestions.map((s) => (
                        <li key={s.value}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-zinc-100"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setOrigin(s.value);
                              setOriginOpen(false);
                              void searchQuotes(s.value, destination);
                            }}
                          >
                            {s.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>

              <div ref={destWrapRef} className="relative min-w-0">
                <label htmlFor="dc02-destination" className={labelClass}>
                  Destino
                </label>
                <input
                  id="dc02-destination"
                  type="text"
                  autoComplete="off"
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    setDestOpen(true);
                  }}
                  onFocus={() => setDestOpen(true)}
                  className={inputClass}
                  placeholder="Ej. MIA"
                />
                {destOpen &&
                  destination.trim().length >= 2 &&
                  (destSuggestions.length > 0 || loadingSuggestD) && (
                    <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-300 bg-white py-1 text-sm shadow-lg">
                      {loadingSuggestD && (
                        <li className="px-3 py-2 text-zinc-500">Buscando…</li>
                      )}
                      {destSuggestions.map((s) => (
                        <li key={s.value}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-zinc-100"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setDestination(s.value);
                              setDestOpen(false);
                              void searchQuotes(origin, s.value);
                            }}
                          >
                            {s.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>

              <div className="min-w-0">
                <label htmlFor="dc02-trade-direction" className={labelClass}>
                  Operación
                </label>
                <select
                  id="dc02-trade-direction"
                  value={tradeDirection}
                  onChange={(e) =>
                    setTradeDirection(e.target.value as TradeDirectionChoice)
                  }
                  className={inputClass}
                >
                  <option value="impo">IMPO</option>
                  <option value="expo">EXPO</option>
                  <option value="ambas">Ambas</option>
                  <option value="transito">Tránsito</option>
                </select>
              </div>

              {tradeDirection === "transito" && (
                <div className="min-w-0">
                  <label
                    htmlFor="dc02-transit-country"
                    className={labelClass}
                  >
                    País de tránsito
                  </label>
                  <select
                    id="dc02-transit-country"
                    value={transitCountry}
                    onChange={(e) =>
                      setTransitCountry(
                        e.target.value as "argentina" | "chile",
                      )
                    }
                    className={inputClass}
                  >
                    <option value="argentina">Argentina</option>
                    <option value="chile">Chile</option>
                  </select>
                </div>
              )}
            </div>

            {(tradeDirection === "expo" || tradeDirection === "ambas") && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="min-w-0">
                  <label htmlFor="dc02-fwd" className={labelClass}>
                    FWD
                  </label>
                  <input
                    id="dc02-fwd"
                    type="text"
                    autoComplete="off"
                    value={fwd}
                    onChange={(e) => setFwd(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
                <div className="w-full max-w-[5.75rem] shrink-0 sm:w-[5.75rem]">
                  <label htmlFor="dc02-animal-count" className={labelClass}>
                    # animales
                  </label>
                  <input
                    id="dc02-animal-count"
                    type="number"
                    min={1}
                    max={MAX_ANIMALS}
                    inputMode="numeric"
                    value={animalCount}
                    onChange={(e) => onAnimalCountChange(e.target.value)}
                    className={`${inputClass} w-full tabular-nums`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <label htmlFor="dc02-quoted" className={labelClass}>
                    Quoted date
                  </label>
                  <input
                    id="dc02-quoted"
                    type="date"
                    value={quotedDate}
                    onChange={(e) => setQuotedDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <label htmlFor="dc02-arrival" className={labelClass}>
                    Travel date
                  </label>
                  <input
                    id="dc02-arrival"
                    type="date"
                    value={travelDate}
                    onChange={(e) => setTravelDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <label htmlFor="dc02-aerolinea" className={labelClass}>
                    Aerolínea
                  </label>
                  <input
                    id="dc02-aerolinea"
                    type="text"
                    value={aerolinea}
                    onChange={(e) => setAerolinea(e.target.value)}
                    className={inputClass}
                    placeholder="ej. LATAM, Aerolíneas"
                  />
                </div>
              </div>

              </div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200/60 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 border-b border-emerald-100 pb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Mascotas
                </h3>
              </div>
              <div className="space-y-4">
              <div>
                {detectedCrateCountryKey ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Jaulas según origen:{" "}
                    <span className="font-medium text-zinc-700">
                      {detectedCrateCountryKey.replace(/_/g, " ")}
                    </span>
                  </p>
                ) : origin.trim() ? (
                  <p className="mt-1 text-xs text-amber-700">
                    No hay tarifas cargadas para este origen; ampliá alias de país
                    en código o el JSON de jaulas.
                  </p>
                ) : null}
              </div>
              {pets.map((pet, i) => (
                <div
                  key={pet.id}
                  className="rounded-lg border border-emerald-200/60 bg-emerald-50/20 p-4 shadow-sm"
                >
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Mascota {i + 1}
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <div>
                      <label
                        htmlFor={`dc02-pet-${i}-tipo`}
                        className={fieldLabelClass}
                      >
                        Tipo
                      </label>
                      <select
                        id={`dc02-pet-${i}-tipo`}
                        value={pet.tipo}
                        onChange={(e) =>
                          updatePet(i, {
                            tipo: e.target.value as PetRow["tipo"],
                          })
                        }
                        className={inputClass}
                      >
                        <option value="">—</option>
                        <option value="perro">Perro</option>
                        <option value="gato">Gato</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor={`dc02-pet-${i}-raza`}
                        className={fieldLabelClass}
                      >
                        Raza
                      </label>
                      <BreedCombobox
                        id={`dc02-pet-${i}-raza`}
                        tipo={pet.tipo}
                        value={pet.raza}
                        onChange={(v) => updatePet(i, { raza: v })}
                        className={inputClass}
                        placeholder="Raza"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`dc02-pet-${i}-nombre`}
                        className={fieldLabelClass}
                      >
                        Nombre
                      </label>
                      <input
                        id={`dc02-pet-${i}-nombre`}
                        type="text"
                        autoComplete="off"
                        defaultValue={pet.nombre}
                        onBlur={(e) => updatePet(i, { nombre: e.target.value })}
                        className={inputClass}
                        placeholder="Nombre"
                      />
                    </div>
                    {!pet.hasCrate && !pet.crateRegistered ? (
                      <div className="col-span-2">
                        <span className={fieldLabelClass} aria-hidden="true">
                          &nbsp;
                        </span>
                        <button
                          type="button"
                          onClick={() => registerCrateAsClient(i)}
                          className={`${inputClass} cursor-pointer truncate whitespace-nowrap border-sky-600/70 bg-sky-50 px-2 font-medium text-sky-900 hover:bg-sky-100`}
                          aria-label={`Agregar jaula a mascota ${i + 1}`}
                        >
                          + Agregar jaula
                        </button>
                      </div>
                    ) : (
                    <>
                      <div>
                        <div className="relative mb-0.5 flex items-center justify-between gap-2">
                          <label
                            htmlFor={`dc02-pet-${i}-crate`}
                            className="block text-xs font-medium text-zinc-600"
                          >
                            Crate
                          </label>
                          <div className="absolute -top-full right-0 flex items-center gap-1">
                            {pet.hasCrate ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => removeCrateFromPet(i)}
                                  className="-my-0.5 inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
                                  title="Volver a 'cliente provee el crate'"
                                  aria-label={`Cliente provee el crate de mascota ${i + 1}`}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.25"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-3 w-3"
                                    aria-hidden
                                  >
                                    <path d="M9 14 4 9l5-5" />
                                    <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
                                  </svg>
                                  <span className="tracking-wide uppercase">
                                    client will provide
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => unregisterCrate(i)}
                                  className="-my-0.5 inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                                  title="Quitar jaula (no aparece en cotización)"
                                  aria-label={`Quitar jaula de mascota ${i + 1}`}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.25"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-3 w-3"
                                    aria-hidden
                                  >
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                  </svg>
                                  <span className="tracking-wide uppercase">
                                    quitar jaula
                                  </span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => unregisterCrate(i)}
                                className="-my-0.5 inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                                title="Quitar jaula (no aparece en cotización)"
                                aria-label={`Quitar jaula de mascota ${i + 1}`}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.25"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="h-3 w-3"
                                  aria-hidden
                                >
                                  <path d="M18 6 6 18" />
                                  <path d="m6 6 12 12" />
                                </svg>
                                <span className="tracking-wide uppercase">
                                  quitar jaula
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                        {(() => {
                          const danger = isDangerBreed(pet.raza, breeds);
                          const optsForPet = filterCrateOptionsForPet(
                            crateOptionsForOrigin,
                            pet.tipo,
                            danger,
                          );
                          return (
                            <select
                              id={`dc02-pet-${i}-crate`}
                              value={pet.crateId}
                              onChange={(e) => {
                                const id = e.target.value;
                                const costo =
                                  id === "" || id === CUSTOM_CRATE_ID || !pet.hasCrate
                                    ? ""
                                    : defaultCostoFromCrateSelection(
                                        crateTariffsData,
                                        origin,
                                        id,
                                      );
                                updatePet(i, { crateId: id, costo });
                              }}
                              disabled={
                                crateTariffsLoading ||
                                Boolean(crateTariffsError) ||
                                !origin.trim() ||
                                optsForPet.length === 0
                              }
                              className={`${inputClass} pr-0`}
                            >
                              <option value="">
                                {crateSelectPlaceholder}
                              </option>
                              {optsForPet.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {formatCrateOptionLabel(c)}
                                </option>
                              ))}
                              <option value={CUSTOM_CRATE_ID}>
                                Personalizado
                              </option>
                            </select>
                          );
                        })()}
                      </div>
                      {pet.hasCrate ? (
                        <div className="col-span-2 sm:col-span-1 lg:col-span-1">
                          <label
                            htmlFor={`dc02-pet-${i}-costo`}
                            className={fieldLabelClass}
                          >
                            Costo
                          </label>
                          <input
                            id={`dc02-pet-${i}-costo`}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={pet.costo}
                            onChange={(e) =>
                              updatePet(i, { costo: e.target.value })
                            }
                            className={inputClass}
                            placeholder="Ej. 270 USD"
                          />
                        </div>
                      ) : (
                        <div className="col-span-2 sm:col-span-1 lg:col-span-1">
                          <span
                            className={fieldLabelClass}
                            aria-hidden="true"
                          >
                            &nbsp;
                          </span>
                          <button
                            type="button"
                            onClick={() => addCrateToPet(i)}
                            className={`${inputClass} cursor-pointer truncate whitespace-nowrap border-emerald-600/70 bg-emerald-50 px-2 font-medium text-emerald-900 hover:bg-emerald-100`}
                            aria-label={`LATAM provee el crate de mascota ${i + 1}`}
                          >
                            LATAM provee
                          </button>
                        </div>
                      )}
                      {pet.crateId === CUSTOM_CRATE_ID && (
                        <div className="col-span-2 sm:col-span-3 lg:col-span-5">
                          <AutoHeightDescriptionTextarea
                            value={pet.customCrateSize}
                            onChange={(e) =>
                              updatePet(i, { customCrateSize: e.target.value })
                            }
                            minHeightPx={64}
                            className={`${inputClass} font-sans`}
                            placeholder="Medidas/notas de la jaula personalizada"
                          />
                        </div>
                      )}
                    </>
                    )}
                  </div>
                  {isBrachyBreed(pet.raza, breeds) && (
                    <p className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden>
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      Atención: esta mascota es braquiocefálica
                    </p>
                  )}
                  {isDangerBreed(pet.raza, breeds) && (
                    <p className="mt-2 flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden>
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      Raza peligrosa — jaula LAR82
                    </p>
                  )}
                </div>
              ))}
              </div>
            </div>

            <div className="space-y-3">
              {/* <button
                type="button"
                onClick={() => void searchQuotes(origin, destination)}
                disabled={loadingQuotes || origin.trim().length === 0}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {loadingQuotes ? "Buscando…" : "Buscar operaciones similares"}
              </button> */}
              <button
                type="button"
                onClick={() =>
                  setSimilarQuotesTableOpen((open) => !open)
                }
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-[12px] font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-800"
                aria-expanded={similarQuotesTableOpen}
                aria-controls="dc02-similar-quotes-table"
              >
                <span>Cotizaciones similares</span>
                <span className="flex items-center gap-1.5">
                  <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] tabular-nums text-zinc-500">
                    {loadingQuotes ? "…" : quotes.length}
                  </span>
                  <span
                    className="inline-block text-[9px] leading-none text-zinc-400 transition-transform duration-150"
                    style={{ transform: similarQuotesTableOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                    aria-hidden
                  >▶</span>
                </span>
              </button>
              {similarQuotesTableOpen ? (
              <div className="relative z-10 w-[90vw] max-w-[90vw] self-start">
                <div
                  id="dc02-similar-quotes-table"
                  className="max-h-[35vh] overflow-auto rounded-lg border border-zinc-400 bg-zinc-200 !mt-0"
                >
                <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-zinc-400 bg-zinc-300">
                    <tr>
                      <th
                        className="w-10 px-1 py-2 text-center font-medium"
                        scope="col"
                        aria-label="Expandir"
                      >
                        <span className="sr-only">Ítems</span>
                      </th>
                      <th className="px-3 py-2 font-medium">Origen</th>
                      <th className="px-3 py-2 font-medium">Destino</th>
                      <th className="px-3 py-2 font-medium">Mascotas</th>
                      <th className="px-3 py-2 font-medium">Cliente</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                      <th className="px-3 py-2 font-medium">Fecha cot. (orig.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingQuotes ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-6 text-center text-zinc-500"
                        >
                          Cargando…
                        </td>
                      </tr>
                    ) : quotes.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-6 text-center text-zinc-500"
                        >
                          Sin resultados. Elegí origen y buscá.
                        </td>
                      </tr>
                    ) : (
                      similarQuotesSortedByPetMatch.map((q) => {
                        const open = Boolean(quoteExpanded[q.import_key]);
                        const items = [...(q.items ?? [])].sort(
                          (a, b) => a.display_order - b.display_order,
                        );
                        return (
                          <Fragment key={q.import_key}>
                            <tr className="group border-b border-zinc-400 even:bg-zinc-100">
                              <td className="px-1 py-1 align-middle">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQuoteExpanded((prev) => ({
                                      ...prev,
                                      [q.import_key]: !prev[q.import_key],
                                    }))
                                  }
                                  className="flex h-8 w-8 items-center justify-center rounded text-zinc-600 hover:bg-zinc-300"
                                  aria-expanded={open}
                                  aria-label={
                                    open
                                      ? `Contraer ítems de ${q.import_key}`
                                      : `Expandir ítems de ${q.import_key}`
                                  }
                                >
                                  <span
                                    className="inline-block text-[10px] leading-none transition-transform duration-150"
                                    style={{
                                      transform: open
                                        ? "rotate(90deg)"
                                        : "rotate(0deg)",
                                    }}
                                    aria-hidden
                                  >
                                    ▶
                                  </span>
                                </button>
                              </td>
                              <td
                                className="max-w-[120px] truncate px-3 py-2"
                                title={q.origin ?? ""}
                              >
                                {q.formatted_origin ?? q.origin ?? "—"}
                              </td>
                              <td
                                className="max-w-[120px] truncate px-3 py-2"
                                title={q.destination ?? ""}
                              >
                                {q.formatted_destination ?? q.destination ?? "—"}
                              </td>
                              <td
                                className="max-w-[min(20rem,28vw)] min-w-[8rem] break-words px-3 py-2 text-xs text-zinc-800"
                                title={quoteAnimalsDisplay(q)}
                              >
                                {quoteAnimalsDisplay(q)}
                              </td>
                              <td
                                className="max-w-[140px] truncate px-3 py-2"
                                title={q.customer_name ?? ""}
                              >
                                {q.customer_name ?? "—"}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2">
                                {q.quoted_total_raw ??
                                  (q.quoted_total_amount != null
                                    ? String(q.quoted_total_amount)
                                    : "—")}
                                {q.currency ? ` ${q.currency}` : ""}
                              </td>
                              <td className="max-w-[200px] px-3 py-2 text-xs text-zinc-600">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate">
                                    {q.quotation_date_raw ?? "—"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => importSimilarQuote(q)}
                                    className="shrink-0 rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-medium text-zinc-700 opacity-0 transition-opacity hover:bg-zinc-50 group-hover:opacity-100 focus:opacity-100"
                                    title="Importar a cotización actual"
                                  >
                                    Importar
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {open ? (
                              <tr className="border-b border-zinc-400 bg-zinc-300">
                                <td colSpan={7} className="px-3 py-3 align-top">
                                  {items.length === 0 ? (
                                    <p className="text-xs text-zinc-500">
                                      Sin ítems en la respuesta.
                                    </p>
                                  ) : (
                                    <ul className="space-y-3 divide-y divide-zinc-300">
                                      {items.map((it) => {
                                        const det = [
                                          ...(it.details ?? []),
                                        ].sort(
                                          (a, b) =>
                                            a.detail_order - b.detail_order,
                                        );
                                        const priceLine = [
                                          it.price_raw || it.price_amount,
                                          it.currency,
                                        ]
                                          .filter(Boolean)
                                          .join(" ");
                                        const itemTitle =
                                          it.item_name_raw ||
                                          it.item_display_name ||
                                          "Ítem";
                                        return (
                                          <li
                                            key={it.quote_item_id}
                                            className="pt-3 first:pt-0"
                                          >
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                              <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium text-zinc-900">
                                                  {itemTitle}
                                                </div>
                                                {it.inline_note ? (
                                                  <p className="mt-0.5 text-xs text-zinc-600">
                                                    {it.inline_note}
                                                  </p>
                                                ) : null}
                                                {priceLine ? (
                                                  <p className="mt-1 font-mono text-xs text-zinc-700">
                                                    {priceLine}
                                                  </p>
                                                ) : null}
                                                {det.length > 0 ? (
                                                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-zinc-700">
                                                    {det.map((d) => (
                                                      <li
                                                        key={`${it.quote_item_id}-${d.detail_order}`}
                                                        className="pl-0.5"
                                                      >
                                                        {d.detail_text}
                                                      </li>
                                                    ))}
                                                  </ul>
                                                ) : (
                                                  <p className="mt-2 text-xs italic text-zinc-500">
                                                    Sin detalles.
                                                  </p>
                                                )}
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  addSimilarQuoteItemToPdf(q, it)
                                                }
                                                className="shrink-0 rounded border border-emerald-600/70 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                                                aria-label={`Añadir al presupuesto PDF: ${itemTitle}`}
                                              >
                                                Añadir ítem
                                              </button>
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
                </div>
              </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              {(tradeDirection === "impo" || tradeDirection === "ambas") ? (
            <div
              className="rounded-lg border border-sky-200 bg-sky-50/50 px-3 py-2"
              aria-label="Templates IMPO por destino"
            >
              <button
                type="button"
                id="dc02-impo-guide-toggle"
                className="flex w-full items-center justify-between gap-2 py-0.5 text-left transition"
                onClick={() => setImpoGuidePanelOpen((o) => !o)}
                aria-expanded={impoGuidePanelOpen}
                aria-controls="dc02-impo-guide-body"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-700">
                  IMPO — items
                </span>
                <span
                  className="inline-block shrink-0 text-[9px] leading-none text-sky-400 transition-transform duration-150"
                  style={{
                    transform: impoGuidePanelOpen
                      ? "rotate(90deg)"
                      : "rotate(0deg)",
                  }}
                  aria-hidden
                >
                  ▶
                </span>
              </button>

              {impoGuidePanelOpen ? (
              <div id="dc02-impo-guide-body" className="mt-2">
              {officialLoading ? (
                <p className="mt-2 text-xs text-zinc-500">Buscando ítems…</p>
              ) : null}
              {!officialLoading && destination.trim().length >= 2 && !officialImpoItems ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Ningún ítem IMPO coincide con este destino.
                </p>
              ) : null}
              {officialImpoItems && officialImpoItems.length > 0 ? (() => {
                const aeropuertos = [...new Set(officialImpoItems.map((i) => i.airport))];
                return (
                  <>
                    <p className="mt-2 text-xs text-zinc-600">
                      País:{" "}
                      <span className="font-medium text-zinc-800">{officialImpoMatchedPais}</span>
                    </p>
                    <div className="mt-3 space-y-3">
                      {aeropuertos.map((aero) => {
                        const items = officialImpoItems.filter((i) => i.airport === aero);
                        const canAddAeroAll = items.some(
                          (i) => !latamRows.some((r) => r.source === "impo" && r.fieldKey === `official_impo_${i.id}`),
                        );
                        return (
                          <div key={aero ?? "sin-aero"} className="rounded border border-zinc-200 bg-white px-3 py-2">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              {aero ? (
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                                  {aero}
                                </p>
                              ) : <span />}
                              <button
                                type="button"
                                onClick={() => addImpoItemsForAirport(aero)}
                                disabled={!canAddAeroAll}
                                className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-40"
                              >
                                + todos
                              </button>
                            </div>
                            <ul className="space-y-1">
                              {items.map((item) => {
                                const key = `official_impo_${item.id}`;
                                const inBudget = latamRows.some(
                                  (r) => r.source === "impo" && r.fieldKey === key,
                                );
                                return (
                                  <li key={item.id} className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <span className="text-[11px] text-zinc-700">
                                        {item.item_en || item.item_es}
                                      </span>
                                      {(item.price_ref ?? item.notes) ? (
                                        <span className="ml-2 font-mono text-[10px] text-zinc-400">
                                          {[item.price_ref, item.notes].filter(Boolean).join(" · ")}
                                        </span>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => addOfficialImpoItem(item)}
                                      disabled={inBudget}
                                      className="shrink-0 rounded border border-emerald-600/60 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      {inBudget ? "✓" : "+"}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })() : null}
              {(() => {
                const n = Math.min(animalCount, pets.length);
                const activePets = pets.slice(0, n);
                if (activePets.length === 0) return null;
                return (
                  <div className="mt-3 rounded border border-zinc-200 bg-white px-3 py-2">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                      Crates
                    </p>
                    <ul className="space-y-1">
                      {activePets.map((pet, i) => {
                        const tipoLabel =
                          pet.tipo === "perro" ? "Dog" : pet.tipo === "gato" ? "Cat" : "Pet";
                        const name = pet.nombre.trim() || `#${i + 1}`;
                        const inBudget =
                          pet.hasCrate && !excludedCrateKeys.has(pet.id);
                        return (
                          <li
                            key={pet.id}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="text-[11px] text-zinc-700">
                              Crate · {tipoLabel} · {name}
                            </span>
                            <button
                              type="button"
                              onClick={() => addCrateToPet(i)}
                              disabled={inBudget}
                              className="shrink-0 rounded border border-emerald-600/60 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Agregar crate para mascota ${i + 1}`}
                            >
                              {inBudget ? "✓" : "+"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })()}
              </div>
              ) : null}
            </div>
              ) : null}

              {(tradeDirection === "expo" || tradeDirection === "ambas") ? (
            <div
              className="rounded-lg border border-violet-300 bg-violet-50/70 p-3"
              aria-label="Guía EXPO — ítems LATAM por origen"
            >
              <button
                type="button"
                id="dc02-expo-guide-toggle"
                className="flex w-full items-center justify-between gap-2 py-0.5 text-left transition"
                onClick={() => setExpoGuidePanelOpen((o) => !o)}
                aria-expanded={expoGuidePanelOpen}
                aria-controls="dc02-expo-guide-body"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-violet-700">
                  EXPO — items
                </span>
                <span
                  className="mt-0.5 inline-block shrink-0 text-[10px] leading-none text-zinc-500 transition-transform duration-150"
                  style={{
                    transform: expoGuidePanelOpen
                      ? "rotate(90deg)"
                      : "rotate(0deg)",
                  }}
                  aria-hidden
                >
                  ▶
                </span>
              </button>

              {expoGuidePanelOpen ? (
              <div id="dc02-expo-guide-body" className="mt-2">
              {!origin.trim() ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Escribí un <span className="font-medium">origen</span> que
                  coincida con un país en la guía EXPO.
                </p>
              ) : officialLoading ? (
                <p className="mt-2 text-xs text-zinc-400">Cargando…</p>
              ) : !officialExpoMatchedPais ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Este origen no coincide con ningún país en la guía EXPO.
                </p>
              ) : officialExpoItemsForPanel.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">
                  No hay ítems para este país.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-xs text-zinc-600">
                    País:{" "}
                    <span className="font-medium text-zinc-800">
                      {officialExpoMatchedPais}
                    </span>
                  </p>
                  {(() => {
                    const usedJsonKeys = new Set(
                      latamRows.filter((r) => r.source === "json").map((r) => r.fieldKey),
                    );
                    const canAddAnyJson = officialExpoItemsForPanel.some(
                      (item) => !usedJsonKeys.has(`official_expo_${item.id}`),
                    );
                    return (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => addAllLatamJsonGuideItems()}
                          disabled={!canAddAnyJson}
                          className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                        >
                          Agregar todos
                        </button>
                        {!canAddAnyJson ? (
                          <span className="text-[10px] text-zinc-500">
                            Todos los ítems ya están en el presupuesto.
                          </span>
                        ) : null}
                      </div>
                    );
                  })()}
                  <ul className="mt-3 space-y-1">
                    {officialExpoItemsForPanel.map((item) => {
                      const itemKey = `official_expo_${item.id}`;
                      const alreadyAdded = latamRows.some(
                        (r) => r.source === "json" && r.fieldKey === itemKey,
                      );
                      return (
                        <li key={item.id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] text-zinc-700">
                              {item.item_en || item.item_es}
                            </span>
                            {(item.price_ref ?? item.notes) ? (
                              <span className="ml-2 font-mono text-[10px] text-zinc-400">
                                {[item.price_ref, item.notes].filter(Boolean).join(" · ")}
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => addLatamJsonRow(itemKey)}
                            disabled={alreadyAdded}
                            className="shrink-0 rounded border border-emerald-600/60 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Añadir ${item.item_en || item.item_es} al presupuesto`}
                          >
                            {alreadyAdded ? "✓" : "+"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              </div>
              ) : null}
            </div>
              ) : null}
            </div>

            


            <hr
              className="my-8 border-0 border-t border-dashed border-zinc-300"
              aria-hidden
            />

            <div className="space-y-6">
              {!origin.trim() ? (
                <p className="text-[11px] text-zinc-400">
                  Elegí un origen para ver ítems EXPO por país.
                </p>
              ) : null}
              {origin.trim() && !officialLoading && !officialExpoMatchedPais ? (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600">
                  Este origen no coincide con ningún país en la guía EXPO;
                  igual podés sumar líneas personalizadas o plantillas IMPO más
                  abajo.
                </p>
              ) : null}
                <section
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                  aria-labelledby="dc02-budget-lines-heading"
                >
                  <header
                    id="dc02-budget-lines-heading"
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-gradient-to-r from-zinc-100 to-zinc-50/90 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold tracking-tight text-white shadow-sm"
                        aria-hidden
                      >
                        ≡
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-zinc-900">
                          Líneas del presupuesto
                        </h2>
                        <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
                          Cada bloque es un ítem en el PDF. IMPO, JSON o similar
                          se mezclan acá.
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-zinc-700 shadow-sm">
                      {latamRows.length}{" "}
                      {latamRows.length === 1 ? "ítem" : "ítems"}
                    </span>
                  </header>
                  <DndContext
                    sensors={dndSensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis]}
                    onDragStart={({ active }) =>
                      setActiveDragId(active.id as string)
                    }
                    onDragEnd={handleLatamRowDragEnd}
                    onDragCancel={() => setActiveDragId(null)}
                  >
                    <SortableContext
                      items={latamRows.map((r) => r.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div
                        className="space-y-3 p-4"
                        role="list"
                        aria-label="Ítems de cotización y referencia"
                      >
                        {latamRows.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-8 text-center text-sm text-zinc-500">
                            Todavía no hay líneas. Usá{" "}
                            <span className="font-medium text-zinc-700">
                              Agregar al presupuesto
                            </span>{" "}
                            abajo (personalizado sin origen, o IMPO / similar si
                            aplica).
                          </p>
                        ) : null}
                        {latamRows.map((row, rowIdx) => (
                          <SortableLatamRow
                            key={row.id}
                            row={row}
                            rowIdx={rowIdx}
                            placeholderCtx={placeholderCtx}
                            updateLatamRow={updateLatamRow}
                            removeLatamRow={removeLatamRow}
                            removeCrateFromPet={removeCrateFromPet}
                            unregisterCrate={unregisterCrate}
                            pets={pets}
                          />
                        ))}
                      </div>
                    </SortableContext>
                    <DragOverlay modifiers={[restrictToVerticalAxis]}>
                      {activeDragId
                        ? (() => {
                            const idx = latamRows.findIndex(
                              (r) => r.id === activeDragId,
                            );
                            const row = latamRows[idx];
                            return row ? (
                              <SortableLatamRow
                                row={row}
                                rowIdx={idx}
                                placeholderCtx={placeholderCtx}
                                updateLatamRow={updateLatamRow}
                                removeLatamRow={removeLatamRow}
                                removeCrateFromPet={removeCrateFromPet}
                                unregisterCrate={unregisterCrate}
                                pets={pets}
                                isOverlay
                              />
                            ) : null;
                          })()
                        : null}
                    </DragOverlay>
                  </DndContext>
                </section>

                <section
                  aria-labelledby="dc02-add-budget-heading"
                  className="rounded-xl border-2 border-dashed border-emerald-300/85 bg-gradient-to-b from-emerald-50/95 via-emerald-50/20 to-white p-4 shadow-sm"
                >
                  <header
                    id="dc02-add-budget-heading"
                    className="mb-4 flex flex-wrap items-center gap-3 border-b border-emerald-200/80 pb-3"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-lg font-light leading-none text-white shadow-md"
                      aria-hidden
                    >
                      +
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold text-emerald-950">
                        Agregar al presupuesto
                      </h2>
                      <p className="mt-0.5 text-[11px] leading-snug text-emerald-900/80">
                        Campos del JSON por país si hay origen que matchee, o
                        línea personalizada en cualquier momento (sin origen).
                      </p>
                    </div>
                  </header>
                  <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start gap-2">
                    {tradeDirection === "expo" || tradeDirection === "ambas" ? (
                      <div className="space-y-1" style={{ width: "30%" }}>
                        <label
                          htmlFor="dc02-latam-add-select-expo"
                          className={fieldLabelClass}
                        >
                          EXPO
                        </label>
                        <select
                          id="dc02-latam-add-select-expo"
                          key={`latam-add-expo-${latamRows.map((r) => r.id).join("-")}-cf${latamCustomFormOpen ? "1" : "0"}`}
                          defaultValue=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === LATAM_CUSTOM_SELECT_VALUE) {
                              setLatamCustomFormOpen(true);
                              return;
                            }
                            if (v) addLatamJsonRow(v);
                          }}
                          className={`${inputClass} bg-white/95`}
                          aria-label="Agregar ítem EXPO"
                        >
                          <option value="">Elegí campo EXPO…</option>
                          {latamJsonOptionsToAdd.map((opt) => (
                            <option
                              key={opt.key}
                              value={opt.key}
                              title={`${opt.title}\n\nNota interna (ref.):\n${opt.internalNotePreview}`}
                            >
                              {opt.title} —{" "}
                              {truncateForOption(opt.internalNotePreview, 85)}
                            </option>
                          ))}
                          <option value={LATAM_CUSTOM_SELECT_VALUE}>
                            + Campo personalizado (título y descripción propios)
                          </option>
                        </select>
                      </div>
                    ) : null}

                    {tradeDirection === "impo" || tradeDirection === "ambas" ? (
                      <div className="space-y-1" style={{ width: "30%" }}>
                        <label
                          htmlFor="dc02-latam-add-select-impo"
                          className={fieldLabelClass}
                        >
                          IMPO
                        </label>
                        <select
                          id="dc02-latam-add-select-impo"
                          key={`latam-add-impo-${latamRows.map((r) => r.id).join("-")}`}
                          defaultValue=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            const item = officialImpoItems?.find(
                              (i) => `official_impo_${i.id}` === v,
                            );
                            if (item) addOfficialImpoItem(item);
                          }}
                          className={`${inputClass} bg-white/95`}
                          aria-label="Agregar ítem IMPO"
                        >
                          <option value="">Elegí campo IMPO…</option>
                          {latamImpoOptionsToAdd.map((opt) => (
                            <option
                              key={opt.key}
                              value={opt.key}
                              title={`${opt.title}\n\nNota interna (ref.):\n${opt.internalNotePreview}`}
                            >
                              {opt.title} —{" "}
                              {truncateForOption(opt.internalNotePreview, 85)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    {tradeDirection === "transito" ? (
                      <div className="space-y-1" style={{ width: "30%" }}>
                        <label
                          htmlFor="dc02-latam-add-select-transito"
                          className={fieldLabelClass}
                        >
                          Tránsito
                        </label>
                        <select
                          id="dc02-latam-add-select-transito"
                          key={`latam-add-transito-${latamRows.map((r) => r.id).join("-")}`}
                          defaultValue=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v) addTransitoOption(v);
                          }}
                          className={`${inputClass} bg-white/95`}
                          aria-label="Agregar ítem tránsito"
                        >
                          <option value="">Elegí campo tránsito…</option>
                          {latamTransitoOptionsToAdd.map((opt) => (
                            <option
                              key={opt.key}
                              value={opt.key}
                              title={`${opt.title}\n\nNota interna (ref.):\n${opt.internalNotePreview}`}
                            >
                              {opt.title} —{" "}
                              {truncateForOption(opt.internalNotePreview, 85)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    <div className="space-y-1" style={{ width: "30%" }}>
                      <label
                        htmlFor="dc02-latam-add-select-orphan"
                        className={fieldLabelClass}
                      >
                        Item personalizado
                      </label>
                      <select
                        id="dc02-latam-add-select-orphan"
                        key={`latam-add-orphan-${latamRows.map((r) => r.id).join("-")}`}
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === LATAM_ORPHAN_CREATE_VALUE) {
                            openOfficialItemModal();
                            return;
                          }
                          if (v) addOrphanItem(v);
                        }}
                        className={`${inputClass} bg-white/95`}
                        aria-label="Agregar ítem personalizado"
                      >
                        <option value="">Elegí ítem personalizado…</option>
                        {latamOrphanOptionsToAdd.map((opt) => (
                          <option
                            key={opt.key}
                            value={opt.key}
                            title={`${opt.title}\n\nNota interna (ref.):\n${opt.internalNotePreview}`}
                          >
                            {opt.title} —{" "}
                            {truncateForOption(opt.internalNotePreview, 85)}
                          </option>
                        ))}
                        <option value={LATAM_ORPHAN_CREATE_VALUE}>
                          + Crear uno
                        </option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-900/55">
                    Resumen de la nota interna; el tooltip muestra el texto
                    completo.
                  </p>

                  {latamCustomFormOpen ? (
                    <div className="rounded-lg border border-emerald-200/90 bg-white/90 p-3 shadow-sm">
                      <p className="mb-2 text-xs font-semibold text-emerald-900">
                        Línea personalizada
                      </p>
                      <div className="space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                          <div className="min-w-0 flex-1">
                            <label
                              htmlFor="dc02-latam-custom-title"
                              className={fieldLabelClass}
                            >
                              Título
                            </label>
                            <input
                              id="dc02-latam-custom-title"
                              type="text"
                              value={latamCustomTitle}
                              onChange={(e) =>
                                setLatamCustomTitle(e.target.value)
                              }
                              className={inputClass}
                              placeholder="Ej. Gastos adicionales"
                            />
                          </div>
                          <div className="w-full shrink-0 sm:w-[7.5rem] md:w-36">
                            <label
                              htmlFor="dc02-latam-custom-price"
                              className={fieldLabelClass}
                            >
                              Costo
                            </label>
                            <input
                              id="dc02-latam-custom-price"
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={latamCustomPrice}
                              onChange={(e) =>
                                setLatamCustomPrice(e.target.value)
                              }
                              className={`${inputClass} tabular-nums`}
                              placeholder="Ej. 150 USD"
                            />
                          </div>
                        </div>
                        <div>
                          <label
                            htmlFor="dc02-latam-custom-desc"
                            className={fieldLabelClass}
                          >
                            Descripción
                          </label>
                          <AutoHeightDescriptionTextarea
                            id="dc02-latam-custom-desc"
                            value={latamCustomDesc}
                            onChange={(e) =>
                              setLatamCustomDesc(e.target.value)
                            }
                            minHeightPx={72}
                            className={`${inputClass} font-sans`}
                            placeholder="Texto para el ítem / cotización al cliente"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => submitLatamCustom()}
                            disabled={latamCustomTitle.trim() === ""}
                            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                          >
                            Agregar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLatamCustomFormOpen(false);
                              setLatamCustomTitle("");
                              setLatamCustomDesc("");
                              setLatamCustomPrice("");
                            }}
                            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => openOfficialItemModal()}
                            className="px-1 py-1.5 text-sm text-emerald-700 underline"
                          >
                            {officialItemBtnLabel()}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  </div>
                </section>
              </div>

            <div className="mt-6">
              <label htmlFor="dc02-notes" className={labelClass}>
                Notes
              </label>
              <textarea
                id="dc02-notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`${inputClass} min-h-[5rem] resize-y font-sans`}
                placeholder="Anotaciones internas de la cotización"
              />
            </div>

            <hr
              className="my-8 border-0 border-t border-dashed border-zinc-300"
              aria-hidden
            />

            <div className="space-y-5">
              <div>
                <label
                  htmlFor="dc02-disclaimer-contract"
                  className={labelClass}
                >
                  Conditions of contract
                </label>
                <textarea
                  id="dc02-disclaimer-contract"
                  rows={5}
                  value={disclaimerContract}
                  onChange={(e) => setDisclaimerContract(e.target.value)}
                  className={`${inputClass} min-h-[5.5rem] resize-y font-sans`}
                />
              </div>
              <div>
                <label
                  htmlFor="dc02-disclaimer-contact"
                  className={labelClass}
                >
                  Contact
                </label>
                <textarea
                  id="dc02-disclaimer-contact"
                  rows={3}
                  value={disclaimerContact}
                  onChange={(e) => setDisclaimerContact(e.target.value)}
                  className={`${inputClass} min-h-[3.5rem] resize-y font-sans`}
                />
              </div>
            </div>
          </form>
        </section>

        {pdfPreviewOpen ? (
        <section
          className="w-full min-w-0 lg:w-1/2 lg:max-w-[50%]"
          aria-label="Panel derecho"
        >
          <div
            id="dc02-right-pane"
            className="h-fit w-full rounded-[20px] border border-zinc-300 bg-white shadow-[0_4px_28px_rgba(15,23,42,0.1)]"
          >
            <QuotePrintLayout
              data={printData}
              lang={pdfLang}
              callbacks={{
                onCustomerNameChange: setCustomerName,
                onAgentNameChange: setAgentName,
                onOriginChange: setOrigin,
                onDestinationChange: setDestination,
                onQuotedDateChange: setQuotedDate,
                onTravelDateChange: setTravelDate,
                onBudgetLineChange: (rowId, patch) => updateLatamRowForPdf(rowId, patch, pdfLang),
                onDisclaimerContractChange: setDisclaimerContract,
                onRemoveBudgetLine: removeLatamRow,
                onReorderBudgetLines: (activeId, overId) => {
                  setLatamRows((prev) => {
                    const oldIndex = prev.findIndex((r) => r.id === activeId);
                    const newIndex = prev.findIndex((r) => r.id === overId);
                    if (oldIndex === -1 || newIndex === -1) return prev;
                    return arrayMove(prev, oldIndex, newIndex);
                  });
                },
              }}
            />
          </div>
        </section>
        ) : null}
      </div>


      {/* Modal: subida de PDF a Dropbox */}
      {dbxUploadModalOpen && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Subiendo PDF a Dropbox"
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900">PDF enviado</h2>

            {dbxUploadStatus === "uploading" && (
              <div className="flex flex-col items-center gap-3 py-2">
                <span className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-700" />
                <p className="text-sm text-zinc-600">Subiendo a Dropbox…</p>
                {dbxMatchedFolderName && (
                  <p className="max-w-full break-all text-center text-xs font-medium text-zinc-500">
                    📁 {dbxMatchedFolderName}
                  </p>
                )}
              </div>
            )}

            {dbxUploadStatus === "done" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-700">Subido correctamente a Dropbox.</p>
                  {dbxMatchedFolderName && (
                    <p className="break-all text-xs text-zinc-500">
                      📁 cotizado por app {dbxMatchedFolderName}
                    </p>
                  )}
                </div>
                {dbxFolderLink && (
                  <a
                    href={dbxFolderLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                  >
                    Ir a la carpeta →
                  </a>
                )}
              </div>
            )}

            {dbxUploadStatus === "not-found" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm text-zinc-600">No se encontró carpeta en Dropbox para este cliente.</p>
                  <p className="text-xs text-zinc-400">El PDF no fue subido a Dropbox.</p>
                </div>
                <a
                  href={`https://www.dropbox.com/home${APP_TESTING_PATH.split("/").map(encodeURIComponent).join("/")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100"
                >
                  Abrir directorio en Dropbox →
                </a>
              </div>
            )}

            {dbxUploadStatus === "error" && (
              <div className="space-y-1">
                <p className="text-sm text-red-700">Error al subir a Dropbox.</p>
                <p className="text-xs text-red-500">{dbxUploadError}</p>
              </div>
            )}

            {dbxUploadStatus !== "uploading" && (
              <button
                type="button"
                onClick={() => setDbxUploadModalOpen(false)}
                className="mt-5 w-full rounded-lg bg-zinc-800 px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-900"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal: conectar Outlook (se muestra al cargar si no hay cuenta conectada) */}
      {outlookConnectModalOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Conectar cuenta Outlook"
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-sm font-semibold text-zinc-900">
              Conectar cuenta Outlook
            </h2>
            <p className="mb-5 text-sm text-zinc-600">
              Para enviar cotizaciones por email necesitás autorizar una cuenta de Outlook.
              Podés hacerlo ahora o más tarde desde el botón &quot;Enviar PDF&quot;.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOutlookConnectModalOpen(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100"
              >
                Ahora no
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/api/auth/microsoft/start?returnTo=/demo-coti";
                }}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-900"
              >
                Conectar Outlook
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Drawer: enviar cotización por email */}
      {emailDrawerOpen ? (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/30"
            aria-hidden="true"
            onClick={() => { if (!emailSending) setEmailDrawerOpen(false); }}
          />
          <div
            className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Enviar cotización por email"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-900">
                Enviar cotización por email
              </h2>
              <button
                type="button"
                onClick={() => { if (!emailSending) setEmailDrawerOpen(false); }}
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            {/* Cuenta remitente */}
            <div className="shrink-0 border-b border-zinc-200 px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Outlook remitente
                  </p>
                  {outlookStatusLoading ? (
                    <p className="mt-0.5 text-xs text-zinc-500">Verificando conexión…</p>
                  ) : outlookStatus?.connected ? (
                    <p className="mt-0.5 text-xs text-zinc-800">
                      <strong>{outlookStatus.displayName || outlookStatus.email}</strong>
                      {outlookStatus.email ? ` · ${outlookStatus.email}` : ""}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-zinc-600">
                      {outlookStatus?.error || "Sin cuenta conectada."}
                    </p>
                  )}
                </div>
                {outlookStatus?.connected ? (
                  <button
                    type="button"
                    onClick={() => void handleDisconnectOutlook()}
                    disabled={outlookDisconnecting || emailSending}
                    className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
                  >
                    {outlookDisconnecting ? "Desconectando…" : "Desconectar"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = "/api/auth/microsoft/start?returnTo=/demo-coti";
                    }}
                    disabled={outlookStatusLoading || emailSending || !outlookStatus?.configured}
                    className="shrink-0 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-900 disabled:opacity-50"
                  >
                    Conectar Outlook
                  </button>
                )}
              </div>
            </div>

            {/* Formulario */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {emailResult === "ok" ? (
                <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
                  PDF enviado correctamente a <strong>{emailTo}</strong>.
                </div>
              ) : (
                <div className="space-y-4">
                  {emailResult === "error" ? (
                    <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
                      {emailError || "Error al enviar el email."}
                    </div>
                  ) : null}

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">
                      Destinatario
                    </label>
                    <EmailAutocomplete
                      value={emailTo}
                      onChange={(v) => {
                        setEmailTo(v);
                        if (selectedThread) {
                          setSelectedThread(null);
                          setEmailSubject(customerName.trim() ? `Cotización LATAM Pet Transport — ${customerName.trim()}` : "Cotización LATAM Pet Transport");
                        }
                        setThreadResults([]);
                        setThreadSearchError("");
                      }}
                      placeholder="cliente@ejemplo.com"
                      className={inputClass}
                      disabled={emailSending}
                      autoFocus
                    />
                  </div>

                  {/* Contexto del template */}
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                        Tipo de operación
                        {emailTemplateCode ? <span className="ml-2 normal-case font-normal text-zinc-400">· {emailTemplateCode}</span> : null}
                      </p>
                      <button
                        type="button"
                        onClick={() => void fetchAndApplyTemplate()}
                        disabled={emailSending || emailTemplateLoading}
                        className="text-[11px] font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      >
                        {emailTemplateLoading ? "Cargando…" : "Regenerar texto"}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="mb-1 block text-[11px] font-medium text-zinc-600">Operación</label>
                        <select
                          value={tipoOperacion}
                          onChange={(e) => setTipoOperacion(e.target.value as "EXPO" | "IMPO")}
                          disabled={emailSending}
                          className={`${inputClass} text-xs`}
                        >
                          <option value="EXPO">EXPO</option>
                          <option value="IMPO">IMPO</option>
                        </select>
                      </div>
                      <div className="flex-none pt-4">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${agentName.trim() ? "bg-zinc-200 text-zinc-600" : "bg-blue-100 text-blue-700"}`}>
                          {agentName.trim() ? "Agente" : "Retail"}
                        </span>
                      </div>
                    </div>
                    {!agentName.trim() && (
                      <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={referidoStarwood}
                          onChange={(e) => setReferidoStarwood(e.target.checked)}
                          disabled={emailSending}
                          className="h-3.5 w-3.5 accent-zinc-700"
                        />
                        Referido por Starwood Pet
                      </label>
                    )}
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                        Agente recomendado
                        <span className="ml-1 font-normal text-zinc-400">(nombre en el cuerpo)</span>
                      </label>
                      <input
                        type="text"
                        value={recommendedAgentName}
                        onChange={(e) => setRecommendedAgentName(e.target.value)}
                        placeholder="Ej: PetRelocation US"
                        className={`${inputClass} text-xs`}
                        disabled={emailSending}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-zinc-600">
                        Email del agente
                        <span className="ml-1 font-normal text-zinc-400">(para CC)</span>
                      </label>
                      <input
                        type="email"
                        value={recommendedAgentEmail}
                        onChange={(e) => setRecommendedAgentEmail(e.target.value)}
                        placeholder="agente@empresa.com"
                        className={`${inputClass} text-xs`}
                        disabled={emailSending}
                      />
                    </div>
                  </div>

                  {/* Responder a mail anterior */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-medium text-zinc-700">
                        Responder a mail anterior
                        <span className="ml-1 font-normal text-zinc-400">(opcional)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleSearchThreads()}
                        disabled={
                          emailSending ||
                          threadLoading ||
                          !emailTo.trim() ||
                          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo.trim()) ||
                          !outlookStatus?.connected
                        }
                        className="rounded-md border border-zinc-300 px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {threadLoading ? "Buscando…" : "Buscar mails"}
                      </button>
                    </div>

                    {selectedThread ? (
                      <div className="flex items-start justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-blue-900">{selectedThread.subject}</p>
                          <p className="mt-0.5 text-blue-600">
                            {new Date(selectedThread.receivedDateTime).toLocaleDateString("es-AR", {
                              day: "2-digit", month: "short", year: "numeric",
                            })}
                            {" · de: "}
                            {selectedThread.from.emailAddress.name || selectedThread.from.emailAddress.address}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedThread(null);
                            setThreadResults([]);
                            setEmailSubject(customerName.trim() ? `Cotización LATAM Pet Transport — ${customerName.trim()}` : "Cotización LATAM Pet Transport");
                          }}
                          disabled={emailSending}
                          className="shrink-0 text-blue-400 hover:text-blue-600 disabled:opacity-50"
                          aria-label="Quitar mail seleccionado"
                        >
                          ✕
                        </button>
                      </div>
                    ) : threadResults.length > 0 ? (
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50">
                        {threadResults.map((thread, idx) => (
                          <button
                            key={thread.id}
                            type="button"
                            onClick={() => {
                              setSelectedThread(thread);
                              setThreadResults([]);
                              const reSubject = thread.subject?.trim() || "";
                              setEmailSubject(reSubject.toLowerCase().startsWith("re:") ? reSubject : `Re: ${reSubject}`);
                            }}
                            disabled={emailSending}
                            className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-xs transition hover:bg-zinc-100 disabled:opacity-50 ${idx > 0 ? "border-t border-zinc-200" : ""}`}
                          >
                            <span className="truncate font-medium text-zinc-800">{thread.subject || "(sin asunto)"}</span>
                            <span className="text-zinc-500">
                              {new Date(thread.receivedDateTime).toLocaleDateString("es-AR", {
                                day: "2-digit", month: "short", year: "numeric",
                              })}
                              {" · de: "}
                              {thread.from.emailAddress.name || thread.from.emailAddress.address}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : threadSearchError ? (
                      <p className="text-[11px] text-zinc-400">{threadSearchError}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">
                      Asunto
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className={`${inputClass} ${selectedThread ? "cursor-not-allowed bg-zinc-50 text-zinc-500" : ""}`}
                      disabled={emailSending}
                      readOnly={!!selectedThread}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">
                      CC
                      {ccRecommendedAgent && (
                        <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">agente recomendado</span>
                      )}
                    </label>
                    <EmailTagInput
                      values={emailCc}
                      onChange={setEmailCc}
                      placeholder="cc@ejemplo.com (Enter o coma para agregar)"
                      disabled={emailSending}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">
                      Cuerpo del email
                    </label>
                    {emailTemplateLoading ? (
                      <div className="flex h-40 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
                        Cargando template…
                      </div>
                    ) : (
                      <RichTextEditor
                        value={emailBody}
                        onChange={setEmailBody}
                        disabled={emailSending}
                        minHeight="16rem"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center justify-between gap-2 border-t border-zinc-200 px-5 py-4">
              {emailResult !== "ok" ? (
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600 select-none">
                  <input
                    type="checkbox"
                    checked={emailDownloadPdf}
                    onChange={(e) => setEmailDownloadPdf(e.target.checked)}
                    disabled={emailSending}
                    className="h-3.5 w-3.5 accent-zinc-700"
                  />
                  Descargar PDF
                </label>
              ) : <span />}
              <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEmailDrawerOpen(false)}
                disabled={emailSending}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
              >
                {emailResult === "ok" ? "Cerrar" : "Cancelar"}
              </button>
              <div ref={actionsMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setActionsMenuOpen((v) => !v)}
                  disabled={emailSending || pdfDownloading || savingQuote}
                  className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
                  aria-label="Más acciones"
                  aria-haspopup="menu"
                  aria-expanded={actionsMenuOpen}
                >
                  {pdfDownloading || savingQuote ? "…" : "⋯"}
                </button>
                {actionsMenuOpen && (
                  <div
                    role="menu"
                    className="absolute bottom-full right-0 mb-1 min-w-[180px] overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-xs shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setActionsMenuOpen(false);
                        void handleDownloadPdfOnly();
                      }}
                      disabled={emailSending || pdfDownloading || savingQuote}
                      className="block w-full px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                    >
                      {pdfDownloading ? "Generando…" : "Descargar PDF"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleSaveQuoteOnly()}
                      disabled={emailSending || pdfDownloading || savingQuote}
                      className="block w-full px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                    >
                      {savingQuote ? "Guardando…" : "Guardar cotización"}
                    </button>
                  </div>
                )}
              </div>
              {emailResult !== "ok" && (
                <button
                  type="button"
                  onClick={() => void handleSendEmail()}
                  disabled={
                    emailSending ||
                    pdfDownloading ||
                    emailTemplateLoading ||
                    !emailTo.trim() ||
                    !emailSubject.trim() ||
                    outlookStatusLoading ||
                    !outlookStatus?.connected
                  }
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-900 disabled:opacity-50"
                >
                  {emailSending ? "Enviando…" : "Enviar"}
                </button>
              )}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {officialItemModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOfficialItemModalOpen(false); }}
        >
          <div className="w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl" style={{ maxHeight: "90dvh" }}>
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-900">
                {officialItemBtnLabel()}
              </h2>
              <button
                type="button"
                onClick={() => setOfficialItemModalOpen(false)}
                className="rounded p-1 text-zinc-400 hover:text-zinc-700"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={fieldLabelClass}>Título (EN)</label>
                  <input
                    type="text"
                    value={officialItemEn}
                    onChange={(e) => setOfficialItemEn(e.target.value)}
                    className={inputClass}
                    placeholder="English title"
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>Título (ES)</label>
                  <input
                    type="text"
                    value={officialItemEs}
                    onChange={(e) => setOfficialItemEs(e.target.value)}
                    className={inputClass}
                    placeholder="Título en español"
                  />
                </div>
              </div>
              <div>
                <label className={fieldLabelClass}>Precio de referencia</label>
                <input
                  type="text"
                  value={officialPriceRef}
                  onChange={(e) => setOfficialPriceRef(e.target.value)}
                  className={`${inputClass} tabular-nums`}
                  placeholder="Ej. 150 USD"
                />
              </div>
              <div>
                <label className={fieldLabelClass}>Descripción (EN)</label>
                <AutoHeightDescriptionTextarea
                  value={officialDescEn}
                  onChange={(e) => setOfficialDescEn(e.target.value)}
                  minHeightPx={64}
                  className={`${inputClass} font-sans`}
                  placeholder="English description"
                />
              </div>
              <div>
                <label className={fieldLabelClass}>Descripción (ES)</label>
                <AutoHeightDescriptionTextarea
                  value={officialDescEs}
                  onChange={(e) => setOfficialDescEs(e.target.value)}
                  minHeightPx={64}
                  className={`${inputClass} font-sans`}
                  placeholder="Descripción en español"
                />
              </div>
              <div>
                <label className={fieldLabelClass}>Notas internas</label>
                <AutoHeightDescriptionTextarea
                  value={officialNotes}
                  onChange={(e) => setOfficialNotes(e.target.value)}
                  minHeightPx={48}
                  className={`${inputClass} font-sans`}
                  placeholder="Notas para uso interno"
                />
              </div>
              <div>
                <label className={fieldLabelClass}>Aeropuerto (código IATA, opcional)</label>
                <input
                  type="text"
                  value={officialAirport}
                  onChange={(e) => setOfficialAirport(e.target.value.toUpperCase())}
                  className={inputClass}
                  placeholder="Ej. EZE"
                  maxLength={10}
                />
              </div>
              <div>
                <label className={fieldLabelClass}>País (opcional)</label>
                <input
                  type="text"
                  value={officialCountry}
                  onChange={(e) => setOfficialCountry(e.target.value)}
                  className={inputClass}
                  placeholder="País (opcional)"
                />
              </div>
              {officialError ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{officialError}</p>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOfficialItemModalOpen(false)}
                  disabled={officialSubmitting}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void submitOfficialItem()}
                  disabled={
                    officialSubmitting ||
                    (!officialItemEn.trim() && !officialItemEs.trim())
                  }
                  className="rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {officialSubmitting ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {deletedToast ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-zinc-800 px-4 py-3 text-sm text-white shadow-xl">
          <span>
            <span className="font-medium">{deletedToast.item.title}</span> eliminado
          </span>
          <button
            type="button"
            onClick={undoDeleteLatamRow}
            className="rounded bg-zinc-600 px-2.5 py-1 text-xs font-semibold transition hover:bg-zinc-500"
          >
            Deshacer
          </button>
          <button
            type="button"
            onClick={() => {
              if (deletedToastTimerRef.current) clearTimeout(deletedToastTimerRef.current);
              setDeletedToast(null);
            }}
            aria-label="Cerrar"
            className="ml-1 text-zinc-400 transition hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
          </button>
        </div>
      ) : null}
    </main>
  );
}
