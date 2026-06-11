"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiBaseUrl } from "@/services/api";

const API = getApiBaseUrl().replace(/\/$/, "");

// ─── types ────────────────────────────────────────────────────────────────────

type Item = {
  id: string;
  uuid: string;
  operation_type: string | null;
  airport: string | null;
  country: string | null;
  item_en: string;
  item_es: string;
  price_ref: string | null;
  price_1: string | null;
  price_2: string | null;
  price_3: string | null;
  price_4: string | null;
  description_en: string | null;
  description_es: string | null;
  notes: string | null;
};

type Draft = {
  operation_type: "" | "EXPO" | "IMPO" | "TRANSITO";
  airport: string;
  country: string;
  item_en: string;
  item_es: string;
  price_ref: string;
  price_1: string;
  price_2: string;
  price_3: string;
  price_4: string;
  description_en: string;
  description_es: string;
  notes: string;
};

const emptyDraft = (): Draft => ({
  operation_type: "",
  airport: "",
  country: "",
  item_en: "",
  item_es: "",
  price_ref: "",
  price_1: "",
  price_2: "",
  price_3: "",
  price_4: "",
  description_en: "",
  description_es: "",
  notes: "",
});

function itemToDraft(it: Item): Draft {
  const op = it.operation_type ?? "";
  return {
    operation_type:
      op === "EXPO" || op === "IMPO" || op === "TRANSITO" ? op : "",
    airport: it.airport ?? "",
    country: it.country ?? "",
    item_en: it.item_en ?? "",
    item_es: it.item_es ?? "",
    price_ref: it.price_ref ?? "",
    price_1: it.price_1 ?? "",
    price_2: it.price_2 ?? "",
    price_3: it.price_3 ?? "",
    price_4: it.price_4 ?? "",
    description_en: it.description_en ?? "",
    description_es: it.description_es ?? "",
    notes: it.notes ?? "",
  };
}

function draftToBody(d: Draft) {
  const num = (s: string) => (s.trim() === "" ? null : parseFloat(s));
  const txt = (s: string) => (s.trim() === "" ? null : s.trim());
  return {
    operation_type: d.operation_type || null,
    airport: txt(d.airport),
    country: txt(d.country),
    item_en: d.item_en.trim(),
    item_es: d.item_es.trim(),
    price_ref: txt(d.price_ref),
    price_1: num(d.price_1),
    price_2: num(d.price_2),
    price_3: num(d.price_3),
    price_4: num(d.price_4),
    description_en: txt(d.description_en),
    description_es: txt(d.description_es),
    notes: txt(d.notes),
  };
}

// ─── ui helpers ───────────────────────────────────────────────────────────────

const inputCls =
  "w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white";
const labelCls = "block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1";
const thCls = "px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap";
const tdCls = "px-3 py-2.5 text-sm text-gray-800 align-top";

function IconEdit() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.742 1.982a.5.5 0 0 0 .638.638l1.982-.742a2.75 2.75 0 0 0 .892-.597l4.262-4.261a1.75 1.75 0 0 0 0-2.475Z" />
      <path d="M4.75 3.5A2.25 2.25 0 0 0 2.5 5.75v5.5A2.25 2.25 0 0 0 4.75 13.5h5.5a2.25 2.25 0 0 0 2.25-2.25V9a.75.75 0 0 0-1.5 0v2.25a.75.75 0 0 1-.75.75h-5.5a.75.75 0 0 1-.75-.75v-5.5a.75.75 0 0 1 .75-.75H7a.75.75 0 0 0 0-1.5H4.75Z" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l-.275-5.5A.75.75 0 0 1 9.95 6Z" />
    </svg>
  );
}
function IconX() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
    </svg>
  );
}

function Dash() {
  return <span className="text-gray-300">—</span>;
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg mb-4">
      <span>{message}</span>
      <button onClick={onDismiss} className="text-red-400 hover:text-red-600 shrink-0">
        <IconX />
      </button>
    </div>
  );
}

function OpBadge({ value }: { value: string | null }) {
  if (!value) {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
        sin tipo
      </span>
    );
  }
  const cls =
    value === "EXPO"
      ? "bg-blue-50 text-blue-700"
      : value === "IMPO"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-amber-50 text-amber-700";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {value}
    </span>
  );
}

function Chip({
  label, active, count, onClick,
}: { label: string; active: boolean; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors",
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900",
      ].join(" ")}
    >
      {label}
      <span
        className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
          active ? "bg-slate-700 text-slate-200" : "bg-gray-100 text-gray-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// ─── modal ────────────────────────────────────────────────────────────────────

type ModalProps = {
  mode: "create" | "edit";
  initial: Draft;
  saving: boolean;
  onCancel: () => void;
  onSave: (d: Draft) => Promise<void>;
};

