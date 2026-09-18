"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";

/** A picker option: `value` is what gets stored, `label` is what users see. */
export interface EgOption {
  value: string;
  label: string;
}

/** Fixed options for Q12a — short Yes/No/NA// list. */
export const Q12A_OPTIONS: readonly EgOption[] = ["Yes", "No", "NA", "/"].map(
  (v) => ({ value: v, label: v }),
);

/**
 * Fixed options for Q12f_RReject, per the EG form's rejection-reason list.
 * Each option is stored verbatim as its full label.
 */
export const Q12F_RREJECT_OPTIONS: readonly EgOption[] = [
  "1 - not belonging to innovative and technology products",
  "2 - non-intact system comprising an assortment of self-selected components and lacking system integrity",
  "3 - items with safety issue",
  "4 - items with insufficient proof of efficacy",
  "5 - items beyond the scope of the I&T Fund",
  "6 - health monitoring gadgets not connected to monitoring/record system for further systematic and consistent analysis",
  "7 - standalone items",
  "8 - excessive collection of personal data",
  "Others",
  "NA",
].map((v) => ({ value: v, label: v }));

/**
 * Short direction and worked-example count for each Q12f_RReject reason, from
 * ZRReject_prompt.xlsx. Display only — it drives the hint beside the "Context
 * for AI" box so the reviewer can see what will steer the generation before
 * they run it. The example texts themselves never reach the browser: they live
 * in the Python service (`python-service/extractors/reject_reasons.py`), which
 * is their source of truth. Keep these keys in step with that module.
 */
export const Q12F_REASON_HINTS: Readonly<
  Record<string, { direction: string; examples: number }>
> = {
  "1": { direction: "Not innovative", examples: 6 },
  "2": { direction: "Lacking system integrity", examples: 3 },
  "3": { direction: "Safety concern", examples: 3 },
  "4": { direction: "Insufficient of proof", examples: 6 },
  "5": { direction: "Beyond scope", examples: 3 },
  "6": { direction: "Not connected to system", examples: 5 },
  "7": { direction: "Standalone item", examples: 4 },
  "8": { direction: "Excessive collection of personal data", examples: 1 },
};

/**
 * Resolve a Q12f_RReject value to its hint. Matches on the leading digit, the
 * same way the Python catalogue does, so a reworded option label on either
 * side cannot silently break the lookup. Returns null for "Others", "NA",
 * blanks and anything unlisted — the generator then falls back to its default
 * rejected shape.
 */
export function rejectReasonHint(
  value: string | undefined | null,
): { key: string; direction: string; examples: number } | null {
  if (!value) return null;
  const key = normalizeNaLike(value).trim().split(" ")[0].replace(/[.-]+$/, "");
  const hint = Q12F_REASON_HINTS[key];
  return hint ? { key, ...hint } : null;
}

/**
 * Legacy stringy-nulls (e.g. Python `float('nan')` serialised as "nan") show
 * up in dataset metadata for some old rows. Normalise them to "NA" for
 * display and editing so users see a real option rather than a broken value.
 */
export function normalizeNaLike(value: any): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.toLowerCase() === "nan") return "NA";
  return s;
}

interface OptionComboboxProps {
  value: string;
  options: readonly EgOption[];
  onChange: (next: string) => void;
  placeholder?: string;
  /** Placeholder for the free-text input inside the popover. */
  freeTextPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Combobox-style picker over a fixed option list that also accepts free
 * text. The trigger button shows the matching option's label, or the raw
 * value verbatim for legacy/custom data. Inside the popover the user can
 * either pick a canned option or type any custom string.
 */
function OptionCombobox({
  value,
  options,
  onChange,
  placeholder,
  freeTextPlaceholder,
  className,
  disabled,
}: OptionComboboxProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const normalized = normalizeNaLike(value);
  const selectedOption = options.find((opt) => opt.value === normalized);
  const isCustom = normalized.length > 0 && !selectedOption;
  // Filter here rather than in cmdk: cmdk re-sorts items by match score while
  // searching and never restores the original order once the search clears.
  const needle = query.trim().toLowerCase();
  const visibleOptions = needle
    ? options.filter((opt) => opt.label.toLowerCase().includes(needle))
    : options;

  return (
    <Popover
      // These pickers live inside Dialogs, whose scroll lock swallows wheel /
      // trackpad events on the portaled popover. A modal popover takes over
      // the lock, so its own list scrolls.
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraft(isCustom ? normalized : "");
          setQuery("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-8 text-xs font-normal px-2",
            !normalized && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate text-left">
            {selectedOption?.label || normalized || placeholder || "Select…"}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search options…"
            value={query}
            onValueChange={setQuery}
          />
          {/* Always-visible scrollbar (macOS hides overlay scrollbars) so it's
              clear the list continues past the fold. */}
          <CommandList className="[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:bg-transparent">
            <CommandEmpty>No matching option.</CommandEmpty>
            <CommandGroup>
              {visibleOptions.map((opt) => {
                const isSelected = normalized === opt.value;
                return (
                  <CommandItem
                    key={opt.value}
                    // Search matches against the label, which includes the value.
                    value={opt.label}
                    onSelect={() => {
                      // Only propagate when the value actually changes —
                      // otherwise callers flip a dirty flag for nothing.
                      if (opt.value !== normalized) onChange(opt.value);
                      setOpen(false);
                    }}
                    className="text-xs items-start"
                  >
                    <Check
                      className={cn(
                        "mr-2 mt-0.5 h-3 w-3 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1">{opt.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <CommandSeparator />
          <div className="p-2 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Or type a custom value
            </div>
            <div className="flex gap-1.5">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={freeTextPlaceholder || "Custom value…"}
                className="h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draft.trim()) {
                    e.preventDefault();
                    onChange(draft);
                    setOpen(false);
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs shrink-0"
                disabled={!draft.trim() || draft === normalized}
                onClick={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
            {isCustom ? (
              <div className="text-[10px] text-muted-foreground">
                Current value is custom text — not in the option list.
              </div>
            ) : null}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface Q12SelectProps {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}

/**
 * Q12a picker — Yes / No / NA / /. Legacy long-form reason values are
 * preserved verbatim and remain editable via free text.
 */
export function Q12aSelect({ value, onChange, className }: Q12SelectProps) {
  return (
    <OptionCombobox
      value={value}
      options={Q12A_OPTIONS}
      onChange={onChange}
      placeholder="Select reason…"
      freeTextPlaceholder="e.g. Yes, No, /, or free text"
      className={className}
    />
  );
}

/**
 * Q12f_RReject picker — rejection reasons 1–8, Others, NA (stored as the
 * full label text), plus free text for legacy long-form rejection
 * justifications.
 */
export function Q12fRejectSelect({
  value,
  onChange,
  className,
}: Q12SelectProps) {
  return (
    <OptionCombobox
      value={value}
      options={Q12F_RREJECT_OPTIONS}
      onChange={onChange}
      placeholder="Select…"
      freeTextPlaceholder="Or type custom text"
      className={className}
    />
  );
}
