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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CORPUS_TASK,
  CORPUS_TYPE,
  EMBEDDING_FIELDS,
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

type Filter = "all" | "attention" | "pending" | "duplicate" | "noCatalogue";

interface Props {
  rows: ImportRow[];
  requiredRoles: RegisterRole[];
  requireCatalogue: boolean;
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
  requireCatalogue,
  batchId,
  isBusy,
  commitProgress,
  onSetExcluded,
  onSetExcludedMany,
  onCommit,
  onBack,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [inspecting, setInspecting] = useState<string | null>(null);

  const annotated = useMemo(
    () =>
      rows.map((row) => {
        const metadata = buildDatasetMetadata(row, batchId);
        const text = embeddingText(metadata);
        const blocker = rowBlocker(row, requiredRoles, requireCatalogue);
        return {
          row,
          metadata,
          blocker,
          // Waiting on extraction is pending work, not a defect. Counting it
          // as "blocked" made a fresh import look 354-cases broken.
          pending: blocker === "catalogue not extracted yet",
          tokens: estimateTokens(text),
          product: resolveProduct(row.joined),
        };
      }),
    [rows, batchId, requiredRoles, requireCatalogue],
  );

  const committable = annotated.filter(
    (a) => !a.row.excluded && !a.row.alreadyInCorpus && !a.blocker,
  );
  const blocked = annotated.filter(
    (a) => a.blocker && !a.pending && !a.row.excluded && !a.row.alreadyInCorpus,
  );
  const pending = annotated.filter(
    (a) => a.pending && !a.row.excluded && !a.row.alreadyInCorpus,
  );
  const duplicates = annotated.filter((a) => a.row.alreadyInCorpus);
  const noCatalogue = annotated.filter((a) => !a.metadata.catalogueDesc);
  const truncated = annotated.filter((a) => a.tokens > EMBEDDING_TOKEN_LIMIT);

