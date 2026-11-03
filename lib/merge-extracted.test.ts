import { describe, expect, it } from "vitest";
import { mergeOntoExtracted } from "@/lib/merge-extracted";

describe("mergeOntoExtracted", () => {
  const extracted = { PA_RefL: "Yes", PA_Cat: "17.1", PA_PName: "HMS", Typ_Disability: "phys." };

  it("keeps the extraction when a patch lands before the preview was opened", () => {
    // The bug: the AI review's auto-applied tidy-up merged onto {} and the
    // result replaced applicationData, leaving only Typ_Disability.
    expect(mergeOntoExtracted({}, extracted, { Typ_Disability: "Physical" })).toEqual({
      ...extracted,
      Typ_Disability: "Physical",
    });
  });

  it("keeps the reviewer's edits over the extraction, and the patch over both", () => {
    expect(
      mergeOntoExtracted({ ...extracted, PA_PName: "HMS edited" }, extracted, { PA_Cat: "17.2" }),
    ).toEqual({ ...extracted, PA_PName: "HMS edited", PA_Cat: "17.2" });
  });

  it("tolerates missing sections", () => {
    expect(mergeOntoExtracted(undefined, undefined, { a: 1 })).toEqual({ a: 1 });
  });
});
