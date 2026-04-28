"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "@/services/api";

const API = getApiBaseUrl().replace(/\/$/, "");

// ─── types ────────────────────────────────────────────────────────────────────

type GlobalTariff = {
  id: string;
  pet_category: string;
  size_code: string;
  measures_cm: string | null;
  weight_note: string | null;
  weight_volume_kg: string | null;
  price_usd: string | null;
  sort_order: number;
};

type CountryTariff = {
  id: string;
  country: string;
  size_code: string;
  pet_scope: string;
  measures_cm: string | null;
  weight_vol_kg: string | null;
  cost_amount: string | null;
  cost_currency: string;
  cost_label: string | null;
  notes: string | null;
  sort_order: number;
};

// ─── shared ui ────────────────────────────────────────────────────────────────

const COUNTRY_LABELS: Record<string, string> = {
  argentina: "Argentina",
  brasil: "Brasil",
  chile: "Chile",
  colombia: "Colombia",
  costa_rica: "Costa Rica",
  ecuador: "Ecuador",
  mexico: "México",
};

function countryLabel(key: string) {
  return COUNTRY_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const inputCls =
  "w-full border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white";

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
function IconCheck() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
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

// ─── GlobalTab ────────────────────────────────────────────────────────────────

type GlobalDraft = {
  pet_category: string;
  size_code: string;
  measures_cm: string;
  weight_note: string;
  weight_volume_kg: string;
  price_usd: string;
  sort_order: string;
};

const emptyGlobal = (): GlobalDraft => ({
  pet_category: "Dog",
  size_code: "",
  measures_cm: "",
  weight_note: "",
  weight_volume_kg: "",
  price_usd: "",
  sort_order: "0",
});

function rowToGlobalDraft(r: GlobalTariff): GlobalDraft {
  return {
    pet_category: r.pet_category,
    size_code: r.size_code,
    measures_cm: r.measures_cm ?? "",
    weight_note: r.weight_note ?? "",
    weight_volume_kg: r.weight_volume_kg ?? "",
    price_usd: r.price_usd ?? "",
    sort_order: String(r.sort_order),
  };
}

function GlobalTab() {
  const [rows, setRows] = useState<GlobalTariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<GlobalDraft>(emptyGlobal());
  const [saving, setSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/admin/crate-quote-tariffs`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = (await res.json()) as { tariffs: GlobalTariff[] };
      setRows(data.tariffs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (editingId !== null) setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [editingId]);

  function startEdit(row: GlobalTariff) {
    setEditingId(row.id);
    setDraft(rowToGlobalDraft(row));
  }

  function startNew() {
    setEditingId("__new__");
    setDraft(emptyGlobal());
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyGlobal());
  }

  function setField(key: keyof GlobalDraft, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function buildBody(d: GlobalDraft) {
    return {
      pet_category: d.pet_category,
      size_code: d.size_code,
      measures_cm: d.measures_cm || null,
      weight_note: d.weight_note || null,
      weight_volume_kg: d.weight_volume_kg ? parseFloat(d.weight_volume_kg) : null,
      price_usd: d.price_usd ? parseFloat(d.price_usd) : null,
      sort_order: parseInt(d.sort_order, 10) || 0,
    };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const isNew = editingId === "__new__";
      const url = isNew
        ? `${API}/admin/crate-quote-tariffs`
        : `${API}/admin/crate-quote-tariffs/${editingId}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(draft)),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: unknown };
        throw new Error(typeof err.error === "string" ? err.error : "Error al guardar");
      }
      const data = (await res.json()) as { tariff: GlobalTariff };
      setRows((prev) =>
        isNew
          ? [...prev, data.tariff]
          : prev.map((r) => (r.id === editingId ? data.tariff : r)),
      );
      setEditingId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar esta tarifa?")) return;
    setError(null);
    try {
      const res = await fetch(`${API}/admin/crate-quote-tariffs/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`Error ${res.status}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  const displayRows = [...rows];
  if (editingId === "__new__") displayRows.push({ id: "__new__" } as GlobalTariff);

  return (
    <div>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Tarifas base de jaulas — sin distinción de país.
        </p>
        {editingId === null && (
          <button
            onClick={startNew}
            className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <IconPlus /> Agregar
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Cargando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={thCls}>Orden</th>
                  <th className={thCls}>Categoría</th>
                  <th className={thCls}>Código</th>
                  <th className={thCls}>Medidas (cm)</th>
                  <th className={thCls}>Nota peso</th>
                  <th className={thCls}>Kg vol.</th>
                  <th className={thCls}>Precio USD</th>
                  <th className={`${thCls} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-sm text-gray-400">
                      Sin registros. Agregá uno.
                    </td>
                  </tr>
                )}
                {displayRows.map((row) => {
                  const isEditing = editingId === row.id;
                  if (isEditing) {
                    return (
                      <tr key={row.id} className="bg-blue-50/60 border-b border-blue-100">
                        <td className={tdCls}>
                          <input ref={firstInputRef} className={inputCls} style={{ width: 64 }}
                            value={draft.sort_order} onChange={(e) => setField("sort_order", e.target.value)} />
                        </td>
                        <td className={tdCls}>
                          <input className={inputCls} style={{ width: 110 }}
                            value={draft.pet_category} onChange={(e) => setField("pet_category", e.target.value)} />
                        </td>
                        <td className={tdCls}>
                          <input className={inputCls} style={{ width: 90 }}
                            value={draft.size_code} onChange={(e) => setField("size_code", e.target.value)} />
                        </td>
                        <td className={tdCls}>
                          <input className={inputCls} style={{ width: 150 }}
                            placeholder="p.ej. 80 x 60 x 55"
                            value={draft.measures_cm} onChange={(e) => setField("measures_cm", e.target.value)} />
                        </td>
                        <td className={tdCls}>
                          <input className={inputCls} style={{ width: 120 }}
                            placeholder="p.ej. 35–45 kgs"
                            value={draft.weight_note} onChange={(e) => setField("weight_note", e.target.value)} />
                        </td>
                        <td className={tdCls}>
                          <input className={inputCls} style={{ width: 80 }} type="number"
                            value={draft.weight_volume_kg} onChange={(e) => setField("weight_volume_kg", e.target.value)} />
                        </td>
                        <td className={tdCls}>
                          <input className={inputCls} style={{ width: 90 }} type="number"
                            value={draft.price_usd} onChange={(e) => setField("price_usd", e.target.value)} />
                        </td>
                        <td className={`${tdCls} text-right`}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { void handleSave(); }}
                              disabled={saving}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-xs font-medium transition-colors"
                            >
                              <IconCheck /> {saving ? "…" : "Guardar"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-gray-500 hover:bg-gray-100 text-xs font-medium transition-colors"
                            >
                              <IconX /> Cancelar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors group">
                      <td className={tdCls}>
                        <span className="text-gray-400 text-xs font-mono">{row.sort_order}</span>
                      </td>
                      <td className={tdCls}>
                        <PetBadge value={row.pet_category} />
                      </td>
                      <td className={`${tdCls} font-medium font-mono`}>{row.size_code}</td>
                      <td className={tdCls}>{row.measures_cm ?? <Dash />}</td>
                      <td className={tdCls}>{row.weight_note ?? <Dash />}</td>
                      <td className={tdCls}>{row.weight_volume_kg ?? <Dash />}</td>
                      <td className={tdCls}>
                        {row.price_usd != null ? (
                          <span className="font-medium text-slate-900">
                            USD {parseFloat(row.price_usd).toLocaleString()}
                          </span>
                        ) : <Dash />}
                      </td>
                      <td className={`${tdCls} text-right`}>
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(row)}
                            disabled={editingId !== null}
                            className="p-1.5 rounded-md text-gray-400 hover:text-slate-700 hover:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                            title="Editar"
                          >
                            <IconEdit />
                          </button>
                          <button
                            onClick={() => { void handleDelete(row.id); }}
                            disabled={editingId !== null}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:cursor-not-allowed transition-colors"
                            title="Eliminar"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CountryTab ───────────────────────────────────────────────────────────────

type CountryDraft = {
  id: string;
  country: string;
  size_code: string;
  pet_scope: string;
  measures_cm: string;
  weight_vol_kg: string;
  cost_amount: string;
  cost_currency: string;
  cost_label: string;
  notes: string;
  sort_order: string;
};

function emptyCountry(country = ""): CountryDraft {
  return {
    id: "",
    country,
    size_code: "",
    pet_scope: "Dog",
    measures_cm: "",
    weight_vol_kg: "",
    cost_amount: "",
    cost_currency: "USD",
    cost_label: "",
    notes: "",
    sort_order: "0",
  };
}

function rowToCountryDraft(r: CountryTariff): CountryDraft {
  return {
    id: r.id,
    country: r.country,
    size_code: r.size_code,
    pet_scope: r.pet_scope,
    measures_cm: r.measures_cm ?? "",
    weight_vol_kg: r.weight_vol_kg ?? "",
    cost_amount: r.cost_amount ?? "",
    cost_currency: r.cost_currency,
    cost_label: r.cost_label ?? "",
    notes: r.notes ?? "",
    sort_order: String(r.sort_order),
  };
}

function CountryTab() {
  const [rows, setRows] = useState<CountryTariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CountryDraft>(emptyCountry());
  const [saving, setSaving] = useState(false);
  const [activeCountry, setActiveCountry] = useState<string>("all");
  const firstInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/admin/crate-tariffs-by-country`);
      if (!res.ok) {
        if (res.status === 503 || res.status === 500) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? `Error ${res.status}`);
        }
        throw new Error(`Error ${res.status}`);
      }
      const data = (await res.json()) as { tariffs: CountryTariff[] };
      setRows(data.tariffs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (editingId !== null) setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [editingId]);

  const countries = [...new Set(rows.map((r) => r.country))].sort();

  const filtered =
    activeCountry === "all" ? rows : rows.filter((r) => r.country === activeCountry);

  function startEdit(row: CountryTariff) {
    setEditingId(row.id);
    setDraft(rowToCountryDraft(row));
  }

  function startNew() {
    setEditingId("__new__");
    setDraft(emptyCountry(activeCountry === "all" ? "" : activeCountry));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyCountry());
  }

  function setField(key: keyof CountryDraft, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function buildBody(d: CountryDraft) {
    return {
      ...(editingId === "__new__" ? { id: d.id } : {}),
      country: d.country,
      size_code: d.size_code,
      pet_scope: d.pet_scope,
      measures_cm: d.measures_cm || null,
      weight_vol_kg: d.weight_vol_kg || null,
      cost_amount: d.cost_amount ? parseFloat(d.cost_amount) : null,
      cost_currency: d.cost_currency || "USD",
      cost_label: d.cost_label || null,
      notes: d.notes || null,
      sort_order: parseInt(d.sort_order, 10) || 0,
    };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const isNew = editingId === "__new__";
      const url = isNew
        ? `${API}/admin/crate-tariffs-by-country`
        : `${API}/admin/crate-tariffs-by-country/${editingId}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(draft)),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: unknown };
        throw new Error(typeof err.error === "string" ? err.error : "Error al guardar");
      }
      const data = (await res.json()) as { tariff: CountryTariff };
      setRows((prev) =>
        isNew
          ? [...prev, data.tariff]
          : prev.map((r) => (r.id === editingId ? data.tariff : r)),
      );
      setEditingId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar esta tarifa?")) return;
    setError(null);
    try {
      const res = await fetch(`${API}/admin/crate-tariffs-by-country/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`Error ${res.status}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  const displayRows = [...filtered];
  if (editingId === "__new__") displayRows.push({ id: "__new__", country: draft.country } as CountryTariff);

  return (
    <div>
      {error && (
        <ErrorBanner
          message={
            error.includes("does not exist")
              ? "La tabla crate_tariffs_by_country no existe todavía. Aplicá la migración 012 y corré db:import:crate-tariffs-by-country."
              : error
          }
          onDismiss={() => setError(null)}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Tarifas por país de destino — migradas desde{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">crate_tariffs_by_country.json</code>.
        </p>
        {editingId === null && (
          <button
            onClick={startNew}
            className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <IconPlus /> Agregar
          </button>
        )}
      </div>

      {/* Country tabs */}
      {!loading && countries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <CountryChip
            label="Todos"
            active={activeCountry === "all"}
            count={rows.length}
            onClick={() => setActiveCountry("all")}
          />
          {countries.map((c) => (
            <CountryChip
              key={c}
              label={countryLabel(c)}
              active={activeCountry === c}
              count={rows.filter((r) => r.country === c).length}
              onClick={() => setActiveCountry(c)}
            />
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Cargando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className={thCls}>País</th>
                  <th className={thCls}>Código</th>
                  <th className={thCls}>Animal</th>
                  <th className={thCls}>Medidas (cm)</th>
                  <th className={thCls}>Peso/Vol kg</th>
                  <th className={thCls}>Costo USD</th>
                  <th className={thCls}>Etiqueta</th>
                  <th className={thCls}>Notas</th>
                  <th className={`${thCls} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-sm text-gray-400">
                      Sin registros. Agregá uno.
                    </td>
                  </tr>
                )}
                {displayRows.map((row) => {
                  const isEditing = editingId === row.id;
                  if (isEditing) {
                    return (
                      <tr key={row.id} className="bg-blue-50/60 border-b border-blue-100">
                        <td className={tdCls}>
                          <div className="space-y-1">
                            <input ref={firstInputRef} className={inputCls} style={{ width: 110 }}
                              placeholder="país (key)" value={draft.country}
                              onChange={(e) => setField("country", e.target.value)} />
                            {editingId === "__new__" && (
                              <input className={inputCls} style={{ width: 110 }}
                                placeholder="id (p.ej. ar-800)" value={draft.id}
                                onChange={(e) => setField("id", e.target.value)} />
                            )}
                          </div>
                        </td>
                        <td className={tdCls}>
                          <input className={inputCls} style={{ width: 90 }}
                            value={draft.size_code} onChange={(e) => setField("size_code", e.target.value)} />
                        </td>
                        <td className={tdCls}>
                          <input className={inputCls} style={{ width: 100 }}
                            value={draft.pet_scope} onChange={(e) => setField("pet_scope", e.target.value)} />
                        </td>
                        <td className={tdCls}>
                          <input className={inputCls} style={{ width: 140 }}
                            placeholder="p.ej. 80 x 60 x 55"
                            value={draft.measures_cm} onChange={(e) => setField("measures_cm", e.target.value)} />
                        </td>
                        <td className={tdCls}>
                          <input className={inputCls} style={{ width: 80 }}
                            value={draft.weight_vol_kg} onChange={(e) => setField("weight_vol_kg", e.target.value)} />
                        </td>
                        <td className={tdCls}>
                          <input className={inputCls} style={{ width: 80 }} type="number"
                            value={draft.cost_amount} onChange={(e) => setField("cost_amount", e.target.value)} />
                        </td>
                        <td className={tdCls}>
                          <input className={inputCls} style={{ width: 120 }}
                            value={draft.cost_label} onChange={(e) => setField("cost_label", e.target.value)} />
                        </td>
                        <td className={tdCls}>
                          <input className={inputCls} style={{ width: 160 }}
                            value={draft.notes} onChange={(e) => setField("notes", e.target.value)} />
                        </td>
                        <td className={`${tdCls} text-right`}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { void handleSave(); }}
                              disabled={saving}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-xs font-medium transition-colors"
                            >
                              <IconCheck /> {saving ? "…" : "Guardar"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-gray-500 hover:bg-gray-100 text-xs font-medium transition-colors"
                            >
                              <IconX /> Cancelar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors group">
                      <td className={tdCls}>
                        <span className="font-medium">{countryLabel(row.country)}</span>
                      </td>
                      <td className={`${tdCls} font-medium font-mono`}>{row.size_code}</td>
                      <td className={tdCls}><PetBadge value={row.pet_scope} /></td>
                      <td className={tdCls}>{row.measures_cm ?? <Dash />}</td>
                      <td className={tdCls}>{row.weight_vol_kg ?? <Dash />}</td>
                      <td className={tdCls}>
                        {row.cost_amount != null ? (
                          <span className="font-medium text-slate-900">
                            USD {parseFloat(row.cost_amount).toLocaleString()}
                          </span>
                        ) : row.cost_label ? (
                          <span className="text-amber-600 text-xs">{row.cost_label}</span>
                        ) : <Dash />}
                      </td>
                      <td className={tdCls}>
                        {row.cost_label ? (
                          <span className="text-xs text-gray-500">{row.cost_label}</span>
                        ) : <Dash />}
                      </td>
                      <td className={tdCls}>
                        {row.notes ? (
                          <span className="text-xs text-gray-500">{row.notes}</span>
                        ) : <Dash />}
                      </td>
                      <td className={`${tdCls} text-right`}>
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(row)}
                            disabled={editingId !== null}
                            className="p-1.5 rounded-md text-gray-400 hover:text-slate-700 hover:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                            title="Editar"
                          >
                            <IconEdit />
                          </button>
                          <button
                            onClick={() => { void handleDelete(row.id); }}
                            disabled={editingId !== null}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:cursor-not-allowed transition-colors"
                            title="Eliminar"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── small ui helpers ─────────────────────────────────────────────────────────

function Dash() {
  return <span className="text-gray-300">—</span>;
}

function PetBadge({ value }: { value: string }) {
  const lower = value.toLowerCase();
  let cls = "bg-gray-100 text-gray-600";
  if (lower.includes("cat") || lower.includes("gato")) cls = "bg-emerald-50 text-emerald-700";
  else if (lower.includes("dog") && lower.includes("cat")) cls = "bg-purple-50 text-purple-700";
  else if (lower.includes("dog") || lower.includes("perro")) cls = "bg-blue-50 text-blue-700";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {value}
    </span>
  );
}

function CountryChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
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

// ─── main page ────────────────────────────────────────────────────────────────

type Tab = "global" | "country";

export function CrateTariffsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("global");

  const tabs: { id: Tab; label: string }[] = [
    { id: "global", label: "Tarifas Globales" },
    { id: "country", label: "Tarifas por País" },
  ];

  return (
    <div className="px-8 py-8 max-w-screen-xl">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-gray-900">Tarifas de Jaulas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestioná las tarifas globales y por país. Los cambios impactan en la cotización.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "global" ? <GlobalTab /> : <CountryTab />}
    </div>
  );
}
