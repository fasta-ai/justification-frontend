import { useState, useCallback } from "react";
import type {
  CaseAuditLogEntry,
  GetAuditLogsResponse,
} from "@/app/api/cases/types";
import { useAuth } from "@/lib/auth-context";

interface UseCaseAuditLogsReturn {
  logs: CaseAuditLogEntry[];
  isLoading: boolean;
  error: string | null;
  fetchAuditLogs: (caseId: string) => Promise<void>;
}

function getAuthHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function useCaseAuditLogs(): UseCaseAuditLogsReturn {
  const { accessToken, refreshAccessToken } = useAuth();
  const [logs, setLogs] = useState<CaseAuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditLogs = useCallback(async (caseId: string) => {
    setIsLoading(true);
    setError(null);

    if (!isValidUuid(caseId)) {
      const message = "Invalid case ID";
      setError(message);
      setLogs([]);
      setIsLoading(false);
      return;
    }

    const currentToken = accessToken ?? (await refreshAccessToken());
    if (!currentToken) {
      const message = "Session expired. Please log in again.";
      setError(message);
      setLogs([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/cases/${caseId}/audit-logs`, {
        headers: getAuthHeaders(currentToken),
      });

      if (response.status === 401) {
        const refreshedToken = await refreshAccessToken();
        if (!refreshedToken) {
          const message = "Session expired. Please log in again.";
          setError(message);
          setLogs([]);
          setIsLoading(false);
          return;
        }
        const retryResponse = await fetch(`/api/cases/${caseId}/audit-logs`, {
          headers: getAuthHeaders(refreshedToken),
        });
        const retryResult: GetAuditLogsResponse = await retryResponse.json();
        if (!retryResponse.ok || !retryResult.success) {
          throw new Error(retryResult.error || "Failed to fetch audit logs");
        }
        setLogs(retryResult.logs || []);
        return;
      }

      const result: GetAuditLogsResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch audit logs");
      }

      setLogs(result.logs || []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch audit logs";
      setError(message);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, refreshAccessToken]);

  return { logs, isLoading, error, fetchAuditLogs };
}
