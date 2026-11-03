import { describe, it, expect } from "vitest";
import {
  buildSimilarMatchRequest,
  similarMatchCategory,
} from "@/hooks/use-similar-matches";

describe("buildSimilarMatchRequest", () => {
  it("sends the querying case's id as excludeCaseId", () => {
    const body = buildSimilarMatchRequest({
      datasetName: "d",
      item: { PA_PName: "Widget", tranche: "T12", caseId: " case-1 " },
    });
    expect(body.excludeCaseId).toBe("case-1");
    expect(body.excludeTranche).toBe("T12");
    expect(body.productName).toBe("Widget");
  });

  it("omits excludeCaseId when the item has no case id", () => {
    expect(buildSimilarMatchRequest({ datasetName: "d", item: { PA_PName: "Widget" } }).excludeCaseId).toBeUndefined();
    expect(
      buildSimilarMatchRequest({ datasetName: "d", item: { PA_PName: "Widget", caseId: "  " } }).excludeCaseId,
    ).toBeUndefined();
  });
});

describe("similarMatchCategory", () => {
  it("normalises App_Cat to Procurement/Rental", () => {
    expect(similarMatchCategory({ App_Cat: "Rental" })).toBe("Rental");
    expect(similarMatchCategory({ App_Cat: " leasing " })).toBe("Rental");
    expect(similarMatchCategory({ App_Cat: "租用" })).toBe("Rental");
    expect(similarMatchCategory({ App_Cat: "procurement" })).toBe("Procurement");
    // Legacy rows that stored PA_RefL's Yes/No as App_Cat.
    expect(similarMatchCategory({ App_Cat: "Yes", RefL_Cat: "Mobility" })).toBe("Procurement");
    expect(similarMatchCategory({ App_Cat: "No" })).toBe("Procurement");
  });

  it("falls back to RefL_Cat, then PA_Cat, when there is no App_Cat", () => {
    expect(similarMatchCategory({ App_Cat: "  ", RefL_Cat: "Mobility", PA_Cat: "X" })).toBe("Mobility");
    expect(similarMatchCategory({ PA_Cat: "Hearing" })).toBe("Hearing");
    expect(similarMatchCategory({})).toBe("");
    expect(similarMatchCategory(undefined)).toBe("");
  });
});
