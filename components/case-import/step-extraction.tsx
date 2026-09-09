"use client";

import { AlertTriangle, Clock, Pause, Play, RotateCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXTRACTION_CONCURRENCY_OPTIONS } from "@/hooks/use-case-import";
import { caseNumber } from "@/lib/case-import/join";
import type { ImportRow } from "@/lib/case-import/types";

/** Observed round-trip for one catalogue through the two-stage extractor. */
const SECONDS_PER_CATALOGUE = 30;

interface Props {
  rows: ImportRow[];
  isExtracting: boolean;
  concurrency: number;
  onConcurrencyChange: (value: number) => void;
  onRun: () => void;
  onStop: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export function StepExtraction({
  rows,
  isExtracting,
  concurrency,
  onConcurrencyChange,
  onRun,
  onStop,
  onBack,
  onContinue,
}: Props) {
  const withCatalogue = rows.filter((r) => !r.excluded && r.selectedCatalogue);
  const done = withCatalogue.filter((r) => r.extraction.status === "done");
  const failed = withCatalogue.filter((r) => r.extraction.status === "failed");
  const remaining = withCatalogue.filter(
    (r) => r.extraction.status !== "done" && r.extraction.status !== "skipped",
  );
  const registerOnly = rows.filter(
    (r) => !r.excluded && !r.selectedCatalogue,
  ).length;

  const pct = withCatalogue.length
    ? Math.round((done.length / withCatalogue.length) * 100)
    : 100;
  const estimateMinutes = Math.ceil(
    (remaining.length * SECONDS_PER_CATALOGUE) / Math.max(1, concurrency) / 60,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Extract catalogue descriptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Each catalogue goes to the extraction service, which reads it and
            returns a short product description. That description is half of
            what the similar-case search matches on — the other half is the
            product name.
          </p>

          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <span className="font-medium">
                {remaining.length.toLocaleString()} catalogue
                {remaining.length === 1 ? "" : "s"} to extract, roughly{" "}
                {estimateMinutes} minute{estimateMinutes === 1 ? "" : "s"}.
              </span>{" "}
              The extraction service runs two workers and is shared with live
              case uploads, so a long run will slow everyone else down. Keep
              this tab open — extraction stops if you close it, though finished
              work is kept and pressing Extract again resumes from where it
              stopped.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Parallel extractions
              </label>
              <Select
                value={String(concurrency)}
                onValueChange={(v) => onConcurrencyChange(Number(v))}
                disabled={isExtracting}
              >
                <SelectTrigger className="w-44 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXTRACTION_CONCURRENCY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option} {option === 1 ? "(leaves capacity)" : "(faster)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isExtracting ? (
              <Button variant="secondary" onClick={onStop}>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
            ) : (
              <Button onClick={onRun} disabled={remaining.length === 0}>
                {failed.length > 0 && done.length > 0 ? (
                  <RotateCw className="w-4 h-4 mr-2" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                {failed.length > 0 && done.length > 0
                  ? `Retry ${remaining.length}`
                  : `Extract ${remaining.length}`}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Progress value={pct} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground tabular-nums">
                  {done.length}
                </span>{" "}
                extracted
              </span>
              {failed.length > 0 && (
                <span className="text-red-600 dark:text-red-500">
                  <span className="font-medium tabular-nums">{failed.length}</span>{" "}
                  failed
                </span>
              )}
              <span>
                <span className="font-medium text-foreground tabular-nums">
                  {registerOnly}
                </span>{" "}
                register-only (no catalogue)
              </span>
            </div>
          </div>

          {failed.length > 0 && !isExtracting && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {failed.length} extraction{failed.length === 1 ? "" : "s"} failed.
                Retrying picks up only those. Cases that keep failing can still be
                imported — they will carry the decision without a description.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {(isExtracting || done.length > 0 || failed.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
              {withCatalogue.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {caseNumber(row.joined.caseKey)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate font-mono">
                      {row.selectedCatalogue?.name}
                    </div>
                    {row.extraction.error && (
                      <div className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                        {row.extraction.error}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={row.extraction.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} disabled={isExtracting}>
          Back
        </Button>
        <Button onClick={onContinue} disabled={isExtracting}>
          Review before committing
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ImportRow["extraction"]["status"] }) {
  const map: Record<
    ImportRow["extraction"]["status"],
    { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
  > = {
    idle: { label: "waiting", variant: "outline" },
    queued: { label: "queued", variant: "outline" },
    running: { label: "extracting", variant: "secondary" },
    done: { label: "extracted", variant: "default" },
    failed: { label: "failed", variant: "destructive" },
    skipped: { label: "skipped", variant: "outline" },
  };
  const { label, variant } = map[status];
  return (
    <Badge variant={variant} className="shrink-0">
      {label}
    </Badge>
  );
}
