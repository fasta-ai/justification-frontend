import { describe, expect, it } from "vitest";
import {
  cleanModelCode,
  cleanText,
  cleanValue,
  excelSerialToISO,
  normaliseCaseNo,
  splitProductAndModel,
} from "@/lib/case-import/normalise";

describe("cleanText", () => {
  it("strips the escaped carriage returns the Excel export leaves behind", () => {
    expect(cleanText("Justifications:_x000d_\n1) The unit price")).toBe(
      "Justifications:\n1) The unit price",
    );
  });

  it("collapses runs of blank lines but keeps paragraph breaks", () => {
    expect(cleanText("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("is empty for null and undefined rather than 'null'", () => {
    expect(cleanText(null)).toBe("");
    expect(cleanText(undefined)).toBe("");
  });
});

describe("cleanValue", () => {
  it("treats the registers' not-applicable markers as absent", () => {
    for (const sentinel of ["/", "NA", "N/A", "NIL", "nil", "-", "None"]) {
      expect(cleanValue(sentinel)).toBeNull();
    }
  });

  it("keeps 0, which is a real beneficiary and cost value", () => {
    expect(cleanValue(0)).toBe("0");
  });

  it("keeps ordinary text", () => {
    expect(cleanValue("  Procurement ")).toBe("Procurement");
  });
});

describe("cleanModelCode", () => {
  it("drops the bare 0 placeholder", () => {
    expect(cleanModelCode("0")).toBeNull();
  });

  it("drops a code that merely repeats the product name", () => {
    expect(cleanModelCode("Smart PLAYBALL", "Smart PLAYBALL")).toBeNull();
  });

  it("keeps a real code", () => {
    expect(cleanModelCode("PLETM01", "8950 Mattress")).toBe("PLETM01");
  });
});

describe("excelSerialToISO", () => {
  it("converts a whole-day serial to a date", () => {
    // 45589 is the D_WkRep value on the T10/1006P row.
    expect(excelSerialToISO(45589)).toBe("2024-10-24");
  });

  it("keeps the time component when the serial has a fraction", () => {
    expect(excelSerialToISO(45589.4549421296)).toMatch(
      /^2024-10-24T\d{2}:\d{2}/,
    );
  });

  it("leaves values outside the plausible date range alone", () => {
    // A cost, not a date.
    expect(excelSerialToISO(134000)).toBeNull();
    expect(excelSerialToISO(0)).toBeNull();
  });

  it("passes a real Date through", () => {
    const d = new Date("2024-03-01T00:00:00.000Z");
    expect(excelSerialToISO(d)).toBe(d.toISOString());
  });
});

describe("normaliseCaseNo", () => {
  it("reconciles the 1080.0 and 1080 spellings that break the join", () => {
    expect(normaliseCaseNo("1080.0")).toBe("1080");
    expect(normaliseCaseNo(1080)).toBe("1080");
    expect(normaliseCaseNo("1080")).toBe("1080");
  });

  it("leaves a non-numeric identifier untouched", () => {
    expect(normaliseCaseNo("1-11G2")).toBe("1-11G2");
  });
});

describe("splitProductAndModel", () => {
  it("splits the slash-separated form the corpus was built around", () => {
    expect(
      splitProductAndModel(
        "8950 Platnum Pressure Relief Turning Mattress / PLETM01",
      ),
    ).toEqual({
      productName: "8950 Platnum Pressure Relief Turning Mattress",
      modelCode: "PLETM01",
    });
  });

  it("splits on the last separator, so slashes inside the name survive", () => {
    expect(
      splitProductAndModel("Active passive trainer for upper / lower limbs / APT-200"),
    ).toEqual({
      productName: "Active passive trainer for upper / lower limbs",
      modelCode: "APT-200",
    });
  });

  it("reads the labelled multiline form", () => {
    expect(
      splitProductAndModel(
        "Product Name: Proactive Individual Caring System (PICS)\nModel Number: PICS MMS",
      ),
    ).toEqual({
      productName: "Proactive Individual Caring System (PICS)",
      modelCode: "PICS MMS",
    });
  });

  it("returns the whole string as the name when there is no separator", () => {
    expect(splitProductAndModel("SuperME Cycling Multi-user Training System")).toEqual({
      productName: "SuperME Cycling Multi-user Training System",
      modelCode: null,
    });
  });

  it("drops a model that just repeats the name", () => {
    expect(
      splitProductAndModel("Smart PLAYBALL by PLAYWORK / Smart PLAYBALL by PLAYWORK"),
    ).toEqual({
      productName: "Smart PLAYBALL by PLAYWORK",
      modelCode: null,
    });
  });

  it("is empty for a blank input", () => {
    expect(splitProductAndModel(null)).toEqual({
      productName: null,
      modelCode: null,
    });
  });
});
