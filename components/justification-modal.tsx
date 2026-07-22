"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Save,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Case } from "@/app/api/cases/types";
import type { SimilarJustification } from "@/lib/types";

export interface JustificationInputs {
  PA_PName: string;
  PA_Brand: string;
  PA_Mod_No: string;
  PA_Elaborate: string;
  egName: string;
  egDesc: string;
  Q12b_Jus: string;
}

export interface SaveDraftPayload {
  justification: string;
  q12bJus: string;
  egPatch: Record<string, string>;
  applicationPatch: Record<string, unknown>;
}

export interface GenerateResult {
  text: string;
  aiDecision?: string;
  aiReasoning?: string;
}

interface JustificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCase: Case | null;
  initialDecision: "approved" | "rejected";
  seedSimilarCase?: SimilarJustification | null;
  isGenerating: boolean;
  isUpdating: boolean;
  isSavingDraft?: boolean;
  onGenerate: (
    inputs: JustificationInputs,
    decision: "approved" | "rejected",
    seedSimilar?: SimilarJustification | null,
  ) => Promise<GenerateResult | string>;
  onConfirm: (
    justification: string,
    decision: "approved" | "rejected",
  ) => Promise<void> | void;
  onSaveDraft?: (payload: SaveDraftPayload) => Promise<void> | void;
}

function extractInputs(c: Case | null): JustificationInputs {
  if (!c) {
    return {
      PA_PName: "",
      PA_Brand: "",
      PA_Mod_No: "",
      PA_Elaborate: "",
      egName: "",
      egDesc: "",
      Q12b_Jus: "",
    };
  }
  const app = (c.applicationData || {}) as Record<string, string>;
  const eg = (c.egData || {}) as Record<string, string>;
  return {
    PA_PName: app.PA_PName || "",
    PA_Brand: app.PA_Brand || "",
    PA_Mod_No: app.PA_Mod_No || "",
    PA_Elaborate: app.PA_Elaborate || app.PA_Justify || "",
    egName: eg.App_PName || eg.App_PNam_Mod || "",
    egDesc: eg.catalogueDesc || "",
    Q12b_Jus: eg.Q12b_Jus || "",
  };
}

