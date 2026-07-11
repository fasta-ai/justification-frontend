import { useState, useCallback } from "react";
import type {
  ReplaceFromSimilarDto,
  ReplaceFromSimilarResponse,
} from "@/app/api/cases/types";
import { useAuth } from "@/lib/auth-context";

interface UseReplaceFromSimilarReturn {
  replaceFromSimilar: (
    caseId: string,
    data: ReplaceFromSimilarDto,
  ) => Promise<ReplaceFromSimilarResponse>;
  isLoading: boolean;
  error: string | null;
}

function getAuthHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function useReplaceFromSimilar(): UseReplaceFromSimilarReturn {
  const { accessToken, refreshAccessToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replaceFromSimilar = useCallback(
    async (
      caseId: string,
      data: ReplaceFromSimilarDto,
    ): Promise<ReplaceFromSimilarResponse> => {
      setIsLoading(true);
      setError(null);

      if (!isValidUuid(caseId)) {
        const message = "Invalid case ID";
        setError(message);
        setIsLoading(false);
        return { success: false, error: message };
      }

      const currentToken = accessToken ?? (await refreshAccessToken());
      if (!currentToken) {
        const message = "Session expired. Please log in again.";
        setError(message);
        setIsLoading(false);
        return { success: false, error: message };
      }

      try {
        const response = await fetch(
          `/api/cases/${caseId}/replace-from-similar`,
          {
            method: "POST",
            headers: getAuthHeaders(currentToken),
            body: JSON.stringify(data),
          },
        );

        if (response.status === 401) {
          const refreshedToken = await refreshAccessToken();
          if (!refreshedToken) {
            const message = "Session expired. Please log in again.";
            setError(message);
            return { success: false, error: message };
          }
          const retryResponse = await fetch(
            `/api/cases/${caseId}/replace-from-similar`,
            {
              method: "POST",
              headers: getAuthHeaders(refreshedToken),
              body: JSON.stringify(data),
            },
          );
          const retryResult: ReplaceFromSimilarResponse =
            await retryResponse.json();
          if (!retryResponse.ok || !retryResult.success) {
            throw new Error(
              retryResult.error || "Failed to replace case fields",
            );
          }
          return retryResult;
        }

        const result: ReplaceFromSimilarResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to replace case fields");
        }

        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to replace case fields";
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken, refreshAccessToken],
  );

  return { replaceFromSimilar, isLoading, error };
}
