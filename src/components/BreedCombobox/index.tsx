"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import razasData from "@/data/razas.json";

type RazaEntry = {
  nombre_es: string;
  nombre_en: string;
  tipo: "perro" | "gato";
};

const razas = razasData as RazaEntry[];

type Props = {
  id?: string;
  tipo: "" | "perro" | "gato";
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
};

export function BreedCombobox({ id, tipo, value, onChange, className, placeholder }: Props) {
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const suggestions = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    if (q.length < 3) return [];
    return razas
      .filter((r) => {
        if (tipo && r.tipo !== tipo) return false;
        return r.nombre_es.toLowerCase().includes(q) || r.nombre_en.toLowerCase().includes(q);
      })
      .slice(0, 12);
  }, [inputValue, tipo]);

  useEffect(() => {
    setOpen(suggestions.length > 0);
  }, [suggestions]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function select(nombre_es: string) {
    setInputValue(nombre_es);
    onChange(nombre_es);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={() => onChange(inputValue)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className={className}
        placeholder={placeholder}
      />
      {open && (
        <ul className="absolute z-50 mt-1 max-h-52 w-full min-w-[180px] overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {suggestions.map((r) => (
            <li
              key={`${r.tipo}-${r.nombre_en}`}
              onMouseDown={(e) => {
                e.preventDefault();
                select(r.nombre_es);
              }}
              className="cursor-pointer px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100"
            >
              {r.nombre_es}
              {r.nombre_es !== r.nombre_en && (
                <span className="ml-1.5 text-xs text-zinc-400">{r.nombre_en}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
