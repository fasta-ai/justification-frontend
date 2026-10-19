import { useState } from "react";
import type { SaveCaseDataDto } from "@/app/api/cases/types";
import { useAuth } from "@/lib/auth-context";

function getAuthHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

interface UseSaveCaseDataResponse {
  saveCaseData: (
    caseId: string,
    data: SaveCaseDataDto,
  ) => Promise<{ success: boolean; case?: any; error?: string }>;
  isLoading: boolean;
  error: string | null;
}

export function useSaveCaseData(): UseSaveCaseDataResponse {
  const { accessToken, refreshAccessToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveCaseData = async (
    caseId: string,
    data: SaveCaseDataDto,
  ): Promise<{ success: boolean; case?: any; error?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      // Send the bearer token explicitly and retry once after a silent
      // refresh. This hook used to rely on the cookie alone, so a save that
      // landed just after the access token expired failed outright — and a
      // draft save is exactly the call people make an hour into a session.
      const post = (token: string | null) =>
        fetch(`/api/cases/${caseId}/save`, {
          method: "POST",
          headers: getAuthHeaders(token),
          body: JSON.stringify(data),
        });

      let response = await post(accessToken);
      if (response.status === 401) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          const message = "Session expired. Please log in again.";
          setError(message);
          return { success: false, error: message };
        }
        response = await post(refreshed);
      }

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error || "Failed to save case data";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }

      console.log("Case data saved successfully:", result);
      return {
        success: true,
        case: result.case,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save case data";
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    saveCaseData,
    isLoading,
    error,
  };
}
