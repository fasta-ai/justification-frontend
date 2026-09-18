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
import { splitProductAndModel } from "@/lib/case-import/normalise";
import { Q12fRejectSelect, rejectReasonHint } from "@/components/eg-field-select";

export interface JustificationInputs {
  PA_PName: string;
  PA_Brand: string;
  PA_Mod_No: string;
  /** Reference-list category (PA_Cat). Boosts same-category similar cases. */
  PA_Cat: string;
  /** The case's own tranche, excluded from similar-case results. */
  tranche: string;
  PA_Elaborate: string;
  egName: string;
  /** EG-form model number / brand. Search keys only — not written back. */
  egModel: string;
  egBrand: string;
  egDesc: string;
  Q12b_Jus: string;
  /** EG decision fields the reviewer fills in (manually or after AI). */
  Q12c_TotC: string;
  Q12d_Quo: string;
  Q12e_JCost: string;
  Q12f_RReject: string;
  Q12g_JRem: string;
}

/** EG decision fields saved back to egData verbatim when edited. */
const EG_DECISION_FIELDS = [
  "Q12c_TotC",
  "Q12d_Quo",
  "Q12e_JCost",
  "Q12f_RReject",
  "Q12g_JRem",
] as const;

/** Edits made in the panel, saved alongside the justification on confirm. */
export interface DecisionDetails {
  egPatch: Record<string, string>;
  applicationPatch: Record<string, unknown>;
}

/**
 * Similar-case search keys taken from the EG form. The record-admin
 * `App_PNam_Mod` holds "<name> / <model>", so it supplies the model (and the
 * name when `App_PName` is blank). The EG form has no brand column, so brand
 * comes from any EG brand field the case carries, else the application's.
 */
export function getEgSearchKeys(c: Case | null | undefined): {
  name: string;
  model: string;
  brand: string;
} {
  const eg = (c?.egData || {}) as Record<string, any>;
  const app = (c?.applicationData || {}) as Record<string, any>;
  const split = splitProductAndModel(eg.App_PNam_Mod);
  return {
    name: String(eg.App_PName || split.productName || eg.App_PNam_Mod || "").trim(),
    model: String(eg.Model_Code || split.modelCode || app.PA_Mod_No || "").trim(),
    brand: String(eg.App_Brand || eg.PA_Brand || app.PA_Brand || "").trim(),
  };
}

/**
 * Catalogue description for a case. `egData.catalogueDesc` is empty on every
 * imported T13 case, but the same text lives under `catalogueData` in one of
 * three shapes depending on which extractor produced it. The similar-case
 * search embeds this alongside the product name, so without it the semantic
 * tier only sees a name.
 */
export function getCatalogueDescription(c: Case | null | undefined): string {
  const cat = (c?.catalogueData || {}) as Record<string, any>;
  return (
    cat.description ||
    cat.catalogue_data?.description ||
    cat.products?.[0]?.description ||
    ""
  );
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

/**
 * Per-generation reviewer inputs, sent alongside the case fields. Separate
 * from `JustificationInputs` because these are not case data — they describe
 * how the reviewer wants THIS generation to go, and are not saved anywhere.
 */
export interface GenerateExtras {
  /** Free text from the "Context for AI" box. Highest-priority prompt input. */
  userContext?: string;
  /** Q12f_RReject as currently selected, so the backend can look up that
   *  reason's worked examples. Only meaningful when the decision is
   *  "rejected"; the backend ignores it otherwise. */
  rejectReason?: string;
  /** Manual decision: skip the similar-case search. The reviewer reached
   *  Manual precisely because no similar case fits, so the round trip is
   *  latency spent on context the prompt would mostly disregard. */
  manual?: boolean;
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
    extras?: GenerateExtras,
  ) => Promise<GenerateResult | string>;
  onConfirm: (
    justification: string,
    decision: "approved" | "rejected",
    details?: DecisionDetails,
  ) => Promise<void> | void;
  onSaveDraft?: (payload: SaveDraftPayload) => Promise<void> | void;
  /** Manual decision: no AI generation, details panel open — the reviewer
   *  enters the case details and justification themselves. */
  manual?: boolean;
}

/**
 * Props for the embeddable justification workspace. `open` mirrors the host
 * dialog's open state so the reset/prefill effects fire when the host opens;
 * `onClose` is invoked by the Cancel button.
 */
