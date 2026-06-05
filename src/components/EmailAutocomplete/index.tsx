"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ContactSuggestion } from "@/app/api/microsoft/contacts/route";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
};

export function EmailAutocomplete({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  autoFocus,
  id,
}: Props) {
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/microsoft/contacts?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { contacts?: ContactSuggestion[] };
      const list = data.contacts ?? [];
      setSuggestions(list);
      setOpen(list.length > 0);
      setActiveIndex(-1);
    } catch {
      // silently ignore — autocomplete is best-effort
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetchSuggestions(v), 250);
  }

  function select(contact: ContactSuggestion) {
    onChange(contact.email);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      select(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="email"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
          {suggestions.map((c, i) => (
            <li
              key={c.email}
              onMouseDown={(e) => {
                e.preventDefault();
                select(c);
              }}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === activeIndex ? "bg-blue-50 text-blue-900" : "text-zinc-800 hover:bg-zinc-50"
              }`}
            >
              <span className="font-medium">{c.displayName}</span>
              {c.displayName !== c.email && (
                <span className="ml-1.5 text-zinc-400">{c.email}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