  const visible = annotated.filter((a) => {
    if (filter === "attention")
      return Boolean(a.blocker) && !a.pending && !a.row.alreadyInCorpus;
    if (filter === "pending") return a.pending && !a.row.alreadyInCorpus;
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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Stat label="Will be written" value={committable.length} emphasis />
            <Stat label="Awaiting extraction" value={pending.length} />
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
                {duplicates.length === 1 ? "is" : "are"} already in the corpus,
                matched on case number. {duplicates.length === 1 ? "It was" : "They were"}{" "}
                skipped at extraction — no point spending a Vertex call on a
                case that will not be written — and {duplicates.length === 1 ? "is" : "are"}{" "}
                left out of the commit.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <FilterButton current={filter} value="all" onSelect={setFilter}>
              All {annotated.length}
            </FilterButton>
            <FilterButton current={filter} value="pending" onSelect={setFilter}>
              Awaiting extraction {pending.length}
            </FilterButton>
            <FilterButton current={filter} value="attention" onSelect={setFilter}>
              Blocked {blocked.length}
            </FilterButton>
            <FilterButton current={filter} value="duplicate" onSelect={setFilter}>
              Already in corpus {duplicates.length}
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

          <p className="text-xs text-muted-foreground">
            Click a case number to see the exact record that will be written and
            the text its embedding is built from.
          </p>

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
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setInspecting(a.row.key)}
                        className="font-mono text-xs underline underline-offset-2 hover:text-primary"
                        title="Show exactly what will be written"
                      >
                        {caseNumber(a.row.joined.caseKey)}
                      </button>
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
                      {/* Already in the corpus wins over any other reason: it
                          explains both why the case was never extracted and
                          why it will not be written. Showing the catalogue
                          blocker instead reads as a failure that needs
                          fixing. */}
                      {a.row.alreadyInCorpus ? (
                        <span className="text-xs text-amber-600 dark:text-amber-500">
                          already in the corpus
                        </span>
                      ) : a.blocker ? (
                        <span
                          className={
                            a.pending
                              ? "text-xs text-muted-foreground"
                              : "text-xs text-red-600 dark:text-red-500"
                          }
                        >
                          {a.blocker}
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

      <RowInspector
        entry={annotated.find((a) => a.row.key === inspecting) ?? null}
        onClose={() => setInspecting(null)}
      />

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

/**
 * Exactly what will be written for one case, and the text the vector is built
 * from. The corpus is otherwise only inspectable through the database, and a
 * bad extraction is far cheaper to notice here than after committing.
 */
function RowInspector({
  entry,
  onClose,
}: {
  entry: {
    row: ImportRow;
    metadata: Record<string, unknown>;
    blocker: string | null;
    tokens: number;
  } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!entry) return null;
  const text = embeddingText(entry.metadata);
  const overLimit = entry.tokens > EMBEDDING_TOKEN_LIMIT;

  // The shape of a `datasets` row, so this can be diffed against one pulled
  // straight out of the table.
  const datasetRow = JSON.stringify(
    {
      task: CORPUS_TASK,
      type: CORPUS_TYPE,
      metadata: entry.metadata,
      embedding: `<768 floats — generated on commit from: ${
        EMBEDDING_FIELDS.join(" + ")
      }>`,
    },
    null,
    2,
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">
            {caseNumber(entry.row.joined.caseKey)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {entry.blocker ? (
              <Badge variant="destructive">{entry.blocker}</Badge>
            ) : entry.row.alreadyInCorpus ? (
              <Badge variant="secondary">already in the corpus</Badge>
            ) : (
              <Badge>will be written</Badge>
            )}
          </div>

          <section className="space-y-1">
            <h4 className="text-sm font-semibold">Catalogue description</h4>
            {entry.metadata.catalogueDesc ? (
              <p className="text-sm text-muted-foreground border rounded-md p-3 whitespace-pre-wrap">
                {String(entry.metadata.catalogueDesc)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                None — this case has no catalogue description.
              </p>
            )}
          </section>

          {Array.isArray(
            (entry.metadata.catalogue_data as { products?: unknown[] })?.products,
          ) && (
            <section className="space-y-1">
              <h4 className="text-sm font-semibold">Products found</h4>
              <div className="space-y-2">
                {(
                  (entry.metadata.catalogue_data as {
                    products: {
                      product_name?: string;
                      model?: string;
                      functions?: string[];
                      product_size?: string;
                      usage_capacity?: string;
                    }[];
                  }).products
                ).map((product, i) => (
                  <div key={i} className="border rounded-md p-3 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-medium">
                        {product.product_name || "(unnamed)"}
                      </span>
                      {product.model && (
                        <Badge variant="secondary" className="font-mono">
                          {product.model}
                        </Badge>
                      )}
                    </div>
                    {product.functions && product.functions.length > 0 && (
                      <ul className="list-disc pl-4 text-xs text-muted-foreground">
                        {product.functions.map((fn, j) => (
                          <li key={j}>{fn}</li>
                        ))}
                      </ul>
                    )}
                    {(product.product_size || product.usage_capacity) && (
                      <p className="text-xs text-muted-foreground">
                        {[product.product_size, product.usage_capacity]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-1">
            <h4 className="text-sm font-semibold">
              Embedding input{" "}
              <span className="font-normal text-muted-foreground">
                ({EMBEDDING_FIELDS.join(" + ")})
              </span>
            </h4>
            <p className="text-sm border rounded-md p-3 whitespace-pre-wrap">
              {text || (
                <span className="text-muted-foreground">
                  empty — nothing to embed
                </span>
              )}
            </p>
            <p
              className={
                overLimit
                  ? "text-xs text-amber-600 dark:text-amber-500"
                  : "text-xs text-muted-foreground"
              }
            >
              ~{entry.tokens} of {EMBEDDING_TOKEN_LIMIT} tokens
              {overLimit
                ? " — the excess is dropped when the vector is built"
                : ". The vector itself is generated by the backend on commit."}
            </p>
          </section>

          <section className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">
                The row as it lands in <code className="font-mono">datasets</code>
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(datasetRow);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="text-xs border rounded-md p-3 overflow-x-auto bg-muted/40">
              {datasetRow}
            </pre>
            <p className="text-xs text-muted-foreground">
              Every field above is written verbatim. `embedding` is the one the
              backend fills in on commit, from the input shown above.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
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
