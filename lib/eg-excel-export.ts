/**
 * Excel export of a tranche's cases in the three workbook layouts the team
 * maintains (A_EG_Form, A_PA_Form, A_Record_Admin). One row per case, columns
 * in the exact order of the reference workbooks so the files can be appended /
 * imported as-is.
 *
 * Which cases reach which sheet
 *   A_EG_Form      Approved / rejected only. The sheet IS the decision record
 *                  (Q12/Q13), and an undecided case has no answers to report —
 *                  it would export the derived defaults as if they were the
 *                  expert group's. With nothing decided the sheet still ships,
 *                  as a header row with no data.
 *   A_PA_Form      Every case in scope. It is the application as submitted:
 *                  complete once extraction has run, decision-independent.
 *   A_Record_Admin Every case in scope. It is the in-flight tracking register,
 *                  so the undecided rows are the ones it exists to show.
 *
 * Column sources
 *   A_EG_Form      EG form fields (egData) + the reviewer's Q12/Q13 answers
 *                  (egData with the same fallbacks as the EG form download)
 *                  + the professional/beneficiary block from the PA form.
 *   A_PA_Form      Case identity (egData) + application form (applicationData).
 *   A_Record_Admin The EG record-admin tracking columns (egData). Blank Yes/No
 *                  tracking columns take the same defaults Step 2 shows
 *                  (lib/record-admin-defaults), and the "received" flags are
 *                  cross-checked against what is actually on the case. On a
 *                  case that is not decided yet, the "Yes" defaults with no
 *                  evidence behind them are left blank — see
 *                  UNEVIDENCED_YES_COLUMNS.
 *
 * Dates are written as real Excel dates (the reference workbooks store serial
 * dates), everything else verbatim.
 */

import type { Case } from "@/app/api/cases/types";
import { clean, deriveEgDefaults, pick } from "@/lib/eg-form";
import { applyRecordAdminDefaults } from "@/lib/record-admin-defaults";

export const EG_FORM_COLUMNS = [
  "Ref", "Tranche", "EB_RM", "NO", "NO_R", "Staff1", "Staff2", "Staff1_Info",
  "Staff2_Info", "Applicant", "App_Cat", "App_PName", "D_ReqF_SWD",
  "D_PlnT_SWD", "SWD_Off_N", "SWD_Off_P", "SWD_Off_I", "D_EGF_ASWD",
  "Prof_Staff", "Typ_Staff", "No_Elderly", "No_Disable", "Typ_Disability",
  "No_Bene", "Q12a", "Q12b_Jus", "Q12c_TotC", "Q12d_Quo", "Q12e_JCost",
  "Q12f_RReject", "Q12g_JRem", "Q13a", "Q13b", "Remarks_EGF", "D_Entry",
] as const;

export const PA_FORM_COLUMNS = [
  "Ref", "Tranche", "EB_RM", "NO", "NO_R", "PA_RefL", "PA_Cat", "PA_PName",
  "PA_Brand", "PA_Mod_No", "TotAmtR", "Prof_Staff", "Typ_Staff", "Staff_Avail",
  "No_Elderly", "No_Disable", "Typ_Disability", "No_Bene", "PA_Justify",
  "PA_Elaborate", "DatEntry",
] as const;

export const RECORD_ADMIN_COLUMNS = [
  "SWD_Ref", "Ref", "App_No", "Tranche", "EB_RM", "NO", "NO_R", "Staff",
  "D_ReqF_SWD", "D_PlnT_SWD", "D_EGF_Out", "D_EGF_Dead", "SWD_Off_N",
  "SWD_Off_P", "SWD_Off_I", "App_Type", "App_Cat", "App_PNam_Mod", "Rem_RA",
  "Recd_EGF", "Recd_PAF", "Recd_Quo", "Recd_Cat", "Ret_Rept", "MRef",
  "Req_I_SWD_YN", "D_ReqT_SWD", "Req_RepSWD_YN", "D_RetF_SWD", "Rem_Req",
  "D_WkRep", "WkRep_Status", "WkRep_Rem", "RecdCurrWk_YN", "EGF_Ready_YN",
  "EGF_To_EG_YN", "D_EGF_T_EG", "EG_Reply_YN", "D_EG_Reply", "Rem_EG",
  "EGF_To_SWD_YN", "D_EGF_ASWD", "FUF_Comp_YN", "DatEntry",
] as const;

