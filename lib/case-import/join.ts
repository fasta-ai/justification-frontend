import type {
  CaseKey,
  JoinReport,
  JoinedCase,
  ParsedRegister,
  RegisterRole,
  RegisterRow,
} from "./types";
import { normaliseCaseNo, normaliseToken } from "./normalise";
import { displayRef, rowsForTranches } from "./registers";

/**
 * Merging the three registers into one row per case.
 *
 * The key is the decomposed `Tranche | EB_RM | NO | NO_R`, never the composed
 * `Ref` string. Ref is not trustworthy: the registers disagree with themselves
 * about it (A_PA_Form has a row whose Ref says T12 while its Tranche column
 * says T10) and each file formats it differently.
 */

/** `${tranche}|${unit}|${no}${noR}`. Also the corpus dedupe key. */
export function caseKeyString(key: CaseKey): string {
  return `${key.tranche}|${key.unit}|${key.no}${key.noR}`;
}

/** The case number as people say it: `1378P`. */
export function caseNumber(key: CaseKey): string {
  return `${key.no}${key.noR}`;
}

/** Build a key from a register row, or explain why it could not be built. */
export function buildCaseKey(
  row: RegisterRow,
): { key: CaseKey } | { error: string } {
  const tranche = normaliseToken(row["Tranche"]);
  const unit = normaliseToken(row["EB_RM"]);
  const no = normaliseCaseNo(row["NO"]);
  const noR = normaliseToken(row["NO_R"]);

  if (!no) return { error: "no case number (NO is empty)" };
  if (!tranche) return { error: "no tranche" };
  return { key: { tranche, unit, no, noR } };
}

/**
 * Three-way join across the selected tranches.
 *
 * A case present in only one register is still returned: a row that exists
 * only in the EG register still carries Q12a and Q12b_Jus, which is most of
 * what the corpus is for. Deciding whether to import it is the user's call on
 * the review screen, not something to drop here.
 */
export function joinRegisters(
  registers: ParsedRegister[],
  tranches: Set<string>,
): JoinReport {
  const byKey = new Map<string, JoinedCase>();
  const unkeyed: JoinReport["unkeyed"] = [];

  const slotFor: Record<RegisterRole, "eg" | "pa" | "recordAdmin"> = {
    eg: "eg",
    pa: "pa",
    recordAdmin: "recordAdmin",
  };

  for (const register of registers) {
    for (const row of rowsForTranches(register, tranches)) {
      const built = buildCaseKey(row);
      if ("error" in built) {
        unkeyed.push({ role: register.role, row, reason: built.error });
        continue;
      }
      const keyStr = caseKeyString(built.key);
      let entry = byKey.get(keyStr);
      if (!entry) {
        entry = {
          key: keyStr,
          caseKey: built.key,
          ref: "",
          eg: null,
          pa: null,
          recordAdmin: null,
          sources: [],
        };
        byKey.set(keyStr, entry);
      }
      const slot = slotFor[register.role];
      // A duplicate key within one register keeps the first row and reports
      // the rest, rather than silently overwriting.
      if (entry[slot]) {
        unkeyed.push({
          role: register.role,
          row,
          reason: `duplicate of ${keyStr} within this register`,
        });
        continue;
      }
      entry[slot] = row;
      entry.sources.push(register.role);
    }
  }

  const cases = [...byKey.values()];
  for (const c of cases) {
    c.ref = displayRef([c.recordAdmin, c.eg, c.pa]);
  }
  cases.sort((a, b) => {
    const na = Number(a.caseKey.no);
    const nb = Number(b.caseKey.no);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a.key.localeCompare(b.key);
  });

  const singleCounts: Record<RegisterRole, number> = {
    eg: 0,
    pa: 0,
    recordAdmin: 0,
  };
  let completeCount = 0;
  let partialCount = 0;
  for (const c of cases) {
    if (c.sources.length === 3) completeCount++;
    else if (c.sources.length === 2) partialCount++;
    else singleCounts[c.sources[0]]++;
  }

  return { cases, completeCount, partialCount, singleCounts, unkeyed };
}
