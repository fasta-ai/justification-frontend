"use client";

import { useRef } from "react";
import { FolderOpen, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectablePdfs } from "@/lib/case-import/folders";
import { caseNumber } from "@/lib/case-import/join";
import { resolveProduct } from "@/lib/case-import/build-record";
import type { CaseFolder, ClassifiedFile, ImportRow } from "@/lib/case-import/types";

interface Props {
  rows: ImportRow[];
  folders: CaseFolder[];
  onAttach: (files: File[]) => void;
  onSelectCatalogue: (key: string, file: ClassifiedFile | null) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function StepDocuments({
  rows,
  folders,
  onAttach,
  onSelectCatalogue,
  onBack,
  onContinue,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const attached = folders.length > 0;

  const counts = {
    confident: rows.filter((r) => r.bucket === "confident").length,
    ambiguous: rows.filter((r) => r.bucket === "ambiguous").length,
    none: rows.filter((r) => r.bucket === "none").length,
    registerOnly: rows.filter((r) => r.bucket === "registerOnly").length,
  };
  const unmatchedFolders = folders.filter((f) => !f.caseKey);
  const needsAttention = rows.filter(
    (r) => r.bucket === "ambiguous" || r.bucket === "none",
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attach the case documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Point at the tranche folder (for example{" "}
            <span className="font-mono text-xs">T12 Cases</span>). Files are read
            in your browser and classified by name; only the one catalogue you
            settle on per case is ever uploaded.
          </p>
          <p className="text-sm text-muted-foreground">
            A folder is required: only cases that end up with a catalogue
            description are imported, so a case with no catalogue is left out.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => inputRef.current?.click()}>
              <FolderOpen className="w-4 h-4 mr-2" />
              {attached ? "Choose a different folder" : "Choose folder"}
            </Button>

            <input
              ref={inputRef}
              type="file"
              // @ts-expect-error non-standard but supported in Chrome, Edge and Safari
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={(e) => {
                onAttach(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </div>

          {attached && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Bucket
                  label="Ready"
                  value={counts.confident}
                  tone="ok"
                  hint="One clear catalogue"
                />
                <Bucket
                  label="Needs a pick"
                  value={counts.ambiguous}
                  tone="warn"
                  hint="Several candidates"
                />
                <Bucket
                  label="Nothing found"
                  value={counts.none}
                  tone="bad"
                  hint="No file matched"
                />
                <Bucket
                  label="Register only"
                  value={counts.registerOnly}
                  tone="muted"
                  hint="No folder at all"
                />
              </div>

              {unmatchedFolders.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {unmatchedFolders.length} folder
                    {unmatchedFolders.length === 1 ? "" : "s"} did not parse as a
                    case and {unmatchedFolders.length === 1 ? "was" : "were"}{" "}
                    ignored:{" "}
                    <span className="font-mono text-xs">
                      {unmatchedFolders
                        .slice(0, 4)
                        .map((f) => f.folderName)
                        .join(", ")}
                      {unmatchedFolders.length > 4 ? "…" : ""}
                    </span>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {needsAttention.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Pick the catalogue ({needsAttention.length} case
              {needsAttention.length === 1 ? "" : "s"})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Naming inside the folders is inconsistent — a catalogue may be
              called a leaflet, a spec, a pamphlet, or nothing recognisable at
              all. Choose the file that describes the product, or mark the case
              register-only to import its decision without a description.
            </p>
            <div className="border rounded-lg divide-y max-h-[28rem] overflow-y-auto">
              {needsAttention.map((row) => (
                <CataloguePicker
                  key={row.key}
                  row={row}
                  onSelect={onSelectCatalogue}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={!attached}>
          Continue to extraction
        </Button>
      </div>
    </div>
  );
}

function CataloguePicker({
  row,
  onSelect,
}: {
  row: ImportRow;
  onSelect: (key: string, file: ClassifiedFile | null) => void;
}) {
  const options = row.folder ? selectablePdfs(row.folder) : [];
  const { appPName } = resolveProduct(row.joined);

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">
            {caseNumber(row.joined.caseKey)}
            {appPName ? ` — ${appPName}` : ""}
          </div>
          <div className="text-xs text-muted-foreground font-mono truncate">
            {row.folder?.folderName}
          </div>
        </div>
        <Badge variant={row.bucket === "ambiguous" ? "secondary" : "outline"}>
          {row.bucket === "ambiguous"
            ? `${options.length} candidates`
            : "nothing matched"}
        </Badge>
      </div>

      <Select
        value={row.selectedCatalogue?.path ?? "__none__"}
        onValueChange={(value) =>
          onSelect(
            row.key,
            value === "__none__"
              ? null
              : (options.find((o) => o.path === value) ?? null),
          )
        }
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Choose the catalogue file" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            Register only — no catalogue description
          </SelectItem>
          {options.map((option) => (
            <SelectItem key={option.path} value={option.path}>
              {option.name} · {(option.size / 1_048_576).toFixed(1)} MB
              {option.matchedOn ? ` · ${option.matchedOn}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Bucket({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "bad" | "muted";
  hint: string;
}) {
  const toneClass = {
    ok: "text-emerald-600 dark:text-emerald-500",
    warn: "text-amber-600 dark:text-amber-500",
    bad: "text-red-600 dark:text-red-500",
    muted: "text-muted-foreground",
  }[tone];

  return (
    <div className="border rounded-lg p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${toneClass}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
    </div>
  );
}
