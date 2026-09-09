import type {
  DatasetMetadata,
  ImportRow,
  JoinedCase,
  RegisterRole,
} from "./types";
import {
  cleanModelCode,
  cleanText,
  cleanValue,
  excelSerialToDayMonthYear,
  excelSerialToISO,
  numericOrText,
  splitProductAndModel,
} from "./normalise";
import { caseNumber } from "./join";

/**
 * Turning a merged case into the row written to `datasets.metadata`.
 *
 * Field names here are not free choices. The Stage 3 approval screen and the
 * tiered matcher read specific keys, and writing anything else produces rows
 * that exist in the table but are invisible to the search that justifies
 * importing them.
 */

/** The task/type discriminators the corpus rows already use. */
export const CORPUS_TASK = "Justification Creation";
export const CORPUS_TYPE = "justification-data";

/**
 * The embedding recipe, frozen to match the existing corpus.
 *
 * The backend derives the vector from these fields, joined with a space, via
 * `bulkCreate`'s `embeddingFields`. It reproduces exactly what
 * `update-embeddings.ts` does for case-family rows, so imported rows land in
 * the same space as the 4,050 already there.
 *
 * Changing this list invalidates comparison against every row not re-embedded
 * with the new recipe — including adding Q12b_Jus, which would also overflow
 * the model's 384-token limit and be silently truncated.
 */
export const EMBEDDING_FIELDS = ["App_PName", "catalogueDesc"] as const;

/** Width the source workbook truncates App_PNam_Mod to. */
const RECORD_ADMIN_FIELD_CAP = 100;

/**
 * The record written to `datasets.metadata`.
 *
 * The shape mirrors the rows the corpus already holds, field for field, so an
 * imported case is indistinguishable from one created through the Stage 1-3
 * workflow. Three conventions are inherited from those rows rather than chosen
 * here:
 *
 *  - PA-form values appear twice: at the root and nested under
 *    `pa_form_data`;
 *  - a field the registers left blank is written as `""`, not omitted, so the
 *    key set is the same for every case;
 *  - the registers' "/" and "NIL" placeholders are kept verbatim. They are
 *    stripped only from the product name and model code, where they would
 *    pollute the exact-match tier.
 */

/** Root fields taken from the EG register, in corpus order. */
const EG_ROOT_FIELDS = [
  "Q12a", "Q13a", "Q13b", "Staff1", "Staff2", "App_Cat", "Q12b_Jus",
  "Q12d_Quo", "Applicant", "Q12g_JRem", "SWD_Off_I", "SWD_Off_N", "SWD_Off_P",
  "Q12e_JCost", "Remarks_EGF", "Staff1_Info", "Staff2_Info", "Q12f_RReject",
];

/** Root fields taken from the PA register. */
const PA_ROOT_FIELDS = [
  "PA_Cat", "No_Bene", "Typ_Staff", "No_Disable", "No_Elderly", "Prof_Staff",
  "Typ_Disability",
];

/** The nested `pa_form_data` block, in corpus order. */
const PA_FORM_FIELDS = [
  "PA_Cat", "No_Bene", "PA_RefL", "TotAmtR", "PA_Brand", "PA_PName",
  "PA_Mod_No", "Typ_Staff", "No_Disable", "No_Elderly", "PA_Justify",
  "Prof_Staff", "Staff_Avail", "PA_Elaborate", "Typ_Disability",
];

/** Stored as numbers, not strings, wherever the value really is numeric. */
const NUMERIC_FIELDS = new Set([
  "NO", "Q12c_TotC", "No_Elderly", "TotAmtR", "No_Bene", "No_Disable",
]);

/** Workflow dates, stored as DD/MM/YYYY. */
const DAY_MONTH_YEAR_FIELDS = new Set([
  "D_EGF_ASWD", "D_PlnT_SWD", "D_ReqF_SWD", "D_EGF_Out", "D_EGF_Dead",
  "D_ReqT_SWD", "D_RetF_SWD", "D_WkRep", "D_EGF_T_EG", "D_EG_Reply",
]);

