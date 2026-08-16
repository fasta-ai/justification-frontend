"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  ChevronLeft,
  History,
  RotateCcw,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { StaffSelect } from "@/components/staff-select";
import {
  JustificationPanel,
  type JustificationPanelProps,
} from "@/components/justification-modal";
import {
  Q12aSelect,
  Q12fRejectSelect,
  normalizeNaLike,
} from "@/components/eg-field-select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useReplaceFromSimilar } from "@/hooks/use-replace-from-similar";
import { useCaseAuditLogs } from "@/hooks/use-case-audit-logs";
import type { Case, CaseAuditLogEntry } from "@/app/api/cases/types";
import type {
  SimilarJustification,
  FieldReplacement,
  ReplacementSection,
} from "@/lib/types";
import {
  resolveSourceValue,
  resolveTargetSlot,
} from "@/lib/case-field-mapping";

interface SimilarCaseReplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalCase: Case | null;
  similarCase: SimilarJustification | null;
  onSuccess?: () => void;
  /**
   * When provided, the dialog widens into a two-column layout: the copy
   * workflow on the left and a justification workspace (seeded with the
   * similar case) on the right, so reviewers can reference the justification
   * while choosing fields to copy. Carries the generate/confirm/save-draft
   * handlers from the host page.
   */
  justification?: Pick<
    JustificationPanelProps,
    | "isGenerating"
    | "isUpdating"
    | "isSavingDraft"
    | "onGenerate"
    | "onConfirm"
    | "onSaveDraft"
  >;
}

// Fields shown in the EG-form copy tab. These are the *metadata* keys as they
// appear on a similar case's dataset. Renames, legacy aliases and constant
// filtering are centralised in `lib/case-field-mapping.ts`; consult that
// module when adding or renaming a field.
const egFields = [
  "Ref",
  "Tranche",
  "EB_RM",
  "NO",
  "NO_R",
  "Staff1",
  "Staff2",
  "Staff1_Info",
  "Staff2_Info",
  "Applicant",
  "App_PName",
  "D_ReqF_SWD",
  "D_PlnT_SWD",
  "SWD_Off_N",
  "SWD_Off_P",
  "SWD_Off_I",
  "Q12a",
  "Q12b_Jus",
  "Q12c_TotC",
  "Q12d_Quo",
  "Q12e_JCost",
  "Q12f_RReject",
  "Q12g_JRem",
];

const appFields = [
  "PA_RefL",
  "PA_Cat",
  "PA_PName",
  "PA_Brand",
  "PA_Mod_No",
  "TotAmtR",
  "Prof_Staff",
  "Typ_Staff",
  "Staff_Avail",
  "No_Elderly",
  "No_Disable",
  "No_Bene",
  "Typ_Disability",
  "PA_Elaborate",
  "PA_Justify",
];

const catalogueFields = [
  "product_name",
  "model",
  "product_size",
  "usage_capacity",
  "description",
];

const sectionLabels: Record<ReplacementSection, string> = {
  eg: "EG Form",
  application: "Application",
  catalogue: "Catalogue",
};

function formatValue(value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  const s = String(value);
  if (s.toLowerCase() === "nan") return "NA";
  return s;
}

