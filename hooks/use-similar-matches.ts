import { useState, useCallback } from "react";

interface SimilarMatchItem {
  PA_Cat?: string;
  PA_PName?: string;
  PA_Mod_No?: string;
  PA_Brand?: string;
  PA_Elaborate?: string;
  PA_Justify?: string;
  /** EG-form name/description (App_PName / App_PNam_Mod / catalogueDesc). Used
   *  alongside the application PA_* fields to enrich the semantic query so it
   *  lands in the same embedding space the dataset rows were built from. */
  egName?: string;
  egDesc?: string;
  desc?: string;
  [key: string]: any;
}

interface SimilarMatchesOptions {
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
        const item = options.item || {};

        const body = {
          // Application product name is the primary exact/fuzzy key.
          productName: item.PA_PName || item.egName || "",
          modelNo: item.PA_Mod_No || undefined,
          brand: item.PA_Brand || undefined,
          elaborate: item.PA_Elaborate || item.PA_Justify || item.desc || undefined,
          // EG form name/description appended to the semantic query only —
          // mirrors App_PName + catalogueDesc so the query embeds into the
          // same neighbourhood as the catalogue/EG rows we want to copy from.
          extraText: [item.egName, item.egDesc].filter(Boolean).join(" ") || undefined,
          datasetName: options.datasetName,
          datasetType: options.datasetType,
          limit: options.limit ?? 10,
        };

        if (!body.productName) {
          throw new Error(
            "Cannot search similar cases without a product name (PA_PName or EG App_PName)",
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
              category: metadata.App_Cat || metadata.RefL_Cat || metadata.PA_Cat || "",
              description: metadata.Q12b_Jus || metadata.Justify || "",
              approvalStatus: metadata.Q12a || metadata.Q12a_T4 || "",
              metadata,
              modelCode:
                metadata.Model_Code ||
                metadata.Model_List ||
                "",
              tier: currentTier && currentTier !== "none" ? currentTier : undefined,
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
