"use client";

import { useEffect } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { CorpusSummary } from "@/hooks/use-case-import";
import type { JoinReport, ParsedRegister } from "@/lib/case-import/types";

interface Props {
  registers: ParsedRegister[];
  tranches: string[];
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  corpus: CorpusSummary | null;
  onLoadCorpus: () => void;
  joinReport: JoinReport | null;
  onBack: () => void;
  onContinue: () => void;
}

export function StepTranches({
  registers,
  tranches,
  selected,
  onSelectedChange,
  corpus,
  onLoadCorpus,
  joinReport,
  onBack,
  onContinue,
}: Props) {
  useEffect(() => {
    if (!corpus) onLoadCorpus();
  }, [corpus, onLoadCorpus]);

  const toggle = (tranche: string) => {
    const next = new Set(selected);
    if (next.has(tranche)) next.delete(tranche);
    else next.add(tranche);
    onSelectedChange(next);
  };

  /**
   * Cases in a tranche, not rows across the three files.
   *
   * Each register holds one row per case, so summing them triples the figure —
   * T12 read as 1,080 when it is 360 cases. The largest single register is the
   * case count.
   */
  const casesFor = (tranche: string) =>
    Math.max(0, ...registers.map((reg) => reg.trancheCounts[tranche] ?? 0));

  const untagged = corpus?.counts["(untagged)"] ?? 0;

  const completeCases = joinReport
    ? joinReport.cases.filter((c) => c.sources.length >= registers.length).length
    : 0;
  const incompleteCases = joinReport
    ? joinReport.cases.length - completeCases
    : 0;

  const overlapping = [...selected]
    .map((tranche) => ({
      tranche,
      inCorpus: corpus?.counts[tranche] ?? 0,
      cases: casesFor(tranche),
    }))
    .filter((entry) => entry.inCorpus > 0)
    .sort((a, b) => b.inCorpus - a.inCorpus);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose what to import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The registers are the complete historical ledger, not a single
            delivery. Pick the tranches to add. Rows already tagged with a
            tranche in the corpus are shown so a tranche is not loaded twice.
          </p>

          {corpus?.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Could not read the existing corpus ({corpus.error}). You can
                still import, but the duplicate warning below will be blank.
              </AlertDescription>
            </Alert>
          )}

          {untagged > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {untagged.toLocaleString()} of the{" "}
                {corpus?.total.toLocaleString()} rows already in the corpus carry
                no Tranche value, so they cannot be attributed to a tranche here.
                A zero in the column below means &ldquo;no rows tagged with that
                tranche&rdquo;, not necessarily &ldquo;never imported&rdquo;.
              </AlertDescription>
            </Alert>
          )}

          <div className="border rounded-lg divide-y">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span className="w-4" />
              <span>Tranche</span>
              <span className="text-right tabular-nums">Cases</span>
              <span className="text-right tabular-nums">In corpus</span>
            </div>
            {tranches.map((tranche) => {
              const inCorpus = corpus?.counts[tranche] ?? 0;
              const isSelected = selected.has(tranche);
              return (
                <label
                  key={tranche}
                  className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-4 py-2.5 items-center cursor-pointer hover:bg-muted/40"
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggle(tranche)}
                    aria-label={`Import ${tranche}`}
                  />
                  <span className="text-sm font-medium">{tranche}</span>
                  <span className="text-sm text-right tabular-nums text-muted-foreground">
                    {casesFor(tranche).toLocaleString()}
                  </span>
                  <span className="text-right">
                    {inCorpus > 0 ? (
                      <Badge variant="secondary" className="tabular-nums">
                        {inCorpus.toLocaleString()}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          {overlapping.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm space-y-1">
                <p>
                  Some of what you selected is partly in the corpus already:
                </p>
                <ul className="list-disc pl-4">
                  {overlapping.map(({ tranche, inCorpus, cases }) => (
                    <li key={tranche}>
                      <span className="font-medium">{tranche}</span> —{" "}
                      {inCorpus.toLocaleString()} of {cases.toLocaleString()}{" "}
                      case{cases === 1 ? "" : "s"} (
                      {Math.round((inCorpus / Math.max(1, cases)) * 100)}%)
                      {inCorpus >= cases ? " — fully loaded" : ""}
                    </li>
                  ))}
                </ul>
                <p>
                  Those cases are matched by case number and skipped, so they
                  will not be duplicated. Everything else in the tranche is
                  imported normally.
                </p>
              </AlertDescription>
            </Alert>
          )}

        </CardContent>
      </Card>

      {joinReport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Merged cases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Stat label="Cases found" value={joinReport.cases.length} />
              <Stat
                label={`In all ${registers.length} register${registers.length === 1 ? "" : "s"}`}
                value={completeCases}
                emphasis
              />
              <Stat label="Incomplete" value={incompleteCases} />
            </div>

            <p className="text-xs text-muted-foreground">
              Merged on Tranche + EB_RM + NO + NO_R, not on Ref — the registers
              disagree with themselves about Ref, and each file formats it
              differently.
            </p>

            {incompleteCases > 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {incompleteCases} case{incompleteCases === 1 ? "" : "s"} appear
                  {incompleteCases === 1 ? "s" : ""} in only some of the
                  registers and will not be imported — a case missing from one
                  file goes into the corpus without that file&rsquo;s half of it.
                  {" "}
                  {completeCases.toLocaleString()} complete case
                  {completeCases === 1 ? "" : "s"} will be imported. The
                  excluded ones are listed at the review step.
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-xs text-emerald-700 dark:text-emerald-500">
                Every case was found in all {registers.length} register
                {registers.length === 1 ? "" : "s"} — nothing dropped.
              </p>
            )}

            {joinReport.unkeyed.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {joinReport.unkeyed.length} row
                  {joinReport.unkeyed.length === 1 ? "" : "s"} could not be
                  merged and {joinReport.unkeyed.length === 1 ? "was" : "were"}{" "}
                  left out:{" "}
                  {[...new Set(joinReport.unkeyed.map((u) => u.reason))]
                    .slice(0, 3)
                    .join("; ")}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex items-center gap-3">
          {!joinReport && (
            <span className="text-sm text-muted-foreground">
              Select at least one tranche to continue
            </span>
          )}
          <Button onClick={onContinue} disabled={!joinReport}>
            Attach case documents
          </Button>
        </div>
      </div>
    </div>
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
