import { describe, it, expect } from "vitest";
import { buildSimilarMatchRequest } from "@/hooks/use-similar-matches";

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
