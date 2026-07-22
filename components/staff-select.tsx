"use client";

import { useMemo, useState } from "react";
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
} from "@/components/ui/command";
import {
  formatStaffInfo,
  formatStaffLabel,
  useStaff,
  type Staff,
} from "@/hooks/use-staff";

interface StaffSelectProps {
  /**
   * `"label"` -> shows and picks Staff1 / Staff2 (Name (Position))
   * `"info"`  -> shows and picks Staff1_Info / Staff2_Info (Phone / Email)
   */
  mode: "label" | "info";
  value: string;
  onSelect: (picked: {
    staff: Staff;
    label: string;
    info: string;
  }) => void;
  onChange?: (raw: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Combobox-style picker over the /staff catalogue. Selecting a person
 * calls `onSelect` with both the composed label and info strings so the
 * caller can back-fill the sibling field (Staff1 <-> Staff1_Info).
 * The user may still type freely — free text is passed through `onChange`.
 */
export function StaffSelect({
  mode,
  value,
  onSelect,
  onChange,
  placeholder,
  className,
  disabled,
}: StaffSelectProps) {
  const { staff, isLoading } = useStaff();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const items = useMemo(
    () =>
      staff.map((s) => ({
        staff: s,
        label: formatStaffLabel(s),
        info: formatStaffInfo(s),
      })),
    [staff],
  );

  const displayValue = value || "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-6 text-xs font-normal px-2",
            !displayValue && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate text-left">
            {displayValue ||
              placeholder ||
              (mode === "label" ? "Select staff…" : "Select contact…")}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            if (!search) return 1;
            return itemValue.toLowerCase().includes(search.toLowerCase())
              ? 1
              : 0;
          }}
        >
          <CommandInput
            placeholder="Search staff…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading…" : "No staff found."}
            </CommandEmpty>
            <CommandGroup>
              {items.map((item) => {
                const primary =
                  mode === "label" ? item.label : item.info || "—";
                const secondary =
                  mode === "label" ? item.info : item.label;
                // The value passed to cmdk drives its built-in filter — pack
                // both label and info in so either half matches search.
                const searchKey = `${item.label} ${item.info}`;
                const isSelected = displayValue === primary;
                return (
                  <CommandItem
                    key={item.staff.id}
                    value={searchKey}
                    onSelect={() => {
                      onSelect(item);
                      setOpen(false);
                    }}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Check
                        className={cn(
                          "h-3 w-3 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="text-xs font-medium truncate">
                        {primary}
                      </span>
                    </div>
                    {secondary ? (
                      <span className="pl-5 text-[10px] text-muted-foreground truncate w-full">
                        {secondary}
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {onChange ? (
            <div className="border-t px-2 py-1.5 text-[10px] text-muted-foreground">
              Free typing is preserved in the field — pick a row only to
              overwrite.
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
