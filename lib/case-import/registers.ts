import * as XLSX from "xlsx";
import type { ParsedRegister, RegisterRole, RegisterRow } from "./types";
import { cleanText, normaliseToken } from "./normalise";

/**
 * Reading the three register workbooks.
 *
 * Files are identified by their header signature rather than their filename,
 * because the client renames them. Each register is a single sheet with one
 * header row and one row per case.
 */

/** Columns this build knows how to use, per register. */
export const KNOWN_COLUMNS: Record<RegisterRole, readonly string[]> = {
  eg: [
    "Ref", "Tranche", "EB_RM", "NO", "NO_R", "Staff1", "Staff2", "Staff1_Info",
    "Staff2_Info", "Applicant", "App_Cat", "App_PName", "D_ReqF_SWD",
    "D_PlnT_SWD", "SWD_Off_N", "SWD_Off_P", "SWD_Off_I", "D_EGF_ASWD",
    "Prof_Staff", "Typ_Staff", "No_Elderly", "No_Disable", "Typ_Disability",
    "No_Bene", "Q12a", "Q12b_Jus", "Q12c_TotC", "Q12d_Quo", "Q12e_JCost",
    "Q12f_RReject", "Q12g_JRem", "Q13a", "Q13b", "Remarks_EGF", "D_Entry",
  ],
  pa: [
    "Ref", "Tranche", "EB_RM", "NO", "NO_R", "PA_RefL", "PA_Cat", "PA_PName",
    "PA_Brand", "PA_Mod_No", "TotAmtR", "Prof_Staff", "Typ_Staff",
    "Staff_Avail", "No_Elderly", "No_Disable", "Typ_Disability", "No_Bene",
    "PA_Justify", "PA_Elaborate", "DatEntry",
  ],
  recordAdmin: [
    "SWD_Ref", "Ref", "App_No", "Tranche", "EB_RM", "NO", "NO_R", "Staff",
    "D_ReqF_SWD", "D_PlnT_SWD", "D_EGF_Out", "D_EGF_Dead", "SWD_Off_N",
    "SWD_Off_P", "SWD_Off_I", "App_Type", "App_Cat", "App_PNam_Mod", "Rem_RA",
    "Recd_EGF", "Recd_PAF", "Recd_Quo", "Recd_Cat", "Ret_Rept", "MRef",
    "Req_I_SWD_YN", "D_ReqT_SWD", "Req_RepSWD_YN", "D_RetF_SWD", "Rem_Req",
    "D_WkRep", "WkRep_Status", "WkRep_Rem", "RecdCurrWk_YN", "EGF_Ready_YN",
    "EGF_To_EG_YN", "D_EGF_T_EG", "EG_Reply_YN", "D_EG_Reply", "Rem_EG",
    "EGF_To_SWD_YN", "D_EGF_ASWD", "FUF_Comp_YN", "DatEntry",
  ],
};

export const REGISTER_LABELS: Record<RegisterRole, string> = {
  eg: "EG Form register",
  pa: "PA Form register",
  recordAdmin: "Record Admin register",
};

/**
 * Columns unique enough to identify a register on their own.
 *
 * All three share Ref / Tranche / EB_RM / NO / NO_R, so identification has to
 * key on a column only one of them has.
 */
const SIGNATURES: { role: RegisterRole; required: string[] }[] = [
  { role: "eg", required: ["Q12b_Jus"] },
  { role: "pa", required: ["PA_Justify"] },
  { role: "recordAdmin", required: ["SWD_Ref", "Recd_EGF"] },
];

/** The register a header row belongs to, or null when nothing matches. */
export function identifyRegister(columns: string[]): RegisterRole | null {
  const present = new Set(columns.map((c) => c.trim()));
  for (const { role, required } of SIGNATURES) {
    if (required.every((col) => present.has(col))) return role;
  }
  return null;
}

/**
 * Parse one workbook.
 *
 * `role` overrides identification, for the case where the user reassigns a
 * file the signature could not place.
 */
export function parseRegisterWorkbook(
  data: ArrayBuffer,
  fileName: string,
  role?: RegisterRole,
): ParsedRegister {
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error(`${fileName}: workbook has no sheets`);

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RegisterRow>(sheet, {
    defval: null,
    // Keep raw values: date columns are serials we convert ourselves, and
    // letting SheetJS format them produces locale-dependent strings.
    raw: true,
  });

  const columns: string[] = [];
  const headerRange = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRange.s.r, c })];
    if (cell && cell.v != null) columns.push(String(cell.v).trim());
  }

  const resolved = role ?? identifyRegister(columns);
  if (!resolved) {
    throw new Error(
      `${fileName}: not recognised as an EG, PA or Record Admin register. ` +
        `Expected one of Q12b_Jus, PA_Justify, or SWD_Ref + Recd_EGF among its columns.`,
    );
  }

  const known = new Set(KNOWN_COLUMNS[resolved]);
  const unknownColumns = columns.filter((c) => c && !known.has(c));

  const trancheCounts: Record<string, number> = {};
  for (const row of rows) {
    const tranche = normaliseToken(row["Tranche"]);
    const bucket = tranche || "(no tranche)";
    trancheCounts[bucket] = (trancheCounts[bucket] ?? 0) + 1;
  }

  return {
    role: resolved,
    fileName,
    sheetName,
    columns,
    rows,
    trancheCounts,
    unknownColumns,
  };
}

/** Every tranche across the parsed registers, ordered T2, T3, … T8a, T8b, … */
export function collectTranches(registers: ParsedRegister[]): string[] {
  const all = new Set<string>();
  for (const reg of registers) {
    for (const tranche of Object.keys(reg.trancheCounts)) all.add(tranche);
  }
  return [...all].sort(compareTranche);
}

/** `T8a` sorts after `T8` and before `T8b`; `T10` after `T9b`. */
export function compareTranche(a: string, b: string): number {
  const parse = (t: string) => {
    const m = /^T(\d+)([a-z]*)$/i.exec(t.trim());
    return m ? { n: Number(m[1]), s: m[2].toLowerCase() } : { n: Infinity, s: t };
  };
  const pa = parse(a);
  const pb = parse(b);
  if (pa.n !== pb.n) return pa.n - pb.n;
  return pa.s.localeCompare(pb.s);
}

/** Rows of one register belonging to the selected tranches. */
export function rowsForTranches(
  register: ParsedRegister,
  tranches: Set<string>,
): RegisterRow[] {
  return register.rows.filter((row) =>
    tranches.has(normaliseToken(row["Tranche"]) || "(no tranche)"),
  );
}

/** Best available display reference across whichever registers matched. */
export function displayRef(rows: (RegisterRow | null)[]): string {
  for (const row of rows) {
    if (!row) continue;
    const ref = cleanText(row["Ref"]);
    if (ref) return ref;
  }
  for (const row of rows) {
    if (!row) continue;
    const alt = cleanText(row["SWD_Ref"]) || cleanText(row["App_No"]);
    if (alt) return alt;
  }
  return "";
}
