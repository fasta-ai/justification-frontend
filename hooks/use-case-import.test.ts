import { describe, expect, it } from "vitest";
import {
  buildRows,
  extractableRows,
  extractionSkipReasons,
} from "@/hooks/use-case-import";
import type {
  RegisterRole,
  CaseFolder,
  ClassifiedFile,
  JoinReport,
  JoinedCase,
} from "@/lib/case-import/types";

function classified(
  name: string,
  confidence: ClassifiedFile["confidence"],
  path?: string,
): ClassifiedFile {
  return {
    file: new File(["x"], name),
    path: path ?? name,
    name,
    size: 1000,
    kind: "catalogue",
    confidence,
  };
}

function joined(no: string): JoinedCase {
  return {
    key: `T12|LORCHE|${no}P`,
    caseKey: { tranche: "T12", unit: "LORCHE", no, noR: "P" },
    ref: `ref-${no}`,
    eg: { Q12b_Jus: "j" },
    pa: null,
    recordAdmin: null,
    sources: ["eg"],
  };
}

function folder(
  no: string,
  candidates: ClassifiedFile[],
  noR = "P",
): CaseFolder {
  return {
    folderName: `${no}${noR}_LORCHE_T12_GP_g`,
    caseKey: { tranche: "T12", unit: "LORCHE", no, noR },
    ragStatus: "g",
    isRevised: false,
    appType: "GP",
    files: candidates,
    catalogueCandidates: candidates,
  };
}

function report(cases: JoinedCase[]): JoinReport {
  return {
    cases,
    completeCount: 0,
    partialCount: 0,
    singleCounts: { eg: cases.length, pa: 0, recordAdmin: 0 },
    unkeyed: [],
  };
}

describe("buildRows", () => {
  it("auto-selects when exactly one high-confidence catalogue exists", () => {
    const rows = buildRows(
      report([joined("1001")]),
      [folder("1001", [classified("1001P_Catalogue.pdf", "high")])],
      new Set(),
    );
    expect(rows[0].bucket).toBe("confident");
    expect(rows[0].selectedCatalogue?.name).toBe("1001P_Catalogue.pdf");
    expect(rows[0].extraction.status).toBe("idle");
  });

  it("asks the user when several files are plausible", () => {
    const rows = buildRows(
      report([joined("1328")]),
      [
        folder("1328", [
          classified("1328 spec (1).pdf", "medium"),
          classified("1328 spec (2).pdf", "medium"),
        ]),
      ],
      new Set(),
    );
    expect(rows[0].bucket).toBe("ambiguous");
    expect(rows[0].selectedCatalogue).toBeNull();
  });

  it("takes a lone medium-confidence file rather than stalling on it", () => {
    const rows = buildRows(
      report([joined("1073")]),
      [folder("1073", [classified("1073P-leaflet.pdf", "medium")])],
      new Set(),
    );
    expect(rows[0].bucket).toBe("confident");
    expect(rows[0].selectedCatalogue?.name).toBe("1073P-leaflet.pdf");
  });

  it("prefers the original submission over a copy attached to an email reply", () => {
    // 129 of the 291 T12 folders carry a Re_<date> subfolder holding a second
    // catalogue. Both look equally good on name alone.
    const rows = buildRows(
      report([joined("1039")]),
      [
        folder("1039", [
          classified("1039P-Catalogue.pdf", "high"),
          classified(
            "1039P-Catalogue.2.pdf",
            "high",
            "Re_20260316/1039P-Catalogue.2.pdf",
          ),
        ]),
      ],
      new Set(),
    );
    expect(rows[0].bucket).toBe("confident");
    expect(rows[0].selectedCatalogue?.name).toBe("1039P-Catalogue.pdf");
  });

  it("still asks when two strong candidates sit side by side at the root", () => {
    const rows = buildRows(
      report([joined("1041")]),
      [
        folder("1041", [
          classified("1041P-Catalogue.pdf", "high"),
          classified("1041P-Catalogue.2.pdf", "high"),
        ]),
      ],
      new Set(),
    );
    expect(rows[0].bucket).toBe("ambiguous");
    expect(rows[0].selectedCatalogue).toBeNull();
  });

  it("marks a folder with no readable catalogue as needing a pick", () => {
    const rows = buildRows(
      report([joined("1310")]),
      [folder("1310", [])],
      new Set(),
    );
    expect(rows[0].bucket).toBe("none");
    expect(rows[0].extraction.status).toBe("skipped");
  });

  it("matches a folder whose name left the case-number suffix off", () => {
    // Nine T12 LORCHD folders are named 2025_LORCHD_… while the register row
    // is 2025 + P. Keyed strictly, the documents go missing.
    const rows = buildRows(
      report([joined("2025")]),
      [folder("2025", [classified("2025P_Catalogue.pdf", "high")], "")],
      new Set(),
    );
    expect(rows[0].folder).not.toBeNull();
    expect(rows[0].bucket).toBe("confident");
    expect(rows[0].selectedCatalogue?.name).toBe("2025P_Catalogue.pdf");
  });

  it("refuses the loose match when two folders claim the same number", () => {
    const rows = buildRows(
      report([joined("2025")]),
      [
        folder("2025", [classified("a.pdf", "high")], ""),
        { ...folder("2025", [classified("b.pdf", "high")], ""), folderName: "dup" },
      ],
      new Set(),
    );
    expect(rows[0].folder).toBeNull();
  });

  it("keeps a case with no folder at all — it still carries the justification", () => {
    const rows = buildRows(report([joined("1600")]), [], new Set());
    expect(rows[0].bucket).toBe("registerOnly");
    expect(rows[0].folder).toBeNull();
  });

  it("flags rows whose key is already in the corpus", () => {
    const rows = buildRows(
      report([joined("1001"), joined("1002")]),
      [],
      new Set(["T12|LORCHE|1001P"]),
    );
    expect(rows[0].alreadyInCorpus).toBe(true);
    expect(rows[1].alreadyInCorpus).toBe(false);
  });
});