export function JustificationModal({
  open,
  onOpenChange,
  selectedCase,
  initialDecision,
  seedSimilarCase,
  isGenerating,
  isUpdating,
  isSavingDraft = false,
  onGenerate,
  onConfirm,
  onSaveDraft,
}: JustificationModalProps) {
  const [decision, setDecision] = useState<"approved" | "rejected">(
    initialDecision,
  );
  const [inputs, setInputs] = useState<JustificationInputs>(() =>
    extractInputs(selectedCase),
  );
  const [draft, setDraft] = useState<string>(selectedCase?.justification || "");
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [showInputs, setShowInputs] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<{
    decision: string;
    reasoning: string;
  } | null>(null);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  // Snapshots for dirty tracking — captured whenever we (re)open on a case.
  const initialInputsRef = useRef<JustificationInputs>(extractInputs(selectedCase));
  const initialDraftRef = useRef<string>(selectedCase?.justification || "");
  const adviceRef = useRef<HTMLDivElement | null>(null);
  // Tracks the most recent (case, seed, decision) triple we prefilled for, so
  // we don't clobber an in-progress edit when React re-runs the effect.
  const prefillKeyRef = useRef<string>("");

  // Reset internal state whenever the modal is (re)opened or the case changes.
  useEffect(() => {
    if (!open) return;
    const nextInputs = extractInputs(selectedCase);
    const nextDraft = selectedCase?.justification || "";
    setDecision(initialDecision);
    setInputs(nextInputs);
    setDraft(nextDraft);
    setHasGeneratedOnce(false);
    setShowInputs(false);
    setAiAdvice(null);
    initialInputsRef.current = nextInputs;
    initialDraftRef.current = nextDraft;
    prefillKeyRef.current = "";
  }, [open, selectedCase?.id, initialDecision]);

  // Prefill the draft + AI advice from the LAST stored generation for this
  // (case × decision × seed) triple. Every generation is persisted server-side
  // in `justification_generations`, so reopening the same reference should
  // show the same AI text without regenerating. Each reference-seed × action
  // pair has its own row, so switching the seed/decision toggle reloads the
  // matching cached result if one exists — and RESETS to the case default
  // if it doesn't (otherwise the previous seed's text bleeds through).
  useEffect(() => {
    if (!open || !selectedCase?.id) return;
    const seedId = seedSimilarCase?.id || "none";
    const key = `${selectedCase.id}::${decision}::${seedId}`;
    // Guard: don't re-run for the same triple within this open session.
    if (prefillKeyRef.current === key) return;
    prefillKeyRef.current = key;

    // Reset to the correct baseline BEFORE the async lookup:
    //   - seed selected → blank draft. The reviewer should Generate for THIS
    //     seed; falling back to `selectedCase.justification` would show
    //     whatever the previous seed produced (since Confirm/Save-Draft writes
    //     that field) and make two seeds look identical.
    //   - no seed → use the case's stored justification (edit-in-place flow).
    const fallbackDraft = seedSimilarCase ? "" : selectedCase.justification || "";
    setDraft(fallbackDraft);
    setAiAdvice(null);
    setHasGeneratedOnce(false);

    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({
          action: decision,
          seedDatasetId: seedId,
        });
        const res = await fetch(
          `/api/extraction/generations/${encodeURIComponent(
            selectedCase.id,
          )}/latest?${qs.toString()}`,
        );
        if (!res.ok) return;
        const row = await res.json();
        if (cancelled || !row) return;
        const gen = row.generatedJustification as string | undefined;
        if (typeof gen === "string" && gen.trim().length > 0) {
          setDraft(gen);
          setHasGeneratedOnce(true);
          if (row.aiDecision) {
            setAiAdvice({
              decision: row.aiDecision,
              reasoning: row.generatedReasoning || "",
            });
          }
        }
      } catch (err) {
        console.warn("Prefill lookup failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, selectedCase?.id, decision, seedSimilarCase?.id, selectedCase?.justification]);

  const hasSaved = Boolean(selectedCase?.justification?.trim());
  const isBusy = isGenerating || isUpdating || isSavingDraft;
  const canConfirm =
    !!selectedCase && draft.trim().length > 0 && !isBusy;

  // Dirty flag: any diff vs snapshot enables Save Draft.
  const isDirty = useMemo(() => {
    if (draft !== initialDraftRef.current) return true;
    const init = initialInputsRef.current;
    return (Object.keys(init) as Array<keyof JustificationInputs>).some(
      (k) => inputs[k] !== init[k],
    );
  }, [inputs, draft]);

  const canSaveDraft =
    !!selectedCase && !!onSaveDraft && isDirty && !isBusy;

  const seedInfo = useMemo(() => {
    if (!seedSimilarCase) return null;
    return {
      name: seedSimilarCase.productName,
      decision: seedSimilarCase.decision,
      similarity: Math.round((seedSimilarCase.similarity ?? 0) * 100),
    };
  }, [seedSimilarCase]);

  const updateInput = <K extends keyof JustificationInputs>(
    key: K,
    value: JustificationInputs[K],
  ) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const runGenerate = async () => {
    const result = await onGenerate(inputs, decision, seedSimilarCase);
    // Backwards-compat: onGenerate used to return a plain string. Handle both.
    const text = typeof result === "string" ? result : result?.text || "";
    const aiDecision =
      typeof result === "string" ? undefined : result?.aiDecision;
    const aiReasoning =
      typeof result === "string" ? undefined : result?.aiReasoning;
    if (text.length > 0) {
      setDraft(text);
      setHasGeneratedOnce(true);
      if (aiDecision) {
        setAiAdvice({ decision: aiDecision, reasoning: aiReasoning || "" });
      } else {
        setAiAdvice(null);
      }
    }
  };

  // Does the AI's recommendation align with the reviewer's chosen decision?
  const aiAgrees = useMemo(() => {
    if (!aiAdvice?.decision) return null;
    const ai = aiAdvice.decision.trim().toLowerCase();
    // "approved"/"approve" vs "rejected"/"reject"
    const aiIsApprove = ai.startsWith("approv");
    const aiIsReject = ai.startsWith("reject");
    if (decision === "approved" && aiIsApprove) return true;
    if (decision === "rejected" && aiIsReject) return true;
    return false;
  }, [aiAdvice, decision]);

  // When a fresh generation lands, scroll the advisory panel into view so
  // the reviewer sees the AI's recommendation before touching Approve/Reject.
  useEffect(() => {
    if (!hasGeneratedOnce || !aiAdvice) return;
    // Defer to next paint — the panel is rendered by the same state change.
    const raf = requestAnimationFrame(() => {
      adviceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [hasGeneratedOnce, aiAdvice]);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    await onConfirm(draft, decision);
  };

  const buildEgPatch = (): Record<string, string> => {
    const init = initialInputsRef.current;
    const patch: Record<string, string> = {};
    if (inputs.Q12b_Jus !== init.Q12b_Jus) patch.Q12b_Jus = inputs.Q12b_Jus;
    if (inputs.egName !== init.egName) {
      // Preserve whichever eg product-name key the case originally used.
      const eg = (selectedCase?.egData || {}) as Record<string, string>;
      if ("App_PName" in eg) patch.App_PName = inputs.egName;
      else if ("App_PNam_Mod" in eg) patch.App_PNam_Mod = inputs.egName;
      else patch.App_PName = inputs.egName;
    }
    if (inputs.egDesc !== init.egDesc) patch.catalogueDesc = inputs.egDesc;
    return patch;
  };

  const buildApplicationPatch = (): Record<string, unknown> => {
    const init = initialInputsRef.current;
    const patch: Record<string, unknown> = {};
    if (inputs.PA_PName !== init.PA_PName) patch.PA_PName = inputs.PA_PName;
    if (inputs.PA_Brand !== init.PA_Brand) patch.PA_Brand = inputs.PA_Brand;
    if (inputs.PA_Mod_No !== init.PA_Mod_No) patch.PA_Mod_No = inputs.PA_Mod_No;
    if (inputs.PA_Elaborate !== init.PA_Elaborate)
      patch.PA_Elaborate = inputs.PA_Elaborate;
    return patch;
  };

  const handleSaveDraft = async () => {
    if (!canSaveDraft || !onSaveDraft) return;
    setSaveConfirmOpen(false);
    await onSaveDraft({
      justification: draft,
      // Force Q12b_Jus to the current draft — this is what the confirm dialog
      // warned about: saving the draft OVERRIDES the case's existing remarks
      // so subsequent copy/edit views see the latest AI-authored text.
      q12bJus: draft,
      egPatch: buildEgPatch(),
      applicationPatch: buildApplicationPatch(),
    });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Justification — Case {selectedCase?.caseNumber || ""}
          </DialogTitle>
          <DialogDescription>
            Review the fields the AI will use, generate a draft, edit it, then
            save as a draft or confirm your decision.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {seedInfo && (
            <div className="rounded-lg border bg-muted/40 p-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">Seeded from similar case:</span>
                <span>{seedInfo.name}</span>
                <Badge variant="outline">{seedInfo.similarity}% match</Badge>
                <Badge
                  variant={
                    seedInfo.decision === "approved" ? "default" : "destructive"
                  }
                  className={cn(
                    seedInfo.decision === "approved" &&
                      "bg-success text-success-foreground",
                  )}
                >
                  {seedInfo.decision}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                Similar-case context will be included in the AI generation
                prompt.
              </p>
            </div>
          )}

          <Separator />

          {/* Inputs (collapsible) */}
          <div className="space-y-2">
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium"
              onClick={() => setShowInputs((v) => !v)}
            >
              {showInputs ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              Inputs used for AI generation
            </button>
            {showInputs && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Product name (PA_PName)</Label>
                  <Input
                    value={inputs.PA_PName}
                    onChange={(e) => updateInput("PA_PName", e.target.value)}
                    disabled={isBusy}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Brand (PA_Brand)</Label>
                  <Input
                    value={inputs.PA_Brand}
                    onChange={(e) => updateInput("PA_Brand", e.target.value)}
                    disabled={isBusy}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Model (PA_Mod_No)</Label>
                  <Input
                    value={inputs.PA_Mod_No}
                    onChange={(e) => updateInput("PA_Mod_No", e.target.value)}
                    disabled={isBusy}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">EG product name</Label>
                  <Input
                    value={inputs.egName}
                    onChange={(e) => updateInput("egName", e.target.value)}
                    disabled={isBusy}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">
                    Elaborate / justify (PA_Elaborate)
                  </Label>
                  <Textarea
                    rows={3}
                    value={inputs.PA_Elaborate}
                    onChange={(e) =>
                      updateInput("PA_Elaborate", e.target.value)
                    }
                    disabled={isBusy}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">
                    EG catalogue description (egDesc)
                  </Label>
                  <Textarea
                    rows={2}
                    value={inputs.egDesc}
                    onChange={(e) => updateInput("egDesc", e.target.value)}
                    disabled={isBusy}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">
                    EG justification remarks (Q12b_Jus)
                  </Label>
                  <Textarea
                    rows={3}
                    value={inputs.Q12b_Jus}
                    onChange={(e) => updateInput("Q12b_Jus", e.target.value)}
                    disabled={isBusy}
                    placeholder="Existing EG remarks on this case (may be empty)."
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Existing remarks from the EG form. Feeds AI generation and
                    is saved back to the EG form when you save or confirm.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={runGenerate}
              disabled={isBusy || !selectedCase}
              className="gap-1"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasGeneratedOnce ? (
                <RefreshCw className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGenerating
                ? "Generating..."
                : hasGeneratedOnce
                  ? "Regenerate with AI"
                  : "Generate with AI"}
            </Button>
            <p className="text-xs text-muted-foreground">
              You can also write or edit the justification directly below.
            </p>
          </div>

          <Separator />

          {/* Justification draft */}
          <div className="space-y-2">
            <Label htmlFor="justification-draft" className="text-sm">
              {hasSaved && !hasGeneratedOnce
                ? "Existing justification (edit before saving or confirming)"
                : "Justification"}
            </Label>
            <Textarea
              id="justification-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a justification, or click Generate with AI..."
              rows={12}
              className="text-sm min-h-[220px]"
              disabled={isUpdating || isSavingDraft}
            />
          </div>

          {/* Advisory AI-decision panel. Read-only — Approve/Reject click still governs. */}
          {hasGeneratedOnce && aiAdvice && (
            <div
              ref={adviceRef}
              className={cn(
                "rounded-lg border p-3 text-xs space-y-1",
                aiAgrees
                  ? "border-success/40 bg-success/5"
                  : "border-amber-400/60 bg-amber-50 dark:bg-amber-950/20",
              )}
              data-testid="ai-advice-panel"
            >
              <div className="flex items-center gap-2 flex-wrap">
                {aiAgrees ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span className="font-medium">
                  AI recommendation:
                </span>
                <Badge
                  variant={aiAgrees ? "default" : "outline"}
                  className={cn(
                    aiAgrees && "bg-success text-success-foreground",
                    !aiAgrees && "border-amber-500 text-amber-700",
                  )}
                >
                  {aiAdvice.decision || "—"}
                </Badge>
                <span className="text-muted-foreground">(advisory)</span>
              </div>
              {aiAdvice.reasoning && (
                <p className="text-muted-foreground leading-relaxed">
                  {aiAdvice.reasoning}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground italic">
                {aiAgrees
                  ? "AI agrees with your selected decision. Your click still decides."
                  : `AI leans ${aiAdvice.decision}; you selected ${
                      decision === "approved" ? "Approve" : "Reject"
                    }. Your click still decides.`}
              </p>
            </div>
          )}

          {/* Decision toggle — placed after the AI advisory so the reviewer
              reads the recommendation first, then picks. */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Your decision</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={decision === "rejected" ? "destructive" : "outline"}
                onClick={() => setDecision("rejected")}
                disabled={isBusy}
                className={cn(
                  "gap-2",
                  decision !== "rejected" &&
                    "border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground",
                )}
              >
                <XCircle className="w-4 h-4" />
                Reject
              </Button>
              <Button
                type="button"
                variant={decision === "approved" ? "default" : "outline"}
                onClick={() => setDecision("approved")}
                disabled={isBusy}
                className={cn(
                  "gap-2",
                  decision === "approved"
                    ? "bg-success hover:bg-success/90 text-success-foreground"
                    : "border-success/50 text-success hover:bg-success hover:text-success-foreground",
                )}
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>
          {onSaveDraft && (
            <Button
              variant="secondary"
              onClick={() => setSaveConfirmOpen(true)}
              disabled={!canSaveDraft}
              className="gap-1"
            >
              {isSavingDraft ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSavingDraft ? "Saving..." : "Save Draft"}
            </Button>
          )}
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              "gap-1",
              decision === "approved" &&
                "bg-success hover:bg-success/90 text-success-foreground",
              decision === "rejected" &&
                "bg-destructive hover:bg-destructive/90",
            )}
          >
            {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
            {`Confirm ${decision === "approved" ? "Approval" : "Rejection"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Override existing EG remarks?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Saving this draft will <strong>overwrite the case&apos;s
                existing Q12b_Jus</strong> with the current text. Any prior
                remarks stored on the case will be replaced.
              </p>
              <p>
                Subsequent Copy / Edit views of this case will populate with the
                new value. The case status will not change — only the
                justification text.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSavingDraft}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSaveDraft}
            disabled={isSavingDraft}
            className="gap-1"
          >
            {isSavingDraft ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSavingDraft ? "Saving..." : "Save & Override"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
