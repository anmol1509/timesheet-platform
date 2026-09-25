"use client";

import { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useFormReset } from "@/lib/useFormReset";
import { cn } from "@/lib/cn";

/**
 * Emirate / city picker for the chosen country. It searches a worldwide city list as you
 * type (see /api/geo/cities), so the choices are always the ones in that country, and
 * changing the country clears the city. Anything not in the list can still be entered
 * with "Use “…”", so nothing is ever blocked.
 */
export function CitySelect({ name, country, value: controlled, defaultValue, onChange, placeholder = "Select emirate / city…", disabled }: { name?: string; country?: string | null; value?: string; defaultValue?: string; onChange?: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  const effectiveCountry = country || "United Arab Emirates";
  const [initialCountry] = useState(effectiveCountry);
  const [inner, setInner] = useState(defaultValue ?? "");
  const [prevCountry, setPrevCountry] = useState(effectiveCountry);
  // A city belongs to one country: changing the country clears it (adjusting state during render, the supported pattern).
  if (prevCountry !== effectiveCountry) {
    setPrevCountry(effectiveCountry);
    if (controlled === undefined) setInner("");
    else onChange?.("");
  }
  const value = controlled ?? inner;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLButtonElement>(null);
  useFormReset(rootRef, () => setInner(effectiveCountry === initialCountry ? (defaultValue ?? "") : ""));

  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/geo/cities?country=${encodeURIComponent(effectiveCountry)}&q=${encodeURIComponent(query)}`, { signal: ctl.signal });
        const j = (await r.json()) as { cities: string[] };
        setResults(j.cities);
      } catch {
        /* aborted or offline: keep what is shown, the typed value can still be used */
      }
      setLoading(false);
    }, query ? 150 : 0);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [open, query, effectiveCountry]);

  function choose(v: string) {
    setInner(v);
    onChange?.(v);
    setOpen(false);
    setQuery("");
  }
  const typed = query.trim();
  const canUseTyped = typed !== "" && !results.some((c) => c.toLowerCase() === typed.toLowerCase());

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={value} />}
      <Popover.Trigger asChild disabled={disabled}>
        <button ref={rootRef} type="button" disabled={disabled} className="input flex w-full items-center justify-between gap-2 text-left data-[state=open]:border-[var(--brand-primary)]">
          <span className={cn("truncate", !value && "text-subtle")}>{value || placeholder}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-subtle" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} className="rx-popover z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-control border border-default bg-surface shadow-popover">
          {/* Filtering is done by the server, so cmdk's own filter is switched off. */}
          <Command shouldFilter={false} loop>
            <CommandInput autoFocus value={query} onValueChange={setQuery} placeholder={`Search cities in ${effectiveCountry}…`} className="w-full border-b border-default px-3 py-2 text-sm text-primary outline-none placeholder:text-subtle" />
            <CommandList className="max-h-64 overflow-y-auto p-1">
              {loading && results.length === 0 && (
                <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Loading…</div>
              )}
              {!loading && results.length === 0 && !canUseTyped && <CommandEmpty className="px-3 py-6 text-center text-sm text-muted">No city list for this country — type the city and press Enter.</CommandEmpty>}
              <CommandGroup>
                {results.map((c) => (
                  <CommandItem key={c} value={c} onMouseDown={(e) => e.preventDefault()} onSelect={() => choose(c)} className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm text-secondary outline-none data-[selected=true]:bg-surface-hover data-[selected=true]:text-primary">
                    <span className="flex-1 truncate">{c}</span>
                    {c === value && <Check className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />}
                  </CommandItem>
                ))}
                {canUseTyped && (
                  <CommandItem value={`__use__${typed}`} onMouseDown={(e) => e.preventDefault()} onSelect={() => choose(typed)} className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm text-secondary outline-none data-[selected=true]:bg-surface-hover data-[selected=true]:text-primary">
                    Use “{typed}”
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