function ItemModal({ mode, initial, saving, onCancel, onSave }: ModalProps) {
  const [draft, setDraft] = useState<Draft>(initial);
  const firstRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    setTimeout(() => firstRef.current?.focus(), 50);
  }, []);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.item_en.trim() && !draft.item_es.trim()) return;
    void onSave(draft);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-3xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {mode === "create" ? "Agregar item" : "Editar item"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-700 p-1 rounded-md hover:bg-gray-100"
          >
            <IconX />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Operación</label>
              <select
                ref={firstRef}
                className={inputCls}
                value={draft.operation_type}
                onChange={(e) => set("operation_type", e.target.value as Draft["operation_type"])}
              >
                <option value="">(sin tipo — huérfano)</option>
                <option value="EXPO">EXPO</option>
                <option value="IMPO">IMPO</option>
                <option value="TRANSITO">TRANSITO</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>País</label>
              <input
                className={inputCls}
                value={draft.country}
                onChange={(e) => set("country", e.target.value)}
                placeholder="Argentina, Brasil, …"
              />
            </div>
            <div>
              <label className={labelCls}>Aeropuerto</label>
              <input
                className={inputCls}
                value={draft.airport}
                onChange={(e) => set("airport", e.target.value)}
                placeholder="EZE, GRU, …"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Item (EN)</label>
              <input
                className={inputCls}
                value={draft.item_en}
                onChange={(e) => set("item_en", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Item (ES)</label>
              <input
                className={inputCls}
                value={draft.item_es}
                onChange={(e) => set("item_es", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Precio referencia (texto libre)</label>
            <input
              className={inputCls}
              value={draft.price_ref}
              onChange={(e) => set("price_ref", e.target.value)}
              placeholder="1 pet: USD 1,880 | 2 pets: USD 2,230 | …"
            />
          </div>

          <div className="grid grid-cols-4 gap-3">
            {(["price_1", "price_2", "price_3", "price_4"] as const).map((k, i) => (
              <div key={k}>
                <label className={labelCls}>USD {i + 1}{i === 3 ? "+" : ""} mascota{i > 0 ? "s" : ""}</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputCls}
                  value={draft[k]}
                  onChange={(e) => set(k, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div>
            <label className={labelCls}>Descripción (EN)</label>
            <textarea
              rows={3}
              className={inputCls}
              value={draft.description_en}
              onChange={(e) => set("description_en", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Descripción (ES)</label>
            <textarea
              rows={3}
              className={inputCls}
              value={draft.description_es}
              onChange={(e) => set("description_es", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Notas</label>
            <textarea
              rows={2}
              className={inputCls}
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || (!draft.item_en.trim() && !draft.item_es.trim())}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Guardando…" : mode === "create" ? "Crear" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

type OpFilter = "all" | "EXPO" | "IMPO" | "TRANSITO" | "none";

export function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opFilter, setOpFilter] = useState<OpFilter>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<
    | { mode: "create"; initial: Draft }
    | { mode: "edit"; id: string; initial: Draft }
    | null
  >(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/admin/items-official`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = (await res.json()) as { items: Item[] };
      setItems(data.items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Filtros derivados.
  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.country) set.add(it.country);
    return [...set].sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (opFilter !== "all") {
        if (opFilter === "none" ? it.operation_type !== null : it.operation_type !== opFilter) {
          return false;
        }
      }
      if (countryFilter !== "all" && it.country !== countryFilter) return false;
      if (q) {
        const hay = `${it.item_en} ${it.item_es} ${it.country ?? ""} ${it.airport ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, opFilter, countryFilter, search]);

  // Conteos por operation_type (sobre la lista ya filtrada por país/search).
  const opCounts = useMemo(() => {
    const base = items.filter((it) => {
      if (countryFilter !== "all" && it.country !== countryFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${it.item_en} ${it.item_es} ${it.country ?? ""} ${it.airport ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return {
      all: base.length,
      EXPO: base.filter((it) => it.operation_type === "EXPO").length,
      IMPO: base.filter((it) => it.operation_type === "IMPO").length,
      TRANSITO: base.filter((it) => it.operation_type === "TRANSITO").length,
      none: base.filter((it) => it.operation_type === null).length,
    };
  }, [items, countryFilter, search]);

  function openCreate() {
    setModal({ mode: "create", initial: emptyDraft() });
  }
  function openEdit(it: Item) {
    setModal({ mode: "edit", id: it.id, initial: itemToDraft(it) });
  }
  function closeModal() {
    if (!saving) setModal(null);
  }

  async function handleSave(d: Draft) {
    if (!modal) return;
    setSaving(true);
    setError(null);
    try {
      const isCreate = modal.mode === "create";
      const url = isCreate
        ? `${API}/admin/items-official`
        : `${API}/admin/items-official/${modal.id}`;
      const res = await fetch(url, {
        method: isCreate ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToBody(d)),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        const msg =
          typeof body.error === "string"
            ? body.error
            : `Error ${res.status} al guardar`;
        throw new Error(msg);
      }
      const data = (await res.json()) as { item: Item };
      setItems((prev) =>
        isCreate
          ? [...prev, data.item]
          : prev.map((it) => (it.id === data.item.id ? data.item : it)),
      );
      setModal(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(it: Item) {
    const label = it.item_en || it.item_es || `#${it.id}`;
    if (!window.confirm(`¿Eliminar "${label}"?`)) return;
    setError(null);
    try {
      const res = await fetch(`${API}/admin/items-official/${it.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`Error ${res.status}`);
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  return (
    <div className="px-8 py-8 max-w-screen-xl">
      {/* Header */}
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Items</h1>
          <p className="text-sm text-gray-500 mt-1">
            Catálogo oficial de ítems por operación, país y aeropuerto.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
        >
          <IconPlus /> Agregar
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Filtros operación */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Chip label="Todos"     active={opFilter === "all"}      count={opCounts.all}      onClick={() => setOpFilter("all")} />
        <Chip label="EXPO"      active={opFilter === "EXPO"}     count={opCounts.EXPO}     onClick={() => setOpFilter("EXPO")} />
        <Chip label="IMPO"      active={opFilter === "IMPO"}     count={opCounts.IMPO}     onClick={() => setOpFilter("IMPO")} />
        <Chip label="TRANSITO"  active={opFilter === "TRANSITO"} count={opCounts.TRANSITO} onClick={() => setOpFilter("TRANSITO")} />
        <Chip label="Sin tipo"  active={opFilter === "none"}     count={opCounts.none}     onClick={() => setOpFilter("none")} />
      </div>

      {/* Filtros país */}
      {countries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Chip
            label="Todos los países"
            active={countryFilter === "all"}
            count={items.length}
            onClick={() => setCountryFilter("all")}
          />
          {countries.map((c) => (
            <Chip
              key={c}
              label={c}
              active={countryFilter === c}
              count={items.filter((it) => it.country === c).length}
              onClick={() => setCountryFilter(c)}
            />
          ))}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          placeholder="Buscar por nombre, país o aeropuerto…"
          className={`${inputCls} max-w-sm`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Cargando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={thCls}>Op.</th>
                  <th className={thCls}>País</th>
                  <th className={thCls}>Aerop.</th>
                  <th className={thCls}>Item (EN)</th>
                  <th className={thCls}>Item (ES)</th>
                  <th className={thCls}>Precio ref.</th>
                  <th className={`${thCls} text-right`}>P1</th>
                  <th className={`${thCls} text-right`}>P2</th>
                  <th className={`${thCls} text-right`}>P3</th>
                  <th className={`${thCls} text-right`}>P4</th>
                  <th className={`${thCls} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-sm text-gray-400">
                      Sin resultados.
                    </td>
                  </tr>
                )}
                {filtered.map((it) => (
                  <tr
                    key={it.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors group"
                  >
                    <td className={tdCls}><OpBadge value={it.operation_type} /></td>
                    <td className={tdCls}>{it.country ?? <Dash />}</td>
                    <td className={`${tdCls} font-mono text-xs`}>{it.airport ?? <Dash />}</td>
                    <td className={`${tdCls} max-w-[220px]`}>
                      <div className="truncate" title={it.item_en}>{it.item_en || <Dash />}</div>
                    </td>
                    <td className={`${tdCls} max-w-[220px]`}>
                      <div className="truncate" title={it.item_es}>{it.item_es || <Dash />}</div>
                    </td>
                    <td className={`${tdCls} max-w-[200px]`}>
                      {it.price_ref ? (
                        <span className="text-xs text-gray-500 line-clamp-2" title={it.price_ref}>
                          {it.price_ref}
                        </span>
                      ) : <Dash />}
                    </td>
                    <td className={`${tdCls} text-right font-mono text-xs`}>{it.price_1 ?? <Dash />}</td>
                    <td className={`${tdCls} text-right font-mono text-xs`}>{it.price_2 ?? <Dash />}</td>
                    <td className={`${tdCls} text-right font-mono text-xs`}>{it.price_3 ?? <Dash />}</td>
                    <td className={`${tdCls} text-right font-mono text-xs`}>{it.price_4 ?? <Dash />}</td>
                    <td className={`${tdCls} text-right`}>
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(it)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
                          title="Editar"
                        >
                          <IconEdit />
                        </button>
                        <button
                          onClick={() => { void handleDelete(it); }}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <ItemModal
          mode={modal.mode}
          initial={modal.initial}
          saving={saving}
          onCancel={closeModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
