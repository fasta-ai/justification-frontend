/**
 * Cleanup rules for values coming out of the three register workbooks.
 *
 * Every rule here exists because of something actually present in
 * A_EG_Form.xlsx / A_PA_Form.xlsx / A_Record_Admin.xlsx, not as defensive
 * guesswork. Skipping any of them puts visible garbage into the corpus, and
 * the corpus is what Stage 3 shows an officer as precedent.
 */

/**
 * Placeholders the registers use to mean "not applicable". Left as strings
 * they pollute the embedding text and produce spurious tier-1 exact matches
 * between unrelated cases.
 *
 * `0` is deliberately NOT here: it is a real value in the beneficiary and
 * cost columns. It is only stripped from model codes, where it is a
 * placeholder — see `cleanModelCode`.
 */
const SENTINELS = new Set(["/", "na", "n/a", "n.a.", "nil", "-", "--", "none"]);

/** Excel's day 0 is 1899-12-30; 25569 days separate that from the Unix epoch. */
const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const MS_PER_DAY = 86_400_000;

/**
 * Plausible range for a date serial. 1 is 1899-12-31 and 60000 is 2064 — wide
 * enough for any real date in these files, narrow enough that a beneficiary
 * count or a dollar amount is never mistaken for one.
 */
const MIN_DATE_SERIAL = 20000; // 1954
const MAX_DATE_SERIAL = 60000; // 2064

/**
 * Strip the escaped carriage returns Excel's XML export leaves behind.
 *
 * The justification fields are full of literal `_x000d_` sequences. Left in,
 * they appear verbatim in the text Stage 3 offers as a suggested
 * justification, which is how they get noticed.
 */
export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/_x000d_/gi, "")
    .replace(/_x000a_/gi, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Cleaned text, or null when the value is blank or a "not applicable" marker. */
export function cleanValue(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  if (SENTINELS.has(text.toLowerCase())) return null;
  return text;
}

/**
 * Model codes additionally use bare `0` as a placeholder, and repeat the
 * product name when there is no separate code.
 */
export function cleanModelCode(value: unknown, productName?: string): string | null {
  const cleaned = cleanValue(value);
  if (!cleaned) return null;
  if (cleaned === "0") return null;
  if (productName && cleaned.toLowerCase() === productName.trim().toLowerCase()) {
    return null;
  }
  return cleaned;
}

/**
 * Convert an Excel date serial to an ISO string.
 *
 * Dates arrive as bare numbers — `44344`, and with a time component as
 * `45589.4549421296`. A value already parsed into a Date (SheetJS with
 * `cellDates`) passes through; anything outside the plausible serial range is
 * left alone, so a cost of 134000 is never turned into a date.
 */
export function excelSerialToISO(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  const serial =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(serial)) return null;
  if (serial < MIN_DATE_SERIAL || serial > MAX_DATE_SERIAL) return null;

  const ms = Math.round((serial - EXCEL_EPOCH_OFFSET_DAYS) * MS_PER_DAY);
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;

  // A whole serial is a date with no meaningful time; keep it date-only so it
  // does not read as midnight UTC in some other timezone.
  return Number.isInteger(serial)
    ? date.toISOString().slice(0, 10)
    : date.toISOString();
}

/** Column names whose values are Excel date serials. */
export const DATE_COLUMNS = new Set([
  "D_ReqF_SWD",
  "D_PlnT_SWD",
  "D_EGF_ASWD",
  "D_EGF_Out",
  "D_EGF_Dead",
  "D_ReqT_SWD",
  "D_RetF_SWD",
  "D_WkRep",
  "D_EGF_T_EG",
  "D_EG_Reply",
  "DatEntry",
  "D_Entry",
]);

/**
 * Normalise a case number for keying.
 *
 * `NO` arrives as `1080.0` from one source and `1080` from another. Without
 * this the three-way join silently loses every row where they disagree.
 */
export function normaliseCaseNo(value: unknown): string {
  const text = cleanText(value);
  if (!text) return "";
  const num = Number.parseFloat(text);
  if (Number.isFinite(num) && /^\d+(\.0+)?$/.test(text)) {
    return String(Math.trunc(num));
  }
  return text;
}

/** Uppercased, trimmed; `""` when absent. Used for tranche, unit and suffix. */
export function normaliseToken(value: unknown): string {
  return cleanText(value).toUpperCase();
}

/**
 * Split `App_PNam_Mod` into a product name and a model code.
 *
 * The field is `"<name> / <model>"` in the large majority of rows
 * (`"8950 Platnum Pressure Relief Turning Mattress / PLETM01"`). A minority use
 * an explicit labelled form across several lines. Splitting matters: the tiered
 * matcher's exact tier keys on the model code, and today only 35 of 4,050
 * corpus rows have one, which is why that tier effectively never fires.
 */
export function splitProductAndModel(value: unknown): {
  productName: string | null;
  modelCode: string | null;
} {
  const text = cleanText(value);
  if (!text) return { productName: null, modelCode: null };

  // Labelled multiline form:
  //   Product Name: Proactive Individual Caring System (PICS)
  //   Model Number: PICS MMS; PICS eMAR
  const labelledName = text.match(/product\s*name\s*[:：]\s*(.+)/i);
  const labelledModel = text.match(/model\s*(?:number|no\.?|code)\s*[:：]\s*(.+)/i);
  if (labelledName || labelledModel) {
    const productName = labelledName ? cleanValue(labelledName[1].split("\n")[0]) : null;
    const modelCode = labelledModel
      ? cleanModelCode(labelledModel[1].split("\n")[0], productName ?? undefined)
      : null;
    if (productName || modelCode) return { productName, modelCode };
  }

  // Slash-separated form. Split on the LAST separator: product names contain
  // slashes of their own ("upper / lower limb trainer") far more often than
  // model codes do.
  const lastSlash = text.lastIndexOf(" / ");
  if (lastSlash > 0) {
    const name = cleanValue(text.slice(0, lastSlash));
    const model = cleanModelCode(text.slice(lastSlash + 3), name ?? undefined);
    return { productName: name, modelCode: model };
  }

  return { productName: cleanValue(text), modelCode: null };
}
