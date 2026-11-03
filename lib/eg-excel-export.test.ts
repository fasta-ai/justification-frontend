import { afterEach, describe, expect, it, vi } from "vitest";
import PizZip from "pizzip";
import { read, utils } from "xlsx";
import { KNOWN_COLUMNS } from "@/lib/case-import/registers";
import type { Case } from "@/app/api/cases/types";
import {
  EG_FORM_COLUMNS,
  PA_FORM_COLUMNS,
  RECORD_ADMIN_COLUMNS,
  buildEgFormRow,
  buildPaFormRow,
  buildRecordAdminRow,
  casesMissingApplicationData,
  exportCasesToExcel,
  exportableCases,
  hasApplicationData,
  sortByEntryDesc,
  toExcelDate,
  toExcelNumber,
} from "@/lib/eg-excel-export";

const approved: Case = {
  id: "c1",
  caseNumber: "SWD/RMB/I&TF/T13/2001P/None",
  userId: "u",
  status: "approved",
  justification: "Supported.",
  recdEG: true,
  createdAt: "2026-08-20T09:30:00.000Z",
  egData: {
    Ref: "T13_SWD/RMB/I&TF/T13/2001P",
    SWD_Ref: "SWD/RMB/I&TF/T13/2001P",
    App_No: "SWD/RMB/I&TF/T13/2001P",
    Tranche: "T13",
    EB_RM: "RMB",
    NO: 2001,
    NO_R: "P",
    Staff1: "Keer Huang (Officer/ITA)",
    Staff1_Info: "3611 8309 / keer.huang@hkcss.org.hk",
    App_Type: "1.2 RCHD",
    D_ReqF_SWD: "17/08/2026",
    D_PlnT_SWD: "31/08/2026",
    SWD_Off_N: "CHOI Wing-lam, Isa",
    SWD_Off_P: "A(ITFund)",
    SWD_Off_I: "3106 2852/ wing_lam_choi@swd.gov.hk",
    Q12d_Quo: "3",
  },
  applicationData: {
    PA_RefL: "Yes",
    PA_Cat: "17.1",
    PA_PName: "HMS Home Management System",
    PA_Brand: "Blue Glacier",
    PA_Mod_No: "HMS-1",
    TotAmtR: "600,000",
    Prof_Staff: "No",
    Typ_Staff: "/",
    Staff_Avail: "No",
    No_Elderly: "/",
    No_Disable: 60,
    Typ_Disability: "/",
    No_Bene: 30,
    PA_Justify: "Why.",
    PA_Elaborate: "How.",
  },
  catalogueData: { products: [{ product_name: "HMS" }] },
};

describe("coercion", () => {
  it("parses dd/mm/yyyy and ISO into Dates and blanks the rest", () => {
    expect(toExcelDate("17/08/2026")).toEqual(new Date(2026, 7, 17));
    expect(toExcelDate("2026-08-31")).toEqual(new Date(2026, 7, 31));
    expect(toExcelDate("2026-08-20T09:30:00.000Z")).toEqual(
      new Date("2026-08-20T09:30:00.000Z"),
    );
    expect(toExcelDate("/")).toBe("");
    expect(toExcelDate("")).toBe("");
  });
  it("accepts the extractor's other date shapes", () => {
    // Two-digit year, dashed and dotted separators, single-digit day/month.
    expect(toExcelDate("17/8/26")).toEqual(new Date(2026, 7, 17));
    expect(toExcelDate("17-08-2026")).toEqual(new Date(2026, 7, 17));
    expect(toExcelDate("17.08.2026")).toEqual(new Date(2026, 7, 17));
    // Year split by a stray space in the PDF text.
    expect(toExcelDate("17/8/202 6")).toEqual(new Date(2026, 7, 17));
    // Excel serial for 2026-08-17.
    expect(toExcelDate(46251)).toEqual(new Date(Date.UTC(2026, 7, 17)));
    // Impossible dates stay blank rather than rolling over.
    expect(toExcelDate("31/02/2026")).toBe("");
    expect(toExcelDate("17/13/2026")).toBe("");
  });
  it("turns numeric strings into numbers and keeps text", () => {
    expect(toExcelNumber("600,000")).toBe(600000);
    expect(toExcelNumber(60)).toBe(60);
    expect(toExcelNumber("/")).toBe("/");
    expect(toExcelNumber("N/A")).toBe("N/A");
  });
});

