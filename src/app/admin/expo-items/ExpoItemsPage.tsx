"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "@/services/api";

const API = getApiBaseUrl().replace(/\/$/, "");

// ─── types ────────────────────────────────────────────────────────────────────

type ExpoOrigin = { country: string; label: string; notes: string[]; sort_order: number };
type ExpoItem   = { id: string; country: string; item_key: string; note: string; description_en: string | null; description_es: string | null; sort_order: number };

// ─── shared ui ────────────────────────────────────────────────────────────────

const COUNTRY_LABELS: Record<string, string> = {
  argentina: "Argentina", brasil: "Brasil", chile: "Chile",
  colombia: "Colombia", costa_rica: "Costa Rica", ecuador: "Ecuador", mexico: "México",
};
function countryLabel(key: string) {
  return COUNTRY_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const inputCls = "w-full border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white";
const thCls    = "px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap";
const tdCls    = "px-3 py-2.5 text-sm text-gray-800 align-top";

function IconEdit()  { return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.742 1.982a.5.5 0 0 0 .638.638l1.982-.742a2.75 2.75 0 0 0 .892-.597l4.262-4.261a1.75 1.75 0 0 0 0-2.475Z" /><path d="M4.75 3.5A2.25 2.25 0 0 0 2.5 5.75v5.5A2.25 2.25 0 0 0 4.75 13.5h5.5a2.25 2.25 0 0 0 2.25-2.25V9a.75.75 0 0 0-1.5 0v2.25a.75.75 0 0 1-.75.75h-5.5a.75.75 0 0 1-.75-.75v-5.5a.75.75 0 0 1 .75-.75H7a.75.75 0 0 0 0-1.5H4.75Z" /></svg>; }
function IconTrash() { return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l-.275-5.5A.75.75 0 0 1 9.95 6Z" /></svg>; }
function IconCheck() { return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg>; }
function IconX()     { return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" /></svg>; }
function IconPlus()  { return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" /></svg>; }

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg mb-4">
      <span>{message}</span>
      <button onClick={onDismiss} className="text-red-400 hover:text-red-600 shrink-0"><IconX /></button>
    </div>
  );
}

// ─── item draft types ─────────────────────────────────────────────────────────

type ItemDraft = { item_key: string; note: string; description_en: string; description_es: string; sort_order: string };
const emptyDraft = (country = ""): ItemDraft & { country: string } =>
  ({ country, item_key: "", note: "", description_en: "", description_es: "", sort_order: "0" });

// ─── main component ───────────────────────────────────────────────────────────

export function ExpoItemsPage() {
  const [origins, setOrigins]           = useState<ExpoOrigin[]>([]);
  const [items, setItems]               = useState<ExpoItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [activeCountry, setActiveCountry] = useState<string>("");

  // item editing
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [draft, setDraft]               = useState<ItemDraft & { country: string }>(emptyDraft());
  const [saving, setSaving]             = useState(false);
  const firstInputRef                   = useRef<HTMLInputElement>(null);

  // origin label editing
  const [editingOrigin, setEditingOrigin] = useState<string | null>(null);
  const [originDraft, setOriginDraft]     = useState({ label: "", notes: "" });
  const [savingOrigin, setSavingOrigin]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [oRes, iRes] = await Promise.all([
        fetch(`${API}/admin/expo-origins`),
        fetch(`${API}/admin/expo-items`),
      ]);
      if (!oRes.ok || !iRes.ok) throw new Error("Error al cargar");
      const oData = (await oRes.json()) as { origins: ExpoOrigin[] };
      const iData = (await iRes.json()) as { items: ExpoItem[] };
      setOrigins(oData.origins);
      setItems(iData.items);
      if (oData.origins.length > 0 && !activeCountry) {
        setActiveCountry(oData.origins[0].country);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (editingId) setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [editingId]);

  const filteredItems = items.filter((i) => i.country === activeCountry);
  const activeOrigin  = origins.find((o) => o.country === activeCountry);

  // ── item handlers ──────────────────────────────────────────────────────────

  function startEdit(item: ExpoItem) {
    setEditingId(item.id);
    setDraft({ country: item.country, item_key: item.item_key, note: item.note, description_en: item.description_en ?? "", description_es: item.description_es ?? "", sort_order: String(item.sort_order) });
  }
  function startNew() {
    setEditingId("__new__");
    setDraft(emptyDraft(activeCountry));
  }
  function cancelEdit() { setEditingId(null); setDraft(emptyDraft()); }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const isNew = editingId === "__new__";
      const url   = isNew ? `${API}/admin/expo-items` : `${API}/admin/expo-items/${editingId}`;
      const description_en = draft.description_en.trim() || null;
      const description_es = draft.description_es.trim() || null;
      const body  = isNew
        ? { country: draft.country, item_key: draft.item_key, note: draft.note, description_en, description_es, sort_order: parseInt(draft.sort_order, 10) || 0 }
        : { note: draft.note, description_en, description_es, sort_order: parseInt(draft.sort_order, 10) || 0 };
      const res = await fetch(url, { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const e = (await res.json()) as { error: unknown }; throw new Error(typeof e.error === "string" ? e.error : "Error"); }
      const data = (await res.json()) as { item: ExpoItem };
      setItems((prev) => isNew ? [...prev, data.item] : prev.map((i) => (i.id === editingId ? data.item : i)));
      setEditingId(null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error al guardar"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar este ítem?")) return;
    setError(null);
    try {
      await fetch(`${API}/admin/expo-items/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error al eliminar"); }
  }

  // ── origin label handlers ──────────────────────────────────────────────────

  function startEditOrigin(o: ExpoOrigin) {
    setEditingOrigin(o.country);
    setOriginDraft({ label: o.label, notes: o.notes.join("\n") });
  }
  function cancelEditOrigin() { setEditingOrigin(null); }

  async function handleSaveOrigin() {
    if (!editingOrigin) return;
    setSavingOrigin(true); setError(null);
    try {
      const notes = originDraft.notes.split("\n").map((s) => s.trim()).filter(Boolean);
      const res = await fetch(`${API}/admin/expo-origins/${encodeURIComponent(editingOrigin)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: originDraft.label, notes, sort_order: activeOrigin?.sort_order ?? 0 }),
      });
      if (!res.ok) throw new Error("Error al guardar país");
      const data = (await res.json()) as { origin: ExpoOrigin };
      setOrigins((prev) => prev.map((o) => (o.country === editingOrigin ? data.origin : o)));
      setEditingOrigin(null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error al guardar"); }
    finally { setSavingOrigin(false); }
  }

  const displayItems = [...filteredItems];
  if (editingId === "__new__") displayItems.push({ id: "__new__", country: activeCountry, item_key: "", note: "", description_en: null, description_es: null, sort_order: 0 });

  return (
    <div className="px-8 py-8 max-w-screen-xl">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-gray-900">Guía EXPO — Ítems por Origen</h1>
        <p className="text-sm text-gray-500 mt-1">
          Costos de exportación por país de origen. Usado en la sección EXPO del cotizador.
        </p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">Cargando…</div>
      ) : (
        <>
          {/* Country tabs */}
          <div className="flex flex-wrap gap-1.5 mb-6">
            {origins.map((o) => (
              <button
                key={o.country}
                onClick={() => { setActiveCountry(o.country); setEditingId(null); }}
                className={[
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  activeCountry === o.country
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900",
                ].join(" ")}
              >
                {countryLabel(o.country)}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${activeCountry === o.country ? "bg-slate-700 text-slate-200" : "bg-gray-100 text-gray-500"}`}>
                  {items.filter((i) => i.country === o.country).length}
                </span>
              </button>
            ))}
          </div>

          {/* Origin metadata */}
          {activeOrigin && (
            <div className="mb-5 bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
              {editingOrigin === activeOrigin.country ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-gray-500 w-16 shrink-0">Label</label>
                    <input className={inputCls} value={originDraft.label} onChange={(e) => setOriginDraft((d) => ({ ...d, label: e.target.value }))} />
                  </div>
                  <div className="flex items-start gap-3">
                    <label className="text-xs font-medium text-gray-500 w-16 shrink-0 pt-1">Notas</label>
                    <textarea
                      rows={3}
                      className={`${inputCls} resize-y`}
                      placeholder="Una nota por línea"
                      value={originDraft.notes}
                      onChange={(e) => setOriginDraft((d) => ({ ...d, notes: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { void handleSaveOrigin(); }} disabled={savingOrigin}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-xs font-medium transition-colors">
                      <IconCheck /> {savingOrigin ? "…" : "Guardar"}
                    </button>
                    <button onClick={cancelEditOrigin} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-gray-500 hover:bg-gray-100 text-xs font-medium transition-colors">
                      <IconX /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{activeOrigin.label}</span>
                      <span className="text-xs font-mono text-gray-400">({activeOrigin.country})</span>
                    </div>
                    {activeOrigin.notes.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {activeOrigin.notes.map((n, i) => (
                          <li key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-0.5 inline-block mr-1">{n}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button onClick={() => startEditOrigin(activeOrigin)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-slate-700 hover:bg-gray-100 transition-colors shrink-0" title="Editar país">
                    <IconEdit />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Items table */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">Ítems del país seleccionado.</p>
            {editingId === null && (
              <button onClick={startNew}
                className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                <IconPlus /> Agregar ítem
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className={thCls} style={{ width: 56 }}>Orden</th>
                    <th className={thCls} style={{ width: 180 }}>Clave</th>
                    <th className={thCls} style={{ width: "22%" }}>Nota</th>
                    <th className={thCls} style={{ width: "28%" }}>Descripción ES</th>
                    <th className={thCls} style={{ width: "28%" }}>Descripción EN</th>
                    <th className={`${thCls} text-right`}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.length === 0 && (
                    <tr><td colSpan={6} className="py-10 text-center text-sm text-gray-400">Sin ítems. Agregá uno.</td></tr>
                  )}
                  {displayItems.map((item) => {
                    const isEditing = editingId === item.id;
                    if (isEditing) {
                      return (
                        <tr key={item.id} className="bg-blue-50/60 border-b border-blue-100">
                          <td className={tdCls}>
                            <input ref={firstInputRef} className={inputCls} style={{ width: 56 }} type="number"
                              value={draft.sort_order} onChange={(e) => setDraft((d) => ({ ...d, sort_order: e.target.value }))} />
                          </td>
                          <td className={tdCls}>
                            {editingId === "__new__" ? (
                              <input className={inputCls} placeholder="ej. vet_fees"
                                value={draft.item_key} onChange={(e) => setDraft((d) => ({ ...d, item_key: e.target.value }))} />
                            ) : (
                              <span className="font-mono text-xs text-gray-600">{item.item_key}</span>
                            )}
                          </td>
                          <td className={tdCls}>
                            <textarea rows={2} className={`${inputCls} resize-y`}
                              value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
                          </td>
                          <td className={tdCls}>
                            <textarea rows={2} className={`${inputCls} resize-y`} placeholder="Descripción en español (opcional)"
                              value={draft.description_es} onChange={(e) => setDraft((d) => ({ ...d, description_es: e.target.value }))} />
                          </td>
                          <td className={tdCls}>
                            <textarea rows={2} className={`${inputCls} resize-y`} placeholder="Description in English (optional)"
                              value={draft.description_en} onChange={(e) => setDraft((d) => ({ ...d, description_en: e.target.value }))} />
                          </td>
                          <td className={`${tdCls} text-right`}>
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => { void handleSave(); }} disabled={saving}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-xs font-medium transition-colors">
                                <IconCheck /> {saving ? "…" : "Guardar"}
                              </button>
                              <button onClick={cancelEdit}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-gray-500 hover:bg-gray-100 text-xs font-medium transition-colors">
                                <IconX /> Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors group">
                        <td className={tdCls}><span className="text-gray-400 text-xs font-mono">{item.sort_order}</span></td>
                        <td className={tdCls}><span className="font-mono text-xs text-gray-700">{item.item_key}</span></td>
                        <td className={tdCls}><span className="text-gray-700 leading-snug">{item.note}</span></td>
                        <td className={tdCls}><span className="text-gray-500 text-xs leading-snug">{item.description_es ?? <span className="text-gray-300 italic">—</span>}</span></td>
                        <td className={tdCls}><span className="text-gray-500 text-xs leading-snug">{item.description_en ?? <span className="text-gray-300 italic">—</span>}</span></td>
                        <td className={`${tdCls} text-right`}>
                          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(item)} disabled={editingId !== null}
                              className="p-1.5 rounded-md text-gray-400 hover:text-slate-700 hover:bg-gray-100 disabled:cursor-not-allowed transition-colors" title="Editar">
                              <IconEdit />
                            </button>
                            <button onClick={() => { void handleDelete(item.id); }} disabled={editingId !== null}
                              className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:cursor-not-allowed transition-colors" title="Eliminar">
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
          </div>
        </>
      )}
    </div>
  );
}