/** Columns holding dates in the reference workbooks. */
const DATE_COLUMNS = new Set([
  "D_ReqF_SWD", "D_PlnT_SWD", "D_EGF_ASWD", "D_EGF_Out", "D_EGF_Dead",
  "D_ReqT_SWD", "D_RetF_SWD", "D_WkRep", "D_EGF_T_EG", "D_EG_Reply",
  "D_Entry", "DatEntry",
]);

/** Columns holding numbers in the reference workbooks. */
const NUMBER_COLUMNS = new Set([
  "NO", "TotAmtR", "Q12c_TotC", "No_Elderly", "No_Disable", "No_Bene",
]);

export type ExportRow = Record<string, string | number | Date>;

/**
 * dd/mm/yyyy (also dd-mm-yyyy, dd.mm.yyyy, two-digit years), yyyy-mm-dd, an
 * ISO timestamp, or an Excel serial -> Date; anything else -> "".
 *
 * The EG extractor's date regex accepts `\d{2,4}` years and any of / - . as
 * the separator, and PDF text extraction sometimes splits a year across a
 * space ("17/8/202 6"). Only the four-digit slash form used to parse, so the
 * rest exported as blank cells.
 */
export function toExcelDate(value: unknown): Date | "" {
  if (value instanceof Date) return isNaN(value.getTime()) ? "" : value;
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial (days since 1899-12-30); only plausible modern dates.
    if (value > 20000 && value < 80000) {
      return new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    }
    return "";
  }
  let s = clean(value);
  if (!s) return "";
  // Re-join a year split by a stray space: "17/8/202 6" -> "17/8/2026".
  s = s.replace(/^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{1,3})\s+(\d{1,3})$/, "$1$2");
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (dmy) {
    const day = +dmy[1];
    const month = +dmy[2];
    // Two-digit year: these registers only hold 2000s dates.
    const year = dmy[3].length === 2 ? 2000 + +dmy[3] : +dmy[3];
    if (month < 1 || month > 12 || day < 1 || day > 31) return "";
    const d = new Date(year, month - 1, day);
    // Reject roll-overs like 31/02 that the Date constructor would silently
    // turn into March.
    return d.getMonth() === month - 1 ? d : "";
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    if (iso[4] !== undefined) {
      const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
      return isNaN(d.getTime()) ? "" : d;
    }
    return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  }
  return "";
}

/**
 * Cell text. Unlike `clean`, a "/" is KEPT: the reference workbooks use it
 * as the explicit "not applicable" marker in text and count columns.
 */
