import type {
  CaseFolder,
  CaseKey,
  ClassifiedFile,
  ClassifyConfidence,
} from "./types";
import { normaliseCaseNo, normaliseToken } from "./normalise";

/**
 * Reading a tranche's case-document folder.
 *
 * Nothing here uploads or even reads a file. The browser hands us `File`
 * handles with relative paths; we classify on names alone, and only the file
 * the user settles on is ever transmitted. The T12 tree is several gigabytes
 * across ~3,000 files but holds only ~291 catalogues.
 */

/**
 * `1001P_LORCHE_T12_GP_g`, `2025_LORCHD_T12_AC_g`, `1281P_LORCHE_T12_AC_r_rev`.
 *
 * The case-number suffix is optional: a handful of folders are numbered
 * `2025_` with no `P`.
 */
const FOLDER_PATTERN =
  /^(\d+)([A-Za-z]*)_([A-Za-z]+)_(T\d+[a-z]?)_(AC|GP)_([gyr])(_rev)?$/i;

/** Subfolders holding outbound correspondence, never source documents. */
const OUTBOUND_DIRS = new Set(["to eg", "to swd"]);

export interface ParsedFolderName {
  caseKey: CaseKey;
  appType: "AC" | "GP";
  ragStatus: "g" | "y" | "r";
  isRevised: boolean;
}

/** Decompose a case folder name, or null when it is not one. */
export function parseFolderName(name: string): ParsedFolderName | null {
  const match = FOLDER_PATTERN.exec(name.trim());
  if (!match) return null;
  const [, no, noR, unit, tranche, appType, rag, rev] = match;
  return {
    caseKey: {
      tranche: normaliseToken(tranche),
      unit: normaliseToken(unit),
      no: normaliseCaseNo(no),
      noR: normaliseToken(noR),
    },
    appType: appType.toUpperCase() as "AC" | "GP",
    ragStatus: rag.toLowerCase() as "g" | "y" | "r",
    isRevised: Boolean(rev),
  };
}

/**
 * Strip the noise a filename carries around its meaningful words so keyword
 * rules can match: the extension, the leading case number, separators.
 */
