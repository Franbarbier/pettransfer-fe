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
  filterCrateOptionsForPet,
  formatCrateOptionLabel,
  getCrateOptionsForOrigin,
  resolveCrateCountryKey,
} from "@/lib/crateTariffsByCountry";
import { useExpoItems } from "@/hooks/useExpoItems";
import {
  type LocationSuggestOption,
  parseLocationSuggestList,
} from "@/lib/quoteLocationSuggestions";
import { getApiBaseUrl } from "@/services/api";

const apiBase = getApiBaseUrl().replace(/\/$/, "");

const INITIAL_DISCLAIMER_CONTRACT =
  "a. This price does not include cost of insurance of the animal.\n" +
  "b. Prices charged by third parties may vary, in which case we will inform if there are any variation in the customer's charges.\n" +
  "c. Payment: 100% in advance";

type VendedorOption = {
  id: string;
  name: string;
  email: string;
};

/** Clave en localStorage para recordar el último vendedor seleccionado (solo el id). */
const SELECTED_VENDEDOR_STORAGE_KEY = "demo-coti:selected-salesperson";

/** Formato fijo de la línea "Contact" en el PDF con los datos del vendedor elegido. */
function formatVendedorDisclaimer(v: VendedorOption): string {
  return `LATAM PET TRANSPORT , ${v.name} , ${v.email}`;
}

const INITIAL_DISCLAIMER_CONTACT =
  "LATAM PET TRANSPORT , Mariela Gherghi , mariela@latampettransport.com";

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

