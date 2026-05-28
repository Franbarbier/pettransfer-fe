"use client";

import { Montserrat, Fraunces } from "next/font/google";
import logooriginal from "@/assets/logooriginal.png";
import { useCallback, useLayoutEffect, useRef, useState, type ChangeEventHandler, type ReactElement, type TextareaHTMLAttributes } from "react";

function AutoHeightTextarea({
  className,
  value,
  onChange,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows" | "onChange"> & {
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
}): ReactElement {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => { resize(); }, [value, resize]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value ?? ""}
      onChange={(e) => { onChange(e); requestAnimationFrame(resize); }}
      style={{ overflow: "hidden", resize: "none" }}
      className={className}
      {...rest}
    />
  );
}

const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "500", "700"] });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["400", "500"] });

const inputClass = "bg-transparent border-none outline-none p-0 w-full focus:ring-0";

const ENGLISH_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function formatIsoDateLong(iso: string): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return "";
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  if (!month || month < 1 || month > 12 || !day || day < 1 || day > 31) return "";
  return `${ENGLISH_MONTHS[month - 1]} ${day}, ${year}`;
}

export type QuotePrintData = {
  customerName: string;
  agentName: string;
  origin: string;
  destination: string;
  quotedDate: string;
  travelDate: string;
  petsLine: string;
  budgetLines: { id: string; rowId?: string; title: string; description: string; price: string }[];
  total: number;
  disclaimerContract: string;
  disclaimerContact: string;
  salesman?: { name: string; email: string };
};

export type QuotePrintCallbacks = {
  onCustomerNameChange: (v: string) => void;
  onAgentNameChange: (v: string) => void;
  onOriginChange: (v: string) => void;
  onDestinationChange: (v: string) => void;
  onQuotedDateChange: (v: string) => void;
  onTravelDateChange: (v: string) => void;
  onBudgetLineChange: (rowId: string, patch: { title?: string; description?: string; price?: string }) => void;
  onDisclaimerContractChange: (v: string) => void;
  onRemoveBudgetLine: (rowId: string) => void;
};

function GridField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={`${montserrat.className} text-[9px] text-zinc-500 uppercase tracking-wide mb-0.5`}>
        {label}
      </p>
      {children}
    </div>
  );
}

const PAGE_H = 1123;
const PAGE_PAD = Math.round(PAGE_H * 0.05);

type PageSlice = { srcOffset: number; topPad: number; bottomPad: number; contentH: number };

function computePageSlices(contentHeight: number, breakPoints: number[] = []): PageSlice[] {
  if (contentHeight <= PAGE_H) {
    return [{ srcOffset: 0, topPad: 0, bottomPad: 0, contentH: contentHeight }];
  }
  const sortedBreaks = [...breakPoints].sort((a, b) => a - b);
  const slices: PageSlice[] = [];
  let consumed = 0;
  let isFirst = true;
  while (consumed < contentHeight) {
    const topPad = isFirst ? 0 : PAGE_PAD;
    const remaining = contentHeight - consumed;
    if (remaining <= PAGE_H - topPad) {
      slices.push({ srcOffset: consumed, topPad, bottomPad: 0, contentH: remaining });
      consumed = contentHeight;
    } else {
      const maxCut = consumed + (PAGE_H - topPad - PAGE_PAD);
      // Snap a la break point más alta que esté dentro de (consumed, maxCut]
      let snapped = maxCut;
      for (let k = sortedBreaks.length - 1; k >= 0; k--) {
        if (sortedBreaks[k] > consumed && sortedBreaks[k] <= maxCut) {
          snapped = sortedBreaks[k];
          break;
        }
      }
      const contentH = snapped - consumed;
      slices.push({ srcOffset: consumed, topPad, bottomPad: PAGE_PAD, contentH });
      consumed = snapped;
    }
    isFirst = false;
  }
  return slices;
}

export { PAGE_H, PAGE_PAD, computePageSlices };