export interface JustificationPanelProps {
  /** Hide the EG decision fields — the host (copy dialog) already shows them. */
  hideDecisionDetails?: boolean;
  /** The EG form's Q12b_Jus as the host currently holds it. When it changes
   *  and the reviewer hasn't written or generated anything, the draft follows
   *  it — the EG form and this panel are the same field. */
  externalJustification?: string;
  /** Bumped by the host to force adoption ("Use this text"), even once the
   *  reviewer has edited the draft. */
  externalJustificationVersion?: number;
  /** Fires when the reviewer types or generates, so the host can mirror the
   *  text back into its own EG form row. */
  onDraftChange?: (text: string) => void;
  /** Hide the duplicate "EG justification remarks" input — the host shows
   *  that field itself. */
  hideEgRemarksInput?: boolean;
  /** Q12f_RReject as the host currently holds it. Required whenever
   *  `hideDecisionDetails` is set: the host then owns the rejection-reason
   *  picker, so the panel's own `inputs.Q12f_RReject` goes stale the moment
   *  the reviewer changes it, and generation would look up the wrong
   *  reason's examples. */
  externalRejectReason?: string;
  open: boolean;
  onClose: () => void;
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
    extras?: GenerateExtras,
  ) => Promise<GenerateResult | string>;
  onConfirm: (
    justification: string,
    decision: "approved" | "rejected",
    details?: DecisionDetails,
  ) => Promise<void> | void;
  onSaveDraft?: (payload: SaveDraftPayload) => Promise<void> | void;
  /** Manual decision: no AI generation, details panel open — the reviewer
   *  enters the case details and justification themselves. */
  manual?: boolean;
}

