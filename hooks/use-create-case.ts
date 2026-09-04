import { useState, useCallback } from "react";
import type { CreateCaseDto, CreateCaseResponse } from "@/app/api/cases/types";

export function useCreateCase() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createCase = useCallback(async (caseData: CreateCaseDto): Promise<CreateCaseResponse | null> => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/cases/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(caseData),
            });

            const result: CreateCaseResponse = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || "Failed to create case");
            }

            console.log("Case created successfully:", result);
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An error occurred while creating the case";
            console.error("Error creating case:", err);
            setError(errorMessage);
            // Return the reason rather than null so callers creating several
            // cases can tell the reviewer WHICH one failed and why.
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        createCase,
        isLoading,
        error,
    };
}
