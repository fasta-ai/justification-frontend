import { useState, useCallback } from "react";
import { normaliseAppCat } from "@/lib/app-cat";

interface SimilarMatchItem {
  /** Reference-list category. Sent as a ranking boost — never a filter —
   *  because it is the applicant's choice and reviewers re-categorise. */
  PA_Cat?: string;
  /** The case's own tranche. Cases from the same tranche are excluded from
   *  results: they are still being decided, so they are not precedent. */
  tranche?: string;
  /** The querying case's id (cases.id). Sent as `excludeCaseId` so a case
   *  never lists its own corpus row (written once it is approved/rejected)
   *  as a similar case. */
  caseId?: string;
  PA_PName?: string;
  PA_Mod_No?: string;
  PA_Brand?: string;
  PA_Elaborate?: string;
  PA_Justify?: string;
  /** EG-form name/description (App_PName / App_PNam_Mod / catalogueDesc). Used
   *  alongside the application PA_* fields to enrich the semantic query so it
   *  lands in the same embedding space the dataset rows were built from. */
  egName?: string;
  /** EG-form model number / brand — preferred over PA_Mod_No / PA_Brand. */
  egModel?: string;
  egBrand?: string;
  egDesc?: string;
  desc?: string;
  [key: string]: any;
}

export interface SimilarMatchesOptions {
  item: SimilarMatchItem;
  datasetName: string;
  datasetType?: string;
  /** override retrieval limit per tier */
  limit?: number;
}

export interface SimilarMatch {
  id: string;
  name: string;
  similarity: number;
  category: string;
  description?: string;
  approvalStatus?: string;
  metadata?: any;
  modelCode?: string;
  /** Which retrieval tier surfaced this match. */
  tier?: "exact" | "fuzzy" | "semantic";
  /** Which field family produced the winning score. */
  matchedOn?: "name" | "description" | "justification" | "semantic";
  /** Cosine agreement between the query and this row, when the backend computed it. */
  semanticScore?: number;
}

interface UseSimilarMatchesReturn {
  matches: SimilarMatch[];
  /** The tier that produced the current result set (or "none"/undefined if no matches). */
  tier?: "exact" | "fuzzy" | "semantic" | "none";
  loading: boolean;
  error: string | null;
  /** Clear matches/tier/error — call when switching cases so stale results
   *  from a previous search are not shown. */
  clearMatches: () => void;
  /**
   * Fetch similar matches and return the fresh result set. Callers should use
   * the resolved value rather than reading `matches` state right after await,
   * since React state updates are not reflected in the current render closure.
   */
  fetchSimilarMatches: (
    options: SimilarMatchesOptions,
  ) => Promise<{ matches: SimilarMatch[]; tier: "exact" | "fuzzy" | "semantic" | "none" }>;
}

/**
 * The tiered `/api/datasets/match` request for an item (see backend
 * TieredMatchQueryDto). Exported for tests.
 */
export function buildSimilarMatchRequest(options: SimilarMatchesOptions) {
  const item = options.item || {};
  const egName = item.egName?.trim() || "";
  const paName = item.PA_PName?.trim() || "";
  return {
    // EG form product name / model / brand are the search keys; the
    // application (PA_*) values only fill in when the EG form is blank.
    productName: egName || paName,
    modelNo: item.egModel || item.PA_Mod_No || undefined,
    brand: item.egBrand || item.PA_Brand || undefined,
    elaborate: item.PA_Elaborate || item.PA_Justify || item.desc || undefined,
    // EG form name/description appended to the semantic query only —
    // mirrors App_PName + catalogueDesc so the query embeds into the
    // same neighbourhood as the catalogue/EG rows we want to copy from.
    extraText: [item.egName, item.egDesc].filter(Boolean).join(" ") || undefined,
    // Secondary name: an extra tier-2 (fuzzy) query variant weighted
    // below productName — the application name when the EG name leads.
    // The backend drops it when identical to productName.
    egName: (egName ? paName : "") || undefined,
    category:
      item.PA_Cat && item.PA_Cat.trim() && item.PA_Cat.trim() !== "/"
        ? item.PA_Cat.trim()
        : undefined,
    excludeTranche: item.tranche?.trim() || undefined,
    excludeCaseId: item.caseId?.trim() || undefined,
    datasetName: options.datasetName,
    datasetType: options.datasetType,
    limit: options.limit ?? 10,
  };
}

