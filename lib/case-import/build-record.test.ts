import { describe, expect, it } from "vitest";
import {
  EMBEDDING_FIELDS,
  EMBEDDING_TOKEN_LIMIT,
  buildDatasetMetadata,
  embeddingText,
  estimateTokens,
  resolveProduct,
  rowBlocker,
} from "@/lib/case-import/build-record";
import type {
  ImportRow,
  JoinedCase,
  RegisterRole,
} from "@/lib/case-import/types";

function joined(overrides: Partial<JoinedCase> = {}): JoinedCase {
  return {
    key: "T12|LORCHE|1001P",
    caseKey: { tranche: "T12", unit: "LORCHE", no: "1001", noR: "P" },
    ref: "T12_SWD/LORCHE/I&TF/T12/1001P",
    eg: { Q12a: "Yes", Q12b_Jus: "Support to apply.", App_PName: "Fallback name" },
    pa: { PA_Cat: "18.20", PA_Mod_No: "W-PP01", PA_PName: "帕帕樂 Pak Pak Lok" },
    recordAdmin: { App_PNam_Mod: "Pak Pak Lok / W-PP01", App_Type: "1.2." },
    sources: ["eg", "pa", "recordAdmin"],
    ...overrides,
  };
}

function importRow(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    key: "T12|LORCHE|1001P",
    joined: joined(),
    folder: null,
    bucket: "confident",
    selectedCatalogue: null,
    catalogueDesc: "A single-user interactive training kiosk.",
    extraction: { status: "done", attempts: 1 },
    excluded: false,
    alreadyInCorpus: false,
    ...overrides,
  };
}

describe("resolveProduct", () => {
  it("prefers the Record Admin name and splits the model out of it", () => {
    expect(resolveProduct(joined())).toEqual({
      appPName: "Pak Pak Lok",
      appPNamMod: "Pak Pak Lok / W-PP01",
      modelCode: "W-PP01",
    });
  });

  it("falls back to the EG name when Record Admin is missing", () => {
    const result = resolveProduct(joined({ recordAdmin: null }));
    expect(result.appPName).toBe("Fallback name");
  });

  it("falls back to PA_Mod_No when the name carries no model", () => {
    const result = resolveProduct(
      joined({ recordAdmin: { App_PNam_Mod: "Just A Name" } }),
    );
    expect(result.modelCode).toBe("W-PP01");
  });
});

describe("buildDatasetMetadata", () => {
  it("writes both product-name aliases, so neither consumer has to change", () => {
    const meta = buildDatasetMetadata(importRow(), "batch-1");
    expect(meta.App_PName).toBe("Pak Pak Lok");
    expect(meta.App_PNam_Mod).toBe("Pak Pak Lok / W-PP01");
    expect(meta.Model_Code).toBe("W-PP01");
  });

  it("carries the EG decision and justification, which are the payload", () => {
    const meta = buildDatasetMetadata(importRow(), "batch-1");
    expect(meta.Q12a).toBe("Yes");
    expect(meta.Q12b_Jus).toBe("Support to apply.");
  });

  it("stamps the stable key and the batch, which the corpus has never had", () => {
    const meta = buildDatasetMetadata(importRow(), "batch-7");
    expect(meta.sourceKey).toBe("T12|LORCHE|1001P");
    expect(meta.importBatchId).toBe("batch-7");
  });

  it("declares which registers the case came from, for the backend to re-check", () => {
    const meta = buildDatasetMetadata(importRow(), "b");
    expect(meta.sourceRegisters).toEqual(["eg", "pa", "recordAdmin"]);
  });

  it("declares only the registers a partial case actually came from", () => {
    const meta = buildDatasetMetadata(
      importRow({ joined: joined({ pa: null, sources: ["eg", "recordAdmin"] }) }),
      "b",
    );
    expect(meta.sourceRegisters).toEqual(["eg", "recordAdmin"]);
  });

  it("keeps catalogueDesc null for a register-only row", () => {
    const meta = buildDatasetMetadata(
      importRow({ catalogueDesc: "", bucket: "registerOnly" }),
      "b",
    );
    expect(meta.catalogueDesc).toBeNull();
  });

  it("records the folder provenance when there is a folder", () => {
    const meta = buildDatasetMetadata(
      importRow({
        folder: {
          folderName: "1001P_LORCHE_T12_GP_g",
          caseKey: joined().caseKey,
          ragStatus: "g",
          isRevised: true,
          appType: "GP",
          files: [],
          catalogueCandidates: [],
        },
      }),
      "b",
    );
    expect(meta.sourceFolder).toBe("1001P_LORCHE_T12_GP_g");
    expect(meta.ragStatus).toBe("g");
    expect(meta.isRevised).toBe(true);
  });

  it("drops the registers' not-applicable markers instead of storing them", () => {
    const meta = buildDatasetMetadata(
      importRow({ joined: joined({ eg: { Q12a: "Yes", Q12b_Jus: "j", Q12g_JRem: "NIL" } }) }),
      "b",
    );
    expect(meta.Q12g_JRem).toBeUndefined();
  });
});

