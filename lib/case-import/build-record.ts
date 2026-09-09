import type {
  DatasetMetadata,
  ImportRow,
  JoinedCase,
  RegisterRole,
} from "./types";
import {
  DATE_COLUMNS,
  cleanModelCode,
  cleanValue,
  excelSerialToISO,
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

/** Fields copied straight through from the EG register when present. */
const EG_PASSTHROUGH = [
  "Applicant", "App_Cat", "Q12a", "Q12b_Jus", "Q12c_TotC", "Q12d_Quo",
  "Q12e_JCost", "Q12f_RReject", "Q12g_JRem", "Q13a", "Q13b", "Remarks_EGF",
  "No_Elderly", "No_Disable", "Typ_Disability", "No_Bene", "Prof_Staff",
  "Typ_Staff",
];

const PA_PASSTHROUGH = [
  "PA_RefL", "PA_Cat", "PA_PName", "PA_Brand", "PA_Mod_No", "TotAmtR",
  "PA_Justify", "PA_Elaborate", "Staff_Avail",
];

const RA_PASSTHROUGH = [
  "SWD_Ref", "App_No", "App_Type", "Rem_RA", "Recd_EGF", "Recd_PAF",
  "Recd_Quo", "Recd_Cat", "WkRep_Status", "MRef",
];

function copyFields(
  target: DatasetMetadata,
  source: Record<string, unknown> | null,
  fields: string[],
): void {
  if (!source) return;
  for (const field of fields) {
    if (!(field in source)) continue;
    const raw = source[field];
    const value = DATE_COLUMNS.has(field)
      ? excelSerialToISO(raw)
      : cleanValue(raw);
    if (value !== null) target[field] = value;
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

  // PA_Mod_No is a real model number when the split found none.
  const fallbackModel = cleanModelCode(
    joined.pa?.["PA_Mod_No"],
    productName ?? undefined,
  );

  return {
    appPName: productName,
    appPNamMod: raw,
    modelCode: modelCode ?? fallbackModel,
  };
}

/**
 * Build the metadata object for one row.
 *
 * `importBatchId` tags the batch so it can be rolled back; `sourceKey` is the
 * stable natural key, which the corpus has never had — the existing loaders
 * deduplicate by whole-object jsonb containment, which breaks the moment any
 * field differs.
 */
export function buildDatasetMetadata(
  row: ImportRow,
  importBatchId: string,
): DatasetMetadata {
  const { joined, folder, catalogueDesc } = row;
  const metadata: DatasetMetadata = {};

  copyFields(metadata, joined.eg, EG_PASSTHROUGH);
  copyFields(metadata, joined.pa, PA_PASSTHROUGH);
  copyFields(metadata, joined.recordAdmin, RA_PASSTHROUGH);

  const { appPName, appPNamMod, modelCode } = resolveProduct(joined);

  // Both aliases are written on purpose. The corpus uses App_PName, the EG
  // extraction pipeline produces App_PNam_Mod, and consumers read one or the
  // other — zero of the 4,050 existing rows carry App_PNam_Mod, which is why
  // Stage 3's original match field returned nothing.
  if (appPName) metadata.App_PName = appPName;
  if (appPNamMod) metadata.App_PNam_Mod = appPNamMod;
  if (modelCode) metadata.Model_Code = modelCode;

  metadata.catalogueDesc = catalogueDesc || null;

  // Identity and provenance.
  metadata.Ref = joined.ref || null;
  metadata.Tranche = joined.caseKey.tranche;
  metadata.EB_RM = joined.caseKey.unit;
  metadata.NO = joined.caseKey.no;
  metadata.NO_R = joined.caseKey.noR;
  metadata.sourceKey = joined.key;
  // Which registers this case was assembled from. The backend re-checks this
  // against its own required list, so the completeness rule holds even for a
  // caller that never went through this page.
  metadata.sourceRegisters = [...joined.sources];
  metadata.importBatchId = importBatchId;
  metadata.importedAt = new Date().toISOString();

  if (folder) {
    metadata.sourceFolder = folder.folderName;
    if (folder.ragStatus) metadata.ragStatus = folder.ragStatus;
    if (folder.isRevised) metadata.isRevised = true;
    if (folder.appType) metadata.appTypeCode = folder.appType;
  }
  if (row.selectedCatalogue) {
    metadata.catalogueFile = row.selectedCatalogue.name;
  }

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
 * `requiredRoles` is the set of registers actually uploaded. A case must be
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
  return null;
}
