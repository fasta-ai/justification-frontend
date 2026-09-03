import { describe, expect, it } from "vitest";
import type { Case } from "@/app/api/cases/types";
import {
  buildEgFormData,
  deriveEgDefaults,
  egFormFileName,
  formatSwdOfficer,
  joinStaff,
  stripTranche,
} from "@/lib/eg-form";

const baseCase: Case = {
  id: "case-1",
  caseNumber: "SWD/RMB/I&TF/T13/2001P/None",
  userId: "u1",
  status: "approved",
  justification: "Line one.\nLine two.",
  tranche: "T13",
  egData: {
    Ref: "T13_SWD/RMB/I&TF/T13/2001P",
    App_No: "2001P",
    Tranche: "T13",
    App_Type: "1.2 RCHD",
    D_ReqF_SWD: "17/08/2026",
    D_PlnT_SWD: "2026-08-31 00:00:00",
    SWD_Off_N: "CHOI Wing-lam, Isa",
    SWD_Off_P: "A(ITFund)",
    SWD_Off_I: "3106 2852/ wing_lam_choi@swd.gov.hk",
    Staff1: "Alice (Manager)",
    Staff2: "Bob (Officer)",
    Staff1_Info: "1111 / alice@hkcss.org.hk",
    Staff2_Info: "/",
  },
  applicationData: { PA_PName: "HMS Home Management System", TotAmtR: 123456 },
};

describe("stripTranche", () => {
  it("removes the tranche prefix from Ref", () => {
    expect(stripTranche("T13_SWD/RMB/I&TF/T13/2001P", "T13")).toBe(
      "SWD/RMB/I&TF/T13/2001P",
    );
  });
  it("falls back to a generic T<n>_ prefix when tranche is unknown", () => {
    expect(stripTranche("T11_SWD/EB/I&TF/T11/1578P")).toBe(
      "SWD/EB/I&TF/T11/1578P",
    );
  });
  it("treats '/' as empty", () => {
    expect(stripTranche("/", "T13")).toBe("");
  });
});

describe("formatSwdOfficer", () => {
  it("joins name and post with a slash", () => {
    expect(formatSwdOfficer("CHOI Wing-lam, Isa", "A(ITFund)")).toBe(
      "CHOI Wing-lam, Isa / A(ITFund)",
    );
  });
  it("keeps a name that already contains the post", () => {
    expect(formatSwdOfficer("CHOI / A(ITFund)", "A(ITFund)")).toBe(
      "CHOI / A(ITFund)",
    );
  });
  it("drops a missing post", () => {
    expect(formatSwdOfficer("CHOI", "/")).toBe("CHOI");
  });
});

describe("joinStaff", () => {
  it("joins two staff with a comma and skips empties", () => {
    expect(joinStaff("A", "B")).toBe("A, B");
    expect(joinStaff("A", "/")).toBe("A");
    expect(joinStaff("", "")).toBe("");
  });
});

describe("buildEgFormData", () => {
  it("maps an approved case", () => {
    const d = buildEgFormData(baseCase);
    expect(d.Applicant).toBe("1.2 RCHD");
    expect(d.App_Cat).toBe("Procurement");
    expect(d.App_PName).toBe("HMS Home Management System");
    expect(d.D_ReqF_SWD).toBe("17/08/2026");
    expect(d.D_PlnT_SWD).toBe("31/08/2026");
    expect(d.Ref).toBe("SWD/RMB/I&TF/T13/2001P");
    expect(d.SWD_Off).toBe("CHOI Wing-lam, Isa / A(ITFund)");
    expect(d.SWD_Off_I).toBe("3106 2852/ wing_lam_choi@swd.gov.hk");
    expect(d.D_EGF_ASWD).toBe("");
    expect(d.Staff).toBe("Alice (Manager), Bob (Officer)");
    expect(d.Staff_Info).toBe("1111 / alice@hkcss.org.hk");
    expect(d.Q12a).toBe("Yes");
    expect(d.Q12b_Jus).toBe("Line one.\nLine two.");
    expect(d.Q12c_TotC).toBe("123,456");
    expect(d.Q12f_RReject).toBe("NA");
    expect(d.Q13a).toBe("NIL");
    expect(d.Q13b).toBe("NIL");
  });

  it("maps a rejected case", () => {
    const d = buildEgFormData({ ...baseCase, status: "rejected" });
    expect(d.Q12a).toBe("No");
    expect(d.Q12f_RReject).toBe("Line one.\nLine two.");
  });

  it("prefers values already stored on egData", () => {
    const d = buildEgFormData({
      ...baseCase,
      egData: {
        ...baseCase.egData,
        Q12a: "No",
        Q12c_TotC: "99,000",
        Q12d_Quo: "3",
        Q12f_RReject: "Cost too high",
        App_Cat: "Rental",
        Applicant: "Elderly home",
      },
    });
    expect(d.Q12a).toBe("No");
    expect(d.Q12c_TotC).toBe("99,000");
    expect(d.Q12d_Quo).toBe("3");
    expect(d.Q12f_RReject).toBe("Cost too high");
    expect(d.App_Cat).toBe("Rental");
    expect(d.Applicant).toBe("Elderly home");
  });
});

describe("egFormFileName", () => {
  it("uses App_No", () => {
    expect(egFormFileName(baseCase)).toBe("2001P_EG Form.docx");
  });
  it("sanitises the case number when App_No is missing", () => {
    expect(egFormFileName({ ...baseCase, egData: {} })).toBe(
      "SWD_RMB_I&TF_T13_2001P_None_EG Form.docx",
    );
  });
});

describe("deriveEgDefaults", () => {
  it("derives empty egData keys from the case for an approved case", () => {
    expect(deriveEgDefaults(baseCase)).toEqual({
      App_Cat: "Procurement",
      App_PNam_Mod: "HMS Home Management System",
      Q12a: "Yes",
      Q12b_Jus: "Line one.\nLine two.",
      Q12c_TotC: "123,456",
      Q12f_RReject: "NA",
      Q13a: "NIL",
      Q13b: "NIL",
    });
  });

  it("does not override keys already set on egData and treats '/' as empty", () => {
    const d = deriveEgDefaults({
      ...baseCase,
      status: "rejected",
      egData: { ...baseCase.egData, App_Cat: "Rental", Q13a: "/", Q12b_Jus: "Own text" },
    });
    expect(d.App_Cat).toBeUndefined();
    expect(d.Q12b_Jus).toBeUndefined();
    expect(d.Q13a).toBe("NIL");
    expect(d.Q12a).toBe("No");
    expect(d.Q12f_RReject).toBeUndefined();
  });

  it("returns nothing status-dependent for a pending case", () => {
    const d = deriveEgDefaults({ ...baseCase, status: "pending" });
    expect(d.Q12a).toBeUndefined();
    expect(d.Q12f_RReject).toBeUndefined();
    expect(d.Q13a).toBe("NIL");
  });
});
