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
  ClipboardCopy,
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
  /** The EG form's Q12b_Jus as the host currently holds it. The officer's
   *  12(b) field in this panel is the same field: when the host value changes
   *  and the officer hasn't typed here, the panel follows it. AI output never
   *  flows through this — it lives in the separate AI suggestion panel. */
  externalJustification?: string;
  /** Bumped by the host to force adoption ("Use this text"), even once the
   *  reviewer has edited the draft. */
  externalJustificationVersion?: number;
  /** Fires when the officer's 12(b) changes (typing, or an explicit "Copy AI
   *  text into my 12(b)"), so the host can mirror it into its EG form row.
   *  Never fires on Generate. */
  onDraftChange?: (text: string) => void;
  /** Fires with the selected decision (and whenever it changes), so a host
   *  showing EG fields can prefill the ones the decision determines — Q12a
   *  above all — instead of displaying an answer from an earlier decision. */
  onDecisionChange?: (decision: "approved" | "rejected") => void;
  /** Kept for API compatibility. The officer's 12(b) field in this panel is
   *  the Q12b_Jus input, so there is no separate remarks input any more. */
  hideEgRemarksInput?: boolean;
  /** Q12f_RReject as the host currently holds it. Required whenever
   *  `hideDecisionDetails` is set: the host then owns the rejection-reason
   *  picker, so the panel's own `inputs.Q12f_RReject` goes stale the moment
   *  the reviewer changes it, and generation would look up the wrong
   *  reason's examples. */
  externalRejectReason?: string;
  /** The host has unsaved field edits of its own (pending copies in the
   *  dialog's left column). Enables Save Draft even when nothing in this
   *  panel changed, so those edits are not stranded behind a disabled
   *  button. */
  externalDirty?: boolean;
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

/**
 * The officer's own 12(b) as stored on the case. The EG form's Q12b_Jus is
 * the record; `case.justification` mirrors it on confirm and is the fallback
 * for cases decided before that mirror existed.
 */
export function officerQ12bFor(c: Case | null | undefined): string {
  if (!c) return "";
  const eg = (c.egData || {}) as Record<string, unknown>;
  const q12b = eg.Q12b_Jus;
  if (typeof q12b === "string" && q12b.trim().length > 0) return q12b;
  return c.justification || "";
}

/**
 * Put AI reference text into the officer's 12(b). Never destructive: an
 * empty field takes the AI text as-is, otherwise it is appended below what
 * the officer already wrote so nothing they typed is lost.
 */
