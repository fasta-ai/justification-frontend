import { useState } from "react";

export interface BulkDeleteResult {
  deletedIds: string[];
  failed: { id: string; error: string }[];
}

interface UseDeleteCaseResponse {
  deleteCase: (caseId: string) => Promise<{ success: boolean; error?: string }>;
  deleteCases: (caseIds: string[]) => Promise<BulkDeleteResult>;
  isLoading: boolean;
  error: string | null;
}

export function useDeleteCase(): UseDeleteCaseResponse {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteCase = async (
    caseId: string,
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error || "Failed to delete case";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }

      console.log("Case deleted successfully:", result);
      return {
        success: true,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete case";
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCases = async (caseIds: string[]): Promise<BulkDeleteResult> => {
    setIsLoading(true);
    setError(null);

    const result: BulkDeleteResult = { deletedIds: [], failed: [] };

    try {
      const outcomes = await Promise.allSettled(
        caseIds.map(async (id) => {
          const response = await fetch(`/api/cases/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(body.error || "Failed to delete case");
          }
          return id;
        }),
      );

      outcomes.forEach((outcome, index) => {
        const id = caseIds[index];
        if (outcome.status === "fulfilled") {
          result.deletedIds.push(id);
        } else {
          const message =
            outcome.reason instanceof Error
              ? outcome.reason.message
              : "Failed to delete case";
          result.failed.push({ id, error: message });
        }
      });

      if (result.failed.length > 0) {
        setError(
          `Failed to delete ${result.failed.length} of ${caseIds.length} case(s)`,
        );
      }

      return result;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    deleteCase,
    deleteCases,
    isLoading,
    error,
  };
}
