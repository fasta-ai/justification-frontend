"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CORPUS_TASK,
  CORPUS_TYPE,
  EMBEDDING_FIELDS,
  buildDatasetMetadata,
  resolveProduct,
  rowBlocker,
} from "@/lib/case-import/build-record";
import { caseKeyString, joinRegisters } from "@/lib/case-import/join";
import { groupIntoCaseFolders } from "@/lib/case-import/folders";
import {
  REGISTER_LABELS,
  collectTranches,
  parseRegisterWorkbook,
} from "@/lib/case-import/registers";
import type {
  CaseFolder,
  ClassifiedFile,
  ImportRow,
  JoinReport,
  ParsedRegister,
  RegisterRole,
} from "@/lib/case-import/types";

export type ImportStep =
  | "registers"
  | "tranches"
  | "documents"
  | "extraction"
  | "review"
  | "done";

/**
 * Matches gunicorn's `--workers 2` on the Python extraction service. Going
 * wider does not go faster, it just queues behind the same two workers — and
 * the service is shared with live Stage 1 uploads, so 1 is the polite choice
 * during working hours.
 */
export const EXTRACTION_CONCURRENCY_OPTIONS = [1, 2] as const;

/** Rows per commit request. The backend embeds row by row, in-process. */
const COMMIT_CHUNK_SIZE = 25;

export interface CorpusSummary {
  counts: Record<string, number>;
  total: number;
  knownKeys: Set<string>;
  error?: string;
}

