import { useState, useCallback, useRef, useEffect } from "react";
import type { AiReviewResult } from "@/hooks/use-application-upload";

export function useEGUpload() {
  const [egFormData, setEGFormData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Background second opinion on the two EG dates; null until it lands. */
  const [aiReview, setAiReview] = useState<AiReviewResult | null>(null);
  const [isAiReviewing, setIsAiReviewing] = useState(false);

  // A review that resolves after a newer upload must not overwrite it.
  const uploadToken = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const uploadEGForm = useCallback(
    async (file: File, tranche: string, season: string) => {
      setIsLoading(true);
      setError(null);
      setAiReview(null);
      const token = ++uploadToken.current;

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("tranche", tranche);
        formData.append("season", season);

        const response = await fetch("/api/extract/eg", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to upload EG form");
        }

        const data = await response.json();
        // Attach tranche/season, but never clobber a value the extractor
        // derived itself (it falls back to the tranche inside the SWD ref).
        if (tranche) data.data["Tranche"] = tranche;
        if (season) data.data["Season"] = season;
        setEGFormData(data);

        // AI review of the dates, NOT awaited: the rule-based result renders
        // now and any disagreement surfaces via `aiReview` a few seconds later.
        setIsAiReviewing(true);
        const reviewForm = new FormData();
        reviewForm.append("file", file);
        reviewForm.append("tranche", tranche);
        reviewForm.append("season", season);
        fetch("/api/extract/eg/ai-review", { method: "POST", body: reviewForm })
          .then((res) => (res.ok ? res.json() : null))
          .then((review) => {
            if (!mounted.current || token !== uploadToken.current) return;
            if (review?.success && review?.data) {
              setAiReview({
                data: review.data,
                rules: review.rules ?? {},
                suggestions: review.suggestions ?? {},
              });
            }
          })
          .catch((err) => {
            // Advisory only; the rule-based values stand on their own.
            console.warn("EG AI review unavailable:", err);
          })
          .finally(() => {
            if (mounted.current && token === uploadToken.current) {
              setIsAiReviewing(false);
            }
          });

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);
        console.error("Error uploading EG form:", err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    egFormData,
    isLoading,
    error,
    uploadEGForm,
    aiReview,
    isAiReviewing,
  };
}
