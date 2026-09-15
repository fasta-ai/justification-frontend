/**
 * Case field mapping — single source of truth for the schema gap between
 * a similar case's *dataset metadata* and the *live case* it will be copied
 * onto.
 *
 * Two shapes:
 *   - Live case: cases.egData / applicationData / catalogueData
 *       keys like App_Type, PA_PName, Q12a, EB_RM, …
 *   - Dataset metadata: datasets.metadata (built by
 *       case.service.ts:createDatasetForCase from an approved case)
 *       keys like Applicant, App_PName, Q12a (or legacy Q12a_T4), …
 *
 * The dataset shape is derived from the live shape by renaming some keys,
 * hardcoding some constants, and — for old rows — carrying legacy names.
 * That translation lives here so every consumer (copy dialog, edit dialog,
 * exports, audit log rendering) can share it.
 */

import type { ReplacementSection } from "@/lib/types";

/**
 * Metadata keys that the live case's EG form stores under a *different
 * fieldName*. Copy dialog uses this both for reading the target "current
 * value" column and for translating replacements before POSTing to backend —
 * backend writes blindly to `<section>Data[fieldName]`.
 *
 * Cases created from the Record Admin register carry `App_Type` and
 * `App_PNam_Mod`; imported EG-form rows carry `Applicant` and `App_PName`.
 * The first key the case actually has wins. The target always stays on the EG
 * form — the application's PA_PName is its own field on the Application tab.
 */
export const EG_TARGET_CANDIDATES: Record<string, string[]> = {
  Applicant: ["App_Type", "Applicant"],
  App_PName: ["App_PName", "App_PNam_Mod"],
};

/**
 * Metadata keys with legacy aliases. When the canonical key is empty on a
 * dataset, fall back through this list. Applies to the *source* side only —
 * the target case always uses the canonical key.
 */
export const EG_SOURCE_ALIASES: Record<string, string[]> = {
  Q12a: ["Q12a_T4"],
};

/**
 * Metadata fields that are hardcoded constants during dataset creation
 * (see case.service.ts:createDatasetForCase). Copying them from a similar
 * case is meaningless — every dataset has the same value. Kept here so
 * other consumers can filter them out consistently.
 */
export const EG_CONSTANT_FIELDS: readonly string[] = [
  "App_Cat", // "Procurement"
  "Q13a", // "NIL"
  "Q13b", // "NIL"
  "Remarks_EGF", // "/"
  "D_Entry", // caseEntity.createdAt
];

/**
 * Read a source (similar case metadata) value, honouring legacy aliases
 * for EG-tab fields and the pa_form_data / catalogue_data sub-shapes for
 * the other tabs.
 */
export function resolveSourceValue(
  section: ReplacementSection,
  fieldName: string,
  metadata: Record<string, any> | undefined | null,
): any {
  if (!metadata) return undefined;
  if (section === "eg") {
    const primary = metadata[fieldName];
    if (primary !== undefined && primary !== null && primary !== "") {
      return primary;
    }
    for (const alias of EG_SOURCE_ALIASES[fieldName] ?? []) {
      const v = metadata[alias];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return primary;
  }
  if (section === "application") {
    return metadata.pa_form_data?.[fieldName] ?? metadata[fieldName];
  }
  if (section === "catalogue") {
    return metadata.catalogue_data?.[fieldName] ?? metadata[fieldName];
  }
  return undefined;
}

/**
 * Where a metadata (section, fieldName) actually lives on the live case.
 * Returns the same pair unchanged when no rename applies.
 */
export function resolveTargetSlot(
  section: ReplacementSection,
  fieldName: string,
  egData?: Record<string, any> | null,
): { section: ReplacementSection; fieldName: string } {
  const candidates = section === "eg" ? EG_TARGET_CANDIDATES[fieldName] : undefined;
  if (candidates) {
    const present = candidates.find((key) => {
      const v = egData?.[key];
      return v !== undefined && v !== null && String(v).trim() !== "";
    });
    return { section: "eg", fieldName: present ?? candidates[0] };
  }
  return { section, fieldName };
}
