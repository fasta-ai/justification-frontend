import { useState, useCallback } from "react";
import type { UpdateCaseStatusAndJustificationDto, UpdateCaseResponse } from "@/app/api/cases/types";

/**
 * A failed update, with enough detail for the caller to tell the two kinds
 * apart. The distinction matters: the server refusing a change is not the
 * same as not reaching the server, and only the second one justifies keeping
 * the reviewer's edit in local state.
 */
export interface UpdateCaseStatusFailure {
    success: false;
    /**
     * The server answered and refused (4xx) — a rule was broken, e.g. a status
     * transition the backend does not allow. Retrying changes nothing, and
     * pretending it saved would show the reviewer a decision the database
     * never recorded.
     */
    serverRejected: boolean;
    error: string;
}

export type UpdateCaseStatusResult = UpdateCaseResponse | UpdateCaseStatusFailure;

export function useUpdateCaseStatus() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updateCaseStatus = useCallback(
        async (
            caseId: string,
            data: UpdateCaseStatusAndJustificationDto
        ): Promise<UpdateCaseStatusResult> => {
            setIsLoading(true);
            setError(null);

            try {
                console.log(`Updating case ${caseId}:`, data);

                const response = await fetch(`/api/cases/${caseId}/status-justification`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(data),
                });

                // A non-JSON body (a gateway error page, say) is a transport
                // problem, not a refusal — keep it out of the rejected branch.
                let result: UpdateCaseResponse | null = null;
                let parseFailed = false;
                try {
                    result = (await response.json()) as UpdateCaseResponse;
                } catch {
                    parseFailed = true;
                }

                if (!response.ok || !result?.success) {
                    const message =
                        result?.error ||
                        `Failed to update case (HTTP ${response.status})`;
                    console.error("Error updating case:", message);
                    setError(message);
                    return {
                        success: false,
                        serverRejected:
                            !parseFailed && response.status >= 400 && response.status < 500,
                        error: message,
                    };
                }

                console.log("Case updated successfully:", result);
                return result;
            } catch (err) {
                // fetch() itself threw: offline, DNS, CORS, aborted.
                const errorMessage =
                    err instanceof Error
                        ? err.message
                        : "An error occurred while updating the case";
                console.error("Error updating case:", err);
                setError(errorMessage);
                return { success: false, serverRejected: false, error: errorMessage };
            } finally {
                setIsLoading(false);
            }
        },
        []
    );

    return {
        updateCaseStatus,
        isLoading,
        error,
    };
}