describe("extractableRows", () => {
  const ALL_THREE: RegisterRole[] = ["eg", "pa", "recordAdmin"];

  function row(over: Partial<import("@/lib/case-import/types").ImportRow> = {}) {
    const base = buildRows(
      report([
        {
          key: "T12|LORCHE|1003P",
          caseKey: { tranche: "T12", unit: "LORCHE", no: "1003", noR: "P" },
          ref: "r",
          eg: { Q12b_Jus: "j" },
          pa: {},
          recordAdmin: { App_PNam_Mod: "Chair / STB203" },
          sources: ["eg", "pa", "recordAdmin"],
        },
      ]),
      [folder("1003", [classified("1003P_Catalogue.pdf", "high")])],
      new Set(),
    )[0];
    return { ...base, ...over };
  }

  it("includes a case that is ready to extract", () => {
    expect(extractableRows([row()], ALL_THREE)).toHaveLength(1);
  });

  it("skips a case already in the corpus — it would be dropped at commit", () => {
    const rows = [row({ alreadyInCorpus: true })];
    expect(extractableRows(rows, ALL_THREE)).toHaveLength(0);
    expect(extractionSkipReasons(rows, ALL_THREE).alreadyInCorpus).toBe(1);
  });

  it("skips a case missing from a register", () => {
    const r = row();
    const rows = [{ ...r, joined: { ...r.joined, pa: null, sources: ["eg", "recordAdmin"] as const } }];
    // @ts-expect-error narrowed literal tuple is fine for the shape under test
    expect(extractableRows(rows, ALL_THREE)).toHaveLength(0);
  });

  it("does not treat the missing catalogue as a reason to skip extraction", () => {
    // catalogueDesc is empty here — that is what extraction is for.
    expect(row().catalogueDesc).toBe("");
    expect(extractableRows([row()], ALL_THREE)).toHaveLength(1);
  });
});
