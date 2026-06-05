"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ContactSuggestion } from "@/app/api/microsoft/contacts/route";

type Props = {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailTagInput({ values, onChange, placeholder, disabled }: Props) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      // autocomplete es best-effort
    }
  }, []);

  function addEmail(email: string) {
    const trimmed = email.trim().replace(/,+$/, "");
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
  }

  function removeEmail(email: string) {
    onChange(values.filter((v) => v !== email));
  }

  function commitInput() {
    const trimmed = input.trim().replace(/,+$/, "");
    if (trimmed) {
      addEmail(trimmed);
      setInput("");
      setSuggestions([]);
      setOpen(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    // commit on comma
    if (v.endsWith(",")) {
      const candidate = v.slice(0, -1).trim();
      if (candidate) addEmail(candidate);
      setInput("");
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetchSuggestions(v), 250);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        addEmail(suggestions[activeIndex].email);
        setInput("");
        setSuggestions([]);
        setOpen(false);
      } else {
        commitInput();
      }
      return;
    }
    if (e.key === "Backspace" && input === "" && values.length > 0) {
      onChange(values.slice(0, -1));
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function selectSuggestion(contact: ContactSuggestion) {
    addEmail(contact.email);
    setInput("");
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        commitInput();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [input, values]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex min-h-[2.25rem] flex-wrap items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-300"
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((email) => {
          const valid = emailRegex.test(email);
          return (
            <span
              key={email}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                valid
                  ? "bg-blue-100 text-blue-800"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {email}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeEmail(email);
                  }}
                  className="ml-0.5 rounded-sm opacity-60 hover:opacity-100 focus:outline-none"
                  aria-label={`Quitar ${email}`}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={values.length === 0 ? placeholder : undefined}
          disabled={disabled}
          autoComplete="off"
          className="min-w-[160px] flex-1 border-none bg-transparent p-0 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
          {suggestions.map((c, i) => (
            <li
              key={c.email}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(c);
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
