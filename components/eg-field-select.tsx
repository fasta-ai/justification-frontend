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

/**
 * Fixed options for Q12f_RReject. Also used for Q12a per user request -
 * both fields now share the same short Yes/No/NA// list.
 */
export const Q12F_RREJECT_OPTIONS: readonly string[] = ["Yes", "No", "NA", "/"];

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
  options: readonly string[];
  onChange: (next: string) => void;
  placeholder?: string;
  /** Placeholder for the free-text input inside the popover. */
  freeTextPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Combobox-style picker over a fixed option list that also accepts free
 * text. The trigger button always shows the current raw value (preserving
 * legacy data verbatim). Inside the popover the user can either pick a
 * canned option or type any custom string.
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
  const normalized = normalizeNaLike(value);
  const isKnown = options.includes(normalized);
  const isCustom = normalized.length > 0 && !isKnown;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(isCustom ? normalized : "");
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
            {normalized || placeholder || "Select…"}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search options…" />
          <CommandList>
            <CommandEmpty>No matching option.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = normalized === opt;
                return (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => {
                      // Only propagate when the value actually changes —
                      // otherwise callers flip a dirty flag for nothing.
                      if (opt !== normalized) onChange(opt);
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
                    <span className="flex-1">{opt}</span>
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
 * Q12a picker — now uses the same Yes / No / NA / / list as Q12f per user
 * request. Legacy long-form reason values are preserved verbatim and remain
 * editable via free text.
 */
export function Q12aSelect({ value, onChange, className }: Q12SelectProps) {
  return (
    <OptionCombobox
      value={value}
      options={Q12F_RREJECT_OPTIONS}
      onChange={onChange}
      placeholder="Select reason…"
      freeTextPlaceholder="e.g. Yes, No, /, or free text"
      className={className}
    />
  );
}

/**
 * Q12f_RReject picker — Yes / No / NA / /, plus free text for legacy
 * long-form rejection justifications.
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
