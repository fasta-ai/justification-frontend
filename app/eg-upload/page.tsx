"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileCheck,
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { ProtectedRoute } from "@/components/protected-route";
import { useGetCases } from "@/hooks/use-get-cases";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ExtractedEGData {
  data: Record<string, unknown>;
  confidence?: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
// .docm is included because SWD issues these forms macro-enabled; the Python
// extractor reads the document body of .docm and .docx identically.
const ALLOWED_EXTENSIONS = [".doc", ".docx", ".docm"];

function validateFile(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Invalid file type. Supported: ${ALLOWED_EXTENSIONS.join(", ")}`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return "File too large. Maximum size: 10MB";
  }
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

function EGUploadPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedEGData | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [tranche, setTranche] = useState<string>("");
  const [season, setSeason] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  const { cases, isLoading: casesLoading, refetch } = useGetCases();

  const selectedCase = (cases ?? []).find((c) => c.id === selectedCaseId);

  useEffect(() => {
    if (selectedCase) {
      const caseData = selectedCase.egData?.data as
        | Record<string, unknown>
        | undefined;
      setTranche(
        selectedCase.tranche ||
          (typeof caseData?.Tranche === "string" ? caseData.Tranche : "")
      );
      setSeason(
        selectedCase.season ||
          (typeof caseData?.Season === "string" ? caseData.Season : "")
      );
    } else {
      setTranche("");
      setSeason("");
    }
  }, [selectedCase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      setFile(null);
      setExtractedData(null);
      return;
    }
    setFile(selectedFile);
    setExtractedData(null);
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    const validationError = validateFile(droppedFile);
    if (validationError) {
      setError(validationError);
      return;
    }
    setFile(droppedFile);
    setExtractedData(null);
    setError(null);
  };

  const handleDropZoneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const handleExtract = useCallback(async () => {
    if (!file) {
      setError("Please select an EG file to upload");
      return;
    }
    if (!selectedCaseId) {
      setError("Please select a case first");
      return;
    }
    if (!tranche) {
      setError("Tranche is required. Please select a case with tranche data or enter it manually.");
      return;
    }
    if (!season) {
      setError("Season is required. Please select a case with season data or enter it manually.");
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tranche", tranche);
      formData.append("season", season);

      const response = await fetch("/api/extract/eg", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: Record<string, unknown>;
        confidence?: number;
      };

      if (!response.ok) {
        throw new Error(
          result.error || `Failed to extract EG form data (${response.status})`
        );
      }

      setExtractedData(result as ExtractedEGData);
      toast({
        title: "Extraction Complete",
        description:
          "EG form data extracted successfully. Review and save to replace.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction failed";
      setError(msg);
    } finally {
      setIsExtracting(false);
    }
  }, [file, selectedCaseId, tranche, season, toast]);

  const handleSave = useCallback(async () => {
    if (!extractedData || !selectedCaseId) {
      setError("No extracted data to save");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${selectedCaseId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ egData: extractedData.data }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save EG data");
      }

      toast({ title: "Saved", description: "EG table data has been replaced." });
      setFile(null);
      setExtractedData(null);
      await refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  }, [extractedData, selectedCaseId, toast, refetch]);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col">
        <Header
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          products={[]}
          resetStore={() => {}}
        />

        <main className="flex-1 px-4 py-8 max-w-5xl mx-auto w-full">
          {/* Page Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              size="sm"
              className="mb-4 gap-2"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <FileCheck className="w-7 h-7 text-primary" />
              EG Table Upload &amp; Replace
            </h1>
            <p className="text-muted-foreground mt-1">
              Upload a new EG form to replace the existing table data for a
              selected case.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column — Selection & Upload */}
            <div className="space-y-6">
              {/* Case Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">1. Select Case</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {casesLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground" data-testid="cases-loading">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading cases...
                    </div>
                  ) : (cases ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground" data-testid="no-cases">No cases found.</p>
                  ) : (
                    <div className="space-y-3">
                          <Select
                        value={selectedCaseId}
                        onValueChange={(value) => {
                          setSelectedCaseId(value);
                          setExtractedData(null);
                          setError(null);
                        }}
                        data-testid="case-select"
                      >
                        <SelectTrigger className="w-full" data-testid="case-select-trigger">
                          <SelectValue placeholder="-- Select a case --" />
                        </SelectTrigger>
                        <SelectContent>
                          {(cases ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.caseNumber} — {c.status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {selectedCase && (
                        <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Case Number:
                            </span>
                            <span className="font-medium">
                              {selectedCase.caseNumber}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge
                              variant={
                                selectedCase.status === "approved"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {selectedCase.status}
                            </Badge>
                          </div>
                          {selectedCase.egData && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Existing EG Data:
                              </span>
                              <span className="text-green-600">Yes</span>
                            </div>
                          )}
                        </div>
                      )}

                      {selectedCase && (!tranche || !season) && (
                        <div className="space-y-2">
                          {!tranche && (
                            <div className="space-y-1">
                              <Label className="text-xs">Tranche</Label>
                              <Input
                                value={tranche}
                                onChange={(e) => setTranche(e.target.value)}
                                placeholder="e.g. T12"
                              />
                            </div>
                          )}
                          {!season && (
                            <div className="space-y-1">
                              <Label className="text-xs">Season</Label>
                              <Input
                                value={season}
                                onChange={(e) => setSeason(e.target.value)}
                                placeholder="e.g. 2025"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* File Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">2. Upload New EG File</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                      file
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"
                    )}
                    role="button"
                    tabIndex={0}
                    aria-label="Select EG form file"
                    data-testid="drop-zone"
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={handleDropZoneKeyDown}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".doc,.docx,.docm"
                      className="hidden"
                      onChange={handleFileChange}
                      data-testid="file-input"
                    />
                    <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    {file ? (
                      <div>
                        <p className="font-medium text-foreground">{file.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Click or drag to upload EG form file
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Supported: {ALLOWED_EXTENSIONS.join(", ")} (max 10MB)
                        </p>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleExtract}
                    disabled={!file || !selectedCaseId || isExtracting}
                    className="w-full gap-2"
                    data-testid="extract-btn"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <FileCheck className="w-4 h-4" />
                        Extract &amp; Preview
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Column — Preview & Save */}
            <div>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">
                    3. Extracted Data Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!extractedData ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <FileCheck className="w-12 h-12 mb-4 opacity-30" />
                      <p className="text-sm">Upload and extract to see preview</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg border overflow-hidden">
                        <div className="max-h-[400px] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-muted sticky top-0">
                              <tr>
                                <th scope="col" className="text-left px-3 py-2 font-medium">
                                  Field
                                </th>
                                <th scope="col" className="text-left px-3 py-2 font-medium">
                                  Value
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(extractedData.data || {}).map(
                                ([key, value]) => (
                                  <tr key={key} className="border-t">
                                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                                      {key}
                                    </td>
                                    <td className="px-3 py-2">
                                      {renderValue(value)}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <p className="text-xs text-muted-foreground">
                          {Object.keys(extractedData.data || {}).length} fields
                          extracted
                        </p>
                        <Button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="gap-2"
                          data-testid="save-btn"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              Replace EG Data
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        <footer className="border-t py-4 mt-auto">
          <div className="px-4">
            <p className="text-center text-sm text-muted-foreground">
              Product Data Management System • AI-Powered Approval Workflow
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function ProtectedEGUploadPage() {
  return (
    <ProtectedRoute>
      <EGUploadPage />
    </ProtectedRoute>
  );
}
