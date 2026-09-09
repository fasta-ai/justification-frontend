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
    catalogueData: null,
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

  it("recovers the model from PA_Mod_No when the source cell hit its 100-char cap", () => {
    const truncated =
      "Smart anti-wandering solution / (VTC-D21AF) (VN-VTC-E20LS) (VTN-208P-A1) (DS-D5024F21V2S) (VT-G8POES";
    expect(truncated).toHaveLength(100);
    const result = resolveProduct(
      joined({
        recordAdmin: { App_PNam_Mod: truncated },
        pa: { PA_Mod_No: "(VTC-D21AF) (VN-VTC-E20LS) (VT-G8POES)" },
      }),
    );
    expect(result.appPName).toBe("Smart anti-wandering solution");
    // Not the bracket-less fragment the truncated cell would have produced.
    expect(result.modelCode).toBe("(VTC-D21AF) (VN-VTC-E20LS) (VT-G8POES)");
  });

  it("falls back to PA_Mod_No when the name carries no model", () => {
    const result = resolveProduct(
      joined({ recordAdmin: { App_PNam_Mod: "Just A Name" } }),
    );
    expect(result.modelCode).toBe("W-PP01");
  });
});

describe("buildDatasetMetadata", () => {
  it("matches on the applicant's own product name, as the corpus does", () => {
    const meta = buildDatasetMetadata(importRow(), "batch-1");
    // PA_PName verbatim — that is the string a new case arrives carrying, so
    // the exact and fuzzy tiers compare like with like.
    expect(meta.App_PName).toBe("帕帕樂 Pak Pak Lok");
    expect(meta.App_PNam_Mod).toBe("Pak Pak Lok / W-PP01");
    expect(meta.Model_Code).toBe("W-PP01");
  });

  it("falls back to the split name when the PA register has none", () => {
    const meta = buildDatasetMetadata(
      importRow({ joined: joined({ pa: { PA_Cat: "18.20" } }) }),
      "b",
    );
    expect(meta.App_PName).toBe("Pak Pak Lok");
  });

  it("writes the corpus field set, including the blanks", () => {
    const meta = buildDatasetMetadata(importRow(), "b");
    for (const field of [
      "NO", "Ref", "fid", "NO_R", "EB_RM", "Tranche", "Q12a", "Q13a", "Q13b",
      "Staff1", "Staff2", "Staff1_Info", "Staff2_Info", "App_Cat", "D_Entry",
      "Applicant", "Q12b_Jus", "Q12c_TotC", "Q12d_Quo", "Q12e_JCost",
      "Q12f_RReject", "Q12g_JRem", "Remarks_EGF", "SWD_Off_N", "SWD_Off_P",
      "SWD_Off_I", "D_ReqF_SWD", "D_PlnT_SWD", "D_EGF_ASWD", "PA_Cat",
      "No_Bene", "No_Elderly", "No_Disable", "Prof_Staff", "Typ_Staff",
      "Typ_Disability", "pa_form_data", "catalogueDesc",
    ]) {
      expect(meta, `missing ${field}`).toHaveProperty(field);
    }
    expect(meta.fid).toBe("1001P");
    expect(meta.NO).toBe(1001);
  });

  it("nests the PA form the way the corpus stores it", () => {
    const meta = buildDatasetMetadata(importRow(), "b");
    const paForm = meta.pa_form_data as Record<string, unknown>;
    expect(paForm.PA_PName).toBe("帕帕樂 Pak Pak Lok");
    expect(paForm.PA_Mod_No).toBe("W-PP01");
    expect(paForm.PA_Cat).toBe("18.20");
    // Also present at the root, as in the existing rows.
    expect(meta.PA_Cat).toBe("18.20");
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

  it("stores the extractor's structured products alongside the summary", () => {
    const meta = buildDatasetMetadata(
      importRow({
        catalogueData: {
          description: "The OSIM uDiva SOFA is the world's first massage sofa.",
          products: [
            {
              product_name: "OSIM uDiva SOFA",
              model: "",
              functions: ["world's first massage sofa", "zero-wall design"],
              product_size: "",
              usage_capacity: "single, 2-seater, or 3-seater unit",
            },
          ],
        },
      }),
      "b",
    );
    const stored = meta.catalogue_data as Record<string, any>;
    expect(stored.products[0].product_name).toBe("OSIM uDiva SOFA");
    expect(stored.products[0].functions).toHaveLength(2);
    expect(stored.products[0].usage_capacity).toBe(
      "single, 2-seater, or 3-seater unit",
    );
    // The summary still drives the embedding.
    expect(meta.catalogueDesc).toBe("A single-user interactive training kiosk.");
  });

  it("omits catalogue_data entirely when nothing was extracted", () => {
    const meta = buildDatasetMetadata(importRow({ catalogueData: null }), "b");
    expect(meta.catalogue_data).toBeUndefined();
  });

  it("writes an empty catalogueDesc rather than dropping the key", () => {
    const meta = buildDatasetMetadata(
      importRow({ catalogueDesc: "", bucket: "registerOnly" }),
      "b",
    );
    expect(meta.catalogueDesc).toBe("");
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

  it("keeps the registers' placeholders verbatim, as the corpus does", () => {
    const meta = buildDatasetMetadata(
      importRow({ joined: joined({ eg: { Q12a: "Yes", Q12b_Jus: "j", Q12g_JRem: "NIL" } }) }),
      "b",
    );
    expect(meta.Q12g_JRem).toBe("NIL");
  });

  it("still strips those placeholders from the model code", () => {
    const meta = buildDatasetMetadata(
      importRow({
        joined: joined({
          recordAdmin: { App_PNam_Mod: "Some Product" },
          pa: { PA_Mod_No: "/" },
        }),
      }),
      "b",
    );
    expect(meta.Model_Code).toBeUndefined();
  });
});

describe("embeddingText", () => {
  it("reproduces the recipe the existing corpus was built with", () => {
    expect(EMBEDDING_FIELDS).toEqual(["App_PName", "catalogueDesc"]);
    const meta = buildDatasetMetadata(importRow(), "b");
    expect(embeddingText(meta)).toBe(
      "帕帕樂 Pak Pak Lok A single-user interactive training kiosk.",
    );
  });

  it("is just the product name when there is no catalogue description", () => {
    const meta = buildDatasetMetadata(importRow({ catalogueDesc: "" }), "b");
    expect(embeddingText(meta)).toBe("帕帕樂 Pak Pak Lok");
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

  it("blocks a case that never got a catalogue description", () => {
    const row = importRow({ catalogueDesc: "", selectedCatalogue: null });
    expect(rowBlocker(row, ALL_THREE)).toBe("no catalogue file for this case");
  });

  it("says so plainly when the catalogue was there but extraction failed", () => {
    const row = importRow({
      catalogueDesc: "",
      selectedCatalogue: {
        file: new File(["x"], "1001P_Catalogue.pdf"),
        path: "1001P_Catalogue.pdf",
        name: "1001P_Catalogue.pdf",
        size: 1000,
        kind: "catalogue",
        confidence: "high",
      },
      extraction: { status: "failed", attempts: 3 },
    });
    expect(rowBlocker(row, ALL_THREE)).toBe("catalogue extraction failed");
  });

  it("allows a case with no catalogue when the rule is switched off", () => {
    const row = importRow({ catalogueDesc: "", selectedCatalogue: null });
    expect(rowBlocker(row, ALL_THREE, false)).toBeNull();
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
