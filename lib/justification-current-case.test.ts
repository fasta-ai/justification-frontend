import { describe, it, expect } from "vitest";
import {
  buildCurrentCaseForPrompt,
  extractCatalogueProducts,
  isCurrentCasePresent,
  resolveCurrentCaseForSuggest,
} from "./justification-current-case";

describe("extractCatalogueProducts", () => {
  it("reads products at the Stage 3 shape { products: [...] }", () => {
    expect(
      extractCatalogueProducts({
        products: [{ product_name: "Nurse call", model: "NC-1" }],
      }),
    ).toEqual([{ product_name: "Nurse call", model: "NC-1" }]);
  });

  it("reads the nested Stage 1 shape { data: { products: [...] } }", () => {
    expect(
      extractCatalogueProducts({
        data: { products: [{ product_name: "HMS", model: "HMS-9" }] },
      }),
    ).toEqual([{ product_name: "HMS", model: "HMS-9" }]);
  });

  it("returns [] when the catalogue has a description but no products", () => {
    expect(
      extractCatalogueProducts({ description: "A wall-mounted call panel." }),
    ).toEqual([]);
  });
});

describe("buildCurrentCaseForPrompt", () => {
  it("keeps stored catalogue products", () => {
    const products = buildCurrentCaseForPrompt({
      products: [{ product_name: "Nurse call", model: "NC-1" }],
    });
    expect(products).toEqual([{ product_name: "Nurse call", model: "NC-1" }]);
    expect(isCurrentCasePresent(products)).toBe(true);
  });

  it("synthesises a product from EG / application fields when products are missing", () => {
    // Manual entry, no similar case, no catalogue extraction (case 2901P).
    const products = buildCurrentCaseForPrompt(
      {},
      {
        productName: "Nurse call system",
        model: "T13",
        brand: "LORCHD",
        description: "integrates with the existing nurse-call system",
      },
    );
    expect(products).toEqual([
      {
        product_name: "Nurse call system",
        model: "T13",
        brand: "LORCHD",
        description: "integrates with the existing nurse-call system",
      },
    ]);
    expect(isCurrentCasePresent(products)).toBe(true);
  });

  it("still returns a truthy current_case when every field is empty", () => {
    // The reviewer can generate with only free-text context / 12(b).
    const products = buildCurrentCaseForPrompt(undefined, {});
    expect(products).toEqual([{}]);
    expect(isCurrentCasePresent(products)).toBe(true);
    expect(isCurrentCasePresent(undefined)).toBe(false);
  });

  it("fills missing identity on a thin products[] entry from extras", () => {
    const products = buildCurrentCaseForPrompt(
      { products: [{ description: "A panel." }] },
      { productName: "Nurse call", model: "NC-1" },
    );
    expect(products[0]).toMatchObject({
      product_name: "Nurse call",
      model: "NC-1",
      description: "A panel.",
    });
  });
});

describe("resolveCurrentCaseForSuggest", () => {
  it("keeps a client-supplied current_case", () => {
    const supplied = [{ product_name: "From client" }];
    expect(
      resolveCurrentCaseForSuggest({
        current_case: supplied,
        application_data: { PA_PName: "Ignored" },
      }),
    ).toBe(supplied);
  });

  it("rebuilds current_case from case_context and application_data when omitted", () => {
    // This is the BFF-side safety net for the 2901P 400 error.
    const resolved = resolveCurrentCaseForSuggest({
      application_data: { PA_PName: "PA name", PA_Mod_No: "M1" },
      case_context: {
        egProductName: "EG name",
        catalogueDescription: "A catalogue blurb.",
      },
    });
    expect(resolved).toEqual([
      {
        product_name: "EG name",
        model: "M1",
        description: "A catalogue blurb.",
      },
    ]);
    expect(isCurrentCasePresent(resolved)).toBe(true);
  });
});