/** One field, converted the way the corpus stores it. */
function valueFor(field: string, raw: unknown): unknown {
  if (DAY_MONTH_YEAR_FIELDS.has(field)) return excelSerialToDayMonthYear(raw);
  if (NUMERIC_FIELDS.has(field)) return numericOrText(raw);
  return cleanText(raw);
}

function copyFields(
  target: DatasetMetadata,
  source: Record<string, unknown> | null,
  fields: string[],
): void {
  for (const field of fields) {
    target[field] = valueFor(field, source?.[field]);
  }
}

/**
 * Resolve the product name and model code.
 *
 * `App_PNam_Mod` from the Record Admin register is the best source — it is the
 * "<name> / <model>" form the corpus was built around. The EG register's
 * `App_PName` is the fallback and often carries a model after a slash too, so
 * it goes through the same split.
 */
export function resolveProduct(joined: JoinedCase): {
  appPName: string | null;
  appPNamMod: string | null;
  modelCode: string | null;
} {
  const raw =
    cleanValue(joined.recordAdmin?.["App_PNam_Mod"]) ??
    cleanValue(joined.eg?.["App_PName"]);

  const { productName, modelCode } = splitProductAndModel(raw);

  const fallbackModel = cleanModelCode(
    joined.pa?.["PA_Mod_No"],
    productName ?? undefined,
  );

  // The Record Admin column is capped at 100 characters in the source
  // workbook — 10 of its 7,479 rows sit exactly on that cap with the model
  // list cut mid-token ("… (VT-G8POES" with no closing bracket). The product
  // name survives, but the model half is unusable, so take PA_Mod_No when it
  // has the whole thing.
  const wasTruncated = raw != null && raw.length === RECORD_ADMIN_FIELD_CAP;
  const resolvedModel =
    wasTruncated && fallbackModel ? fallbackModel : (modelCode ?? fallbackModel);

  return {
    appPName: productName,
    appPNamMod: raw,
    modelCode: resolvedModel,
  };
}

/**
 * Build the metadata object for one case.
 *
 * `sourceKey`, `sourceRegisters`, `importBatchId` and `Model_Code` are the
 * only additions to the corpus shape. The first three make an import
 * deduplicable and reversible, which the existing rows are not; `Model_Code`
 * feeds the exact-match tier, which today fires on 35 of 4,050 rows.
 */
export function buildDatasetMetadata(
  row: ImportRow,
  importBatchId: string,
): DatasetMetadata {
  const { joined, folder, catalogueDesc } = row;
  const { eg, pa, recordAdmin, caseKey } = joined;
  const metadata: DatasetMetadata = {};

  // Identity.
  metadata.NO = numericOrText(caseKey.no);
  metadata.Ref = cleanText(joined.ref);
  metadata.fid = `${caseKey.no}${caseKey.noR}`;
  metadata.NO_R = caseKey.noR;
  metadata.EB_RM = caseKey.unit;
  metadata.Tranche = caseKey.tranche;

  copyFields(metadata, eg, EG_ROOT_FIELDS);
  copyFields(metadata, pa, PA_ROOT_FIELDS);

  // D_Entry keeps its time component, so it stays a full ISO timestamp.
  metadata.D_Entry = excelSerialToISO(eg?.["D_Entry"]) ?? "";
  metadata.Q12c_TotC = numericOrText(eg?.["Q12c_TotC"]);
  for (const field of ["D_ReqF_SWD", "D_PlnT_SWD", "D_EGF_ASWD"]) {
    metadata[field] = excelSerialToDayMonthYear(
      eg?.[field] ?? recordAdmin?.[field],
    );
  }

  // The PA form, nested the way the corpus stores it.
  const paForm: DatasetMetadata = {};
  copyFields(paForm, pa, PA_FORM_FIELDS);
  metadata.pa_form_data = paForm;

  // The product name the corpus matches on is the applicant's, bilingual and
  // verbatim — that is what a new case arrives carrying, so exact and fuzzy
  // matching compare like with like.
  const { appPName, appPNamMod, modelCode } = resolveProduct(joined);
  metadata.App_PName = cleanText(pa?.["PA_PName"]) || appPName || "";
  if (appPNamMod) metadata.App_PNam_Mod = appPNamMod;
  if (modelCode) metadata.Model_Code = modelCode;

  metadata.catalogueDesc = catalogueDesc || "";
  if (row.catalogueData) metadata.catalogue_data = row.catalogueData;

  // Provenance — additions, not part of the inherited shape.
  metadata.sourceKey = joined.key;
  metadata.sourceRegisters = [...joined.sources];
  metadata.importBatchId = importBatchId;
  metadata.importedAt = new Date().toISOString();
  if (folder) {
    metadata.sourceFolder = folder.folderName;
    if (folder.ragStatus) metadata.ragStatus = folder.ragStatus;
    if (folder.isRevised) metadata.isRevised = true;
  }
  if (row.selectedCatalogue) metadata.catalogueFile = row.selectedCatalogue.name;

  return metadata;
}

