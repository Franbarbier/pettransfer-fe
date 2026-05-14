"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBreeds } from "@/hooks/useBreeds";

type Props = {
  id?: string;
  tipo: "" | "perro" | "gato";
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
};

export function BreedCombobox({ id, tipo, value, onChange, className, placeholder }: Props) {
  const { breeds } = useBreeds();
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const suggestions = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    if (q.length < 3) return [];
    return breeds
      .filter((r) => {
        if (tipo && r.type !== tipo) return false;
        return r.name_es.toLowerCase().includes(q) || r.name_en.toLowerCase().includes(q);
      })
      .slice(0, 12);
  }, [inputValue, tipo, breeds]);

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

  function select(name_es: string) {
    setInputValue(name_es);
    onChange(name_es);
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
              key={`${r.type}-${r.name_en}`}
              onMouseDown={(e) => {
                e.preventDefault();
                select(r.name_es);
              }}
              className="cursor-pointer px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100"
            >
              {r.name_es}
              {r.name_es !== r.name_en && (
                <span className="ml-1.5 text-xs text-zinc-400">{r.name_en}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
