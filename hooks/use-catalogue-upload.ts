import { CLOUDFRONT_URL } from "@/lib/utils";
import { useState, useCallback } from "react";

export function useCatalogueUpload() {
  const [catalogueData, setCatalogueData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadCatalogue = useCallback(
    async (file: File, productName: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("productName", productName);
        // const response = await fetch(`${CLOUDFRONT_URL}/extract/catalogue`, {
        //   method: "POST",
        //   body: formData,
        // });
        const response = await fetch(`/api/extract/catalogue`, {
          method: "POST",
          body: formData,
        });

        console.log("Catalogue response:", response);

        if (!response.ok) {
          throw new Error("Failed to upload catalogue");
        }

        const data = await response.json();
        setCatalogueData(data);
        console.log("Catalogue data:", data);

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);
        console.error("Error uploading catalogue:", err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    catalogueData,
    isLoading,
    error,
    uploadCatalogue,
  };
}