export function toExcelText(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

/** Numeric strings ("12,700") -> number; blanks -> ""; "/" and other text verbatim. */
export function toExcelNumber(value: unknown): number | string {
  if (typeof value === "number") return value;
  const s = toExcelText(value);
  if (!s) return "";
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : s;
}

function coerce(column: string, value: unknown): string | number | Date {
  if (DATE_COLUMNS.has(column)) return toExcelDate(value);
  if (NUMBER_COLUMNS.has(column)) return toExcelNumber(value);
  if (typeof value === "number") return value;
  return toExcelText(value);
}

function sections(caseItem: Case) {
  return {
    eg: (caseItem.egData ?? {}) as Record<string, unknown>,
    app: (caseItem.applicationData ?? {}) as Record<string, unknown>,
    cat: (caseItem.catalogueData ?? {}) as Record<string, unknown>,
  };
}

/** Case identity columns shared by every sheet. */
function identity(caseItem: Case) {
  const { eg } = sections(caseItem);
  return {
    Ref: pick(eg.Ref, eg.SWD_Ref, eg.App_No, caseItem.caseNumber),
    Tranche: pick(eg.Tranche, caseItem.tranche),
    EB_RM: clean(eg.EB_RM),
    NO: eg.NO ?? "",
    NO_R: clean(eg.NO_R),
  };
}

function finish(columns: readonly string[], values: Record<string, unknown>): ExportRow {
  const row: ExportRow = {};
  for (const col of columns) row[col] = coerce(col, values[col]);
  return row;
}

/** A_EG_Form row: EG form + reviewer answers + PA professional/beneficiary block. */
export function buildEgFormRow(caseItem: Case): ExportRow {
  const { eg, app } = sections(caseItem);
  const defaults = deriveEgDefaults(caseItem);
  const egOr = (key: string) => pick(eg[key], defaults[key]);
  return finish(EG_FORM_COLUMNS, {
    ...identity(caseItem),
    Staff1: eg.Staff1, Staff2: eg.Staff2,
    Staff1_Info: eg.Staff1_Info, Staff2_Info: eg.Staff2_Info,
    Applicant: pick(eg.Applicant, eg.App_Type),
    App_Cat: egOr("App_Cat"),
    App_PName: pick(eg.App_PName, app.PA_PName, eg.App_PNam_Mod),
    D_ReqF_SWD: eg.D_ReqF_SWD, D_PlnT_SWD: eg.D_PlnT_SWD,
    SWD_Off_N: eg.SWD_Off_N, SWD_Off_P: eg.SWD_Off_P, SWD_Off_I: eg.SWD_Off_I,
    D_EGF_ASWD: eg.D_EGF_ASWD,
    Prof_Staff: app.Prof_Staff, Typ_Staff: app.Typ_Staff,
    No_Elderly: app.No_Elderly, No_Disable: app.No_Disable,
    Typ_Disability: app.Typ_Disability, No_Bene: app.No_Bene,
    Q12a: egOr("Q12a"),
    Q12b_Jus: egOr("Q12b_Jus"),
    Q12c_TotC: pick(eg.Q12c_TotC, app.TotAmtR),
    Q12d_Quo: eg.Q12d_Quo, Q12e_JCost: eg.Q12e_JCost,
    Q12f_RReject: egOr("Q12f_RReject"),
    Q12g_JRem: eg.Q12g_JRem,
    Q13a: egOr("Q13a"), Q13b: egOr("Q13b"),
    Remarks_EGF: pick(eg.Remarks_EGF) || "/",
    D_Entry: caseItem.createdAt,
  });
}

/** A_PA_Form row: case identity + the application form as submitted. */
export function buildPaFormRow(caseItem: Case): ExportRow {
  const { app } = sections(caseItem);
  return finish(PA_FORM_COLUMNS, {
    ...identity(caseItem),
    PA_RefL: app.PA_RefL, PA_Cat: app.PA_Cat, PA_PName: app.PA_PName,
    PA_Brand: app.PA_Brand, PA_Mod_No: app.PA_Mod_No, TotAmtR: app.TotAmtR,
    Prof_Staff: app.Prof_Staff, Typ_Staff: app.Typ_Staff,
    Staff_Avail: app.Staff_Avail, No_Elderly: app.No_Elderly,
    No_Disable: app.No_Disable, Typ_Disability: app.Typ_Disability,
    No_Bene: app.No_Bene, PA_Justify: app.PA_Justify,
    PA_Elaborate: app.PA_Elaborate,
    DatEntry: caseItem.createdAt,
  });
}

/**
 * Tracking columns that default to "Yes" with nothing on the case to back it
 * up. Recd_EGF / Recd_PAF / Recd_Cat are cross-checked against the case's own
 * sections below, so their default never applies; these three have no such
 * check. Harmless on a decided case — by the time the expert group ruled, the
 * quotation was in and SWD had been asked — but on an in-flight case the
 * register would be asserting steps that may not have happened.
 */
const UNEVIDENCED_YES_COLUMNS = [
  "Recd_Quo",
  "Req_I_SWD_YN",
  "Req_RepSWD_YN",
] as const;

/** A_Record_Admin row: the EG tracking columns, flags derived from the case. */
export function buildRecordAdminRow(caseItem: Case): ExportRow {
  const { eg: stored, app, cat } = sections(caseItem);
  const eg = applyRecordAdminDefaults(stored);
  const has = (o: Record<string, unknown>) => Object.keys(o).length > 0;
  const yesNo = (v: boolean) => (v ? "Yes" : "No");
  const values: Record<string, unknown> = { ...identity(caseItem) };
  for (const col of RECORD_ADMIN_COLUMNS) {
    if (!(col in values)) values[col] = eg[col];
  }
  Object.assign(values, {
    SWD_Ref: pick(eg.SWD_Ref, caseItem.caseNumber),
    App_No: pick(eg.App_No, eg.SWD_Ref),
    // The reference workbook keeps the responsible officer's first name here.
    Staff: pick(eg.Staff, clean(eg.Staff1).split(/[\s(]/)[0]),
    App_Type: pick(eg.App_Type, eg.Applicant),
    App_Cat: pick(eg.App_Cat, "Procurement"),
    App_PNam_Mod: pick(eg.App_PNam_Mod, app.PA_PName),
    // Stored answer first; otherwise what the case actually holds; the
    // Step 2 default ("Yes") is already in `eg` as the last resort.
    Recd_EGF: pick(stored.Recd_EGF, yesNo(caseItem.recdEG === true || has(stored)), eg.Recd_EGF),
    Recd_PAF: pick(stored.Recd_PAF, yesNo(has(app)), eg.Recd_PAF),
    Recd_Cat: pick(stored.Recd_Cat, yesNo(has(cat)), eg.Recd_Cat),
    Recd_Quo: pick(stored.Recd_Quo, eg.Recd_Quo),
    DatEntry: caseItem.createdAt,
  });
  // Undecided rows only reached this register once it started covering the
  // whole tranche. A blank cell reads as "not yet"; the default would read as
  // a claim. A value the reviewer actually stored still wins.
  if (!isDecidedCase(caseItem)) {
    for (const col of UNEVIDENCED_YES_COLUMNS) {
      values[col] = toExcelText(stored[col]);
    }
  }
  return finish(RECORD_ADMIN_COLUMNS, values);
}

export const EXPORTABLE_STATUSES = new Set<Case["status"]>(["approved", "rejected"]);

/** A case the expert group has ruled on, so it has Q12/Q13 answers to report. */
export function isDecidedCase(caseItem: Case): boolean {
  return EXPORTABLE_STATUSES.has(caseItem.status);
}

/** Only approved / rejected cases carry a decision worth putting in A_EG_Form. */
export function exportableCases(cases: Case[]): Case[] {
  return cases.filter(isDecidedCase);
}

export interface ExcelExportResult {
  fileName: string;
  /** Rows in A_PA_Form / A_Record_Admin — every case in scope. */
  caseCount: number;
  /** Rows in A_EG_Form — the approved / rejected subset. */
  decidedCount: number;
}

/**
 * Build the three workbooks for the given cases and download them as one zip
 * (browsers throttle or block three simultaneous downloads).
 *
 * Pass the whole scope (the selected tranche); this splits it per sheet. The
 * registers take every case, A_EG_Form only the decided ones.
 */
export async function exportCasesToExcel(cases: Case[]): Promise<ExcelExportResult> {
  if (cases.length === 0) {
    throw new Error("No cases to export");
  }
  const decided = exportableCases(cases);
  const [{ utils, write }, { default: PizZip }] = await Promise.all([
    import("xlsx"),
    import("pizzip"),
  ]);

  // With an empty row list json_to_sheet still writes the header row, which is
  // what an all-pending tranche should hand over for A_EG_Form.
  const workbook = (
    sheetName: string,
    columns: readonly string[],
    build: (c: Case) => ExportRow,
    rows: Case[],
  ) => {
    const wb = utils.book_new();
    const ws = utils.json_to_sheet(rows.map(build), {
      header: [...columns],
      cellDates: true,
    });
    utils.book_append_sheet(wb, ws, sheetName);
    return write(wb, { bookType: "xlsx", type: "array", cellDates: true }) as ArrayBuffer;
  };

  const zip = new PizZip();
  zip.file(
    "A_EG_Form.xlsx",
    workbook("A_EG_Form", EG_FORM_COLUMNS, buildEgFormRow, decided),
  );
  zip.file(
    "A_PA_Form.xlsx",
    workbook("A_PA_Form", PA_FORM_COLUMNS, buildPaFormRow, cases),
  );
  zip.file(
    "A_Record_Admin.xlsx",
    workbook("A_Record_Admin", RECORD_ADMIN_COLUMNS, buildRecordAdminRow, cases),
  );

  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `EG_Export_${stamp}.zip`;
  const blob = zip.generate({ type: "blob", mimeType: "application/zip" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return { fileName, caseCount: cases.length, decidedCount: decided.length };
}