describe("buildEgFormRow", () => {
  const row = buildEgFormRow(approved);
  it("has exactly the reference columns in order", () => {
    expect(Object.keys(row)).toEqual([...EG_FORM_COLUMNS]);
  });
  it("maps identity, EG, reviewer, and PA columns", () => {
    expect(row.Ref).toBe("T13_SWD/RMB/I&TF/T13/2001P");
    expect(row.NO).toBe(2001);
    expect(row.Applicant).toBe("1.2 RCHD");
    expect(row.App_Cat).toBe("Procurement");
    expect(row.App_PName).toBe("HMS Home Management System");
    expect(row.D_ReqF_SWD).toEqual(new Date(2026, 7, 17));
    expect(row.SWD_Off_P).toBe("A(ITFund)");
    expect(row.No_Disable).toBe(60);
    expect(row.Q12a).toBe("Yes");
    expect(row.Q12b_Jus).toBe("Supported.");
    expect(row.Q12c_TotC).toBe(600000);
    expect(row.Q12d_Quo).toBe("3");
    expect(row.Q12f_RReject).toBe("NA");
    expect(row.Q13a).toBe("NIL");
    expect(row.Remarks_EGF).toBe("/");
    expect(row.D_Entry).toEqual(new Date("2026-08-20T09:30:00.000Z"));
  });
  it("uses rejected-case answers", () => {
    const r = buildEgFormRow({ ...approved, status: "rejected" });
    expect(r.Q12a).toBe("No");
    expect(r.Q12f_RReject).toBe("");
  });
});

describe("buildPaFormRow", () => {
  const row = buildPaFormRow(approved);
  it("has exactly the reference columns in order", () => {
    expect(Object.keys(row)).toEqual([...PA_FORM_COLUMNS]);
  });
  it("maps the application form", () => {
    expect(row.Ref).toBe("T13_SWD/RMB/I&TF/T13/2001P");
    expect(row.PA_Cat).toBe("17.1");
    expect(row.TotAmtR).toBe(600000);
    expect(row.No_Elderly).toBe("/");
    expect(row.Typ_Staff).toBe("/");
    expect(row.No_Bene).toBe(30);
    expect(row.PA_Elaborate).toBe("How.");
    expect(row.DatEntry).toEqual(new Date("2026-08-20T09:30:00.000Z"));
  });
});

describe("buildRecordAdminRow", () => {
  const row = buildRecordAdminRow(approved);
  it("has exactly the reference columns in order", () => {
    expect(Object.keys(row)).toEqual([...RECORD_ADMIN_COLUMNS]);
  });
  it("derives flags and the staff first name", () => {
    expect(row.SWD_Ref).toBe("SWD/RMB/I&TF/T13/2001P");
    expect(row.App_No).toBe("SWD/RMB/I&TF/T13/2001P");
    expect(row.Staff).toBe("Keer");
    expect(row.App_Type).toBe("1.2 RCHD");
    expect(row.App_PNam_Mod).toBe("HMS Home Management System");
    expect(row.Recd_EGF).toBe("Yes");
    expect(row.Recd_PAF).toBe("Yes");
    expect(row.Recd_Cat).toBe("Yes");
    expect(row.Recd_Quo).toBe("Yes");
    expect(row.Req_I_SWD_YN).toBe("NA");
    expect(row.Ret_Rept).toBe("No");
    expect(row.EGF_To_SWD_YN).toBe("No");
    expect(row.MRef).toBe("");
    expect(row.D_ReqF_SWD).toEqual(new Date(2026, 7, 17));
  });
  it("keeps stored tracking values over derived ones", () => {
    const r = buildRecordAdminRow({
      ...approved,
      egData: { ...approved.egData, Staff: "Argus", Recd_Cat: "No", MRef: "S570", EGF_Ready_YN: "Yes" },
    });
    expect(r.Staff).toBe("Argus");
    expect(r.Recd_Cat).toBe("No");
    expect(r.MRef).toBe("S570");
    expect(r.EGF_Ready_YN).toBe("Yes");
  });
});