export interface CommitProgress {
  committed: number;
  created: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export function useCaseImport() {
  const [step, setStep] = useState<ImportStep>("registers");
  const [registers, setRegisters] = useState<ParsedRegister[]>([]);
  const [registerErrors, setRegisterErrors] = useState<string[]>([]);
  const [registerNotes, setRegisterNotes] = useState<string[]>([]);
  const [selectedTranches, setSelectedTranches] = useState<Set<string>>(new Set());
  const [joinReport, setJoinReport] = useState<JoinReport | null>(null);
  const [folders, setFolders] = useState<CaseFolder[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [corpus, setCorpus] = useState<CorpusSummary | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [concurrency, setConcurrency] = useState<number>(2);
  const [isExtracting, setIsExtracting] = useState(false);
  const [commitProgress, setCommitProgress] = useState<CommitProgress | null>(null);
  const [batchId] = useState(
    () => `import-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  );

  /** Set while a run is in flight; cleared to ask the workers to stop. */
  const extractionRunning = useRef(false);

  const tranches = useMemo(() => collectTranches(registers), [registers]);

  /**
   * The registers a case has to appear in to be imported. Every register the
   * user uploaded counts — upload all three and a case must be in all three.
   */
  const requiredRoles = useMemo<RegisterRole[]>(
    () => registers.map((r) => r.role),
    [registers],
  );

  // ---------------------------------------------------------------- registers

  /**
   * Read one or more register workbooks.
   *
   * `slot` is the drop target the file landed on. It is an override, not an
   * instruction: the header signature decides the role whenever it can, so
   * dropping A_PA_Form onto the EG target files it as the PA register and says
   * so, rather than importing applicant data as Expert Group decisions. The
   * slot only takes effect for a workbook no signature matches, which is the
   * manual-reassignment case.
   */
  const addRegisterFiles = useCallback(
    async (files: File[], slot?: RegisterRole) => {
      setIsBusy(true);
      const errors: string[] = [];
      const notes: string[] = [];
      const parsed: ParsedRegister[] = [];

      for (const file of files) {
        let buffer: ArrayBuffer;
        try {
          buffer = await file.arrayBuffer();
        } catch {
          errors.push(`${file.name}: could not be read`);
          continue;
        }

        try {
          const register = parseRegisterWorkbook(buffer, file.name);
          if (slot && register.role !== slot) {
            notes.push(
              `${file.name} is the ${REGISTER_LABELS[register.role]}, not the ` +
                `${REGISTER_LABELS[slot]} — filed under ${REGISTER_LABELS[register.role]}.`,
            );
          }
          parsed.push(register);
        } catch (error) {
          // Unidentifiable. If it was dropped on a specific target, take that
          // as the user telling us what it is.
          if (slot) {
            try {
              parsed.push(parseRegisterWorkbook(buffer, file.name, slot));
              notes.push(
                `${file.name} carries none of the expected columns; using it as ` +
                  `the ${REGISTER_LABELS[slot]} because that is where you dropped it.`,
              );
              continue;
            } catch (forced) {
              errors.push(
                forced instanceof Error
                  ? forced.message
                  : `${file.name}: could not be read`,
              );
              continue;
            }
          }
          errors.push(
            error instanceof Error
              ? error.message
              : `${file.name}: could not be read`,
          );
        }
      }

      setRegisters((current) => {
        const merged = new Map(current.map((r) => [r.role, r]));
        // A newly uploaded file replaces an earlier one in the same role, which
        // is what "I picked the wrong file" looks like from the user's side.
        for (const reg of parsed) merged.set(reg.role, reg);
        return [...merged.values()];
      });
      setRegisterErrors(errors);
      setRegisterNotes(notes);
      setIsBusy(false);
    },
    [],
  );

  const removeRegister = useCallback((role: RegisterRole) => {
    setRegisters((current) => current.filter((r) => r.role !== role));
  }, []);

  // ------------------------------------------------------------------- corpus

  const loadCorpusSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/datasets/tranche-summary");
      const payload = await response.json();
      setCorpus({
        counts: payload.counts ?? {},
        total: payload.total ?? 0,
        knownKeys: new Set<string>(payload.knownKeys ?? []),
        error: payload.error,
      });
    } catch (error) {
      setCorpus({
        counts: {},
        total: 0,
        knownKeys: new Set(),
        error:
          error instanceof Error ? error.message : "Could not read the corpus",
      });
    }
  }, []);

  // --------------------------------------------------------------------- join

  /**
   * Signature of the inputs the current join was built from, so the effect
   * below re-runs on a real change and not on every render. Without it,
   * returning to this step would rebuild the rows and discard the catalogue
   * choices already made further along.
   */
  const joinedFrom = useRef<string | null>(null);

  /**
   * Merge as soon as there is something to merge.
   *
   * This used to be a "Merge the registers" button that gated the Continue
   * button, which left Continue disabled with nothing explaining why. The
   * merge is a pure pass over rows already parsed in memory, so there is
   * nothing to defer.
   */
  useEffect(() => {
    if (registers.length === 0 || selectedTranches.size === 0) {
      joinedFrom.current = null;
      setJoinReport(null);
      setRows([]);
      return;
    }

    const signature = [
      [...selectedTranches].sort().join(","),
      registers.map((r) => `${r.role}:${r.rows.length}`).sort().join("|"),
      corpus?.knownKeys.size ?? -1,
    ].join("::");
    if (joinedFrom.current === signature) return;
    joinedFrom.current = signature;

    const report = joinRegisters(registers, selectedTranches);
    setJoinReport(report);
    setRows(buildRows(report, folders, corpus?.knownKeys ?? new Set()));
    // `folders` is intentionally read but not depended on: attaching a folder
    // rebuilds the rows through attachFolder, and listing it here would
    // rebuild them a second time and drop the user's catalogue picks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registers, selectedTranches, corpus]);

  // ------------------------------------------------------------------ folders

  const attachFolder = useCallback(
    (files: File[]) => {
      const grouped = groupIntoCaseFolders(files);
      setFolders(grouped);
      if (joinReport) {
        setRows(buildRows(joinReport, grouped, corpus?.knownKeys ?? new Set()));
      }
    },
    [joinReport, corpus],
  );

  const skipFolders = useCallback(() => {
    setFolders([]);
    if (joinReport) {
      setRows(
        buildRows(joinReport, [], corpus?.knownKeys ?? new Set()).map((row) => ({
          ...row,
          bucket: "registerOnly" as const,
          extraction: { ...row.extraction, status: "skipped" as const },
        })),
      );
    }
  }, [joinReport, corpus]);

  // ---------------------------------------------------------------- selection

  const selectCatalogue = useCallback((key: string, file: ClassifiedFile | null) => {
    setRows((current) =>
      current.map((row) =>
        row.key === key
          ? {
              ...row,
              selectedCatalogue: file,
              bucket: file ? "confident" : "registerOnly",
              catalogueDesc: file ? row.catalogueDesc : "",
              extraction: file
                ? { status: "idle", attempts: 0 }
                : { status: "skipped", attempts: 0 },
            }
          : row,
      ),
    );
  }, []);

  const setExcluded = useCallback((key: string, excluded: boolean) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, excluded } : row)),
    );
  }, []);

  const setExcludedMany = useCallback((keys: string[], excluded: boolean) => {
    const set = new Set(keys);
    setRows((current) =>
      current.map((row) => (set.has(row.key) ? { ...row, excluded } : row)),
    );
  }, []);

  // ------------------------------------------------------------- extraction

  const stopExtraction = useCallback(() => {
    extractionRunning.current = false;
    setIsExtracting(false);
  }, []);

  /**
   * Extract the selected catalogues.
   *
   * Only rows that still need it are queued, so this doubles as "retry the
   * failures": pressing it again after a partial run picks up exactly where
   * the last one stopped, without re-spending on the ones that succeeded.
   */
  const runExtraction = useCallback(async () => {
    if (extractionRunning.current) return;

    const queue = rows.filter(
      (row) =>
        !row.excluded &&
        row.selectedCatalogue &&
        row.extraction.status !== "done" &&
        row.extraction.status !== "skipped",
    );
    if (queue.length === 0) return;

    extractionRunning.current = true;
    setIsExtracting(true);
    setRows((current) =>
      current.map((row) =>
        queue.some((q) => q.key === row.key)
          ? { ...row, extraction: { ...row.extraction, status: "queued" } }
          : row,
      ),
    );

    let cursor = 0;
    const worker = async () => {
      for (;;) {
        if (!extractionRunning.current) return;
        const index = cursor++;
        if (index >= queue.length) return;
        const row = queue[index];
        const file = row.selectedCatalogue;
        if (!file) continue;

        setRows((current) =>
          current.map((r) =>
            r.key === row.key
              ? { ...r, extraction: { ...r.extraction, status: "running" } }
              : r,
          ),
        );

        try {
          const { appPName } = resolveProduct(row.joined);
          const form = new FormData();
          form.append("file", file.file, file.name);
          if (appPName) form.append("productName", appPName);

          const response = await fetch("/api/extract/catalogue", {
            method: "POST",
            body: form,
          });
          if (!response.ok) {
            throw new Error(`extraction service returned ${response.status}`);
          }
          const payload = await response.json();
          // The Python service answers {success, data:{products, description}};
          // `description` is the stage-1 summary, which is what the corpus
          // stores as catalogueDesc.
          const description: string =
            payload?.data?.description ?? payload?.description ?? "";
          if (!description.trim()) {
            throw new Error("extractor returned no description");
          }

          setRows((current) =>
            current.map((r) =>
              r.key === row.key
                ? {
                    ...r,
                    catalogueDesc: description.trim(),
                    extraction: {
                      status: "done",
                      attempts: r.extraction.attempts + 1,
                    },
                  }
                : r,
            ),
          );
        } catch (error) {
          setRows((current) =>
            current.map((r) =>
              r.key === row.key
                ? {
                    ...r,
                    extraction: {
                      status: "failed",
                      attempts: r.extraction.attempts + 1,
                      error:
                        error instanceof Error ? error.message : "extraction failed",
                    },
                  }
                : r,
            ),
          );
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.max(1, concurrency) }, () => worker()),
    );

    extractionRunning.current = false;
    setIsExtracting(false);
  }, [rows, concurrency]);

  // ----------------------------------------------------------------- commit

  const commit = useCallback(async () => {
    const committable = rows.filter(
      (row) =>
        !row.excluded && !row.alreadyInCorpus && !rowBlocker(row, requiredRoles),
    );
    if (committable.length === 0) return;

    setIsBusy(true);
    const progress: CommitProgress = {
      committed: 0,
      created: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };
    setCommitProgress({ ...progress });

    for (let i = 0; i < committable.length; i += COMMIT_CHUNK_SIZE) {
      const chunk = committable.slice(i, i + COMMIT_CHUNK_SIZE);
      const payload = chunk.map((row) => buildDatasetMetadata(row, batchId));

      try {
        const response = await fetch("/api/datasets/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: CORPUS_TASK,
            type: CORPUS_TYPE,
            embeddingFields: [...EMBEDDING_FIELDS],
            requiredRegisters: requiredRoles,
            rows: payload,
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error ?? `commit returned ${response.status}`);
        }
        progress.created += result.createdItems ?? 0;
        progress.skipped += result.skippedItems ?? 0;
        // The backend applies the same rules independently. Anything it turns
        // away that the frontend let through is a genuine disagreement worth
        // showing rather than swallowing.
        progress.failed += result.rejectedItems ?? 0;
        for (const rejection of result.rejections ?? []) {
          if (progress.errors.length < 20) {
            progress.errors.push(
              `${rejection.sourceKey}: rejected — ${rejection.reason}`,
            );
          }
        }
        if (Array.isArray(result.errors) && result.errors.length > 0) {
          progress.errors.push(...result.errors.slice(0, 5));
        }
      } catch (error) {
        progress.failed += chunk.length;
        progress.errors.push(
          error instanceof Error ? error.message : "chunk failed",
        );
      }
      progress.committed += chunk.length;
      setCommitProgress({ ...progress });
    }

    setIsBusy(false);
    setStep("done");
  }, [rows, batchId, requiredRoles]);

  const reset = useCallback(() => {
    stopExtraction();
    setStep("registers");
    setRegisters([]);
    setRegisterErrors([]);
    setRegisterNotes([]);
    setSelectedTranches(new Set());
    setJoinReport(null);
    joinedFrom.current = null;
    setFolders([]);
    setRows([]);
    setCommitProgress(null);
  }, [stopExtraction]);

  return {
    step, setStep,
    registers, registerErrors, registerNotes, addRegisterFiles, removeRegister,
    tranches, requiredRoles, selectedTranches, setSelectedTranches,
    corpus, loadCorpusSummary,
    joinReport,
    folders, attachFolder, skipFolders,
    rows, selectCatalogue, setExcluded, setExcludedMany,
    concurrency, setConcurrency,
    isExtracting, runExtraction, stopExtraction,
    commit, commitProgress, isBusy, batchId, reset,
  };
}

/**
 * Combine the join with whatever folders were attached.
 *
 * A case with no folder, or a folder with no readable catalogue, becomes
 * register-only rather than an error: those rows still carry the EG decision
 * and justification, which is most of what the corpus is for. In T12, 69 of
 * the 360 register rows have no folder at all.
 */
export function buildRows(
  report: JoinReport,
  folders: CaseFolder[],
  knownKeys: Set<string>,
): ImportRow[] {
  const foldersByKey = new Map<string, CaseFolder>();
  for (const folder of folders) {
    if (folder.caseKey) foldersByKey.set(caseKeyString(folder.caseKey), folder);
  }

  return report.cases.map((joined) => {
    const folder = foldersByKey.get(joined.key) ?? null;
    const candidates = folder?.catalogueCandidates ?? [];
    const high = candidates.filter((c) => c.confidence === "high");

    let bucket: ImportRow["bucket"];
    let selected: ClassifiedFile | null = null;

    if (!folder || candidates.length === 0) {
      bucket = folder ? "none" : "registerOnly";
    } else if (high.length === 1) {
      bucket = "confident";
      selected = high[0];
    } else if (candidates.length === 1) {
      bucket = "confident";
      selected = candidates[0];
    } else {
      // Several plausible files. The user picks; guessing here is how the
      // wrong spec sheet ends up describing the product.
      bucket = "ambiguous";
    }

    return {
      key: joined.key,
      joined,
      folder,
      bucket,
      selectedCatalogue: selected,
      catalogueDesc: "",
      extraction: {
        status: selected ? "idle" : "skipped",
        attempts: 0,
      },
      excluded: false,
      alreadyInCorpus: knownKeys.has(joined.key),
    };
  });
}
