import { describe, expect, it } from "vitest";
import type { Case } from "@/app/api/cases/types";
import {
  EG_FORM_COLUMNS,
  PA_FORM_COLUMNS,
  RECORD_ADMIN_COLUMNS,
  buildEgFormRow,
  buildPaFormRow,
  buildRecordAdminRow,
  exportableCases,
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
    expect(row.Req_I_SWD_YN).toBe("Yes");
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
