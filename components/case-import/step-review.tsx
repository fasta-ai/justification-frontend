"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Database } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  EMBEDDING_TOKEN_LIMIT,
  buildDatasetMetadata,
  embeddingText,
  estimateTokens,
  resolveProduct,
  rowBlocker,
} from "@/lib/case-import/build-record";
import { caseNumber } from "@/lib/case-import/join";
import type { CommitProgress } from "@/hooks/use-case-import";
import type { ImportRow, RegisterRole } from "@/lib/case-import/types";

type Filter = "all" | "attention" | "duplicate" | "noCatalogue";

interface Props {
  rows: ImportRow[];
  requiredRoles: RegisterRole[];
  batchId: string;
  isBusy: boolean;
  commitProgress: CommitProgress | null;
  onSetExcluded: (key: string, excluded: boolean) => void;
  onSetExcludedMany: (keys: string[], excluded: boolean) => void;
  onCommit: () => void;
  onBack: () => void;
}

export function StepReview({
  rows,
  requiredRoles,
  batchId,
  isBusy,
  commitProgress,
  onSetExcluded,
  onSetExcludedMany,
  onCommit,
  onBack,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const annotated = useMemo(
    () =>
      rows.map((row) => {
        const metadata = buildDatasetMetadata(row, batchId);
        const text = embeddingText(metadata);
        return {
          row,
          metadata,
          blocker: rowBlocker(row, requiredRoles),
          tokens: estimateTokens(text),
          product: resolveProduct(row.joined),
        };
      }),
    [rows, batchId, requiredRoles],
  );

  const committable = annotated.filter(
    (a) => !a.row.excluded && !a.row.alreadyInCorpus && !a.blocker,
  );
  const blocked = annotated.filter((a) => a.blocker && !a.row.excluded);
  const duplicates = annotated.filter((a) => a.row.alreadyInCorpus);
  const noCatalogue = annotated.filter((a) => !a.metadata.catalogueDesc);
  const truncated = annotated.filter((a) => a.tokens > EMBEDDING_TOKEN_LIMIT);

  const visible = annotated.filter((a) => {
    if (filter === "attention") return Boolean(a.blocker);
    if (filter === "duplicate") return a.row.alreadyInCorpus;
    if (filter === "noCatalogue") return !a.metadata.catalogueDesc;
    return true;
  });

  if (commitProgress) {
    const pct = committable.length
      ? Math.round((commitProgress.committed / committable.length) * 100)
      : 100;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Writing to the corpus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={pct} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Created" value={commitProgress.created} />
            <Stat label="Skipped" value={commitProgress.skipped} />
            <Stat label="Failed" value={commitProgress.failed} />
            <Stat label="Sent" value={commitProgress.committed} />
          </div>
          {commitProgress.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <ul className="list-disc pl-4 space-y-1">
                  {commitProgress.errors.slice(0, 5).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <p className="text-xs text-muted-foreground font-mono">
            Batch {batchId}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review before committing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Will be written" value={committable.length} emphasis />
            <Stat label="Blocked" value={blocked.length} />
            <Stat label="Already in corpus" value={duplicates.length} />
            <Stat label="No description" value={noCatalogue.length} />
          </div>

          {truncated.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {truncated.length} row{truncated.length === 1 ? "" : "s"} have
                text longer than the embedding model reads ({EMBEDDING_TOKEN_LIMIT}{" "}
                tokens). The excess is dropped when the vector is built — the
                stored description keeps it, so only the matching is affected.
              </AlertDescription>
            </Alert>
          )}

          {duplicates.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {duplicates.length} case{duplicates.length === 1 ? "" : "s"}{" "}
                {duplicates.length === 1 ? "is" : "are"} already in the corpus
                and will not be written again.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <FilterButton current={filter} value="all" onSelect={setFilter}>
              All {annotated.length}
            </FilterButton>
            <FilterButton current={filter} value="attention" onSelect={setFilter}>
              Blocked {blocked.length}
            </FilterButton>
            <FilterButton current={filter} value="duplicate" onSelect={setFilter}>
              Duplicates {duplicates.length}
            </FilterButton>
            <FilterButton current={filter} value="noCatalogue" onSelect={setFilter}>
              No description {noCatalogue.length}
            </FilterButton>
            {filter !== "all" && visible.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onSetExcludedMany(
                    visible.map((a) => a.row.key),
                    true,
                  )
                }
              >
                Exclude these {visible.length}
              </Button>
            )}
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2 w-10">Keep</th>
                  <th className="text-left font-medium px-3 py-2">Case</th>
                  <th className="text-left font-medium px-3 py-2">Product</th>
                  <th className="text-left font-medium px-3 py-2">Model</th>
                  <th className="text-left font-medium px-3 py-2">Q12a</th>
                  <th className="text-left font-medium px-3 py-2">Description</th>
                  <th className="text-left font-medium px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.slice(0, 300).map((a) => (
                  <tr
                    key={a.row.key}
                    className={a.row.excluded ? "opacity-40" : undefined}
                  >
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={!a.row.excluded}
                        onCheckedChange={(checked) =>
                          onSetExcluded(a.row.key, !checked)
                        }
                        aria-label={`Keep ${caseNumber(a.row.joined.caseKey)}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                      {caseNumber(a.row.joined.caseKey)}
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      <span className="line-clamp-2">
                        {a.product.appPName ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {a.product.modelCode ?? "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {String(a.metadata.Q12a ?? "—")}
                    </td>
                    <td className="px-3 py-2">
                      {a.metadata.catalogueDesc ? (
                        <Badge variant="secondary">
                          {a.tokens > EMBEDDING_TOKEN_LIMIT
                            ? `${a.tokens} tokens`
                            : "present"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          register only
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {a.blocker ? (
                        <span className="text-xs text-red-600 dark:text-red-500">
                          {a.blocker}
                        </span>
                      ) : a.row.alreadyInCorpus ? (
                        <span className="text-xs text-amber-600 dark:text-amber-500">
                          already imported
                        </span>
                      ) : (
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length > 300 && (
              <div className="px-3 py-2 text-xs text-muted-foreground border-t">
                Showing the first 300 of {visible.length}. Filters narrow the list.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onCommit} disabled={isBusy || committable.length === 0}>
          <Database className="w-4 h-4 mr-2" />
          Write {committable.length.toLocaleString()} case
          {committable.length === 1 ? "" : "s"} to the corpus
        </Button>
      </div>
    </div>
  );
}

function FilterButton({
  current,
  value,
  onSelect,
  children,
}: {
  current: Filter;
  value: Filter;
  onSelect: (f: Filter) => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant={current === value ? "secondary" : "ghost"}
      size="sm"
      onClick={() => onSelect(value)}
    >
      {children}
    </Button>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className={`border rounded-lg p-3 ${emphasis ? "border-primary" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">
        {value.toLocaleString()}
      </div>
    </div>
  );
}
