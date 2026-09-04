import { describe, expect, it } from "vitest";
import {
  applyRecordAdminDefaults,
  recordAdminDefault,
} from "@/lib/record-admin-defaults";

describe("record admin defaults", () => {
  it("knows the Yes and No columns and nothing else", () => {
    expect(recordAdminDefault("Recd_EGF")).toBe("Yes");
    expect(recordAdminDefault("Req_RepSWD_YN")).toBe("Yes");
    expect(recordAdminDefault("EGF_Ready_YN")).toBe("No");
    expect(recordAdminDefault("FUF_Comp_YN")).toBe("No");
    expect(recordAdminDefault("MRef")).toBeUndefined();
    expect(recordAdminDefault("Q12a")).toBeUndefined();
  });

  it("fills blanks and keeps stored answers", () => {
    const out = applyRecordAdminDefaults({
      Ref: "T13_X",
      Recd_Cat: "No",
      EGF_Ready_YN: "",
      EG_Reply_YN: "/",
      Rem_RA: "Model list: S570",
    });
    expect(out.Ref).toBe("T13_X");
    expect(out.Recd_Cat).toBe("No");
    expect(out.Recd_EGF).toBe("Yes");
    expect(out.EGF_Ready_YN).toBe("No");
    expect(out.EG_Reply_YN).toBe("No");
    expect(out.Rem_RA).toBe("Model list: S570");
    expect(out.MRef).toBeUndefined();
  });

  it("handles a missing object", () => {
    expect(applyRecordAdminDefaults(undefined).Recd_PAF).toBe("Yes");
  });
});