function extractInputs(c: Case | null): JustificationInputs {
  if (!c) {
    return {
      PA_PName: "",
      PA_Brand: "",
      PA_Mod_No: "",
      PA_Cat: "",
      tranche: "",
      PA_Elaborate: "",
      egName: "",
      egModel: "",
      egBrand: "",
      egDesc: "",
      Q12b_Jus: "",
      Q12c_TotC: "",
      Q12d_Quo: "",
      Q12e_JCost: "",
      Q12f_RReject: "",
      Q12g_JRem: "",
    };
  }
  const app = (c.applicationData || {}) as Record<string, string>;
  const eg = (c.egData || {}) as Record<string, string>;
  const egKeys = getEgSearchKeys(c);
  const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
  return {
    PA_PName: app.PA_PName || "",
    PA_Brand: app.PA_Brand || "",
    PA_Mod_No: app.PA_Mod_No || "",
    PA_Cat: app.PA_Cat || "",
    tranche: c.tranche || "",
    PA_Elaborate: app.PA_Elaborate || app.PA_Justify || "",
    egName: eg.App_PName || eg.App_PNam_Mod || "",
    egModel: egKeys.model,
    egBrand: egKeys.brand,
    egDesc: eg.catalogueDesc || getCatalogueDescription(c),
    Q12b_Jus: eg.Q12b_Jus || "",
    Q12c_TotC: str(eg.Q12c_TotC),
    Q12d_Quo: str(eg.Q12d_Quo),
    Q12e_JCost: str(eg.Q12e_JCost),
    Q12f_RReject: str(eg.Q12f_RReject),
    Q12g_JRem: str(eg.Q12g_JRem),
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
  manual = false,
}: JustificationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {manual ? "Manual decision" : "Justification"} — Case{" "}
            {selectedCase?.caseNumber || ""}
          </DialogTitle>
          <DialogDescription>
            {manual
              ? "Enter the case details and your own justification, then confirm. No similar-case search or AI is used."
              : "Review the fields the AI will use, generate a draft, edit it, then save as a draft or confirm your decision."}
          </DialogDescription>
        </DialogHeader>
        <JustificationPanel
          open={open}
          onClose={() => onOpenChange(false)}
          selectedCase={selectedCase}
          initialDecision={initialDecision}
          seedSimilarCase={seedSimilarCase}
          isGenerating={isGenerating}
          isUpdating={isUpdating}
          isSavingDraft={isSavingDraft}
          onGenerate={onGenerate}
          onConfirm={onConfirm}
          onSaveDraft={onSaveDraft}
          manual={manual}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Embeddable justification workspace: inputs, AI generation, draft editing,
 * advisory panel, decision toggle and footer actions. Rendered standalone by
 * JustificationModal and side-by-side with the copy dialog.
 */
export function JustificationPanel({
  open,
  onClose,
  selectedCase,
  initialDecision,
  seedSimilarCase,
  isGenerating,
  isUpdating,
  isSavingDraft = false,
  onGenerate,
  onConfirm,
  onSaveDraft,
  manual = false,
  hideDecisionDetails = false,
  externalJustification,
  externalJustificationVersion,
  onDraftChange,
  hideEgRemarksInput = false,
  externalRejectReason,
}: JustificationPanelProps) {
  const [decision, setDecision] = useState<"approved" | "rejected">(
    initialDecision,
  );
  const [inputs, setInputs] = useState<JustificationInputs>(() =>
    extractInputs(selectedCase),
  );
  const [draft, setDraft] = useState<string>(selectedCase?.justification || "");
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  // True once the reviewer types or generates. Guards the EG-form mirror so
  // their own text is never replaced without asking.
  const [draftTouched, setDraftTouched] = useState(false);
  const [showInputs, setShowInputs] = useState(false);
  // Free-text steer for the next generation. Deliberately not part of
  // `inputs`: it is never saved to the case, and it resets with the panel.
  const [userContext, setUserContext] = useState("");
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
    setDraftTouched(false);
    // Collapsed by default, in both flows. The details are long enough to
    // push the context box and draft below the fold, and the reviewer reaches
    // for them only when a value needs correcting.
    setShowInputs(false);
    setUserContext("");
    setAiAdvice(null);
    initialInputsRef.current = nextInputs;
    initialDraftRef.current = nextDraft;
    prefillKeyRef.current = "";
  }, [open, selectedCase?.id, initialDecision, manual]);

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
    setDraftTouched(false);

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

  // Mirror the host's EG-form justification into the draft: they are one
  // field. Adoption is deliberately conservative — only when the reviewer has
  // not typed or generated, so their work is never overwritten silently. The
  // host bumps `externalJustificationVersion` for an explicit "Use this text",
  // which adopts regardless. Never adopts on mount: a seeded panel starts
  // blank on purpose so the reviewer generates for THAT seed.
  const externalTextRef = useRef<string | undefined>(externalJustification);
  const externalVersionRef = useRef<number | undefined>(
    externalJustificationVersion,
  );
  useEffect(() => {
    const previousText = externalTextRef.current;
    const previousVersion = externalVersionRef.current;
    externalTextRef.current = externalJustification;
    externalVersionRef.current = externalJustificationVersion;
    if (externalJustification === undefined) return;
    const forced =
      externalJustificationVersion !== undefined &&
      externalJustificationVersion !== previousVersion;
    const changed =
      previousText !== undefined && previousText !== externalJustification;
    if (!forced && !(changed && !draftTouched)) return;
    setDraft(externalJustification);
  }, [externalJustification, externalJustificationVersion, draftTouched]);

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

  // The rejection reason driving generation. When the host owns the picker
  // (hideDecisionDetails), its value is authoritative — `inputs.Q12f_RReject`
  // is only a snapshot taken when the panel mounted.
  const effectiveRejectReason =
    hideDecisionDetails && externalRejectReason !== undefined
      ? externalRejectReason
      : inputs.Q12f_RReject;

  const reasonHint = useMemo(
    () =>
      decision === "rejected" ? rejectReasonHint(effectiveRejectReason) : null,
    [decision, effectiveRejectReason],
  );

  const updateInput = <K extends keyof JustificationInputs>(
    key: K,
    value: JustificationInputs[K],
  ) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const runGenerate = async () => {
    const result = await onGenerate(inputs, decision, seedSimilarCase, {
      userContext,
      rejectReason: effectiveRejectReason,
      manual,
    });
    // Backwards-compat: onGenerate used to return a plain string. Handle both.
    const text = typeof result === "string" ? result : result?.text || "";
    const aiDecision =
      typeof result === "string" ? undefined : result?.aiDecision;
    const aiReasoning =
      typeof result === "string" ? undefined : result?.aiReasoning;
    if (text.length > 0) {
      setDraft(text);
      setDraftTouched(true);
      onDraftChange?.(text);
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
    // Save the details the reviewer entered alongside the decision, so a
    // manual approval/rejection keeps them (and the saved copy of the case).
    await onConfirm(draft, decision, {
      egPatch: buildEgPatch(),
      applicationPatch: buildApplicationPatch(),
    });
  };

  const buildEgPatch = (): Record<string, string> => {
    const init = initialInputsRef.current;
    const patch: Record<string, string> = {};
    // With the host showing Q12b_Jus itself, the draft is the only source —
    // confirm / save-draft write it, so don't also patch from the hidden input.
    if (!hideEgRemarksInput && inputs.Q12b_Jus !== init.Q12b_Jus) {
      patch.Q12b_Jus = inputs.Q12b_Jus;
    }
    for (const field of EG_DECISION_FIELDS) {
      if (inputs[field] !== init[field]) patch[field] = inputs[field];
    }
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

  /** Rendered in one of two positions depending on the flow — see the two
   *  call sites below. Defined once so they cannot drift apart. */
  const decisionToggle = (
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
  );

  return (
    <>
    <div className="flex flex-col flex-1 min-h-0">
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
              {manual ? "Case details" : "Inputs used for AI generation"}
            </button>
            {showInputs && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">EG model no. (search key)</Label>
                  <Input
                    value={inputs.egModel}
                    onChange={(e) => updateInput("egModel", e.target.value)}
                    disabled={isBusy}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">EG brand (search key)</Label>
                  <Input
                    value={inputs.egBrand}
                    onChange={(e) => updateInput("egBrand", e.target.value)}
                    disabled={isBusy}
                  />
                </div>
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
                {!hideEgRemarksInput && (
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
                )}
              </div>
            )}
          </div>

          {/* EG decision fields — saved to the EG form on confirm / save. */}
          {!hideDecisionDetails && (
          <div className="space-y-2">
            <p className="text-sm font-medium">EG decision details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Total cost (Q12c_TotC)</Label>
                <Input
                  value={inputs.Q12c_TotC}
                  onChange={(e) => updateInput("Q12c_TotC", e.target.value)}
                  disabled={isBusy}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quotation (Q12d_Quo)</Label>
                <Input
                  value={inputs.Q12d_Quo}
                  onChange={(e) => updateInput("Q12d_Quo", e.target.value)}
                  disabled={isBusy}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Cost justification (Q12e_JCost)</Label>
                <Textarea
                  rows={2}
                  value={inputs.Q12e_JCost}
                  onChange={(e) => updateInput("Q12e_JCost", e.target.value)}
                  disabled={isBusy}
                />
              </div>
              {decision === "rejected" && (
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Rejection reason (Q12f_RReject)</Label>
                  <Q12fRejectSelect
                    value={inputs.Q12f_RReject}
                    onChange={(next) => updateInput("Q12f_RReject", next)}
                  />
                </div>
              )}
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Remarks (Q12g_JRem)</Label>
                <Textarea
                  rows={2}
                  value={inputs.Q12g_JRem}
                  onChange={(e) => updateInput("Q12g_JRem", e.target.value)}
                  disabled={isBusy}
                />
              </div>
            </div>
          </div>
          )}

          {/* Manual: decide first. The decision is the reviewer's own — there
              is no similar case to seed it — and it selects the context
              placeholder, the rejection-reason examples and the shape the
              generation follows, so it has to be settled before generating. */}
          {manual && decisionToggle}

          {/* The reviewer's steer for the next generation, kept directly
              above the draft so it reads as "here's my steer → here's the
              result". Shown in both flows: a chosen similar case sets the
              shape, but only the reviewer can supply what the case data
              doesn't carry. */}
          <div className="space-y-2">
            <Label htmlFor="justification-context" className="text-sm">
              Context for AI{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="justification-context"
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              placeholder={
                decision === "rejected"
                  ? "e.g. certificate lists a different model number"
                  : "e.g. integrates with the existing nurse-call system"
              }
              rows={3}
              className="text-sm"
              disabled={isBusy}
            />
            {decision === "rejected" ? (
              reasonHint ? (
                <p className="text-[11px] text-muted-foreground">
                  Rejection reason {reasonHint.key} —{" "}
                  <span className="font-medium">{reasonHint.direction}</span>.{" "}
                  {reasonHint.examples} past justification
                  {reasonHint.examples === 1 ? "" : "s"} written under this
                  reason will steer the wording.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  No standing rejection reason selected (Q12f_RReject), so there
                  are no worked examples to follow — the wording will rest on
                  the case data and anything you add here.
                </p>
              )
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Generation also draws on the catalogue description, PA_Cat and
                the rest of the case details above.
              </p>
            )}
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
              onChange={(e) => {
                setDraft(e.target.value);
                setDraftTouched(true);
                onDraftChange?.(e.target.value);
              }}
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

          {/* In the copy flow the toggle sits after the AI advisory, so the
              reviewer reads the recommendation before picking. Manual has no
              advisory to read, and the decision drives the context
              placeholder and the rejection-reason hint, so it moves above
              them instead. */}
          {!manual && decisionToggle}
        </div>

        <DialogFooter className="pt-2 border-t gap-2">
          <Button
            variant="outline"
            onClick={onClose}
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
    </div>

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
