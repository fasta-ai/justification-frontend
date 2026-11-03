import { describe, expect, it } from "vitest";
import {
  APP_CAT_DEFAULT,
  normaliseAppCat,
  parseAppCat,
  resolveAppCat,
} from "@/lib/app-cat";

describe("normaliseAppCat", () => {
  it("keeps the two real categories, case-insensitive and trimmed", () => {
    expect(normaliseAppCat("Procurement")).toBe("Procurement");
    expect(normaliseAppCat("procurement")).toBe("Procurement");
    expect(normaliseAppCat("  PROCUREMENT ")).toBe("Procurement");
    expect(normaliseAppCat("Rental")).toBe("Rental");
    expect(normaliseAppCat("rental")).toBe("Rental");
    expect(normaliseAppCat(" RENTAL  ")).toBe("Rental");
  });

  it("tolerates obvious Rental spellings", () => {
    expect(normaliseAppCat("Rent")).toBe("Rental");
    expect(normaliseAppCat("rent")).toBe("Rental");
    expect(normaliseAppCat("Lease")).toBe("Rental");
    expect(normaliseAppCat("租用")).toBe("Rental");
    expect(normaliseAppCat("租賃")).toBe("Rental");
  });

  it("tolerates obvious Procurement spellings", () => {
    expect(normaliseAppCat("Purchase")).toBe("Procurement");
    expect(normaliseAppCat("採購")).toBe("Procurement");
  });

  it("falls back to Procurement for anything that is not a category", () => {
    for (const v of ["Yes", "No", "YES", "no", "Y", "N", "", "  ", "/", "NA",
      "N/A", "18.14", undefined, null, 0, true]) {
      expect(normaliseAppCat(v)).toBe("Procurement");
    }
    expect(APP_CAT_DEFAULT).toBe("Procurement");
  });

  it("parseAppCat reports non-categories as null", () => {
    expect(parseAppCat("Yes")).toBeNull();
    expect(parseAppCat("No")).toBeNull();
    expect(parseAppCat("/")).toBeNull();
    expect(parseAppCat("Rental")).toBe("Rental");
  });
});

describe("resolveAppCat", () => {
  it("prefers egData.App_Cat", () => {
    expect(resolveAppCat({ App_Cat: "Rental" }, { App_Cat: "Procurement" }))
      .toBe("Rental");
  });

  it("falls through to applicationData.App_Cat, then the default", () => {
    expect(resolveAppCat({}, { App_Cat: "rental" })).toBe("Rental");
    expect(resolveAppCat({ App_Cat: "/" }, { App_Cat: "Rental" })).toBe("Rental");
    expect(resolveAppCat({ App_Cat: "Yes" }, {})).toBe("Procurement");
    expect(resolveAppCat(undefined, undefined)).toBe("Procurement");
    expect(resolveAppCat(null, null)).toBe("Procurement");
  });

  it("never reads PA_RefL", () => {
    expect(resolveAppCat({}, { PA_RefL: "Yes" })).toBe("Procurement");
    expect(resolveAppCat({}, { PA_RefL: "No" })).toBe("Procurement");
    expect(resolveAppCat({}, { PA_RefL: "Rental" })).toBe("Procurement");
    expect(resolveAppCat({ App_Cat: "Rental" }, { PA_RefL: "No" })).toBe("Rental");
  });
});
