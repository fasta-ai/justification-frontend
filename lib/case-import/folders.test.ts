import { describe, expect, it } from "vitest";
import {
  classifyFile,
  groupIntoCaseFolders,
  normaliseFileName,
  parseFolderName,
} from "@/lib/case-import/folders";

function fakeFile(path: string, size = 1024): File {
  const name = path.split("/").pop() ?? path;
  const file = new File(["x"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: size });
  Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
}

describe("parseFolderName", () => {
  it("decomposes the standard T12 folder name", () => {
    expect(parseFolderName("1001P_LORCHE_T12_GP_g")).toEqual({
      caseKey: { tranche: "T12", unit: "LORCHE", no: "1001", noR: "P" },
      appType: "GP",
      ragStatus: "g",
      isRevised: false,
    });
  });

  it("handles the folders numbered without a P suffix", () => {
    expect(parseFolderName("2025_LORCHD_T12_AC_g")?.caseKey).toEqual({
      tranche: "T12",
      unit: "LORCHD",
      no: "2025",
      noR: "",
    });
  });

  it("flags the revised submissions", () => {
    const parsed = parseFolderName("1281P_LORCHE_T12_AC_r_rev");
    expect(parsed?.isRevised).toBe(true);
    expect(parsed?.ragStatus).toBe("r");
  });

  it("returns null for the junk folder rather than throwing", () => {
    expect(parseFolderName("1-11G2-QT3NG4E")).toBeNull();
  });
});

describe("normaliseFileName", () => {
  it("strips the case-number prefix and the extension", () => {
    expect(normaliseFileName("1001P_Catalogue.pdf")).toBe("catalogue");
    expect(normaliseFileName("1310 product spec (1).pdf")).toBe("product spec 1");
  });
});

describe("classifyFile", () => {
  const classify = (name: string) => classifyFile(fakeFile(name), name);

  it("recognises the catalogue spellings with high confidence", () => {
    for (const name of ["1001P_Catalogue.pdf", "1378 catalog.pdf", "2001P_Cat.pdf"]) {
      const result = classify(name);
      expect(result.kind).toBe("catalogue");
      expect(result.confidence).toBe("high");
    }
  });

  it("accepts the looser synonyms at medium confidence", () => {
    for (const name of ["1073P-leaflet.pdf", "1328 spec (1).pdf", "1001P_Pamphlet.pdf"]) {
      const result = classify(name);
      expect(result.kind).toBe("catalogue");
      expect(result.confidence).toBe("medium");
    }
  });

  it("does not mistake a certificate or a quotation for a catalogue", () => {
    expect(classify("1003P-CE Certificate.pdf").kind).toBe("other");
    expect(classify("1378Quotation.pdf").kind).toBe("other");
    expect(classify("1003P-Test Report.pdf").kind).toBe("other");
    expect(classify("1001P_Letter of Security.pdf").kind).toBe("other");
  });

  it("identifies the two forms", () => {
    expect(classify("1001P_Application Form.docx").kind).toBe("application");
    expect(classify("1310 app form.docx").kind).toBe("application");
    expect(classify("1001P_EG Form.docx").kind).toBe("eg");
    expect(classify("EG Form (2025P).docm").kind).toBe("eg");
  });

  it("refuses a catalogue the extractor cannot read", () => {
    expect(classify("1001P_Catalogue.docx").kind).toBe("other");
  });

  it("never treats correspondence copies as source documents", () => {
    const path = "TO SWD/SWD_LORCHE_I&TF_T12_1001P.pdf";
    expect(classifyFile(fakeFile(path), path).kind).toBe("other");
  });
});

describe("groupIntoCaseFolders", () => {
  it("groups by case folder and ranks catalogue candidates", () => {
    const folders = groupIntoCaseFolders([
      fakeFile("T12 Cases/1001P_LORCHE_T12_GP_g/1001P_Catalogue.pdf", 4_000_000),
      fakeFile("T12 Cases/1001P_LORCHE_T12_GP_g/1001P_Pamphlet.pdf", 900_000),
      fakeFile("T12 Cases/1001P_LORCHE_T12_GP_g/1001P_Quotation.pdf", 500_000),
      fakeFile("T12 Cases/1001P_LORCHE_T12_GP_g/TO EG/out.docx"),
      fakeFile("T12 Cases/1003P_LORCHE_T12_AC_g/1003P_Catalogue.pdf"),
    ]);

    expect(folders).toHaveLength(2);
    const first = folders[0];
    expect(first.folderName).toBe("1001P_LORCHE_T12_GP_g");
    expect(first.caseKey?.no).toBe("1001");
    // High confidence first, so the actual catalogue outranks the pamphlet.
    expect(first.catalogueCandidates.map((f) => f.name)).toEqual([
      "1001P_Catalogue.pdf",
      "1001P_Pamphlet.pdf",
    ]);
  });

  it("keeps an unparseable folder instead of discarding its files", () => {
    const folders = groupIntoCaseFolders([
      fakeFile("T12 Cases/1-11G2-QT3NG4E/something.pdf"),
    ]);
    expect(folders).toHaveLength(1);
    expect(folders[0].caseKey).toBeNull();
  });

  it("ignores dotfiles and files outside a case folder", () => {
    const folders = groupIntoCaseFolders([
      fakeFile("T12 Cases/.DS_Store"),
      fakeFile("T12 Cases/1001P_LORCHE_T12_GP_g/.DS_Store"),
      fakeFile("T12 Cases/1001P_LORCHE_T12_GP_g/1001P_Catalogue.pdf"),
    ]);
    expect(folders).toHaveLength(1);
    expect(folders[0].files).toHaveLength(1);
  });
});
