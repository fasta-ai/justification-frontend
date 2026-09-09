"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  Trash2,
  Upload,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { REGISTER_LABELS } from "@/lib/case-import/registers";
import type { ParsedRegister, RegisterRole } from "@/lib/case-import/types";

const ROLE_ORDER: RegisterRole[] = ["eg", "pa", "recordAdmin"];

const ROLE_FILE_HINTS: Record<RegisterRole, string> = {
  eg: "A_EG_Form.xlsx",
  pa: "A_PA_Form.xlsx",
  recordAdmin: "A_Record_Admin.xlsx",
};

const ROLE_SIGNATURES: Record<RegisterRole, string> = {
  eg: "Q12b_Jus",
  pa: "PA_Justify",
  recordAdmin: "SWD_Ref + Recd_EGF",
};

const ROLE_HINTS: Record<RegisterRole, string> = {
  eg: "The Expert Group decision and justification — the payload this import exists to capture.",
  pa: "The applicant's product name, brand, model number and cost.",
  recordAdmin:
    "App_PNam_Mod, which the product name and model code are split from.",
};

interface Props {
  registers: ParsedRegister[];
  errors: string[];
  notes: string[];
  isBusy: boolean;
  onAdd: (files: File[], slot?: RegisterRole) => void;
  onRemove: (role: RegisterRole) => void;
  onContinue: () => void;
}

export function StepRegisters({
  registers,
  errors,
  notes,
  isBusy,
  onAdd,
  onRemove,
  onContinue,
}: Props) {
  const allRef = useRef<HTMLInputElement>(null);
  const [dragAll, setDragAll] = useState(false);
  const byRole = new Map(registers.map((r) => [r.role, r]));
  const hasEg = byRole.has("eg");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Upload the registers</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Each register has its own slot. Files are identified by the columns
          they contain rather than by filename, so a renamed workbook still
          lands in the right place. Only the EG register is required.
        </p>
      </div>

      <div className="grid gap-4">
        {ROLE_ORDER.map((role) => (
          <RegisterSlot
            key={role}
            role={role}
            register={byRole.get(role)}
            isBusy={isBusy}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={() => allRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragAll(true);
        }}
        onDragLeave={() => setDragAll(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragAll(false);
          onAdd(Array.from(e.dataTransfer.files));
        }}
        className={`w-full flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-sm transition-colors ${
          dragAll
            ? "border-primary bg-primary/5 text-foreground"
            : "text-muted-foreground hover:border-primary/50 hover:text-foreground"
        }`}
      >
        <Upload className="w-4 h-4" />
        Drop all three at once and let the columns sort them
      </button>
      <input
        ref={allRef}
        type="file"
        accept=".xlsx,.xls"
        multiple
        className="hidden"
        onChange={(e) => {
          onAdd(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {errors.map((error) => (
                <li key={error} className="text-sm">
                  {error}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {notes.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {notes.map((note) => (
                <li key={note} className="text-sm">
                  {note}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end pt-1">
        <Button onClick={onContinue} disabled={!hasEg || isBusy}>
          {isBusy ? "Reading…" : "Choose tranches"}
        </Button>
      </div>
    </div>
  );
}

/**
 * One register's upload target.
 *
 * The drop area stays visible after a file is loaded. An earlier version
 * collapsed to a small "Replace" link, which made it look like a status row —
 * anyone who used the drop-all-three shortcut never discovered that the slots
 * take files individually.
 */
function RegisterSlot({
  role,
  register,
  isBusy,
  onAdd,
  onRemove,
}: {
  role: RegisterRole;
  register?: ParsedRegister;
  isBusy: boolean;
  onAdd: (files: File[], slot?: RegisterRole) => void;
  onRemove: (role: RegisterRole) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const label = REGISTER_LABELS[role];
  const inputId = `register-input-${role}`;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        onAdd(Array.from(e.dataTransfer.files), role);
      }}
      className={`rounded-lg border bg-card p-4 transition-colors ${
        isDragging ? "border-primary ring-2 ring-primary/20" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {register ? (
            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
          ) : (
            <FileSpreadsheet className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{label}</span>
              {role === "eg" && <Badge variant="outline">Required</Badge>}
              {register && (
                <Badge variant="secondary" className="tabular-nums">
                  {register.rows.length.toLocaleString()} rows
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {register ? (
                <>
                  {register.fileName} · sheet {register.sheetName} ·{" "}
                  {register.columns.length} columns
                </>
              ) : (
                ROLE_HINTS[role]
              )}
            </p>
          </div>
        </div>

        {register && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => onRemove(role)}
            aria-label={`Remove ${label}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <label
        htmlFor={inputId}
        className={`flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-4 cursor-pointer text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/40"
        } ${isBusy ? "pointer-events-none opacity-60" : ""}`}
      >
        <Upload className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {register
            ? `Drop a different file to replace ${label.toLowerCase()}`
            : `Drop ${ROLE_FILE_HINTS[role]} here, or click to choose`}
        </span>
        <span className="text-xs text-muted-foreground">
          Any workbook with a{" "}
          <span className="font-mono">{ROLE_SIGNATURES[role]}</span> column
        </span>
      </label>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          onAdd(Array.from(e.target.files ?? []), role);
          e.target.value = "";
        }}
      />
    </div>
  );
}