describe("embeddingText", () => {
  it("reproduces the recipe the existing corpus was built with", () => {
    expect(EMBEDDING_FIELDS).toEqual(["App_PName", "catalogueDesc"]);
    const meta = buildDatasetMetadata(importRow(), "b");
    expect(embeddingText(meta)).toBe(
      "Pak Pak Lok A single-user interactive training kiosk.",
    );
  });

  it("is just the product name when there is no catalogue description", () => {
    const meta = buildDatasetMetadata(importRow({ catalogueDesc: "" }), "b");
    expect(embeddingText(meta)).toBe("Pak Pak Lok");
  });
});

describe("estimateTokens", () => {
  it("stays under the limit for a typical name plus a 200-word summary", () => {
    const text = `Product ${"word ".repeat(200)}`;
    expect(estimateTokens(text)).toBeLessThan(EMBEDDING_TOKEN_LIMIT);
  });

  it("exceeds the limit once a full justification is added", () => {
    expect(estimateTokens("word ".repeat(400))).toBeGreaterThan(
      EMBEDDING_TOKEN_LIMIT,
    );
  });

  it("is zero for empty text", () => {
    expect(estimateTokens("   ")).toBe(0);
  });
});

describe("rowBlocker", () => {
  const ALL_THREE: RegisterRole[] = ["eg", "pa", "recordAdmin"];

  it("passes a row present in every uploaded register", () => {
    expect(rowBlocker(importRow(), ALL_THREE)).toBeNull();
  });

  it("blocks a case missing from one of the uploaded registers", () => {
    const row = importRow({
      joined: joined({ pa: null, sources: ["eg", "recordAdmin"] }),
    });
    expect(rowBlocker(row, ALL_THREE)).toBe("not in the PA register");
  });

  it("names every register the case is missing from", () => {
    const row = importRow({
      joined: joined({ pa: null, recordAdmin: null, sources: ["eg"] }),
    });
    expect(rowBlocker(row, ALL_THREE)).toBe(
      "not in the PA and Record Admin registers",
    );
  });

  it("does not demand a register that was never uploaded", () => {
    // Only the EG file was brought in; an EG-only case is complete then.
    const row = importRow({
      joined: joined({ pa: null, recordAdmin: null, sources: ["eg"] }),
    });
    expect(rowBlocker(row, ["eg"])).toBeNull();
  });

  it("blocks a row with no product name anywhere", () => {
    const row = importRow({
      joined: joined({ recordAdmin: null, eg: { Q12b_Jus: "j" } }),
    });
    expect(rowBlocker(row)).toContain("no product name");
  });

  it("blocks a row with no justification, which is the point of importing", () => {
    const row = importRow({ joined: joined({ eg: { Q12a: "Yes" } }) });
    expect(rowBlocker(row)).toContain("Q12b_Jus");
  });
});