/** The exact text the backend will embed, for preview and length checks. */
export function embeddingText(metadata: DatasetMetadata): string {
  return EMBEDDING_FIELDS.map((field) => metadata[field])
    .filter(Boolean)
    .join(" ");
}

/**
 * Rough token count for the 384-token sequence limit of all-mpnet-base-v2.
 *
 * Past that the input is truncated with no warning of any kind, so the review
 * screen flags rows that are close. ~1.3 tokens per whitespace word is a
 * reasonable approximation for this English product prose.
 */
export function estimateTokens(text: string): number {
  if (!text.trim()) return 0;
  return Math.ceil(text.trim().split(/\s+/).length * 1.3);
}

export const EMBEDDING_TOKEN_LIMIT = 384;

/** A one-line label for the row, used throughout the review screens. */
export function rowLabel(row: ImportRow): string {
  const num = caseNumber(row.joined.caseKey);
  const { appPName } = resolveProduct(row.joined);
  return appPName ? `${num} — ${appPName}` : num;
}

export const REGISTER_SHORT_NAMES: Record<RegisterRole, string> = {
  eg: "EG",
  pa: "PA",
  recordAdmin: "Record Admin",
};

/**
 * Why a row cannot be committed, or null when it is fine.
 *
 * Two rules, both of which the caller opts into. `requiredRoles` is the set
 * of registers actually uploaded. A case must be
 * present in every one of them: the three registers hold different halves of
 * the same case — the decision, the applicant's product and cost, the admin
 * trail — so a case missing from one of them goes into the corpus with holes
 * in it. Keying on what was uploaded rather than always demanding three keeps
 * the rule from blocking everything when someone deliberately brings only the
 * EG file.
 */
export function rowBlocker(
  row: ImportRow,
  requiredRoles: RegisterRole[] = [],
  requireCatalogue = true,
): string | null {
  const present = new Set(row.joined.sources);
  const missing = requiredRoles.filter((role) => !present.has(role));
  if (missing.length > 0) {
    return `not in the ${missing
      .map((role) => REGISTER_SHORT_NAMES[role])
      .join(" and ")} register${missing.length > 1 ? "s" : ""}`;
  }

  const { appPName } = resolveProduct(row.joined);
  if (!appPName) return "no product name in any register";
  const justification = cleanValue(row.joined.eg?.["Q12b_Jus"]);
  if (!justification) return "no EG justification (Q12b_Jus)";

  // A case with no catalogue description is half of what the search matches
  // on — it can only ever be found by product name. Requiring one keeps the
  // corpus to cases that are actually useful as precedent.
  if (requireCatalogue && !cleanValue(row.catalogueDesc)) {
    if (!row.selectedCatalogue) return "no catalogue file for this case";
    if (row.extraction.status === "failed") return "catalogue extraction failed";
    return "catalogue not extracted yet";
  }
  return null;
}