function toEditString(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function getSourceValue(
  section: ReplacementSection,
  fieldName: string,
  metadata: Record<string, any>,
): any {
  return normalizeNaLike(resolveSourceValue(section, fieldName, metadata));
}

function getOriginalValue(
  section: ReplacementSection,
  fieldName: string,
  originalCase: Case,
): any {
  const target = resolveTargetSlot(section, fieldName);
  let raw: any;
  if (target.section === "eg") raw = originalCase.egData?.[target.fieldName];
  else if (target.section === "application")
    raw = originalCase.applicationData?.[target.fieldName];
  else if (target.section === "catalogue") {
    const catData = originalCase.catalogueData || {};
    if (Array.isArray(catData.products) && catData.products.length > 0) {
      raw = catData.products[0][target.fieldName];
    } else {
      raw = catData[target.fieldName];
    }
  }
  return normalizeNaLike(raw);
}

function getSectionIcon(section: ReplacementSection | "case") {
  switch (section) {
    case "eg":
      return "EG";
    case "application":
      return "APP";
    case "catalogue":
      return "CAT";
    case "case":
      return "CASE";
  }
}

export function SimilarCaseReplaceDialog({
  open,
  onOpenChange,
  originalCase,
  similarCase,
  onSuccess,
  justification,
}: SimilarCaseReplaceDialogProps) {
  const { user } = useAuth();
  const { replaceFromSimilar, isLoading } = useReplaceFromSimilar();
  const { logs: auditLogs, fetchAuditLogs, isLoading: isLoadingAuditLogs } =
    useCaseAuditLogs();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [replacements, setReplacements] = useState<FieldReplacement[]>([]);
  const [activeTab, setActiveTab] = useState<ReplacementSection>("eg");

  const fieldGroups: { section: ReplacementSection; fields: string[] }[] = useMemo(
    () => [
      { section: "eg", fields: egFields },
      { section: "application", fields: appFields },
      { section: "catalogue", fields: catalogueFields },
    ],
    [],
  );

  const selectedKeys = useMemo(
    () => new Set(replacements.map((r) => `${r.section}:${r.fieldName}`)),
    [replacements],
  );

  useEffect(() => {
    if (open && originalCase?.id) {
      fetchAuditLogs(originalCase.id);
    }
  }, [open, originalCase?.id, fetchAuditLogs]);

  useEffect(() => {
    if (!open) {
      setReplacements([]);
      setStep(1);
      setActiveTab("eg");
    }
  }, [open]);

  function isCopied(section: ReplacementSection, fieldName: string) {
    return selectedKeys.has(`${section}:${fieldName}`);
  }

  function getCopiedValue(section: ReplacementSection, fieldName: string): any {
    return replacements.find(
      (r) => r.section === section && r.fieldName === fieldName,
    )?.value;
  }

  function handleUseValue(
    section: ReplacementSection,
    fieldName: string,
    value: any,
  ) {
    setReplacements((prev) =>
      prev.some((r) => r.section === section && r.fieldName === fieldName)
        ? prev.map((r) =>
            r.section === section && r.fieldName === fieldName
              ? { ...r, value }
              : r,
          )
        : [...prev, { section, fieldName, value }],
    );
  }

  function handleEditValue(
    section: ReplacementSection,
    fieldName: string,
    value: string,
  ) {
    setReplacements((prev) =>
      prev.map((replacement) =>
        replacement.section === section &&
        replacement.fieldName === fieldName
          ? { ...replacement, value }
          : replacement,
      ),
    );
  }

  function handleUseAllInSection(section: ReplacementSection) {
    if (!similarCase?.metadata || !originalCase) return;

    const fields =
      section === "eg"
        ? egFields
        : section === "application"
          ? appFields
          : catalogueFields;

    setReplacements((prev) => {
      const withoutSection = prev.filter((r) => r.section !== section);
      const sectionReplacements = fields
        .map((fieldName) => ({
          section,
          fieldName,
          value: getSourceValue(section, fieldName, similarCase.metadata),
        }))
        .filter(
          (r) =>
            r.value !== undefined &&
            r.value !== null &&
            r.value !== "" &&
            formatValue(r.value) !==
              formatValue(getOriginalValue(section, r.fieldName, originalCase)),
        );
      return [...withoutSection, ...sectionReplacements];
    });
  }

  function handleRestore(section: ReplacementSection, fieldName: string) {
    setReplacements((prev) =>
      prev.filter(
        (r) => !(r.section === section && r.fieldName === fieldName),
      ),
    );
  }

  function handleRestoreAllInSection(section: ReplacementSection) {
    setReplacements((prev) => prev.filter((r) => r.section !== section));
  }

  async function handleConfirm() {
    if (!originalCase || !similarCase || replacements.length === 0) return;

    // Translate metadata keys to their real target section/field on the
    // case before sending to backend. Backend writes blindly to
    // `<section>Data[fieldName]`, so mapping happens here. Rules live in
    // lib/case-field-mapping.ts.
    const backendReplacements: FieldReplacement[] = replacements.map((r) => {
      const target = resolveTargetSlot(r.section, r.fieldName);
      if (target.section === r.section && target.fieldName === r.fieldName) {
        return r;
      }
      return { section: target.section, fieldName: target.fieldName, value: r.value };
    });

    const result = await replaceFromSimilar(originalCase.id, {
      sourceDatasetId: similarCase.id,
      replacements: backendReplacements,
    });

    if (result.success) {
      if (originalCase.id) {
        await fetchAuditLogs(originalCase.id);
      }
      setStep(3);
      onSuccess?.();
    } else {
      alert(result.error || "Failed to apply copy");
    }
  }

  function handleClose() {
    onOpenChange(false);
  }

  function handleNext() {
    if (replacements.length === 0) return;
    setStep(2);
  }

  function handleBack() {
    setStep(1);
  }

  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of replacements) {
      counts[r.section] = (counts[r.section] || 0) + 1;
    }
    return counts;
  }, [replacements]);

  function renderStepper() {
    const steps = [
      { id: 1, label: "Select fields" },
      { id: 2, label: "Preview" },
      { id: 3, label: "Done" },
    ];

    return (
      <div className="flex items-center gap-2 mb-4">
        {steps.map((s, idx) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
                step >= s.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {step > s.id ? <Check className="w-3.5 h-3.5" /> : s.id}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                step >= s.id ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {idx < steps.length - 1 && (
              <Separator orientation="vertical" className="h-4 mx-1" />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Applying a picked staff row back-fills the sibling field (label ↔ info)
  // so users don't have to pick twice. Only overrides the sibling if it's
  // not already copied with a different value.
  function handlePickStaff(
    fieldName: string,
    picked: { label: string; info: string },
  ) {
    const isLabel = fieldName === "Staff1" || fieldName === "Staff2";
    const isInfo = fieldName === "Staff1_Info" || fieldName === "Staff2_Info";
    const sibling = isLabel
      ? `${fieldName}_Info`
      : isInfo
        ? fieldName.replace("_Info", "")
        : null;
    const primaryValue = isLabel ? picked.label : picked.info;
    const siblingValue = isLabel ? picked.info : picked.label;

    setReplacements((prev) => {
      const eg: ReplacementSection = "eg";
      const next: FieldReplacement[] = prev.some(
        (r) => r.section === "eg" && r.fieldName === fieldName,
      )
        ? prev.map((r) =>
            r.section === "eg" && r.fieldName === fieldName
              ? { ...r, value: primaryValue }
              : r,
          )
        : [...prev, { section: eg, fieldName, value: primaryValue }];
      if (!sibling) return next;
      return next.some(
        (r) => r.section === "eg" && r.fieldName === sibling,
      )
        ? next.map((r) =>
            r.section === "eg" && r.fieldName === sibling
              ? { ...r, value: siblingValue }
              : r,
          )
        : [...next, { section: eg, fieldName: sibling, value: siblingValue }];
    });
  }

  function renderFieldRow(
    section: ReplacementSection,
    fieldName: string,
    sourceValue: any,
    originalValue: any,
  ) {
    const copied = isCopied(section, fieldName);
    const displayValue = copied
      ? getCopiedValue(section, fieldName)
      : originalValue;
    const valuesAreSame =
      formatValue(sourceValue) === formatValue(originalValue);

    return (
      <div
        key={`${section}-${fieldName}`}
        className={cn(
          "grid grid-cols-2 gap-0 items-start rounded-md border text-sm overflow-hidden relative",
          copied && "border-primary/40 ring-1 ring-primary/20",
        )}
      >
        {copied && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground shadow-sm">
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        )}
        <div className="p-3 border-r bg-muted/30 space-y-0.5 min-w-0">
          <div className="text-xs text-muted-foreground">{fieldName}</div>
          <div className="font-medium break-words">
            {formatValue(sourceValue)}
          </div>
        </div>
        <div
          className={cn(
            "p-3 space-y-0.5 min-w-0",
            copied && "bg-primary/5",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Current</span>
            {copied ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground -my-1"
                onClick={() => handleRestore(section, fieldName)}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Restore
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 -my-1"
                onClick={() => handleUseValue(section, fieldName, sourceValue)}
                disabled={valuesAreSame}
              >
                <ArrowRightLeft className="w-3 h-3 mr-1" />
                Use this value
              </Button>
            )}
          </div>
          {copied ? (
            (() => {
              const isStaffLabel =
                section === "eg" &&
                (fieldName === "Staff1" || fieldName === "Staff2");
              const isStaffInfo =
                section === "eg" &&
                (fieldName === "Staff1_Info" || fieldName === "Staff2_Info");
              if (isStaffLabel || isStaffInfo) {
                return (
                  <div className="mt-1">
                    <StaffSelect
                      mode={isStaffLabel ? "label" : "info"}
                      value={toEditString(displayValue)}
                      onSelect={({ label, info }) =>
                        handlePickStaff(fieldName, { label, info })
                      }
                      onChange={(raw) =>
                        handleEditValue(section, fieldName, raw)
                      }
                    />
                  </div>
                );
              }
              if (section === "eg" && fieldName === "Q12a") {
                return (
                  <div className="mt-1">
                    <Q12aSelect
                      value={toEditString(displayValue)}
                      onChange={(next) =>
                        handleEditValue(section, fieldName, next)
                      }
                    />
                  </div>
                );
              }
              if (section === "eg" && fieldName === "Q12f_RReject") {
                return (
                  <div className="mt-1">
                    <Q12fRejectSelect
                      value={toEditString(displayValue)}
                      onChange={(next) =>
                        handleEditValue(section, fieldName, next)
                      }
                    />
                  </div>
                );
              }
              return (
                <Textarea
                  value={toEditString(displayValue)}
                  onChange={(e) =>
                    handleEditValue(section, fieldName, e.target.value)
                  }
                  className="min-h-[60px] text-sm resize-y mt-1"
                />
              );
            })()
          ) : (
            <div
              className="break-words cursor-pointer hover:bg-accent/50 rounded-sm -mx-1 px-1 -my-0.5 py-0.5 transition-colors"
              onClick={() => handleUseValue(section, fieldName, displayValue)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleUseValue(section, fieldName, displayValue);
                }
              }}
            >
              {formatValue(displayValue)}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderCompareStep() {
    return (
      <div className="flex flex-col gap-4 h-full min-h-0">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border text-sm shrink-0">
          <div className="flex-1 min-w-0 pr-2">
            <div className="text-xs text-muted-foreground mb-0.5">Source (similar case)</div>
            <p className="font-medium truncate">
              {similarCase?.productName || "Unknown"}
            </p>
          </div>
          <div className="flex items-center justify-center px-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10">
              <ArrowRight className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div className="flex-1 min-w-0 pl-2 text-right">
            <div className="text-xs text-muted-foreground mb-0.5">Target (this case)</div>
            <p className="font-medium truncate">
              {originalCase?.caseNumber || "—"}
            </p>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as ReplacementSection)}
          className="flex-1 min-h-0 flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-3 shrink-0">
            <TabsTrigger value="eg">EG Form</TabsTrigger>
            <TabsTrigger value="application">Application</TabsTrigger>
            <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
          </TabsList>
          {fieldGroups.map(({ section, fields }) => (
            <TabsContent
              key={section}
              value={section}
              className="mt-4 flex-1 min-h-0 flex flex-col"
            >
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground px-1 flex-1">
                  <div className="flex items-center gap-1">
                    Similar case value
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    This case value
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => handleUseAllInSection(section)}
                  >
                    Use all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => handleRestoreAllInSection(section)}
                  >
                    Restore all
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1 min-h-0 pr-2">
                <div className="space-y-2">
                  {originalCase &&
                    similarCase?.metadata &&
                    fields.map((fieldName) =>
                      renderFieldRow(
                        section,
                        fieldName,
                        getSourceValue(section, fieldName, similarCase.metadata),
                        getOriginalValue(section, fieldName, originalCase),
                      ),
                    )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex justify-start items-center pt-3 border-t shrink-0">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  function renderPreviewStep() {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Review the {replacements.length} field
          {replacements.length === 1 ? "" : "s"} that will be updated on{" "}
          <span className="font-medium text-foreground">
            {originalCase?.caseNumber || "this case"}
          </span>
          .
        </div>

        <ScrollArea className="max-h-[45vh] pr-2">
          <div className="space-y-5">
            {fieldGroups.map(({ section, fields }) => {
              const sectionReplacements = replacements.filter((r) =>
                fields.includes(r.fieldName),
              );
              if (sectionReplacements.length === 0) return null;

              return (
                <div key={section} className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {getSectionIcon(section)}
                    </Badge>
                    {sectionLabels[section]}
                    <Badge variant="outline" className="text-xs">
                      {sectionReplacements.length}
                    </Badge>
                  </h4>
                  <div className="space-y-2">
                    {sectionReplacements.map((r) => (
                      <div
                        key={`${r.section}-${r.fieldName}`}
                        className="grid grid-cols-[1fr_1fr] gap-3 p-3 rounded-md border text-sm"
                      >
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground mb-1">
                            {r.fieldName}
                          </div>
                          <div className="text-destructive line-clamp-3 break-words">
                            {formatValue(
                              getOriginalValue(
                                r.section,
                                r.fieldName,
                                originalCase || ({} as Case),
                              ),
                            )}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground mb-1">
                            New value
                          </div>
                          <div className="text-success line-clamp-3 break-words font-medium">
                            {formatValue(r.value)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex justify-between pt-3 border-t shrink-0">
          <Button variant="outline" onClick={handleBack} className="gap-2">
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              className="gap-2 bg-success hover:bg-success/90"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Applying…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Confirm Copy
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function renderAuditLog() {
    if (isLoadingAuditLogs) {
      return (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
          Loading audit log…
        </div>
      );
    }

    if (auditLogs.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No copies have been recorded for this case yet.
        </div>
      );
    }

    return (
      <ScrollArea className="max-h-[40vh] pr-2">
        <div className="space-y-4">
          {auditLogs.map((log: CaseAuditLogEntry) => (
            <div key={log.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {log.userName || log.userEmail || "Unknown user"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {log.changedFields.length} field
                  {log.changedFields.length === 1 ? "" : "s"}
                </Badge>
              </div>

              <div className="space-y-1.5">
                {log.changedFields.map((field, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center text-xs py-1 border-b last:border-0"
                  >
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {getSectionIcon(field.section)}
                    </Badge>
                    <div className="min-w-0">
                      <span className="text-muted-foreground block">
                        {field.fieldName}
                      </span>
                      <span className="text-destructive line-clamp-2 break-words">
                        {formatValue(field.oldValue)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground block">
                        → new
                      </span>
                      <span className="text-success line-clamp-2 break-words font-medium">
                        {formatValue(field.newValue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  function renderDoneStep() {
    const latestLog = auditLogs[0];
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center py-3">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
            <Check className="w-6 h-6 text-success" />
          </div>
          <h3 className="text-lg font-semibold">Copy applied</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1">
            {replacements.length} field{replacements.length === 1 ? "" : "s"}{" "}
            on{" "}
            <span className="font-medium text-foreground">
              {originalCase?.caseNumber || "this case"}
            </span>{" "}
            have been updated from the similar case.
          </p>
        </div>

        {latestLog && (
          <div className="shrink-0 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                Just now
              </span>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span className="font-medium text-foreground">
                  {latestLog.userName || latestLog.userEmail || "Unknown user"}
                </span>
                <span>
                  ·{" "}
                  {latestLog.createdAt
                    ? new Date(latestLog.createdAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              {latestLog.changedFields.map((field, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center text-xs py-1 border-b last:border-0"
                >
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    {getSectionIcon(field.section)}
                  </Badge>
                  <div className="min-w-0">
                    <span className="text-muted-foreground block">
                      {field.fieldName}
                    </span>
                    <span className="text-destructive line-clamp-2 break-words">
                      {formatValue(field.oldValue)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-muted-foreground block">→ new</span>
                    <span className="text-success line-clamp-2 break-words font-medium">
                      {formatValue(field.newValue)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Audit Log</span>
          <Badge variant="outline" className="text-xs">
            {auditLogs.length} entries
          </Badge>
        </div>

        {renderAuditLog()}

        <div className="flex justify-end pt-3 border-t gap-2 shrink-0">
          <Button variant="outline" onClick={handleBack}>
            Back to Preview
          </Button>
          <Button onClick={handleClose}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-hidden flex flex-col",
          justification
            ? "sm:max-w-[1400px] w-[95vw]"
            : "sm:max-w-[900px]",
        )}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle className="flex items-center gap-2">
              {step === 1
                ? "Copy from Similar Case"
                : step === 2
                  ? "Preview Changes"
                  : "Copy Complete"}
              {step !== 3 && replacements.length > 0 && (
                <Badge variant="secondary">{replacements.length} changes</Badge>
              )}
            </DialogTitle>
            {step === 1 && (
              <Button
                onClick={handleNext}
                disabled={replacements.length === 0}
                size="sm"
                className="gap-2 shrink-0"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
          {/* Left column - copy workflow */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {renderStepper()}
            <div className="py-1 flex-1 overflow-y-auto min-h-0">
              {step === 1 && renderCompareStep()}
              {step === 2 && renderPreviewStep()}
              {step === 3 && renderDoneStep()}
            </div>
          </div>

          {/* Right column - justification workspace seeded with the similar
              case, for easy reference while copying. */}
          {justification && (
            <div className="flex-1 min-w-0 flex flex-col min-h-0 lg:max-w-[620px] lg:border-l lg:pl-4">
              <div className="flex items-center gap-2 pb-2 shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">
                  Justification - Case {originalCase?.caseNumber || ""}
                </span>
              </div>
              <JustificationPanel
                open={open}
                onClose={handleClose}
                selectedCase={originalCase}
                initialDecision={
                  similarCase?.decision === "rejected" ? "rejected" : "approved"
                }
                seedSimilarCase={similarCase}
                isGenerating={justification.isGenerating}
                isUpdating={justification.isUpdating}
                isSavingDraft={justification.isSavingDraft}
                onGenerate={justification.onGenerate}
                onConfirm={justification.onConfirm}
                onSaveDraft={justification.onSaveDraft}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
