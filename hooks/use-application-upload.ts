import { useState, useCallback, useRef, useEffect } from "react";

/** One field where the model's reading differs from the parser's. */
export interface AiSuggestion {
  /** fill = parser blank; cleaner = same value tidier; similar/conflict = differs. */
  kind: "fill" | "cleaner" | "similar" | "conflict";
  current: any;
  suggested: any;
  similarity: number | null;
}

/** Shape returned by /api/extract/application/ai-review. */
export interface AiReviewResult {
  /** Rule-based values, UNCHANGED - the model never overwrites anything. */
  data: Record<string, any>;
  rules: Record<string, any>;
  /** Differences for the reviewer to accept or ignore. */
  suggestions: Record<string, AiSuggestion>;
}

export function useApplicationUpload() {
  const [applicationFormData, setApplicationFormData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Background second pass; null until it lands (and it may never land). */
  const [aiReview, setAiReview] = useState<AiReviewResult | null>(null);
  const [isAiReviewing, setIsAiReviewing] = useState(false);

  // Each upload gets a token. A background review that resolves after a newer
  // upload started is stale and must be dropped, or it would apply one file's
  // values to another's form.
  const uploadToken = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const uploadApplicationForm = useCallback(async (file: File) => {
    const token = ++uploadToken.current;
    setIsLoading(true);
    setError(null);
    setAiReview(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/extract/application", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload application form");
      }

      const data = await response.json();
      setApplicationFormData(data);

      // Kick off the AI review WITHOUT awaiting it: the caller gets the fast
      // rule-based result immediately and the form renders, while this runs in
      // the background and surfaces via `aiReview` a few seconds later.
      setIsAiReviewing(true);
      const reviewForm = new FormData();
      reviewForm.append("file", file);
      fetch("/api/extract/application/ai-review", {
        method: "POST",
        body: reviewForm,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((review) => {
          // Drop if unmounted, superseded by a newer upload, or unsuccessful.
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
          // Never surface as a user-facing error: the rule-based values stand
          // on their own and the reviewer is already working with them.
          console.warn("Application AI review unavailable:", err);
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
      console.error("Error uploading application form:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    applicationFormData,
    isLoading,
    error,
    uploadApplicationForm,
    aiReview,
    isAiReviewing,
  };
}