describe("buildRecordAdminRow on a case that is not decided", () => {
  const pending: Case = { ...approved, status: "pending" };
  const row = buildRecordAdminRow(pending);

  it("leaves the unevidenced Yes defaults blank", () => {
    expect(row.Recd_Quo).toBe("");
    expect(row.Req_I_SWD_YN).toBe("");
    expect(row.Req_RepSWD_YN).toBe("");
  });

  it("keeps the flags that are checked against the case", () => {
    expect(row.Recd_EGF).toBe("Yes");
    expect(row.Recd_PAF).toBe("Yes");
    expect(row.Recd_Cat).toBe("Yes");
  });

  it("keeps the No defaults, which are true of an in-flight case", () => {
    expect(row.Ret_Rept).toBe("No");
    expect(row.EGF_Ready_YN).toBe("No");
    expect(row.EGF_To_SWD_YN).toBe("No");
  });

  it("still prefers a value the reviewer stored, including the / marker", () => {
    const stored = buildRecordAdminRow({
      ...pending,
      egData: { ...approved.egData, Recd_Quo: "No", Req_I_SWD_YN: "/" },
    });
    expect(stored.Recd_Quo).toBe("No");
    expect(stored.Req_I_SWD_YN).toBe("/");
  });

  it("does not touch the decided rows", () => {
    expect(buildRecordAdminRow(approved).Recd_Quo).toBe("Yes");
    expect(buildRecordAdminRow({ ...approved, status: "rejected" }).Recd_Quo).toBe("Yes");
  });
});

describe("exportableCases", () => {
  it("keeps only approved and rejected", () => {
    const list = [
      approved,
      { ...approved, id: "c2", status: "rejected" as const },
      { ...approved, id: "c3", status: "pending" as const },
      { ...approved, id: "c4", status: "under_review" as const },
    ];
    expect(exportableCases(list).map((c) => c.id)).toEqual(["c1", "c2"]);
  });
});

