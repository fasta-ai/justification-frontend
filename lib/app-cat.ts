/**
 * App_Cat: the application category in the A_EG_Form (column K) and
 * A_Record_Admin (column Q) registers. The client's registers only ever hold
 * "Procurement" or "Rental" (HKCSS Argus clarification 3).
 *
 * The one place that decides the value, so the Step 2 preview, the Step 2
 * downloads, the Step 3 table, the EG form and the Step 3 Excel export agree.
 *
 * Never derive it from `PA_RefL`: that is the application form's "on the
 * reference list?" Yes/No flag, not the category.
 */

export type AppCat = "Procurement" | "Rental";

export const APP_CAT_DEFAULT: AppCat = "Procurement";

/**
 * The category a raw value names, or null when it names neither (blank, "/",
 * "NA", Yes/No, anything else).
 */
export function parseAppCat(value: unknown): AppCat | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim().toLowerCase();
  if (!s) return null;
  if (/^(rent|leas)/.test(s)) return "Rental";
  if (s.includes("租")) return "Rental";
  if (/^(procure|purchas)/.test(s)) return "Procurement";
  if (s.includes("採購") || s.includes("采购") || s.includes("購買")) {
    return "Procurement";
  }
  return null;
}

/** Normalise one raw value: Rental when it says so, otherwise Procurement. */
export function normaliseAppCat(value: unknown): AppCat {
  return parseAppCat(value) ?? APP_CAT_DEFAULT;
}

/**
 * App_Cat for a case or Step 2 product. The first source that names a
 * category wins: egData.App_Cat, then an App_Cat on the application data,
 * then the Procurement default. `PA_RefL` is deliberately not consulted.
 */
export function resolveAppCat(
  egData?: Record<string, unknown> | null,
  applicationData?: Record<string, unknown> | null,
): AppCat {
  return (
    parseAppCat(egData?.App_Cat) ??
    parseAppCat(applicationData?.App_Cat) ??
    APP_CAT_DEFAULT
  );
}
