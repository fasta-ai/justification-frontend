/**
 * Default Yes/No values for the A_Record_Admin tracking columns.
 *
 * Step 2 has always shown these in its preview table, but until now they were
 * never written into the case, so Step 3 and the Excel export saw blanks.
 * This is the single definition used by the Step 2 preview, case creation,
 * and the A_Record_Admin export. A value already stored on the case wins.
 */

/** Documents are on hand and SWD was asked / replied: default "Yes". */
export const RECORD_ADMIN_YES_FIELDS = [
  "Recd_EGF",
  "Recd_PAF",
  "Recd_Quo",
  "Recd_Cat",
  "Req_I_SWD_YN",
  "Req_RepSWD_YN",
] as const;

/** Workflow milestones that have not happened at intake: default "No". */
export const RECORD_ADMIN_NO_FIELDS = [
  "Ret_Rept",
  "RecdCurrWk_YN",
  "EGF_Ready_YN",
  "EGF_To_EG_YN",
  "EG_Reply_YN",
  "EGF_To_SWD_YN",
  "FUF_Comp_YN",
] as const;

const DEFAULTS: Record<string, "Yes" | "No"> = Object.fromEntries([
  ...RECORD_ADMIN_YES_FIELDS.map((f) => [f, "Yes"]),
  ...RECORD_ADMIN_NO_FIELDS.map((f) => [f, "No"]),
]);

/** The default for a tracking column, or undefined for any other key. */
export function recordAdminDefault(field: string): "Yes" | "No" | undefined {
  return DEFAULTS[field];
}

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  const s = String(value).trim();
  return s === "" || s === "/";
}

/**
 * Fill every blank tracking column with its default. Non-blank values are
 * kept, so a reviewer's "No" is never flipped back to "Yes".
 */
export function applyRecordAdminDefaults<T extends Record<string, unknown>>(
  egData: T | null | undefined,
): T & Record<string, unknown> {
  const out: Record<string, unknown> = { ...(egData ?? {}) };
  for (const [field, value] of Object.entries(DEFAULTS)) {
    if (isBlank(out[field])) out[field] = value;
  }
  return out as T & Record<string, unknown>;
}
