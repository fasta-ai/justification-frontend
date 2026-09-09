import { describe, expect, it } from "vitest";
import { buildRows } from "@/hooks/use-case-import";
import type {
  CaseFolder,
  ClassifiedFile,
  JoinReport,
  JoinedCase,
} from "@/lib/case-import/types";

function classified(name: string, confidence: ClassifiedFile["confidence"]): ClassifiedFile {
  return {
    file: new File(["x"], name),
    path: name,
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

function folder(no: string, candidates: ClassifiedFile[]): CaseFolder {
  return {
    folderName: `${no}P_LORCHE_T12_GP_g`,
    caseKey: { tranche: "T12", unit: "LORCHE", no, noR: "P" },
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

  it("marks a folder with no readable catalogue as needing a pick", () => {
    const rows = buildRows(
      report([joined("1310")]),
      [folder("1310", [])],
      new Set(),
    );
    expect(rows[0].bucket).toBe("none");
    expect(rows[0].extraction.status).toBe("skipped");
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