describe("App_Cat (Procurement / Rental only)", () => {
  const rental: Case = {
    ...approved,
    id: "rental",
    egData: { ...approved.egData, App_Cat: "Rental" },
    applicationData: { ...approved.applicationData, PA_RefL: "Yes" },
  };
  const procurementWithNo: Case = {
    ...approved,
    id: "procurement",
    egData: { ...approved.egData, App_Cat: "" },
    applicationData: { ...approved.applicationData, PA_RefL: "No" },
  };
  const leakedYes: Case = {
    ...approved,
    id: "leaked",
    egData: { ...approved.egData, App_Cat: "Yes" },
  };

  it("sits at column K (11th) of A_EG_Form and Q (17th) of A_Record_Admin", () => {
    expect(EG_FORM_COLUMNS.indexOf("App_Cat")).toBe(10);
    expect(RECORD_ADMIN_COLUMNS.indexOf("App_Cat")).toBe(16);
    expect(utils.encode_col(EG_FORM_COLUMNS.indexOf("App_Cat"))).toBe("K");
    expect(utils.encode_col(RECORD_ADMIN_COLUMNS.indexOf("App_Cat"))).toBe("Q");
    // The importer reads the client's registers with the same layout.
    expect(KNOWN_COLUMNS.eg).toEqual([...EG_FORM_COLUMNS]);
    expect(KNOWN_COLUMNS.recordAdmin).toEqual([...RECORD_ADMIN_COLUMNS]);
  });

  it("exports a stored Rental on both sheets", () => {
    expect(buildEgFormRow(rental).App_Cat).toBe("Rental");
    expect(buildRecordAdminRow(rental).App_Cat).toBe("Rental");
  });

  it("never lets PA_RefL's Yes/No through, and repairs a leaked Yes", () => {
    for (const c of [procurementWithNo, leakedYes, approved]) {
      expect(buildEgFormRow(c).App_Cat).toBe("Procurement");
      expect(buildRecordAdminRow(c).App_Cat).toBe("Procurement");
    }
  });

  describe("exportCasesToExcel workbooks", () => {
    afterEach(() => vi.restoreAllMocks());

    async function exportZip(cases: Case[]): Promise<PizZip> {
      let blob: Blob | undefined;
      const origCreate = URL.createObjectURL;
      const origRevoke = URL.revokeObjectURL;
      URL.createObjectURL = ((b: Blob) => {
        blob = b;
        return "blob:test";
      }) as typeof URL.createObjectURL;
      URL.revokeObjectURL = () => {};
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      try {
        await exportCasesToExcel(cases);
      } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
      }
      const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as ArrayBuffer);
        fr.onerror = () => reject(fr.error);
        fr.readAsArrayBuffer(blob!);
      });
      return new PizZip(buf);
    }

    function sheetOf(zip: PizZip, file: string) {
      const wb = read(zip.file(file)!.asUint8Array(), { type: "array" });
      return wb.Sheets[wb.SheetNames[0]];
    }

    it("writes Rental / Procurement at A_EG_Form K and A_Record_Admin Q", async () => {
      const zip = await exportZip([rental, procurementWithNo, leakedYes]);
      const eg = sheetOf(zip, "A_EG_Form.xlsx");
      const ra = sheetOf(zip, "A_Record_Admin.xlsx");
      expect(eg.K1.v).toBe("App_Cat");
      expect(ra.Q1.v).toBe("App_Cat");
      expect([eg.K2.v, eg.K3.v, eg.K4.v]).toEqual(["Rental", "Procurement", "Procurement"]);
      expect([ra.Q2.v, ra.Q3.v, ra.Q4.v]).toEqual(["Rental", "Procurement", "Procurement"]);
      for (const sheet of [eg, ra]) {
        const col = sheet === eg ? "K" : "Q";
        const values = utils
          .sheet_to_json<string[]>(sheet, { header: 1 })
          .slice(1)
          .map((r) => r[utils.decode_col(col)]);
        for (const v of values) expect(["Procurement", "Rental"]).toContain(v);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Issue 3: A_PA_Form rows with only Ref/Tranche/EB_RM/NO/NO_R filled.
// ---------------------------------------------------------------------------

describe("A_PA_Form when the application form was never extracted", () => {
  // What Stage 2 saved when the application extraction failed / was still
  // running (applicationData {}), or what the AI-review overwrite left behind
  // (only the field it tidied).
  const noApp: Case = { ...approved, id: "noapp", applicationData: {} };
  const wiped: Case = {
    ...approved,
    id: "wiped",
    applicationData: { Typ_Disability: "Physical" },
  };
  const nullApp: Case = { ...approved, id: "null", applicationData: undefined };

  it("detects the cases", () => {
    expect(hasApplicationData(approved)).toBe(true);
    for (const c of [noApp, wiped, nullApp]) expect(hasApplicationData(c)).toBe(false);
    expect(
      casesMissingApplicationData([approved, noApp, wiped]).map((c) => c.id),
    ).toEqual(["noapp", "wiped"]);
  });

  it("fills what the case knows from the EG form and catalogue, nothing else", () => {
    const row = buildPaFormRow({
      ...noApp,
      egData: { ...approved.egData, App_PName: "HMS (EG)", Q12c_TotC: "12,700" },
      catalogueData: { products: [{ product_name: "HMS (cat)", model: "HMS-9" }] },
    });
    expect(row.Ref).toBe("T13_SWD/RMB/I&TF/T13/2001P");
    expect(row.NO).toBe(2001);
    expect(row.PA_PName).toBe("HMS (EG)");
    expect(row.PA_Mod_No).toBe("HMS-9");
    expect(row.TotAmtR).toBe(12700);
    // Only the application form holds these: not invented.
    expect(row.PA_RefL).toBe("");
    expect(row.PA_Cat).toBe("");
    expect(row.PA_Brand).toBe("");
    expect(row.PA_Justify).toBe("");
  });

  it("falls back to the catalogue product name when the EG form has none", () => {
    const row = buildPaFormRow({
      ...noApp,
      egData: { ...approved.egData, App_PName: "", App_PNam_Mod: "" },
      catalogueData: { products: [{ product_name: "HMS (cat)" }] },
    });
    expect(row.PA_PName).toBe("HMS (cat)");
  });

  it("keeps a real application form as submitted, '/' markers included", () => {
    const row = buildPaFormRow({
      ...approved,
      applicationData: { ...approved.applicationData, PA_Mod_No: "/" },
      catalogueData: { products: [{ model: "OTHER" }] },
    });
    expect(row.PA_PName).toBe("HMS Home Management System");
    expect(row.PA_Mod_No).toBe("/");
    expect(row.PA_Brand).toBe("Blue Glacier");
  });
});

// ---------------------------------------------------------------------------
// Issue 4: rows ordered latest D_Entry first on every sheet.
// ---------------------------------------------------------------------------

describe("D_Entry ordering", () => {
  const mk = (id: string, createdAt: string, no: number, status: Case["status"] = "approved"): Case => ({
    ...approved,
    id,
    status,
    createdAt,
    caseNumber: `${no}P`,
    egData: { ...approved.egData, NO: no, NO_R: "P", Ref: `R${no}` },
  });
  // Deliberately out of order; "updated" order would differ again.
  const oldest = mk("oldest", "2026-01-05T02:00:00.000Z", 1500);
  const middle = mk("middle", "2026-09-28T02:00:00.000Z", 1600, "pending");
  // Same entry instant (one Stage 2 save) - tie broken by NO desc.
  const newestLowNo = mk("newestLowNo", "2026-10-02T03:00:00.000Z", 1700, "rejected");
  const newestHighNo = mk("newestHighNo", "2026-10-02T03:00:00.000Z", 1701);
  // 10/02 vs 28/09: a d/m/yyyy string compare would put 28/09 first.
  const input = [oldest, newestLowNo, middle, newestHighNo];

  it("sorts on the real date, latest first, NO desc on ties", () => {
    expect(sortByEntryDesc(input).map((c) => c.id)).toEqual([
      "newestHighNo", "newestLowNo", "middle", "oldest",
    ]);
    // Input is not mutated, and the result does not depend on input order.
    expect(input[0].id).toBe("oldest");
    expect(sortByEntryDesc([...input].reverse()).map((c) => c.id)).toEqual(
      sortByEntryDesc(input).map((c) => c.id),
    );
  });

  it("puts cases with no usable entry date last", () => {
    const undated = { ...mk("undated", "", 9999) };
    expect(sortByEntryDesc([undated, oldest]).map((c) => c.id)).toEqual([
      "oldest", "undated",
    ]);
  });

  it("orders all three workbooks the same way", async () => {
    let blob: Blob | undefined;
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = ((b: Blob) => {
      blob = b;
      return "blob:test";
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = () => {};
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    let result;
    try {
      result = await exportCasesToExcel(input);
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      click.mockRestore();
    }
    expect(result.missingApplication).toEqual([]);
    const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as ArrayBuffer);
      fr.onerror = () => reject(fr.error);
      fr.readAsArrayBuffer(blob!);
    });
    const zip = new PizZip(buf);
    const nos = (file: string) => {
      const wb = read(zip.file(file)!.asUint8Array(), { type: "array" });
      return utils
        .sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])
        .map((r) => r.NO);
    };
    expect(nos("A_PA_Form.xlsx")).toEqual([1701, 1700, 1600, 1500]);
    expect(nos("A_Record_Admin.xlsx")).toEqual([1701, 1700, 1600, 1500]);
    // A_EG_Form: decided only (1600 is pending), same order.
    expect(nos("A_EG_Form.xlsx")).toEqual([1701, 1700, 1500]);
  });

  it("reports the cases exported without an application form", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = (() => "blob:test") as typeof URL.createObjectURL;
    URL.revokeObjectURL = () => {};
    try {
      const r = await exportCasesToExcel([
        oldest,
        { ...middle, applicationData: {} },
      ]);
      expect(r.missingApplication).toEqual(["1600P"]);
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      click.mockRestore();
    }
  });
});
