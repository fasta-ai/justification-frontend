import { describe, expect, it } from "vitest";
import { buildCaseKey, caseKeyString, joinRegisters } from "@/lib/case-import/join";
import type { ParsedRegister, RegisterRole, RegisterRow } from "@/lib/case-import/types";

function register(role: RegisterRole, rows: RegisterRow[]): ParsedRegister {
  return {
    role,
    fileName: `${role}.xlsx`,
    sheetName: role,
    columns: Object.keys(rows[0] ?? {}),
    rows,
    trancheCounts: {},
    unknownColumns: [],
  };
}

describe("buildCaseKey", () => {
  it("keys on the decomposed columns, not Ref", () => {
    const built = buildCaseKey({
      // Ref and Tranche disagree here — this row shape is real: A_PA_Form
      // carries a T12-looking Ref on a row whose Tranche column says T10.
      Ref: "SWD/LORCHE/I&T/T12/1056P",
      Tranche: "T10",
      EB_RM: "LORCHE",
      NO: "1056",
      NO_R: "P",
    });
    expect("key" in built && caseKeyString(built.key)).toBe("T10|LORCHE|1056P");
  });

  it("explains a row it cannot key", () => {
    expect(buildCaseKey({ Tranche: "T12", EB_RM: "EB", NO: "", NO_R: "P" })).toEqual({
      error: "no case number (NO is empty)",
    });
    expect(buildCaseKey({ Tranche: "", EB_RM: "EB", NO: "12", NO_R: "P" })).toEqual({
      error: "no tranche",
    });
  });
});

describe("joinRegisters", () => {
  const eg = register("eg", [
    { Ref: "T12_SWD/EB/I&TF/T12/1501P", Tranche: "T12", EB_RM: "EB", NO: 1501, NO_R: "P", Q12b_Jus: "yes" },
    { Ref: "T11_x", Tranche: "T11", EB_RM: "EB", NO: 900, NO_R: "P", Q12b_Jus: "other tranche" },
    { Ref: "T12_egonly", Tranche: "T12", EB_RM: "EB", NO: 1600, NO_R: "P", Q12b_Jus: "eg only" },
  ]);
  const pa = register("pa", [
    // The same case, written as 1501.0 by this register.
    { Ref: "whatever", Tranche: "T12", EB_RM: "EB", NO: "1501.0", NO_R: "P", PA_Justify: "j" },
  ]);
  const ra = register("recordAdmin", [
    { Ref: "T12_ra", SWD_Ref: "SWD/EB/I&TF/1501P/x", Tranche: "T12", EB_RM: "EB", NO: 1501, NO_R: "P" },
  ]);

  it("merges the three registers on the composite key", () => {
    const report = joinRegisters([eg, pa, ra], new Set(["T12"]));
    const complete = report.cases.find((c) => c.key === "T12|EB|1501P");
    expect(complete).toBeDefined();
    expect(complete?.sources.sort()).toEqual(["eg", "pa", "recordAdmin"]);
    expect(report.completeCount).toBe(1);
  });

  it("reconciles 1501 and 1501.0 rather than producing two cases", () => {
    const report = joinRegisters([eg, pa, ra], new Set(["T12"]));
    expect(report.cases.filter((c) => c.caseKey.no === "1501")).toHaveLength(1);
  });

  it("keeps an EG-only case, which still carries the justification", () => {
    const report = joinRegisters([eg, pa, ra], new Set(["T12"]));
    const egOnly = report.cases.find((c) => c.key === "T12|EB|1600P");
    expect(egOnly?.sources).toEqual(["eg"]);
    expect(report.singleCounts.eg).toBe(1);
  });

  it("honours the tranche filter", () => {
    const report = joinRegisters([eg, pa, ra], new Set(["T12"]));
    expect(report.cases.some((c) => c.caseKey.tranche === "T11")).toBe(false);
  });

  it("reports a duplicate within one register instead of overwriting", () => {
    const dup = register("eg", [
      { Tranche: "T12", EB_RM: "EB", NO: 1, NO_R: "P", Q12b_Jus: "first" },
      { Tranche: "T12", EB_RM: "EB", NO: 1, NO_R: "P", Q12b_Jus: "second" },
    ]);
    const report = joinRegisters([dup], new Set(["T12"]));
    expect(report.cases).toHaveLength(1);
    expect(report.cases[0].eg?.Q12b_Jus).toBe("first");
    expect(report.unkeyed[0].reason).toContain("duplicate");
  });

  it("prefers the Record Admin Ref for display", () => {
    const report = joinRegisters([eg, pa, ra], new Set(["T12"]));
    expect(report.cases.find((c) => c.key === "T12|EB|1501P")?.ref).toBe("T12_ra");
  });
});
