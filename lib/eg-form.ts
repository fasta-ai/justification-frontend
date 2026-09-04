/**
 * EG form (Expert Group consolidated advice) generation.
 *
 * Fills `public/eg_form_template.docx` — a copy of the HKCSS EG form with
 * `{tag}` placeholders in every value cell — from a live case and downloads
 * the result. Only approved / rejected cases have enough data to be worth
 * exporting; callers should gate on status.
 *
 * Numbered form fields -> template tags:
 *   (1)  Applicant      (2)  App_Cat       (3)  App_PName
 *   (4)  D_ReqF_SWD     (5)  D_PlnT_SWD    (6)  Ref (tranche prefix stripped)
 *   (7)  SWD_Off        (8)  SWD_Off_I     (9)  D_EGF_ASWD
 *   (10) Staff          (11) Staff_Info
 *   (12a-g) Q12a … Q12g_JRem   (13a-b) Q13a, Q13b
 */

import type { Case } from "@/app/api/cases/types";

export const EG_FORM_TEMPLATE_URL = "/eg_form_template.docx";

export interface EgFormData {
  Applicant: string;
  App_Cat: string;
  App_PName: string;
  D_ReqF_SWD: string;
  D_PlnT_SWD: string;
  Ref: string;
  SWD_Off: string;
  SWD_Off_I: string;
  D_EGF_ASWD: string;
  Staff: string;
  Staff_Info: string;
  Q12a: string;
  Q12b_Jus: string;
  Q12c_TotC: string;
  Q12d_Quo: string;
  Q12e_JCost: string;
  Q12f_RReject: string;
  Q12g_JRem: string;
  Q13a: string;
  Q13b: string;
}

/** "/" is the extractor's null marker; treat it like an empty value. */
export function clean(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = String(value).trim();
  return s === "/" ? "" : s;
}

/** First non-empty candidate, else "". */
export function pick(...candidates: unknown[]): string {
  for (const c of candidates) {
    const s = clean(c);
    if (s) return s;
  }
  return "";
}