function QuotePrintMain({ data, callbacks }: { data: QuotePrintData; callbacks: QuotePrintCallbacks }): ReactElement {
  return (
    <div className="w-[794px] flex flex-col" style={{ backgroundColor: "#f5f5f0" }}>

      <div className="w-full flex justify-center items-center bg-gradient-to-tl from-[#8e8d70] to-[#aeb0a1]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logooriginal.src} alt="Logo" style={{ display: "block" }} />
      </div>

      <div className="w-full pt-[20px] pb-[10%] px-[7%]" style={{ backgroundColor: "#f5f5f0" }}>

        <div data-atomic className="grid grid-cols-2 gap-x-4 gap-y-3">

          <GridField label={data.agentName.trim() ? "Customer - Agent" : "Customer"}>
            <div className={`${fraunces.className} text-[13px] text-zinc-900 leading-snug flex items-center gap-1`}>
              <input
                className={inputClass}
                value={data.customerName}
                onChange={(e) => callbacks.onCustomerNameChange(e.target.value)}
                placeholder="—"
              />
              {data.agentName.trim() && <span className="shrink-0 text-zinc-400">—</span>}
              {data.agentName.trim() && (
                <input
                  className={inputClass}
                  value={data.agentName}
                  onChange={(e) => callbacks.onAgentNameChange(e.target.value)}
                  placeholder="—"
                />
              )}
            </div>
          </GridField>

          <GridField label="Origin">
            <input
              className={`${fraunces.className} text-[13px] text-zinc-900 leading-snug ${inputClass}`}
              value={data.origin}
              onChange={(e) => callbacks.onOriginChange(e.target.value)}
              placeholder="—"
            />
          </GridField>

          <GridField label="Destination">
            <input
              className={`${fraunces.className} text-[13px] text-zinc-900 leading-snug ${inputClass}`}
              value={data.destination}
              onChange={(e) => callbacks.onDestinationChange(e.target.value)}
              placeholder="—"
            />
          </GridField>

          <GridField label="Quotation date">
            <div className="relative">
              <input
                type="date"
                className={`${fraunces.className} text-[13px] text-zinc-900 leading-snug ${inputClass} ${data.quotedDate ? "opacity-0 absolute inset-0" : ""}`}
                value={data.quotedDate}
                onChange={(e) => callbacks.onQuotedDateChange(e.target.value)}
              />
              {data.quotedDate && (
                <span className={`${fraunces.className} text-[13px] text-zinc-900 leading-snug pointer-events-none`}>
                  {formatIsoDateLong(data.quotedDate)}
                </span>
              )}
            </div>
          </GridField>

          <GridField label="Trip date">
            <div className="relative">
              <input
                type="date"
                className={`${fraunces.className} text-[13px] text-zinc-900 leading-snug ${inputClass} ${!data.travelDate ? "opacity-0 absolute inset-0" : ""}`}
                value={data.travelDate}
                onChange={(e) => callbacks.onTravelDateChange(e.target.value)}
              />
              {!data.travelDate && (
                <span className={`${fraunces.className} text-[13px] text-zinc-900 leading-snug`}>
                  Not confirmed
                </span>
              )}
            </div>
          </GridField>

          <GridField label="Pets">
            <p className={`${fraunces.className} text-[13px] text-zinc-900 leading-snug`}>
              {data.petsLine || "—"}
            </p>
          </GridField>

        </div>

        <div data-atomic className="flex justify-between items-center border-t-2 border-b-2 border-zinc-400 py-[10px] mt-6">
          <span className={`${fraunces.className} text-[9px] font-medium uppercase tracking-wide text-zinc-700`}>
            Items - Description
          </span>
          <span className={`${fraunces.className} text-[9px] font-medium uppercase tracking-wide text-zinc-700`}>
            Amount
          </span>
        </div>

        <div className="border-b-2 border-zinc-400">
          {data.budgetLines.map((line) => (
            <div key={line.id} data-atomic className="group/row flex">
              <div className="w-[80%] border-r-2 border-zinc-400 py-2 pr-5">
                <div className="flex items-center gap-1">
                  {line.rowId ? (
                    <input
                      className={`${fraunces.className} text-[13px] text-zinc-900 leading-snug ${inputClass} font-medium`}
                      value={line.title}
                      onChange={(e) => callbacks.onBudgetLineChange(line.rowId!, { title: e.target.value })}
                      placeholder="—"
                    />
                  ) : (
                    <p className={`${fraunces.className} text-[13px] text-zinc-900 leading-snug font-medium flex-1`}>
                      {line.title || "—"}
                    </p>
                  )}
                  {line.rowId && (
                    <button
                      type="button"
                      onClick={() => callbacks.onRemoveBudgetLine(line.rowId!)}
                      className="shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity rounded p-0.5 text-zinc-400 hover:text-red-500 hover:bg-red-50"
                      title="Eliminar ítem"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
                        <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
                      </svg>
                    </button>
                  )}
                </div>
                {line.rowId ? (
                  <AutoHeightTextarea
                    className={`${montserrat.className} text-[10px] text-zinc-500 leading-snug mt-0.5 ${inputClass}`}
                    value={line.description}
                    onChange={(e) => callbacks.onBudgetLineChange(line.rowId!, { description: e.target.value })}
                    placeholder=" "
                  />
                ) : (
                  <p className={`${montserrat.className} text-[10px] text-zinc-500 leading-snug mt-0.5`}>
                    {line.description}
                  </p>
                )}
              </div>
              <div className="w-[20%] flex items-center justify-end py-2 pl-5">
                {line.rowId ? (
                  <div className={`${montserrat.className} text-[11px] text-zinc-500 flex items-center gap-0.5`}>
                    {line.price.trim() !== "" && line.price.trim() !== "0" && <span>USD</span>}
                    <input
                      className={`${inputClass} text-right w-[60px]`}
                      value={line.price}
                      onChange={(e) => callbacks.onBudgetLineChange(line.rowId!, { price: e.target.value })}
                      placeholder="—"
                      inputMode="decimal"
                    />
                  </div>
                ) : (
                  <span className={`${montserrat.className} text-[11px] text-zinc-500`}>
                    {line.price.trim() === "" || line.price.trim() === "0" ? "" : `USD ${line.price}`}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div data-atomic className="flex justify-end items-center gap-4 pt-[20px]">
          <span className={`${montserrat.className} text-[14px] font-bold text-zinc-900 uppercase tracking-wide`}>
            Total
          </span>
          <div className="w-[20%] flex justify-end">
            <span className={`${montserrat.className} text-[14px] font-bold text-zinc-900`}>
              USD {data.total.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}

function QuotePrintTail({ data, callbacks }: { data: QuotePrintData; callbacks: QuotePrintCallbacks }): ReactElement {
  return (
    <div className="w-[794px] flex flex-col" style={{ backgroundColor: "#f5f5f0" }}>
      <div className="w-full px-[7%] pb-4" style={{ backgroundColor: "#f5f5f0" }}>
        <p className={`${montserrat.className} text-[9px] text-zinc-600 uppercase tracking-wide mb-1`}>
          Conditions of contract
        </p>
        <AutoHeightTextarea
          className={`${montserrat.className} text-[9px] text-zinc-700 leading-snug ${inputClass}`}
          value={data.disclaimerContract}
          onChange={(e) => callbacks.onDisclaimerContractChange(e.target.value)}
        />
      </div>

      <div className="w-full flex items-center justify-between bg-gradient-to-tl from-[#00cd00] to-[#ffffff] px-[7%] h-[40px]">
        <span className={`${montserrat.className} text-[9px] font-bold uppercase tracking-widest text-zinc-900`}>
          LATAM Pet Transport
        </span>
        {data.disclaimerContact && (
          <span className={`${montserrat.className} text-[9px] text-zinc-900`}>
            {data.disclaimerContact}
          </span>
        )}
      </div>
    </div>
  );
}

export function QuotePrintLayout({ data, callbacks }: { data: QuotePrintData; callbacks: QuotePrintCallbacks }) {
  const mainRef = useRef<HTMLDivElement>(null);
  const [mainHeight, setMainHeight] = useState<number | null>(null);
  const [breakPoints, setBreakPoints] = useState<number[]>([]);

  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    setMainHeight(el.scrollHeight);
    const rootTop = el.getBoundingClientRect().top;
    const points: number[] = [];
    el.querySelectorAll<HTMLElement>("[data-atomic]").forEach((r) => {
      points.push(r.getBoundingClientRect().top - rootTop);
    });
    setBreakPoints(points);
  }, [data]);

  const slices = mainHeight ? computePageSlices(mainHeight, breakPoints) : [{ srcOffset: 0, topPad: 0, bottomPad: 0, contentH: PAGE_H }];

  return (
    <div className="flex flex-col">
      {/* Fuente oculta off-screen: Main (paginable) + Tail (fijo al fondo). PDF gen captura ambos. */}
      <div
        className="pointer-events-none"
        style={{ position: "fixed", left: -99999, top: 0 }}
        aria-hidden
      >
        <div ref={mainRef} data-pdf-main>
          <QuotePrintMain data={data} callbacks={callbacks} />
        </div>
        <div data-pdf-tail>
          <QuotePrintTail data={data} callbacks={callbacks} />
        </div>
      </div>

      {/* Ventanas paginadas. Body (Main) con padding normal; Tail absoluto al fondo de la última */}
      {slices.map((slice, i) => {
        const isLast = i === slices.length - 1;
        return (
          <div key={i}>
            <div
              className="relative w-[794px] overflow-hidden"
              style={{ height: PAGE_H, backgroundColor: "#f5f5f0" }}
            >
              <div
                style={{
                  height: slice.contentH,
                  overflow: "hidden",
                  marginTop: slice.topPad,
                }}
              >
                <div style={{ marginTop: -slice.srcOffset }}>
                  <QuotePrintMain data={data} callbacks={callbacks} />
                </div>
              </div>
              {isLast && (
                <div className="absolute left-0 right-0 bottom-0">
                  <QuotePrintTail data={data} callbacks={callbacks} />
                </div>
              )}
            </div>
            {!isLast && (
              <div data-page-break className="w-[794px] flex items-center justify-center bg-zinc-200 px-4 py-1 gap-2">
                <div className="flex-1 border-t border-dashed border-zinc-400" />
                <span className="shrink-0 text-[9px] font-medium text-zinc-400">
                  Página {i + 2}
                </span>
                <div className="flex-1 border-t border-dashed border-zinc-400" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