/**
 * Category shown for a similar-case row. When the row carries an App_Cat it
 * is normalised the same way the registers/exports are (Procurement/Rental;
 * legacy values such as a PA_RefL "Yes"/"No" fall back to Procurement). Rows
 * with no App_Cat (older catalogue/reference rows) fall back to their
 * reference-list category, RefL_Cat then PA_Cat, else "".
 */
export function similarMatchCategory(
  metadata: Record<string, unknown> | null | undefined,
): string {
  const appCat = metadata?.App_Cat;
  if (appCat !== undefined && appCat !== null && String(appCat).trim()) {
    return normaliseAppCat(appCat);
  }
  const text = (v: unknown) =>
    v === undefined || v === null ? "" : String(v).trim();
  return text(metadata?.RefL_Cat) || text(metadata?.PA_Cat) || "";
}

/**
 * Client hook for the tiered similar-case endpoint (`/api/datasets/match`).
 * Maps the item's PA_* fields into the tiered request shape.
 */
export function useSimilarMatches(): UseSimilarMatchesReturn {
  const [matches, setMatches] = useState<SimilarMatch[]>([]);
  const [tier, setTier] = useState<
    "exact" | "fuzzy" | "semantic" | "none" | undefined
  >(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSimilarMatches = useCallback(
    async (
      options: SimilarMatchesOptions,
    ): Promise<{
      matches: SimilarMatch[];
      tier: "exact" | "fuzzy" | "semantic" | "none";
    }> => {
      setLoading(true);
      setError(null);
      setMatches([]);
      setTier(undefined);

      try {
        const token = localStorage.getItem("authToken") || "";
        const body = buildSimilarMatchRequest(options);

        if (!body.productName) {
          throw new Error(
            "Cannot search similar cases without a product name (EG App_PName or PA_PName)",
          );
        }

        const response = await fetch("/api/datasets/match", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `Failed to fetch similar matches: ${response.statusText}`,
          );
        }

        const data = await response.json();
        const currentTier = data?.tier as SimilarMatch["tier"] | "none";
        setTier(currentTier);

        const raw = Array.isArray(data?.matches) ? data.matches : [];
        const transformed: SimilarMatch[] = raw.map(
          (m: any, index: number) => {
            const dataset = m.dataset || {};
            const metadata = dataset.metadata || {};
            return {
              id: dataset.id || `match-${index}`,
              name:
                metadata.App_PName ||
                metadata?.pa_form_data?.PA_PName ||
                metadata.Company ||
                "Unknown",
              similarity: typeof m.score === "number" ? m.score : 0,
              category: similarMatchCategory(metadata),
              description: metadata.Q12b_Jus || metadata.Justify || "",
              approvalStatus: metadata.Q12a || metadata.Q12a_T4 || "",
              metadata,
              modelCode:
                metadata.Model_Code ||
                metadata.Model_List ||
                "",
              // Per-match tier: a topped-up page mixes exact/fuzzy rows with
              // semantic ones, so the page-level tier alone would mislabel them.
              tier:
                m.tier ||
                (currentTier && currentTier !== "none" ? currentTier : undefined),
              matchedOn: m.matchedOn,
              semanticScore:
                typeof m.semanticScore === "number" ? m.semanticScore : undefined,
            };
          },
        );

        setMatches(transformed);
        return {
          matches: transformed,
          tier: currentTier && currentTier !== "none" ? currentTier : "none",
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);
        console.error("Similar matches error:", err);
        return { matches: [], tier: "none" };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const clearMatches = useCallback(() => {
    setMatches([]);
    setTier(undefined);
    setError(null);
    setLoading(false);
  }, []);

  return {
    matches,
    tier,
    loading,
    error,
    fetchSimilarMatches,
    clearMatches,
  };
}
