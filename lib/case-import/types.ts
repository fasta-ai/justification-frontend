/**
 * Bulk import of previous (already-vetted) cases into the similar-case corpus.
 *
 * The corpus is the `datasets` table the Stage 3 tiered matcher searches. Until
 * now it was only ever loaded by a developer running `load-catalogue-data.ts`
 * against a folder on their own machine, so every tranche vetted since T9b is
 * missing from it. This module is the same pipeline, driven from the browser.
 */

/** Which of the three registers a workbook turned out to be. */
export type RegisterRole = "eg" | "pa" | "recordAdmin";

/** A single parsed row, keys are the register's own column headers. */
export type RegisterRow = Record<string, string | number | null>;

export interface ParsedRegister {
  role: RegisterRole;
  fileName: string;
  sheetName: string;
  /** Header row, in sheet order. */
  columns: string[];
  rows: RegisterRow[];
  /** Row count per tranche, for the tranche picker. */
  trancheCounts: Record<string, number>;
  /** Columns present in the sheet that this build does not know about. */
  unknownColumns: string[];
}

/**
 * The join key. Deliberately NOT `Ref`: the registers disagree with themselves
 * about it — A_PA_Form carries a row whose Ref reads `SWD/LORCHE/I&T/T12/1056P`
 * while its Tranche column reads `T10` — and the three files format it
 * differently from each other.
 */
export interface CaseKey {
  tranche: string;
  unit: string;
  no: string;
  noR: string;
}

/** One case, after the three registers are merged. */
export interface JoinedCase {
  /** `${tranche}|${unit}|${no}${noR}` — stable, and the dedupe key. */
  key: string;
  caseKey: CaseKey;
  /** Display reference, best available across the three files. */
  ref: string;
  eg: RegisterRow | null;
  pa: RegisterRow | null;
  recordAdmin: RegisterRow | null;
  /** Which registers contributed. */
  sources: RegisterRole[];
}

export interface JoinReport {
  cases: JoinedCase[];
  /** Cases found in all three registers. */
  completeCount: number;
  /** Cases found in two. */
  partialCount: number;
  /** Cases found in exactly one, by which one. */
  singleCounts: Record<RegisterRole, number>;
  /** Rows whose key could not be built at all, with the reason. */
  unkeyed: { role: RegisterRole; row: RegisterRow; reason: string }[];
}

/** How confident the name-based classifier is about a file's role. */
export type ClassifyConfidence = "high" | "medium" | "none";

export interface ClassifiedFile {
  file: File;
  /** Path relative to the chosen directory. */
  path: string;
  name: string;
  size: number;
  kind: "catalogue" | "application" | "eg" | "other";
  confidence: ClassifyConfidence;
  /** The keyword that matched, for showing the user why. */
  matchedOn?: string;
}

export interface CaseFolder {
  folderName: string;
  /** Null when the folder name does not parse as a case at all. */
  caseKey: CaseKey | null;
  ragStatus: "g" | "y" | "r" | null;
  isRevised: boolean;
  appType: "AC" | "GP" | null;
  files: ClassifiedFile[];
  catalogueCandidates: ClassifiedFile[];
}

/** Where a case sits in the catalogue-selection review. */
export type CatalogueBucket = "confident" | "ambiguous" | "none" | "registerOnly";

export interface ImportRow {
  key: string;
  joined: JoinedCase;
  folder: CaseFolder | null;
  bucket: CatalogueBucket;
  /** The file the user (or the classifier) settled on. */
  selectedCatalogue: ClassifiedFile | null;
  /** Filled by extraction; empty for register-only rows. */
  catalogueDesc: string;
  /**
   * The extractor's full reply — `{ products: [...], description }`. The
   * summary alone loses the structured product rows (model, functions,
   * dimensions, usage capacity), which the corpus has always stored under
   * `catalogue_data` and which are useful well beyond similarity search.
   */
  catalogueData: CatalogueExtraction | null;
  extraction: {
    status: "idle" | "queued" | "running" | "done" | "failed" | "skipped";
    error?: string;
    attempts: number;
  };
  /** Excluded rows are kept visible but never committed. */
  excluded: boolean;
  /** True when a row with this key is already in the corpus. */
  alreadyInCorpus: boolean;
}

/** The object written to `datasets.metadata`. */
export type DatasetMetadata = Record<string, unknown>;

/** Shape returned by the Python catalogue extractor. */
export interface CatalogueExtraction {
  description?: string;
  products?: {
    product_name?: string;
    model?: string;
    functions?: string[];
    description?: string;
    product_size?: string;
    usage_capacity?: string;
  }[];
  [key: string]: unknown;
}