/** Normalise ISO-ish dates ("2023-01-26 00:00:00", "2023-01-26T…") to dd/mm/yyyy; pass everything else through. */
function formatDate(value: unknown): string {
  const s = clean(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

/** Field (6): Ref with the tranche prefix removed ("T13_SWD/RMB/I&TF/T13/2001P" -> "SWD/RMB/I&TF/T13/2001P"). */
export function stripTranche(ref: unknown, tranche?: unknown): string {
  const s = clean(ref);
  if (!s) return "";
  const t = clean(tranche);
  if (t && s.startsWith(`${t}_`)) return s.slice(t.length + 1);
  return s.replace(/^T\d+_/i, "");
}

/** Field (7): "Name / Post". Post comes from SWD_Off_P; if the name already carries a "/ Post" part it is kept as-is. */
export function formatSwdOfficer(name: unknown, post: unknown): string {
  const n = clean(name);
  const p = clean(post);
  if (n && p) return n.includes("/") ? n : `${n} / ${p}`;
  return n || p;
}

/** Fields (10)/(11): Staff1 and Staff2 (or their _Info) joined with a comma. */
export function joinStaff(first: unknown, second: unknown): string {
  return [clean(first), clean(second)].filter(Boolean).join(", ");
}

function formatAmount(value: unknown): string {
  const s = clean(value);
  if (!s) return "";
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n.toLocaleString("en-HK") : s;
}

/**
 * egData keys whose value can be derived from the rest of the case when the
 * stored value is empty. Shared by the EG form download and the Stage 3 edit
 * dialog so both show the same prefilled values. Only non-empty derivations
 * are returned; keys already set on egData are left out.
 */
export function deriveEgDefaults(caseItem: Case): Record<string, string> {
  const eg = (caseItem.egData ?? {}) as Record<string, unknown>;
  const app = (caseItem.applicationData ?? {}) as Record<string, unknown>;
  const isApproved = caseItem.status === "approved";
  const isRejected = caseItem.status === "rejected";
  const justification = clean(caseItem.justification);

  const derived: Record<string, string> = {
    App_Cat: "Procurement",
    App_PNam_Mod: pick(app.PA_PName),
    Q12a: isApproved ? "Yes" : isRejected ? "No" : "",
    Q12b_Jus: justification,
    Q12c_TotC: formatAmount(app.TotAmtR),
    Q12f_RReject: isApproved ? "NA" : "",
    Q13a: "NIL",
    Q13b: "NIL",
  };

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(derived)) {
    if (value && !clean(eg[key])) out[key] = value;
  }
  return out;
}

/** Map a live case onto the template tags. Values already on egData win over derived fallbacks. */
export function buildEgFormData(caseItem: Case): EgFormData {
  const eg = (caseItem.egData ?? {}) as Record<string, unknown>;
  const app = (caseItem.applicationData ?? {}) as Record<string, unknown>;
  const isApproved = caseItem.status === "approved";
  const isRejected = caseItem.status === "rejected";
  const justification = clean(caseItem.justification);

  return {
    Applicant: pick(eg.Applicant, eg.App_Type),
    App_Cat: pick(eg.App_Cat, "Procurement"),
    App_PName: pick(eg.App_PName, app.PA_PName, eg.App_PNam_Mod),
    D_ReqF_SWD: formatDate(eg.D_ReqF_SWD),
    D_PlnT_SWD: formatDate(eg.D_PlnT_SWD),
    Ref: stripTranche(
      pick(eg.Ref, eg.SWD_Ref, eg.App_No),
      eg.Tranche ?? caseItem.tranche,
    ),
    SWD_Off: formatSwdOfficer(eg.SWD_Off_N, eg.SWD_Off_P),
    SWD_Off_I: clean(eg.SWD_Off_I),
    D_EGF_ASWD: formatDate(eg.D_EGF_ASWD),
    Staff: joinStaff(eg.Staff1, eg.Staff2),
    Staff_Info: joinStaff(eg.Staff1_Info, eg.Staff2_Info),
    Q12a: pick(eg.Q12a, isApproved ? "Yes" : isRejected ? "No" : ""),
    Q12b_Jus: pick(eg.Q12b_Jus, justification),
    Q12c_TotC: formatAmount(pick(eg.Q12c_TotC, app.TotAmtR)),
    Q12d_Quo: clean(eg.Q12d_Quo),
    Q12e_JCost: clean(eg.Q12e_JCost),
    Q12f_RReject: pick(eg.Q12f_RReject, isRejected ? justification : "NA"),
    Q12g_JRem: clean(eg.Q12g_JRem),
    Q13a: pick(eg.Q13a, "NIL"),
    Q13b: pick(eg.Q13b, "NIL"),
  };
}

/** "2001P_EG Form.docx", falling back to the case number. */
export function egFormFileName(caseItem: Case): string {
  const eg = (caseItem.egData ?? {}) as Record<string, unknown>;
  const base = pick(eg.App_No, caseItem.caseNumber, caseItem.id).replace(
    /[\\/:*?"<>|]+/g,
    "_",
  );
  return `${base}_EG Form.docx`;
}

/** Render the template with the case data and return the .docx as a Blob. */
export async function renderEgForm(
  caseItem: Case,
  templateUrl: string = EG_FORM_TEMPLATE_URL,
): Promise<Blob> {
  const [{ default: PizZip }, { default: Docxtemplater }, res] =
    await Promise.all([
      import("pizzip"),
      import("docxtemplater"),
      fetch(templateUrl),
    ]);
  if (!res.ok) {
    throw new Error(`Failed to load EG form template (${res.status})`);
  }
  const zip = new PizZip(await res.arrayBuffer());
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  doc.render(buildEgFormData(caseItem));
  return doc.getZip().generate({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/** Fill the EG form for a case and trigger a browser download. */
export async function downloadEgForm(caseItem: Case): Promise<void> {
  const blob = await renderEgForm(caseItem);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = egFormFileName(caseItem);
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
