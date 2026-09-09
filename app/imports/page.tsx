"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { ProtectedRoute } from "@/components/protected-route";
import { StepRegisters } from "@/components/case-import/step-registers";
import { StepTranches } from "@/components/case-import/step-tranches";
import { StepDocuments } from "@/components/case-import/step-documents";
import { StepExtraction } from "@/components/case-import/step-extraction";
import { StepReview } from "@/components/case-import/step-review";
import { useCaseImport, type ImportStep } from "@/hooks/use-case-import";

const STEPS: { id: ImportStep; label: string }[] = [
  { id: "registers", label: "Registers" },
  { id: "tranches", label: "Tranches" },
  { id: "documents", label: "Documents" },
  { id: "extraction", label: "Extraction" },
  { id: "review", label: "Review" },
];

function ImportsPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const importer = useCaseImport();
  const { step, setStep } = importer;

  const currentIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col">
        <Header
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          products={[]}
          resetStore={() => {}}
        />

        <main className="flex-1 px-4 py-8 max-w-5xl mx-auto w-full">
          <div className="mb-8">
            <Button
              variant="ghost"
              size="sm"
              className="mb-4 gap-2"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">
              Import previous cases
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Add already-vetted cases to the corpus that Stage 3 searches for
              precedents. The more tranches it holds, the better the suggested
              justifications get.
            </p>
          </div>

          {step !== "done" && (
            <nav aria-label="Import steps" className="mb-6">
              <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {STEPS.map((s, index) => {
                  const state =
                    index < currentIndex
                      ? "done"
                      : index === currentIndex
                        ? "current"
                        : "upcoming";
                  return (
                    <li key={s.id} className="flex items-center gap-2">
                      <span
                        aria-current={state === "current" ? "step" : undefined}
                        className={
                          state === "current"
                            ? "font-medium text-foreground"
                            : state === "done"
                              ? "text-muted-foreground"
                              : "text-muted-foreground/60"
                        }
                      >
                        <span className="tabular-nums mr-1.5">{index + 1}.</span>
                        {s.label}
                      </span>
                      {index < STEPS.length - 1 && (
                        <span aria-hidden className="text-muted-foreground/40">
                          /
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}

          {step === "registers" && (
            <StepRegisters
              registers={importer.registers}
              errors={importer.registerErrors}
              notes={importer.registerNotes}
              isBusy={importer.isBusy}
              onAdd={importer.addRegisterFiles}
              onRemove={importer.removeRegister}
              onContinue={() => setStep("tranches")}
            />
          )}

          {step === "tranches" && (
            <StepTranches
              registers={importer.registers}
              tranches={importer.tranches}
              selected={importer.selectedTranches}
              onSelectedChange={importer.setSelectedTranches}
              corpus={importer.corpus}
              onLoadCorpus={importer.loadCorpusSummary}
              joinReport={importer.joinReport}
              onBack={() => setStep("registers")}
              onContinue={() => setStep("documents")}
            />
          )}

          {step === "documents" && (
            <StepDocuments
              rows={importer.rows}
              folders={importer.folders}
              onAttach={importer.attachFolder}
              onSkip={() => {
                importer.skipFolders();
                setStep("review");
              }}
              onSelectCatalogue={importer.selectCatalogue}
              onBack={() => setStep("tranches")}
              onContinue={() => setStep("extraction")}
            />
          )}

          {step === "extraction" && (
            <StepExtraction
              rows={importer.rows}
              isExtracting={importer.isExtracting}
              concurrency={importer.concurrency}
              onConcurrencyChange={importer.setConcurrency}
              onRun={importer.runExtraction}
              onStop={importer.stopExtraction}
              onBack={() => setStep("documents")}
              onContinue={() => setStep("review")}
            />
          )}

          {step === "review" && (
            <StepReview
              rows={importer.rows}
              requiredRoles={importer.requiredRoles}
              batchId={importer.batchId}
              isBusy={importer.isBusy}
              commitProgress={importer.commitProgress}
              onSetExcluded={importer.setExcluded}
              onSetExcludedMany={importer.setExcludedMany}
              onCommit={importer.commit}
              onBack={() => setStep("extraction")}
            />
          )}

          {step === "done" && (
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600 dark:text-emerald-500" />
                <div>
                  <h2 className="text-lg font-semibold">Import finished</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {importer.commitProgress?.created.toLocaleString() ?? 0} case
                    {importer.commitProgress?.created === 1 ? "" : "s"} written to
                    the corpus
                    {importer.commitProgress?.failed
                      ? `, ${importer.commitProgress.failed} failed`
                      : ""}
                    . They are searchable from Stage 3 straight away.
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mt-3">
                    Batch {importer.batchId}
                  </p>
                </div>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" onClick={importer.reset}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Import another tranche
                  </Button>
                  <Button onClick={() => router.push("/")}>Done</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

export default function ProtectedImportsPage() {
  return (
    <ProtectedRoute>
      <ImportsPage />
    </ProtectedRoute>
  );
}