export function normaliseFileName(name: string): string {
  const withoutExt = name.replace(/\.[a-z0-9]+$/i, "");
  return withoutExt
    .toLowerCase()
    .replace(/^\d+[a-z]?\s*[-_]?\s*/i, " ")
    .replace(/[_\-.()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extensions the catalogue extractor can read. */
const CATALOGUE_EXTENSIONS = /\.(pdf|png|jpe?g|webp)$/i;

interface Rule {
  kind: ClassifiedFile["kind"];
  confidence: ClassifyConfidence;
  /** Matched against the normalised name. */
  pattern: RegExp;
  label: string;
}

/**
 * Ordered: the first match wins, so exclusions come before the loose
 * catalogue synonyms. `spec` and `leaflet` are only medium confidence because
 * a folder often holds several of them and only one is the real catalogue.
 */
const RULES: Rule[] = [
  // Definitely not a product catalogue, however they are named.
  { kind: "other", confidence: "high", pattern: /\bquotations?\b|\bquote\b/, label: "quotation" },
  { kind: "other", confidence: "high", pattern: /\bcerts?\b|\bcertificates?\b/, label: "certificate" },
  { kind: "other", confidence: "high", pattern: /\btest reports?\b|\breports?\b/, label: "test report" },
  { kind: "other", confidence: "high", pattern: /\bsole agents?\b|\bagent\b/, label: "sole agent" },
  { kind: "other", confidence: "high", pattern: /\bendorsement\b|\bsecurity\b/, label: "letter" },
  { kind: "other", confidence: "high", pattern: /\bmanuals?\b|\bmanaul\b/, label: "manual" },
  { kind: "other", confidence: "high", pattern: /\bdeclarations?\b|\bdeclare\b|\bdoc\b/, label: "declaration" },
  { kind: "other", confidence: "high", pattern: /\bscreen ?cap\b|\biec\b/, label: "other document" },

  // Forms.
  { kind: "eg", confidence: "high", pattern: /\beg ?forms?\b/, label: "EG form" },
  { kind: "application", confidence: "high", pattern: /\bapplication ?_?forms?\b|\bapp ?forms?\b/, label: "application form" },

  // Catalogue, strongest naming first.
  { kind: "catalogue", confidence: "high", pattern: /\bcatalogues?\b|\bcatalogs?\b|\bcat\b/, label: "catalogue" },
  { kind: "catalogue", confidence: "medium", pattern: /\bleaflets?\b|\bpamphlets?\b|\bbrochures?\b/, label: "leaflet" },
  { kind: "catalogue", confidence: "medium", pattern: /\bproduct ?specs?\b|\bspecs?\b|\bspecifications?\b/, label: "spec" },
  { kind: "catalogue", confidence: "medium", pattern: /\bdata ?sheets?\b|\bproduct ?info\b/, label: "datasheet" },
  { kind: "catalogue", confidence: "medium", pattern: /\badditional ?info(rmation)?\b/, label: "additional information" },
];

/** Classify one file by its name and its position in the tree. */
export function classifyFile(file: File, relativePath: string): ClassifiedFile {
  const segments = relativePath.split("/");
  const name = segments[segments.length - 1];
  const inOutboundDir = segments
    .slice(0, -1)
    .some((seg) => OUTBOUND_DIRS.has(seg.trim().toLowerCase()));

  const base: Omit<ClassifiedFile, "kind" | "confidence" | "matchedOn"> = {
    file,
    path: relativePath,
    name,
    size: file.size,
  };

  // Correspondence copies live in TO EG / TO SWD and are never source
  // documents, whatever they are called.
  if (inOutboundDir) {
    return { ...base, kind: "other", confidence: "high", matchedOn: "outbound folder" };
  }

  const normalised = normaliseFileName(name);
  for (const rule of RULES) {
    if (rule.pattern.test(normalised)) {
      // A catalogue the extractor cannot read is not a catalogue candidate.
      if (rule.kind === "catalogue" && !CATALOGUE_EXTENSIONS.test(name)) {
        return { ...base, kind: "other", confidence: "high", matchedOn: "unsupported file type" };
      }
      return { ...base, kind: rule.kind, confidence: rule.confidence, matchedOn: rule.label };
    }
  }
  return { ...base, kind: "other", confidence: "none" };
}

/**
 * Group a flat directory selection into case folders.
 *
 * `webkitRelativePath` is `<chosen dir>/<case folder>/…`, so the case folder is
 * the second segment. Files sitting directly in the chosen directory have no
 * case folder and are ignored.
 */
export function groupIntoCaseFolders(files: File[]): CaseFolder[] {
  const byFolder = new Map<string, ClassifiedFile[]>();

  for (const file of files) {
    const fullPath = (file as File & { webkitRelativePath?: string })
      .webkitRelativePath;
    if (!fullPath) continue;
    const segments = fullPath.split("/");
    if (segments.length < 3) continue; // not inside a case folder
    const folderName = segments[1];
    if (folderName.startsWith(".")) continue;
    if (file.name.startsWith(".")) continue; // .DS_Store and friends

    const relativePath = segments.slice(2).join("/");
    const classified = classifyFile(file, relativePath);
    const bucket = byFolder.get(folderName);
    if (bucket) bucket.push(classified);
    else byFolder.set(folderName, [classified]);
  }

  const folders: CaseFolder[] = [];
  for (const [folderName, folderFiles] of byFolder) {
    const parsed = parseFolderName(folderName);
    const catalogueCandidates = folderFiles
      .filter((f) => f.kind === "catalogue")
      .sort(byConfidenceThenSize);

    folders.push({
      folderName,
      caseKey: parsed?.caseKey ?? null,
      ragStatus: parsed?.ragStatus ?? null,
      isRevised: parsed?.isRevised ?? false,
      appType: parsed?.appType ?? null,
      files: folderFiles,
      catalogueCandidates,
    });
  }

  return folders.sort((a, b) => a.folderName.localeCompare(b.folderName));
}

/** High confidence first, then largest file: catalogues are the fat PDFs. */
function byConfidenceThenSize(a: ClassifiedFile, b: ClassifiedFile): number {
  const rank = (c: ClassifyConfidence) => (c === "high" ? 0 : c === "medium" ? 1 : 2);
  const diff = rank(a.confidence) - rank(b.confidence);
  if (diff !== 0) return diff;
  return b.size - a.size;
}

/**
 * Every PDF in the folder, for the picker shown when classification found
 * nothing. The user needs to see what is actually there, not just what the
 * keyword rules liked.
 */
export function selectablePdfs(folder: CaseFolder): ClassifiedFile[] {
  return folder.files
    .filter((f) => CATALOGUE_EXTENSIONS.test(f.name))
    .sort((a, b) => b.size - a.size);
}