type PetRow = {
  tipo: "" | "perro" | "gato";
  raza: string;
  nombre: string;
  crateId: string;
  costo: string;
  /**
   * Si `true`, esta mascota viaja con crate cotizado (se muestra el selector
   * de tamaño/valor y se emite una línea de crate en el PDF). Si `false`, no
   * se cotiza crate para este animal.
   */
  hasCrate: boolean;
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

function emptyPet(): PetRow {
  return {
    tipo: "",
    raza: "",
    nombre: "",
    crateId: "",
    costo: "",
    hasCrate: false,
  };
}

type ImpoTemplateMatch = {
  title: string;
  country: string;
  location: string | null;
  file_name: string;
  relative_path: string;
  animal_count: number | null;
  variants: string[];
  metadata: Record<string, unknown> | null;
  /** Presente desde API actualizado; si falta, el merge usa solo `customer_description`. */
  description_blocks?: Array<{
    item_number: number;
    title: string;
    paragraphs: string[];
  }>;
  quoted_items: Array<{
    item_number: number | null;
    label: string;
    amount: number | null;
    note: string | null;
    /** Texto al cliente (descriptions); la `note` es solo interna. */
    customer_description: string | null;
  }>;
};

/** Texto al cliente: solo `paragraphs` del template (el título del bloque no se repite). */
function impoCustomerTextForQuotedItem(
  it: ImpoTemplateMatch["quoted_items"][number],
  tpl: ImpoTemplateMatch,
): string {
  const direct = it.customer_description?.trim();
  if (direct) return direct;
  const n = it.item_number;
  const block =
    n != null
      ? tpl.description_blocks?.find((d) => d.item_number === n)
      : undefined;
  if (block?.paragraphs?.length) {
    return block.paragraphs.filter(Boolean).join("\n\n").trim();
  }
  const ln = it.label.trim().toLowerCase();
  if (!ln || !tpl.description_blocks?.length) return "";
  const byTitle = tpl.description_blocks.find(
    (d) => d.title.trim().toLowerCase() === ln,
  );
  if (byTitle?.paragraphs?.length) {
    return byTitle.paragraphs.filter(Boolean).join("\n\n").trim();
  }
  return "";
}

type LatamFieldRow = {
  id: string;
  source: "json" | "custom" | "impo" | "similar";
  /** Clave JSON (`vet_fees`) o id único para filas custom. */
  fieldKey: string;
  title: string;
  price: string;
  /** Texto de ítem / al cliente. */
  description: string;
  /** Referencia operativa (contenido que venía del JSON como aclaración). */
  internalNote: string;
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
    case "impo":
      return "border-sky-200 bg-sky-50/70 ring-sky-100/80";
    case "json":
      return "border-violet-200 bg-violet-50/70 ring-violet-100/80";
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

function newLatamRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `latam-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function latamJsonFieldTitle(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
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

function formatAnimalsLine(count: number, petsList: PetRow[]): string {
  if (count <= 0) return "—";
  const rows = petsList.slice(0, count);
  const parts = rows.map((p, i) => {
    const tipoLabel =
      p.tipo === "perro" ? "Dog" : p.tipo === "gato" ? "Cat" : "Pet";
    const name = p.nombre.trim() || `#${i + 1}`;
    const raza = p.raza.trim();
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

type TradeDirectionChoice = "impo" | "expo" | "ambas";

export default function DemoCoti01Page(): React.JSX.Element {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [tradeDirection, setTradeDirection] =
    useState<TradeDirectionChoice>("ambas");
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
  const [animalCount, setAnimalCount] = useState(1);
  const [pets, setPets] = useState<PetRow[]>([emptyPet()]);
  const [quotedDate, setQuotedDate] = useState(() => todayLocalIsoDate());
  const [arrivalDate, setArrivalDate] = useState("");
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
  const [impoTemplates, setImpoTemplates] = useState<ImpoTemplateMatch[]>([]);
  const [impoTemplatesLoading, setImpoTemplatesLoading] = useState(false);
  const [impoTemplatesError, setImpoTemplatesError] = useState<string | null>(
    null,
  );
  const [latamCustomFormOpen, setLatamCustomFormOpen] = useState(false);
  const [latamCustomTitle, setLatamCustomTitle] = useState("");
  const [latamCustomDesc, setLatamCustomDesc] = useState("");
  const [latamCustomPrice, setLatamCustomPrice] = useState("");
  const [dragRowIndex, setDragRowIndex] = useState<number | null>(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<
    "before" | "after" | null
  >(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(true);
  const [similarQuotesTableOpen, setSimilarQuotesTableOpen] =
    useState(false);
  const [impoGuidePanelOpen, setImpoGuidePanelOpen] = useState(false);
  const [expoGuidePanelOpen, setExpoGuidePanelOpen] = useState(false);

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

  const debouncedOrigin = useDebounced(origin, 280);
  const debouncedDest = useDebounced(destination, 280);

  useEffect(() => {
    void (async () => {
      setVendedoresLoading(true);
      setVendedoresError(null);
      try {
        const res = await fetch(`${apiBase}/salespeople`);
        const body: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          const err =
            typeof body === "object" && body !== null && "error" in body
              ? String((body as { error: unknown }).error)
              : res.statusText;
          setVendedoresError(err);
          return;
        }
        if (
          typeof body === "object" &&
          body !== null &&
          "salespeople" in body &&
          Array.isArray((body as { salespeople: unknown }).salespeople)
        ) {
          const list = (
            body as { salespeople: VendedorOption[] }
          ).salespeople.map((v) => ({
            id: v.id,
            name: v.name,
            email: v.email,
          }));
          setVendedores(list);
          try {
            const stored = localStorage.getItem(SELECTED_VENDEDOR_STORAGE_KEY);
            const resolved =
              stored && list.some((v) => v.id === stored)
                ? stored
                : list[0]?.id ?? "";
            setSelectedVendedorId(resolved);
          } catch {
            setSelectedVendedorId(list[0]?.id ?? "");
          }
        }
      } catch (e: unknown) {
        setVendedoresError(e instanceof Error ? e.message : String(e));
      } finally {
        setVendedoresLoading(false);
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

  useEffect(() => {
    if (tradeDirection === "expo") {
      setImpoTemplates([]);
      setImpoTemplatesError(null);
      setImpoTemplatesLoading(false);
      return;
    }
    const d = debouncedDest.trim();
    if (d.length < 2) {
      setImpoTemplates([]);
      setImpoTemplatesError(null);
      return;
    }
    const ac = new AbortController();
    setImpoTemplatesLoading(true);
    setImpoTemplatesError(null);
    void (async () => {
      try {
        const res = await fetch(
          `${apiBase}/quotes/impo-templates/for-destination?${new URLSearchParams(
            {
              destination: d,
              pets: String(Math.max(1, animalCount)),
            },
          )}`,
          { signal: ac.signal },
        );
        const body: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          const err =
            typeof body === "object" && body !== null && "error" in body
              ? String((body as { error: unknown }).error)
              : res.statusText;
          if (!ac.signal.aborted) {
            setImpoTemplatesError(err);
            setImpoTemplates([]);
          }
          return;
        }
        const list =
          typeof body === "object" &&
          body !== null &&
          "templates" in body &&
          Array.isArray((body as { templates: unknown }).templates)
            ? (body as { templates: ImpoTemplateMatch[] }).templates
            : [];
        // Por ahora ocultamos variantes "puppy" (ej.: México MEX tiene
        // `1_pet_puppy`). Más adelante se puede agregar un toggle para
        // elegir explícitamente si la operación es con cachorro.
        const filtered = list.filter(
          (tpl) =>
            !Array.isArray(tpl.variants) || !tpl.variants.includes("puppy"),
        );
        if (!ac.signal.aborted) {
          setImpoTemplates(filtered);
        }
      } catch (e: unknown) {
        if (ac.signal.aborted) return;
        setImpoTemplatesError(e instanceof Error ? e.message : String(e));
        setImpoTemplates([]);
      } finally {
        if (!ac.signal.aborted) setImpoTemplatesLoading(false);
      }
    })();
    return () => ac.abort();
  }, [debouncedDest, animalCount, tradeDirection]);

  const { latamJaulasHint, latamPreEntregaHint, latamProfitFields, expoLoading } =
    useExpoItems(origin);

  /**
   * Al cambiar el país de referencia del JSON profit, se quitan solo las filas
   * cargadas desde ese JSON; las de template IMPO o personalizadas se mantienen.
   */
  useEffect(() => {
    setLatamCustomFormOpen(false);
    setLatamCustomTitle("");
    setLatamCustomDesc("");
    setLatamRows((prev) => prev.filter((r) => r.source !== "json"));
  }, [latamProfitFields?.countryKey]);

  const latamJsonOptionsToAdd = useMemo(() => {
    if (!latamProfitFields?.fields.length) return [];
    const usedJson = new Set(
      latamRows.filter((r) => r.source === "json").map((r) => r.fieldKey),
    );
    return latamProfitFields.fields
      .filter((f) => !usedJson.has(f.key))
      .map((f) => ({
        key: f.key,
        title: latamJsonFieldTitle(f.key),
        internalNotePreview: f.clarification,
      }));
  }, [latamProfitFields, latamRows]);

  function removeLatamRow(rowId: string): void {
    setLatamRows((prev) => prev.filter((r) => r.id !== rowId));
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

  /**
   * Reordena `latamRows` moviendo el ítem en `fromIndex` justo antes del que
   * estaba en `toIndex`. Se usa para drag&drop manual.
   */
  function moveLatamRow(fromIndex: number, toIndex: number): void {
    setLatamRows((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex < 0 ||
        toIndex > prev.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
      next.splice(insertAt, 0, moved);
      return next;
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
  }

  function buildImpoTemplateRow(
    template: ImpoTemplateMatch,
    itemIndex: number,
  ): LatamFieldRow | null {
    const it = template.quoted_items[itemIndex];
    if (!it) return null;
    const label = it.label.trim();
    if (!label) return null;
    const fieldKey = `impo_${template.title}_${it.item_number ?? "u"}_${itemIndex}`;
    const internalBits: string[] = [];
    if (it.note?.trim()) internalBits.push(it.note.trim());
    internalBits.push(`${template.file_name} · ${template.title}`);
    return {
      id: newLatamRowId(),
      source: "impo",
      fieldKey,
      title: label,
      price:
        it.amount != null && Number.isFinite(it.amount)
          ? String(it.amount)
          : "",
      description: impoCustomerTextForQuotedItem(it, template),
      internalNote: internalBits.join(" · "),
    };
  }

  function addImpoTemplateItem(
    template: ImpoTemplateMatch,
    itemIndex: number,
  ): void {
    const row = buildImpoTemplateRow(template, itemIndex);
    if (!row) return;
    setLatamRows((prev) => {
      if (prev.some((r) => r.source === "impo" && r.fieldKey === row.fieldKey)) {
        return prev;
      }
      return [...prev, row];
    });
  }

  function addImpoTemplateItems(template: ImpoTemplateMatch): void {
    const rows: LatamFieldRow[] = [];
    for (let idx = 0; idx < template.quoted_items.length; idx++) {
      const row = buildImpoTemplateRow(template, idx);
      if (row) rows.push(row);
    }
    if (rows.length === 0) return;
    setLatamRows((prev) => {
      const existingKeys = new Set(
        prev.filter((r) => r.source === "impo").map((r) => r.fieldKey),
      );
      const toAppend = rows.filter((r) => !existingKeys.has(r.fieldKey));
      if (toAppend.length === 0) return prev;
      for (const r of toAppend) existingKeys.add(r.fieldKey);
      return [...prev, ...toAppend];
    });
  }

  function addLatamJsonRow(jsonKey: string): void {
    if (!latamProfitFields?.fields) return;
    const f = latamProfitFields.fields.find((x) => x.key === jsonKey);
    if (!f) return;
    setLatamRows((prev) => {
      if (prev.some((r) => r.source === "json" && r.fieldKey === f.key)) {
        return prev;
      }
      return [
        ...prev,
        {
          id: newLatamRowId(),
          source: "json",
          fieldKey: f.key,
          title: latamJsonFieldTitle(f.key),
          price: "",
          description: "",
          internalNote: f.clarification,
        },
      ];
    });
  }

  /**
   * Agrega el sub-ítem "Pre-entrega de la jaula" como fila del presupuesto.
   * Usa la misma `source="json"` y `fieldKey="pre_entrega_de_la_jaula"` para
   * que el dedup general funcione (no se duplica si alguien ya lo agregó).
   */
  function addPreEntregaJaulaItem(): void {
    if (!latamPreEntregaHint) return;
    const key = "pre_entrega_de_la_jaula";
    setLatamRows((prev) => {
      if (prev.some((r) => r.source === "json" && r.fieldKey === key)) {
        return prev;
      }
      return [
        ...prev,
        {
          id: newLatamRowId(),
          source: "json",
          fieldKey: key,
          title: "Pre-entrega de la jaula",
          price: "",
          description: "",
          internalNote: latamPreEntregaHint.note,
        },
      ];
    });
  }

  function addAllLatamJsonGuideItems(): void {
    const fields = latamProfitFields?.fields;
    if (!fields?.length) return;
    setLatamRows((prev) => {
      const usedJson = new Set(
        prev.filter((r) => r.source === "json").map((r) => r.fieldKey),
      );
      const newRows: LatamFieldRow[] = [];
      for (const f of fields) {
        if (usedJson.has(f.key)) continue;
        usedJson.add(f.key);
        newRows.push({
          id: newLatamRowId(),
          source: "json",
          fieldKey: f.key,
          title: latamJsonFieldTitle(f.key),
          price: "",
          description: "",
          internalNote: f.clarification,
        });
      }
      if (newRows.length === 0) return prev;
      return [...prev, ...newRows];
    });
  }

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

  useEffect(() => {
    if (impoTemplatesLoading) return;
    const includeImpo =
      tradeDirection === "impo" || tradeDirection === "ambas";
    if (!includeImpo || impoTemplates.length === 0) {
      autoAddedImpoSigRef.current = null;
      return;
    }
    const preferred =
      impoTemplates.find((t) => t.variants?.includes("default")) ??
      impoTemplates[0];
    if (!preferred) return;
    const sig = `${preferred.title}|${preferred.location ?? ""}|${preferred.file_name}`;
    if (autoAddedImpoSigRef.current === sig) return;
    setLatamRows((prev) => prev.filter((r) => r.source !== "impo"));
    autoAddedImpoSigRef.current = sig;
    addImpoTemplateItems(preferred);
  }, [impoTemplates, impoTemplatesLoading, tradeDirection]);

  useEffect(() => {
    const includeExpo =
      tradeDirection === "expo" || tradeDirection === "ambas";
    if (!includeExpo || !latamProfitFields?.fields.length) {
      autoAddedExpoSigRef.current = null;
      return;
    }
    const sig = latamProfitFields.countryKey;
    if (autoAddedExpoSigRef.current === sig) return;
    autoAddedExpoSigRef.current = sig;
    addAllLatamJsonGuideItems();
  }, [latamProfitFields, tradeDirection]);

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
  }, [tradeDirection]);

  /** Copia título, descripción (nota + detalles) y precio de un ítem de cotización similar al presupuesto PDF. */
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

  /** Vista previa PDF: primero crates por animal, luego ítems LATAM. */
  const rightPaneBudgetLines = useMemo((): RightPaneBudgetLine[] => {
    const lines: RightPaneBudgetLine[] = [];
    const n = Math.min(animalCount, pets.length);
    for (let i = 0; i < n; i++) {
      const p = pets[i];
      if (!p.hasCrate) continue;
      const crate = crateOptionsForOrigin.find((c) => c.id === p.crateId);
      const cratePart = crate ? formatCrateOptionLabel(crate) : "";
      const tipoLabel =
        p.tipo === "perro" ? "Dog" : p.tipo === "gato" ? "Cat" : "Pet";
      const name = p.nombre.trim() || `#${i + 1}`;
      const descBits: string[] = [];
      if (p.raza.trim()) descBits.push(p.raza.trim());
      if (cratePart) descBits.push(cratePart);
      lines.push({
        kind: "pet",
        id: `pet-costo-${i}`,
        petIndex: i,
        title: `Crate · ${tipoLabel} · ${name}`,
        description: descBits.join(" · "),
        price: p.costo,
      });
    }
    for (const r of latamRows) {
      lines.push({
        kind: "latam",
        id: r.id,
        rowId: r.id,
        title: r.title,
        description: r.description,
        price: r.price,
      });
    }
    return lines;
  }, [animalCount, crateOptionsForOrigin, latamRows, pets]);

  const rightPaneBudgetTotal = useMemo(() => {
    let sum = 0;
    for (const line of rightPaneBudgetLines) {
      const v = parseBudgetAmount(line.price);
      if (v !== null) sum += v;
    }
    return sum;
  }, [rightPaneBudgetLines]);

  const detectedCrateCountryKey = useMemo(
    () => resolveCrateCountryKey(origin),
    [origin],
  );

  useEffect(() => {
    setPets((prev) =>
      prev.map((p) => {
        if (!p.hasCrate) return p;
        const allowed = filterCrateOptionsForPet(crateOptionsForOrigin, p.tipo);
        const validIds = new Set(allowed.map((c) => c.id));
        let crateId = p.crateId;
        let costo = p.costo;
        if (crateId && !validIds.has(crateId)) {
          crateId = "";
          costo = "";
        }
        if (p.tipo === "gato" && !crateId) {
          const def = defaultCrateIdForCat(crateOptionsForOrigin);
          if (def) {
            crateId = def;
            costo = defaultCostoFromCrateSelection(
              crateTariffsData,
              origin,
              def,
            );
          }
        }
        if (crateId === p.crateId && costo === p.costo) return p;
        return { ...p, crateId, costo };
      }),
    );
  }, [crateOptionsForOrigin, crateTariffsData, origin]);

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
        ...Array.from({ length: n - prev.length }, () => emptyPet()),
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
      if (Object.prototype.hasOwnProperty.call(patch, "tipo")) {
        const allowed = filterCrateOptionsForPet(
          crateOptionsForOrigin,
          merged.tipo,
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
      if (p.tipo === "gato" && !crateId) {
        const def = defaultCrateIdForCat(crateOptionsForOrigin);
        if (def) {
          crateId = def;
          costo = defaultCostoFromCrateSelection(
            crateTariffsData,
            origin,
            def,
          );
        }
      }
      next[index] = { ...p, hasCrate: true, crateId, costo };
      return next;
    });
  }

  function removeCrateFromPet(index: number): void {
    setPets((prev) => {
      const next = [...prev];
      const p = next[index];
      if (!p || !p.hasCrate) return prev;
      next[index] = { ...p, hasCrate: false, crateId: "", costo: "" };
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

      {[
        suggestError,
        quotesError,
        crateTariffsError,
        impoTemplatesError,
      ].filter(Boolean).length > 0 ? (
        <p className="mt-4 text-sm text-red-600">
          {[suggestError, quotesError, crateTariffsError, impoTemplatesError]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <section
          className={`w-full shrink-0 ${pdfPreviewOpen ? "lg:w-1/2 lg:max-w-[50%]" : "lg:max-w-none"}`}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >

            <div>
              <label htmlFor="dc02-customer" className={labelClass}>
                Nombre del cliente
              </label>
              <input
                id="dc02-customer"
                type="text"
                autoComplete="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={inputClass}
                placeholder="Cliente"
              />
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
                  placeholder="Ej. EZE (mín. 2 caracteres para sugerencias)"
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
                              setDestination("");
                              void searchQuotes(s.value, "");
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
                  Destino (opcional)
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
                  placeholder="Ej. MIA — sugerencias de todos los destinos en la base"
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
                </select>
              </div>
            </div>
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
                    Arrival date
                  </label>
                  <input
                    id="dc02-arrival"
                    type="date"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
             
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-zinc-700">
                  Mascotas
                </p>
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
                {latamJaulasHint ? (
                  <p
                    role="note"
                    className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-950"
                  >
                    <span className="font-semibold">Jaulas</span>
                    <span className="text-amber-800">
                      {" "}
                      ({latamJaulasHint.label}):{" "}
                    </span>
                    {latamJaulasHint.jaulas}
                  </p>
                ) : null}
                {latamPreEntregaHint && pets.some((p) => p.hasCrate) ? (() => {
                  const preKey = "pre_entrega_de_la_jaula";
                  const alreadyAdded = latamRows.some(
                    (r) => r.source === "json" && r.fieldKey === preKey,
                  );
                  return (
                    <div className="mt-2 rounded-md border border-zinc-300 bg-white p-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-zinc-900">
                            2. Pre-entrega de la jaula
                          </p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600">
                            {latamPreEntregaHint.note}
                            <span className="ml-1 text-zinc-400">
                              · ({latamPreEntregaHint.label})
                            </span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addPreEntregaJaulaItem()}
                          disabled={alreadyAdded}
                          className="shrink-0 rounded border border-emerald-600/70 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Añadir Pre-entrega de la jaula al presupuesto"
                        >
                          {alreadyAdded ? "Ya agregado" : "Añadir ítem"}
                        </button>
                      </div>
                    </div>
                  );
                })() : null}
              </div>
              {pets.map((pet, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-zinc-300 p-3"
                >
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
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
                      <input
                        id={`dc02-pet-${i}-raza`}
                        type="text"
                        autoComplete="off"
                        value={pet.raza}
                        onChange={(e) => updatePet(i, { raza: e.target.value })}
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
                        value={pet.nombre}
                        onChange={(e) =>
                          updatePet(i, { nombre: e.target.value })
                        }
                        className={inputClass}
                        placeholder="Nombre"
                      />
                    </div>
                    {pet.hasCrate ? (
                      <>
                        <div>
                          <div className="mb-0.5 flex items-center justify-between gap-2">
                            <label
                              htmlFor={`dc02-pet-${i}-crate`}
                              className="block text-xs font-medium text-zinc-600"
                            >
                              Crate
                            </label>
                            <button
                              type="button"
                              onClick={() => removeCrateFromPet(i)}
                              className="group/remove-crate -my-0.5 inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                              title="Quitar crate"
                              aria-label={`Quitar crate cotizado de mascota ${i + 1}`}
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
                                quitar
                              </span>
                            </button>
                          </div>
                          {(() => {
                            const optsForPet = filterCrateOptionsForPet(
                              crateOptionsForOrigin,
                              pet.tipo,
                            );
                            return (
                              <select
                                id={`dc02-pet-${i}-crate`}
                                value={pet.crateId}
                                onChange={(e) => {
                                  const id = e.target.value;
                                  const costo =
                                    id === ""
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
                                className={inputClass}
                              >
                                <option value="">
                                  {crateSelectPlaceholder}
                                </option>
                                {optsForPet.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {formatCrateOptionLabel(c)}
                                  </option>
                                ))}
                              </select>
                            );
                          })()}
                        </div>
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
                      </>
                    ) : (
                      <div className="col-span-2 sm:col-span-1 lg:col-span-2">
                        <span
                          className={fieldLabelClass}
                          aria-hidden="true"
                        >
                          &nbsp;
                        </span>
                        <button
                          type="button"
                          onClick={() => addCrateToPet(i)}
                          className={`${inputClass} cursor-pointer border-emerald-600/70 bg-emerald-50 font-medium text-emerald-900 hover:bg-emerald-100`}
                          aria-label={`Agregar crate cotizado a mascota ${i + 1}`}
                        >
                          + Agregar crate
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
                className="w-full rounded-md border border-zinc-300 bg-zinc-50 py-[2px] text-center text-[12px] font-medium leading-tight text-zinc-800 transition hover:bg-zinc-100"
                aria-expanded={similarQuotesTableOpen}
                aria-controls="dc02-similar-quotes-table"
              >
                {`Ver cotizaciones similares (${
                  loadingQuotes ? "…" : quotes.length
                })`}
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
                            <tr className="border-b border-zinc-400 even:bg-zinc-100">
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
                              <td className="max-w-[140px] px-3 py-2 text-xs text-zinc-600">
                                {q.quotation_date_raw ?? "—"}
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
              className="rounded-lg border border-sky-300 bg-sky-50/70 p-3"
              aria-label="Templates IMPO por destino"
            >
              <button
                type="button"
                id="dc02-impo-guide-toggle"
                className="flex w-full items-start justify-between gap-2 rounded-md py-1 text-left transition hover:bg-sky-100/60"
                onClick={() => setImpoGuidePanelOpen((o) => !o)}
                aria-expanded={impoGuidePanelOpen}
                aria-controls="dc02-impo-guide-body"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-sky-900">
                    IMPO — mercado de importación (destino)
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                    Templates y líneas según el destino elegido (mismo criterio
                    que antes en este bloque).
                  </span>
                </span>
                <span
                  className="mt-0.5 inline-block shrink-0 text-[10px] leading-none text-zinc-500 transition-transform duration-150"
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
              {impoTemplatesLoading ? (
                <p className="mt-2 text-xs text-zinc-500">Buscando templates…</p>
              ) : null}
              {!impoTemplatesLoading &&
              destination.trim().length >= 2 &&
              impoTemplates.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Ningún template IMPO coincide con este destino.
                </p>
              ) : null}
              {impoTemplates.length > 0 ? (
                <ul className="mt-3 space-y-3">
                  {impoTemplates.map((tpl) => {
                    const hasPendingImpoLine = tpl.quoted_items.some(
                      (it, idx) => {
                        if (!it.label.trim()) return false;
                        const fk = `impo_${tpl.title}_${it.item_number ?? "u"}_${idx}`;
                        return !latamRows.some(
                          (r) => r.source === "impo" && r.fieldKey === fk,
                        );
                      },
                    );
                    return (
                    <li
                      key={tpl.file_name}
                      className="rounded-md border border-zinc-300 bg-white p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-zinc-900">
                            {tpl.title}
                          </p>
                          <p className="font-mono text-[11px] text-zinc-500">
                            {tpl.file_name}
                            {tpl.animal_count != null
                              ? ` · ${tpl.animal_count} pet(s)`
                              : ""}
                            {tpl.location ? ` · ${tpl.location}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addImpoTemplateItems(tpl)}
                          disabled={
                            tpl.quoted_items.length === 0 || !hasPendingImpoLine
                          }
                          className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                        >
                          Agregar todos
                        </button>
                      </div>
                      {tpl.quoted_items.length > 0 ? (
                        <ul className="mt-2 space-y-3 border-t border-zinc-300 pt-2 text-xs">
                          {tpl.quoted_items.map((it, qIdx) => {
                            const cust = impoCustomerTextForQuotedItem(it, tpl);
                            const impoFk = `impo_${tpl.title}_${it.item_number ?? "u"}_${qIdx}`;
                            const impoLineInBudget = latamRows.some(
                              (r) => r.source === "impo" && r.fieldKey === impoFk,
                            );
                            return (
                            <li
                              key={`${tpl.file_name}-${it.item_number ?? "n"}-${qIdx}`}
                              className="text-zinc-700"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap gap-x-2">
                                    <span className="font-mono text-zinc-400">
                                      {it.item_number != null
                                        ? `${it.item_number}.`
                                        : "—"}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      {it.label}
                                    </span>
                                    {it.amount != null ? (
                                      <span className="shrink-0 tabular-nums">
                                        {it.amount}
                                      </span>
                                    ) : null}
                                  </div>
                                  {cust.trim() !== "" ? (
                                    <p className="mt-1 whitespace-pre-wrap text-[10px] leading-snug text-zinc-500 sm:pl-6">
                                      {cust}
                                    </p>
                                  ) : null}
                                  {it.note?.trim() ? (
                                    <p className="mt-0.5 font-mono text-[10px] text-amber-700/90 sm:pl-6">
                                      Nota interna: {it.note}
                                    </p>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    addImpoTemplateItem(tpl, qIdx)
                                  }
                                  disabled={!it.label.trim() || impoLineInBudget}
                                  className="shrink-0 rounded border border-emerald-600/70 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                                  aria-label={`Añadir al presupuesto: ${it.label.trim() || "ítem"}`}
                                >
                                  {impoLineInBudget ? "Ya agregado" : "Añadir ítem"}
                                </button>
                              </div>
                            </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-2 text-[11px] text-zinc-500">
                          Sin líneas en{" "}
                          <code className="rounded bg-zinc-100 px-0.5">
                            quoted_items
                          </code>{" "}
                          (revisá descripciones u otro sheet en el fuente).
                        </p>
                      )}
                    </li>
                    );
                  })}
                </ul>
              ) : null}
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
                className="flex w-full items-start justify-between gap-2 rounded-md py-1 text-left transition hover:bg-violet-100/60"
                onClick={() => setExpoGuidePanelOpen((o) => !o)}
                aria-expanded={expoGuidePanelOpen}
                aria-controls="dc02-expo-guide-body"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-violet-900">
                    EXPO — guía de ítems por origen (JSON LATAM)
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                    Misma referencia que en el select &quot;Elegí qué
                    agregar&quot;: clave, título y nota interna completa.
                  </span>
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
              ) : expoLoading ? (
                <p className="mt-2 text-xs text-zinc-400">Cargando…</p>
              ) : !latamProfitFields ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Este origen no coincide con ningún país en la guía EXPO.
                </p>
              ) : latamProfitFields.fields.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">
                  No hay ítems (además de jaulas) para este país en el JSON.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-xs text-zinc-600">
                    País / referencia:{" "}
                    <span className="font-medium text-zinc-800">
                      {latamProfitFields.label}
                    </span>{" "}
                    <span className="font-mono text-[10px] text-zinc-400">
                      ({latamProfitFields.countryKey})
                    </span>
                  </p>
                  {(() => {
                    const usedJsonKeys = new Set(
                      latamRows
                        .filter((r) => r.source === "json")
                        .map((r) => r.fieldKey),
                    );
                    const canAddAnyJson = latamProfitFields.fields.some(
                      (f) => !usedJsonKeys.has(f.key),
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
                            Todos los ítems de la guía ya están en el presupuesto.
                          </span>
                        ) : null}
                      </div>
                    );
                  })()}
                  <ul className="mt-3 space-y-3">
                    {latamProfitFields.fields.map((f) => {
                      const jsonAlreadyAdded = latamRows.some(
                        (r) => r.source === "json" && r.fieldKey === f.key,
                      );
                      return (
                      <li
                        key={f.key}
                        className="rounded-md border border-zinc-300 bg-white p-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-zinc-900">
                              {latamJsonFieldTitle(f.key)}
                            </p>
                            <p className="font-mono text-[10px] text-zinc-500">
                              {f.key}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-zinc-700">
                              {f.clarification}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addLatamJsonRow(f.key)}
                            disabled={jsonAlreadyAdded}
                            className="shrink-0 rounded border border-emerald-600/70 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Añadir ${latamJsonFieldTitle(f.key)} al presupuesto`}
                          >
                            {jsonAlreadyAdded ? "Ya agregado" : "Añadir ítem"}
                          </button>
                        </div>
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
                <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950">
                  <span className="font-medium">Sin origen</span> no aparecen
                  los campos del JSON por país. Podés sumar{" "}
                  <span className="font-medium">líneas personalizadas</span> en
                  “Agregar al presupuesto”. Si elegís origen, se ofrecen ítems
                  desde la guía EXPO por país.
                </p>
              ) : null}
              {origin.trim() && !expoLoading && !latamProfitFields ? (
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
                  {latamRows.map((row, rowIdx) => {
                      const isDragging = dragRowIndex === rowIdx;
                      const activeOnThisRow =
                        dragRowIndex !== null &&
                        dragOverRowIndex === rowIdx &&
                        dragOverPosition !== null;
                      const wouldBeNoop =
                        dragRowIndex !== null &&
                        ((dragOverPosition === "before" &&
                          (rowIdx === dragRowIndex ||
                            rowIdx === dragRowIndex + 1)) ||
                          (dragOverPosition === "after" &&
                            (rowIdx === dragRowIndex ||
                              rowIdx === dragRowIndex - 1)));
                      const showMarkerTop =
                        activeOnThisRow &&
                        dragOverPosition === "before" &&
                        !wouldBeNoop;
                      const showMarkerBottom =
                        activeOnThisRow &&
                        dragOverPosition === "after" &&
                        !wouldBeNoop;
                      return (
                      <div
                        key={row.id}
                        role="listitem"
                        onDragOver={(e) => {
                          if (dragRowIndex === null) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          const rect =
                            e.currentTarget.getBoundingClientRect();
                          const pos: "before" | "after" =
                            e.clientY < rect.top + rect.height / 2
                              ? "before"
                              : "after";
                          if (dragOverRowIndex !== rowIdx) {
                            setDragOverRowIndex(rowIdx);
                          }
                          if (dragOverPosition !== pos) {
                            setDragOverPosition(pos);
                          }
                        }}
                        onDragLeave={(e) => {
                          if (
                            e.currentTarget.contains(
                              e.relatedTarget as Node | null,
                            )
                          ) {
                            return;
                          }
                          if (dragOverRowIndex === rowIdx) {
                            setDragOverRowIndex(null);
                            setDragOverPosition(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (
                            dragRowIndex === null ||
                            dragOverPosition === null
                          ) {
                            return;
                          }
                          const from = dragRowIndex;
                          const to =
                            dragOverPosition === "after"
                              ? rowIdx + 1
                              : rowIdx;
                          moveLatamRow(from, to);
                          setDragRowIndex(null);
                          setDragOverRowIndex(null);
                          setDragOverPosition(null);
                        }}
                        className={`relative flex items-start gap-3 rounded-lg border p-3 shadow-sm ring-1 transition ${latamRowThemeClasses(
                          row.source,
                        )}${isDragging ? " opacity-40" : ""}`}
                      >
                        {showMarkerTop ? (
                          <span
                            className="pointer-events-none absolute left-1 right-1 -top-[5px] z-10 h-[3px] rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.18)]"
                            aria-hidden
                          />
                        ) : null}
                        {showMarkerBottom ? (
                          <span
                            className="pointer-events-none absolute left-1 right-1 -bottom-[5px] z-10 h-[3px] rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.18)]"
                            aria-hidden
                          />
                        ) : null}
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            setDragRowIndex(rowIdx);
                            setDragOverRowIndex(rowIdx);
                            e.dataTransfer.effectAllowed = "move";
                            try {
                              e.dataTransfer.setData("text/plain", row.id);
                            } catch {
                            }
                          }}
                          onDragEnd={() => {
                            setDragRowIndex(null);
                            setDragOverRowIndex(null);
                            setDragOverPosition(null);
                          }}
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
                                  updateLatamRow(row.id, {
                                    title: e.target.value,
                                  })
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
                                    price: e.target.value,
                                  })
                                }
                                className={`${inputClass} tabular-nums`}
                                placeholder="—"
                              />
                            </div>
                          </div>
                          {row.source === "json" ||
                          row.source === "impo" ||
                          row.source === "similar" ? (
                            <p className="font-mono text-[10px] text-zinc-400">
                              {row.source === "impo"
                                ? "IMPO · "
                                : row.source === "similar"
                                  ? "Similar · "
                                  : "Clave JSON: "}
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
                              value={row.description}
                              onChange={(e) =>
                                updateLatamRow(row.id, {
                                  description: e.target.value,
                                })
                              }
                              minHeightPx={52}
                              className={`${inputClass} font-sans`}
                              placeholder="Texto para el ítem / cotización"
                            />
                          </div>
                          <div>
                            <p className={fieldLabelClass}>Nota interna</p>
                            <p className="text-[11px] leading-relaxed text-zinc-500">
                              {row.internalNote.trim() !== ""
                                ? row.internalNote
                                : "—"}
                            </p>
                            <p className="mt-1 text-[10px] text-zinc-400">
                              Referencia del JSON / operativa; solo lectura.
                            </p>
                          </div>
                        </div>
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
                      </div>
                      );
                    })}
                </div>
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
                    <div className="min-w-0 flex-1 space-y-1">
                      <label
                        htmlFor="dc02-latam-add-select"
                        className={fieldLabelClass}
                      >
                        Elegí qué agregar
                      </label>
                      <select
                        id="dc02-latam-add-select"
                        key={`latam-add-${latamRows.map((r) => r.id).join("-")}-cf${latamCustomFormOpen ? "1" : "0"}`}
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
                        aria-label="Agregar campo de referencia"
                      >
                        <option value="">Elegí campo…</option>
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
                      <p className="text-[11px] text-emerald-900/55">
                        Resumen de la nota interna; el tooltip muestra el texto
                        completo.
                      </p>
                    </div>
                  </div>

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
                        </div>
                      </div>
                    </div>
                  ) : null}
                  </div>
                </section>
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
            className="h-fit w-full rounded-[20px] border border-zinc-300 bg-white py-[10%] px-[7%] shadow-[0_4px_28px_rgba(15,23,42,0.1)]"
          >
            <div className="relative w-full">
              <Image
                src={headerBanner}
                alt="LATAM Pet Transport — Pet relocation across Latin America"
                className="h-auto w-full object-contain object-left"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>

            <div
              className="mt-3 grid w-full grid-cols-1 gap-y-1.5 gap-x-3 rounded-lg px-2.5 py-2 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-3 sm:gap-y-1 sm:gap-x-4"
              style={{ backgroundColor: "#f0f0f0", colorScheme: "light" }}
            >
              <div className="min-w-0 flex flex-col gap-px">
                <span className="text-[9px] font-medium uppercase tracking-wide text-zinc-800">
                  Customer
                </span>
                <div className="flex min-w-0 items-start gap-1.5">
                  <UserFieldIcon className="mt-px h-[14px] w-[14px] shrink-0 text-[#cdb073]" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={pdfFieldTextClass}
                    placeholder="—"
                    autoComplete="off"
                    aria-label="Customer"
                  />
                </div>
              </div>
              <div className="min-w-0 flex flex-col gap-px">
                <span className="text-[9px] font-medium uppercase tracking-wide text-zinc-800">
                  Origin
                </span>
                <div className="flex min-w-0 items-start gap-1.5">
                  <UserFieldIcon className="mt-px h-[14px] w-[14px] shrink-0 text-[#cdb073]" />
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className={pdfFieldTextClass}
                    placeholder="—"
                    autoComplete="off"
                    aria-label="Origin"
                  />
                </div>
              </div>
              <div className="min-w-0 flex flex-col gap-px">
                <span className="text-[9px] font-medium uppercase tracking-wide text-zinc-800">
                  Destination
                </span>
                <div className="flex min-w-0 items-start gap-1.5">
                  <UserFieldIcon className="mt-px h-[14px] w-[14px] shrink-0 text-[#cdb073]" />
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className={pdfFieldTextClass}
                    placeholder="—"
                    autoComplete="off"
                    aria-label="Destination"
                  />
                </div>
              </div>
              <div className="min-w-0 flex flex-col gap-px">
                <span className="text-[9px] font-medium uppercase tracking-wide text-zinc-800">
                  Quotation date
                </span>
                <div className="flex min-w-0 items-start gap-1.5">
                  <UserFieldIcon className="mt-px h-[14px] w-[14px] shrink-0 text-[#cdb073]" />
                  <div className="relative h-5 min-w-0 flex-1 overflow-hidden">
                    <input
                      type="date"
                      value={quotedDate}
                      onChange={(e) => setQuotedDate(e.target.value)}
                      className={`${pdfFieldTextClass} absolute inset-0 h-5 w-full appearance-none ${quotedDate ? "opacity-0" : ""}`}
                      aria-label="Quotation date"
                    />
                    {quotedDate ? (
                      <span className="pointer-events-none absolute inset-0 flex items-center text-[12px] leading-tight text-zinc-950">
                        {formatIsoDateAsSpanishLong(quotedDate)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex flex-col gap-px">
                <span className="text-[9px] font-medium uppercase tracking-wide text-zinc-800">
                  Trip date
                </span>
                <div className="flex min-w-0 items-start gap-1.5">
                  <UserFieldIcon className="mt-px h-[14px] w-[14px] shrink-0 text-[#cdb073]" />
                  <div className="relative h-5 min-w-0 flex-1 overflow-hidden">
                    <input
                      type="date"
                      value={arrivalDate}
                      onChange={(e) => setArrivalDate(e.target.value)}
                      className={`${pdfFieldTextClass} absolute inset-0 h-5 w-full appearance-none ${arrivalDate ? "" : "opacity-0"}`}
                      aria-label="Trip date"
                    />
                    {!arrivalDate ? (
                      <span className="pointer-events-none absolute inset-0 flex items-center text-[12px] leading-tight text-zinc-950">
                        Not confirmed
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex flex-col gap-px">
                <span className="text-[9px] font-medium uppercase tracking-wide text-zinc-800">
                  Pets
                </span>
                <div className="flex min-w-0 items-start gap-1.5">
                  <UserFieldIcon className="mt-px h-[14px] w-[14px] shrink-0 text-[#cdb073]" />
                  <span className="break-words text-[12px] leading-tight text-zinc-950">
                    {formatAnimalsLine(animalCount, pets)}
                  </span>
                </div>
              </div>
            </div>

            <div
              className="mt-3 w-full"
              role="region"
              aria-label="Presupuesto — ítems"
            >
              <div className="w-full">
                {rightPaneBudgetLines.length === 0 ? (
                  <p className="text-[11px] leading-tight text-zinc-600">
                    Sin líneas de presupuesto (referencia LATAM o costo por
                    mascota).
                  </p>
                ) : (
                  rightPaneBudgetLines.map((line) => (
                    <div
                      key={line.id}
                      className="group/pdf-budget-row flex flex-row items-start justify-between gap-1 border-b border-zinc-300 py-1"
                    >
                      <div className="min-w-0 flex-1 pr-1">
                        {line.kind === "latam" ? (
                          <>
                            <input
                              type="text"
                              value={line.title}
                              onChange={(e) =>
                                updateLatamRow(line.rowId, {
                                  title: e.target.value,
                                })
                              }
                              className={`${pdfFieldTextClass} font-medium`}
                              placeholder="—"
                              aria-label={`Título ítem ${line.rowId}`}
                            />
                            <AutoHeightDescriptionTextarea
                              value={line.description}
                              onChange={(e) =>
                                updateLatamRow(line.rowId, {
                                  description: e.target.value,
                                })
                              }
                              minHeightPx={34}
                              className={pdfFieldDescClass}
                              placeholder=" "
                              aria-label={`Descripción ítem ${line.rowId}`}
                            />
                          </>
                        ) : (
                          <>
                            <div className="text-[11px] font-medium leading-tight text-zinc-950">
                              {line.title}
                            </div>
                            {line.description.trim() !== "" ? (
                              <p className="mt-px whitespace-pre-wrap text-[10px] leading-snug text-zinc-700">
                                {line.description}
                              </p>
                            ) : null}
                          </>
                        )}
                      </div>
                      <div className="flex shrink-0 items-start gap-0.5 self-start">
                        <button
                          type="button"
                          onClick={() =>
                            line.kind === "latam"
                              ? removeLatamRow(line.rowId)
                              : removePetAtBudgetIndex(line.petIndex)
                          }
                          className="mt-0.5 shrink-0 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover/pdf-budget-row:opacity-100 group-focus-within/pdf-budget-row:opacity-100"
                          title="Eliminar línea"
                          aria-label={
                            line.kind === "latam"
                              ? `Eliminar del presupuesto: ${line.title}`
                              : `Quitar mascota ${line.petIndex + 1} del presupuesto`
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
                        <div className="flex shrink-0 items-baseline justify-end gap-1">
                          <span
                            className="shrink-0 font-mono text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                            aria-hidden
                          >
                            USD
                          </span>
                          {line.kind === "latam" ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={line.price}
                              onChange={(e) =>
                                updateLatamRow(line.rowId, {
                                  price: e.target.value,
                                })
                              }
                              className={pdfFieldMonoClass}
                              placeholder="—"
                              aria-label={`Precio USD ítem ${line.rowId}`}
                            />
                          ) : (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={line.price}
                              onChange={(e) =>
                                updatePet(line.petIndex, {
                                  costo: e.target.value,
                                })
                              }
                              className={pdfFieldMonoClass}
                              placeholder="—"
                              aria-label={`Costo USD jaula mascota ${line.petIndex + 1}`}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div className="flex flex-row items-baseline justify-between gap-2 pt-1.5">
                  <span className="text-[13px] font-semibold uppercase tracking-wide text-zinc-800">
                    Total
                  </span>
                  <span className="flex shrink-0 items-baseline justify-end gap-1 text-right font-mono text-[13px] font-semibold tabular-nums text-zinc-950">
                    <span
                      className="text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                      aria-hidden
                    >
                      USD
                    </span>
                    {rightPaneBudgetTotal.toLocaleString("en-US", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>

            <hr
              className="my-3 border-0 border-t border-dashed border-zinc-300"
              aria-hidden
            />
            <div
              className="space-y-2.5"
              role="region"
              aria-label="Contract and contact"
            >
              <div>
                <p className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-800">
                  Conditions of contract
                </p>
                <textarea
                  value={disclaimerContract}
                  onChange={(e) => setDisclaimerContract(e.target.value)}
                  rows={5}
                  className={pdfDisclaimerAreaClass}
                  aria-label="Conditions of contract"
                />
              </div>
              <div>
                <p className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-800">
                  Contact
                </p>
                <textarea
                  value={disclaimerContact}
                  onChange={(e) => setDisclaimerContact(e.target.value)}
                  rows={3}
                  className={pdfDisclaimerAreaClass}
                  aria-label="Contact"
                />
              </div>
            </div>
          </div>
        </section>
        ) : null}
      </div>
    </main>
  );
}