export function insertAiTextIntoQ12b(officerText: string, aiText: string): string {
  const ai = aiText.trim();
  if (!ai) return officerText;
  if (officerText.trim().length === 0) return ai;
  if (officerText.includes(ai)) return officerText;
  return `${officerText.replace(/\s+$/, "")}\n\n${ai}`;
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
      <DialogContent className="sm:max-w-[1100px] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {manual ? "Manual decision" : "Justification"} — Case{" "}
            {selectedCase?.caseNumber || ""}
          </DialogTitle>
          <DialogDescription>
            {manual
              ? "Enter the case details and your own justification, then confirm. No similar-case search or AI is used."
              : "Write your 12(b) justification. The AI suggestion is shown separately as a reference only — it is never saved as 12(b) unless you copy it in."}
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
  onDecisionChange,
  hideEgRemarksInput = false,
  externalRejectReason,
  externalDirty = false,
}: JustificationPanelProps) {
  const [decision, setDecision] = useState<"approved" | "rejected">(
    initialDecision,
  );
  // Report the decision up on mount and on every change, so a host rendering
  // the EG fields can keep Q12a and the rejection reason in step with it.
  useEffect(() => {
    onDecisionChange?.(decision);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision]);
  const [inputs, setInputs] = useState<JustificationInputs>(() =>
    extractInputs(selectedCase),
  );
  // `draft` is the OFFICER'S 12(b) — their own manual text and the single
  // source of truth for Q12b_Jus / case.justification on confirm and save.
  // AI output never writes here; it goes to `aiSuggestion` (reference only)
  // and reaches the officer's field only through "Copy AI text into my 12(b)".
  const [draft, setDraft] = useState<string>(() => officerQ12bFor(selectedCase));
  const [aiSuggestion, setAiSuggestion] = useState<string>("");
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  /** Why the last Generate produced nothing, shown under the button. */
  const [generateError, setGenerateError] = useState<string | null>(null);
  // True once the officer types (or copies AI text in). Guards the EG-form
  // mirror so their own text is never replaced without asking.
  const [draftTouched, setDraftTouched] = useState(false);
  const [showInputs, setShowInputs] = useState(false);
  // Free-text steer for the next generation. Deliberately not part of
  // `inputs`: it is never saved to the case, and it resets with the panel.
  const [userContext, setUserContext] = useState("");
  const [aiAdvice, setAiAdvice] = useState<{
    decision: string;
    reasoning: string;
  } | null>(null);

  // Snapshots for dirty tracking — captured whenever we (re)open on a case.
  const initialInputsRef = useRef<JustificationInputs>(extractInputs(selectedCase));
  const initialDraftRef = useRef<string>(officerQ12bFor(selectedCase));
  const adviceRef = useRef<HTMLDivElement | null>(null);
  // Tracks the most recent (case, seed, decision) triple we prefilled for, so
  // we don't clobber an in-progress edit when React re-runs the effect.
  const prefillKeyRef = useRef<string>("");

  // Reset internal state whenever the modal is (re)opened or the case changes.
  useEffect(() => {
    if (!open) return;
    const nextInputs = extractInputs(selectedCase);
    // The officer's 12(b): the host's live EG row when it owns the field
    // (copy dialog — may hold unsaved typing), else the case's stored 12(b).
    const nextDraft =
      externalJustification !== undefined
        ? externalJustification
        : officerQ12bFor(selectedCase);
    setDecision(initialDecision);
    setInputs(nextInputs);
    setDraft(nextDraft);
    setAiSuggestion("");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedCase?.id, initialDecision, manual]);

  // Prefill the AI SUGGESTION panel (never the officer's 12(b)) from the LAST
  // stored generation for this (case × decision × seed) triple. Every
  // generation is persisted server-side in `justification_generations`, so
  // reopening the same reference shows the same AI text without regenerating.
  // Switching seed/decision clears the suggestion and reloads the matching
  // cached one, if any. The officer's own text is left exactly as it is.
  useEffect(() => {
    if (!open || !selectedCase?.id) return;
    const seedId = seedSimilarCase?.id || "none";
    const key = `${selectedCase.id}::${decision}::${seedId}`;
    // Guard: don't re-run for the same triple within this open session.
    if (prefillKeyRef.current === key) return;
    prefillKeyRef.current = key;

    setAiSuggestion("");
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
          setAiSuggestion((current) => (current.trim().length === 0 ? gen : current));
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
  }, [open, selectedCase?.id, decision, seedSimilarCase?.id]);

  // Mirror the host's EG-form Q12b_Jus into the officer's 12(b): they are one
  // field. Adoption is deliberately conservative — only when the officer has
  // not typed here, so their work is never overwritten silently. The host
  // bumps `externalJustificationVersion` for an explicit "Use in
  // justification", which adopts regardless. An EMPTY field always adopts:
  // there is no work to protect, and Confirm is gated on this field.
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
    const draftIsEmpty = draft.trim().length === 0;
    if (!forced && !(changed && (!draftTouched || draftIsEmpty))) return;
    setDraft(externalJustification);
  }, [externalJustification, externalJustificationVersion, draftTouched, draft]);

  const hasSaved = Boolean(selectedCase?.justification?.trim());
  /**
   * The decision already recorded on this case, if any. `pending` and
   * `under_review` are not decisions — there is nothing to show for them.
   */
  const recordedDecision: "approved" | "rejected" | null =
    selectedCase?.status === "approved" || selectedCase?.status === "rejected"
      ? selectedCase.status
      : null;
  const isBusy = isGenerating || isUpdating || isSavingDraft;
  // Gated on the OFFICER'S 12(b) only — an AI suggestion alone can never be
  // confirmed as the case's 12(b).
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
    !!selectedCase && !!onSaveDraft && (isDirty || externalDirty) && !isBusy;

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
    setGenerateError(null);
    let result: GenerateResult | string;
    try {
      // The AI sees the officer's current 12(b) as the existing remarks.
      result = await onGenerate({ ...inputs, Q12b_Jus: draft }, decision, seedSimilarCase, {
        userContext,
        rejectReason: effectiveRejectReason,
        manual,
      });
    } catch (err) {
      // The host already toasts; keep the reason next to the button too, so
      // a failed generation never looks like "nothing happened".
      setGenerateError(
        err instanceof Error && err.message
          ? err.message
          : "Generation failed. Please try again.",
      );
      return;
    }
    // Backwards-compat: onGenerate used to return a plain string. Handle both.
    const text = typeof result === "string" ? result : result?.text || "";
    if (text.trim().length === 0) {
      setGenerateError(
        "The AI returned no text. Try again; if it keeps happening, the generation service log has the reason.",
      );
      return;
    }
    const aiDecision =
      typeof result === "string" ? undefined : result?.aiDecision;
    const aiReasoning =
      typeof result === "string" ? undefined : result?.aiReasoning;
    if (text.length > 0) {
      // Reference only: the officer's 12(b) (`draft`) is NOT touched.
      setAiSuggestion(text);
      setHasGeneratedOnce(true);
      if (aiDecision) {
        setAiAdvice({ decision: aiDecision, reasoning: aiReasoning || "" });
      } else {
        setAiAdvice(null);
      }
    }
  };

  /** Explicit opt-in: put the AI suggestion into the officer's 12(b). */
  const copyAiIntoQ12b = () => {
    if (!aiSuggestion.trim()) return;
    const next = insertAiTextIntoQ12b(draft, aiSuggestion);
    setDraft(next);
    setDraftTouched(true);
    onDraftChange?.(next);
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
    // Q12b_Jus is deliberately absent: the officer's 12(b) field (`draft`) is
    // the only source, and the host writes it on confirm / save draft.
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
    await onSaveDraft({
      // Both are the OFFICER'S 12(b). The AI suggestion is never saved here.
      justification: draft,
      q12bJus: draft,
      egPatch: buildEgPatch(),
      applicationPatch: buildApplicationPatch(),
    });
  };

  /** Rendered in one of two positions depending on the flow — see the two
   *  call sites below. Defined once so they cannot drift apart. */
  const decisionToggle = (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-medium">Your decision</p>
        {/* The decision already on the case. Without it the toggle reads as a
            blank slate, and a decided case opening on the opposite choice is
            one click from being flipped by someone who only meant to edit the
            justification. */}
        {recordedDecision && (
          <Badge
            variant={recordedDecision === "approved" ? "default" : "destructive"}
            className={cn(
              recordedDecision === "approved" &&
                "bg-success text-success-foreground",
            )}
          >
            Currently {recordedDecision}
          </Badge>
        )}
      </div>
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
      {recordedDecision && decision !== recordedDecision && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Confirming changes this case from {recordedDecision} to {decision}.
        </p>
      )}
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
            {generateError && (
              <p
                role="alert"
                className="text-xs text-destructive whitespace-pre-wrap"
              >
                {generateError}
              </p>
            )}
          </div>

          <Separator />

          {/* Officer's 12(b) (left) and the AI suggestion (right) are two
              separate areas. Only the officer's text is ever saved as 12(b);
              the AI text is a reference and reaches 12(b) only through the
              explicit "Copy AI text into my 12(b)" button. */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            <div className="space-y-2" data-testid="officer-q12b-section">
              <div className="flex items-center gap-2 flex-wrap">
                <Label htmlFor="justification-draft" className="text-sm">
                  Your 12(b) justification
                </Label>
                <Badge variant="secondary" className="text-[10px]">
                  saved as Q12b_Jus
                </Badge>
              </div>
              <Textarea
                id="justification-draft"
                data-testid="officer-q12b"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setDraftTouched(true);
                  onDraftChange?.(e.target.value);
                }}
                placeholder="Write the 12(b) justification in your own words. This is what will be recorded."
                rows={12}
                className="text-sm min-h-[220px]"
                disabled={isUpdating || isSavingDraft}
              />
              <p className="text-[11px] text-muted-foreground">
                This is the final 12(b). Confirm and Save Draft record exactly
                this text.
              </p>
            </div>

            <div
              className="space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3"
              data-testid="ai-suggestion-panel"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">AI suggestion</span>
                <Badge variant="outline" className="text-[10px]">
                  reference only — not saved as 12(b)
                </Badge>
              </div>
              {aiSuggestion.trim().length > 0 ? (
                <>
                  <div
                    data-testid="ai-suggestion-text"
                    aria-readonly="true"
                    className="text-sm whitespace-pre-wrap rounded-md border bg-background p-2 max-h-[260px] overflow-y-auto"
                  >
                    {aiSuggestion}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyAiIntoQ12b}
                    disabled={isBusy}
                    className="gap-1"
                    data-testid="copy-ai-to-q12b"
                  >
                    <ClipboardCopy className="w-4 h-4" />
                    Copy AI text into my 12(b)
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Copying adds the AI text to your 12(b) (below anything you
                    have already written). You can edit it afterwards.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Click &ldquo;Generate with AI&rdquo; for a suggested
                  wording. It appears here for reference and does not change
                  your 12(b).
                </p>
              )}
            </div>
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
              onClick={handleSaveDraft}
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

    </>
  );
}
