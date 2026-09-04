"use client";

import type React from "react";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Upload,
  FileText,
  ImageIcon,
  FileCheck,
  BookOpen,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  Eye,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useProductStore } from "@/lib/store";
import { useApplicationUpload } from "@/hooks/use-application-upload";
import { useEGUpload } from "@/hooks/use-eg-upload";
import type {
  AiAppliedChange,
  AiSuggestion,
} from "@/hooks/use-application-upload";
import { useCatalogueUpload } from "@/hooks/use-catalogue-upload";
import type { Product, ProductFile, ExtractedData } from "@/lib/types";

const fileTypes = [
  {
    type: "application",
    label: "Application Form",
    icon: FileText,
    // .docm: SWD issues these forms macro-enabled, so most real uploads are
    // .docm rather than .docx. The extractor reads both.
    accept: ".doc,.docx,.docm",
  },
  {
    type: "eg",
    label: "EG Form",
    icon: FileCheck,
    accept: ".doc,.docx,.docm",
  },
  {
    type: "catalogue",
    label: "Product Catalogue",
    icon: ImageIcon,
    accept: ".jpg,.pdf",
  },
  {
    type: "quotation",
    label: "Quotation (Optional)",
    icon: BookOpen,
    accept: ".pdf,.doc,.docx,.txt",
  },
] as const;

interface AiSuggestionRowsProps {
  isReviewing: boolean;
  suggestions: Array<[string, AiSuggestion]>;
  onAccept: (field: string, value: any) => void;
  onDismiss: (field: string) => void;
  /** Changes the review applied on its own; each can be reverted. */
  applied?: Array<[string, AiAppliedChange]>;
  onRevert?: (field: string) => void;
}

/** Rows for a textarea so the whole answer is visible without scrolling. */
function textareaRows(value: unknown, min = 3, max = 30): number {
  const text = value == null ? "" : String(value);
  const lines = text
    .split("\n")
    .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 70)), 0);
  return Math.min(max, Math.max(min, lines + 1));
}

/** Inline value for short answers, a wrapped block for long prose. */
function SuggestionValue({ value }: { value: any }) {
  const text = String(value ?? "/") || "/";
  if (text.length <= 80) {
    return <code className="rounded bg-background px-1">{text}</code>;
  }
  return (
    <pre className="w-full max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-background px-2 py-1 font-sans text-[11px]">
      {text}
    </pre>
  );
}

/**
 * Rows rendered inside the extracted-data table showing where the AI's
 * reading differs from the parser's. Advisory only: nothing is applied until
 * the reviewer clicks "Use AI value".
 */
function AiSuggestionRows({
  isReviewing,
  suggestions,
  onAccept,
  onDismiss,
  applied = [],
  onRevert,
}: AiSuggestionRowsProps) {
  return (
    <>
      {applied.length > 0 && (
        <TableRow>
          <TableCell colSpan={2} className="p-0">
            <div className="border-l-2 border-sky-400 bg-sky-50/60 dark:bg-sky-950/20 px-3 py-2 space-y-1">
              <p className="text-[11px] font-semibold text-sky-900 dark:text-sky-300">
                AI tidied {applied.length} field
                {applied.length === 1 ? "" : "s"} (same value, cleaner
                wording) — applied
              </p>
              {applied.map(([field, c]) => (
                <div
                  key={field}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]"
                >
                  <span className="font-medium">{field}</span>
                  <span className="text-muted-foreground">was</span>
                  <SuggestionValue value={c.from} />
                  <span className="text-muted-foreground">now</span>
                  <SuggestionValue value={c.to} />
                  {onRevert && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 px-2 text-[10px]"
                      onClick={() => onRevert(field)}
                    >
                      Revert
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
      {isReviewing && (
        <TableRow>
          <TableCell
            colSpan={2}
            className="text-[11px] text-muted-foreground italic"
          >
            AI cross-check running…
          </TableCell>
        </TableRow>
      )}
      {suggestions.length > 0 && (
        <TableRow>
          <TableCell colSpan={2} className="p-0">
            <div className="border-l-2 border-amber-400 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2 space-y-2">
              <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-300">
                AI read {suggestions.length} field
                {suggestions.length === 1 ? "" : "s"} differently — nothing has
                been changed
              </p>
              {suggestions.map(([field, s]) => (
                <div
                  key={field}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]"
                >
                  <span className="font-medium">{field}</span>
                  <Badge
                    variant={s.kind === "conflict" ? "destructive" : "secondary"}
                    className="px-1 py-0 text-[10px]"
                  >
                    {s.kind}
                  </Badge>
                  <span className="text-muted-foreground">current</span>
                  <SuggestionValue value={s.current} />
                  <span className="text-muted-foreground">AI</span>
                  <SuggestionValue value={s.suggested} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-5 px-2 text-[10px]"
                    onClick={() => onAccept(field, s.suggested)}
                  >
                    Use AI value
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 px-2 text-[10px]"
                    onClick={() => onDismiss(field)}
                  >
                    Keep current
                  </Button>
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

interface ProductUploadCardProps {
  product: Product;
  onUpdate: (updates: Partial<Product>) => void;
  onRemove: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  commonTranch: string;
  commonSeason: string;
  /** Reports which extractions are running, so Stage 1 can total them up. */
  onBusyChange?: (productId: string, running: string[]) => void;
}

function ProductUploadCard({
  product,
  onUpdate,
  onRemove,
  isExpanded,
  onToggleExpand,
  commonTranch,
  commonSeason,
  onBusyChange,
}: ProductUploadCardProps) {
  console.log("product", product);
  const [showExtractedPreview, setShowExtractedPreview] = useState(false);
  // const [extractedData, setExtractedData] = useState<ExtractedData | null>(
  //   null,
  // );
  const [isExtracting, setIsExtracting] = useState(false);
  const [pendingCatalogueFile, setPendingCatalogueFile] = useState<File | null>(
    null,
  );
  const [editableEgData, setEditableEgData] = useState<Record<string, any>>({});
  const [editableAppData, setEditableAppData] = useState<Record<string, any>>(
    {},
  );
  const [editableCatalogueData, setEditableCatalogueData] = useState<
    Record<string, any>
  >({});

  const {
    uploadApplicationForm,
    isLoading: isUploadingApplication,
    applicationFormData,
    aiReview: applicationAiReview,
    isAiReviewing: isApplicationAiReviewing,
  } = useApplicationUpload();
  const {
    uploadEGForm,
    isLoading: isUploadingEG,
    egFormData,
    aiReview: egAiReview,
    isAiReviewing: isEgAiReviewing,
  } = useEGUpload();
  const {
    uploadCatalogue,
    isLoading: isUploadingCatalogue,
    catalogueData,
  } = useCatalogueUpload();

  const handleExtractData = () => {
    setIsExtracting(true);
    // Simulate extraction delay
    setTimeout(() => {
      // const data = simulateDataExtraction(product);
      // setExtractedData(data);
      setShowExtractedPreview(true);
      setIsExtracting(false);

      // Initialize editable data
      if (product?.egData?.data) {
        setEditableEgData(JSON.parse(JSON.stringify(product.egData.data)));
      }
      if (product?.applicationData?.data) {
        setEditableAppData(
          JSON.parse(JSON.stringify(product.applicationData.data)),
        );
      }
      if (product?.catalogueData?.data?.products?.[0]) {
        setEditableCatalogueData(
          JSON.parse(JSON.stringify(product.catalogueData.data.products[0])),
        );
      }
    }, 1200);
  };

  // Initialize editable data from product data when component mounts or product data changes
  useEffect(() => {
    if (product?.egData?.data) {
      setEditableEgData(JSON.parse(JSON.stringify(product.egData.data)));
    }
    if (product?.applicationData?.data) {
      setEditableAppData(
        JSON.parse(JSON.stringify(product.applicationData.data)),
      );
    }
    if (product?.catalogueData?.data?.products?.[0]) {
      setEditableCatalogueData(
        JSON.parse(JSON.stringify(product.catalogueData.data.products[0])),
      );
    }

    // If we have uploaded files and data, show the preview automatically
    if (
      product?.egData?.data ||
      product?.applicationData?.data ||
      product?.catalogueData?.data
    ) {
      setShowExtractedPreview(true);
    }
  }, [product.id]); // Only run when product ID changes (component mount)

  // Handle pending catalogue upload when application data becomes available
  // Guards the retry effect below against launching overlapping uploads.
  const catalogueInFlight = useRef(false);

  const handleCatalogueUploadWithData = useCallback(
    (file: File) => {
      const productName =
        product.applicationData?.data?.PA_PName || product.name || "";

      if (!productName && !product.applicationData?.data?.PA_PName) {
        // If we still don't have a product name, store the file and wait
        setPendingCatalogueFile(file);
        return;
      }

      // Catalogue extraction takes ~25s. The retry effect below re-runs on every
      // product change, so clearing `pendingCatalogueFile` only once the request
      // RESOLVED left a 25-second window in which each unrelated update (the
      // application extract landing, the AI review landing) launched another
      // duplicate upload. Clear it up front, and hard-block re-entry.
      if (catalogueInFlight.current) {
        console.warn(
          "Catalogue extraction already running - ignoring duplicate",
        );
        return;
      }
      catalogueInFlight.current = true;
      setPendingCatalogueFile(null);

      uploadCatalogue(file, productName)
        .then((data) => {
          onUpdate({ catalogueData: data });
        })
        .catch((err) => {
          console.error("Failed to upload catalogue:", err);
        })
        .finally(() => {
          catalogueInFlight.current = false;
        });
    },
    [product, uploadCatalogue, onUpdate],
  );

  // Effect to retry pending catalogue upload when application data is available
  useEffect(() => {
    if (pendingCatalogueFile && product.applicationData?.data?.PA_PName) {
      handleCatalogueUploadWithData(pendingCatalogueFile);
    }
  }, [
    product.applicationData?.data?.PA_PName,
    pendingCatalogueFile,
    handleCatalogueUploadWithData,
  ]);

  // Everything currently in flight for this product, newest concern first.
  // Named for what the reviewer is waiting on, not the internal call.
  const runningWork = [
    isUploadingApplication && "Application form",
    isUploadingEG && "EG form",
    isUploadingCatalogue && "Catalogue",
    pendingCatalogueFile && !isUploadingCatalogue
      ? "Catalogue (waiting for product name)"
      : null,
    isApplicationAiReviewing && "AI cross-check",
  ].filter(Boolean) as string[];

  // One entry per required document, so the indicator can show WHICH document
  // is done or running rather than just a total.
  const docStates = [
    {
      label: "Application form",
      done: !!product.applicationData?.data,
      running: isUploadingApplication,
    },
    {
      label: "EG form",
      done: !!product.egData?.data,
      running: isUploadingEG,
    },
    {
      label: "Catalogue",
      done: !!product.catalogueData?.data,
      running: isUploadingCatalogue || !!pendingCatalogueFile,
    },
  ];
  const documentsDone = docStates.filter((d) => d.done).length;
  const documentsExpected = docStates.length;

  const busyKey = runningWork.join("|");
  useEffect(() => {
    onBusyChange?.(product.id, busyKey ? busyKey.split("|") : []);
  }, [product.id, busyKey, onBusyChange]);

  const handleApplyExtractedData = useCallback(() => {
    // if (extractedData) {
    const updates: Partial<Product> = {};

    // Always save editable data if it exists
    if (Object.keys(editableEgData).length > 0) {
      updates.egData = { data: editableEgData };
    }
    if (Object.keys(editableAppData).length > 0) {
      updates.applicationData = { data: editableAppData };
    }
    if (Object.keys(editableCatalogueData).length > 0) {
      updates.catalogueData = {
        data: {
          products: [editableCatalogueData],
        },
      };
    }

    onUpdate(updates);
    setShowExtractedPreview(false);
    // }
  }, [
    // extractedData,
    editableEgData,
    editableAppData,
    editableCatalogueData,
    onUpdate,
  ]);

  const handleApplicationUpload = useCallback(
    (file: File) => {
      uploadApplicationForm(file)
        .then((data) => {
          onUpdate({ applicationData: data });
        })
        .catch((err) => {
          console.error("Failed to upload application form:", err);
        });
    },
    [uploadApplicationForm, onUpdate],
  );

  // The AI review NEVER writes a value. Neither source is authoritative - the
  // parser has shipped label-contaminated values, and the model has read the
  // wrong section of the form - so a disagreement is shown to the reviewer and
  // they decide. Dismissed suggestions are remembered so they stay dismissed.
  const [dismissedSuggestions, setDismissedSuggestions] = useState<
    Record<string, boolean>
  >({});

  const openSuggestions = Object.entries(
    applicationAiReview?.suggestions ?? {},
  ).filter(([field]) => !dismissedSuggestions[field]);

  const acceptSuggestion = useCallback(
    (field: string, value: any) => {
      setEditableAppData((prev) => {
        const merged = { ...prev, [field]: value };
        onUpdate({ applicationData: { data: merged } });
        return merged;
      });
      setDismissedSuggestions((prev) => ({ ...prev, [field]: true }));
    },
    [onUpdate],
  );

  const dismissSuggestion = useCallback((field: string) => {
    setDismissedSuggestions((prev) => ({ ...prev, [field]: true }));
  }, []);

  // Fields the review applied by itself (e.g. a tidier Typ_Disability that
  // reads the same as the parser's). Written into the editable values once
  // per review, shown to the reviewer, and revertable.
  const appliedReviewRef = useRef<object | null>(null);
  const [revertedApplied, setRevertedApplied] = useState<
    Record<string, boolean>
  >({});
  useEffect(() => {
    if (!applicationAiReview || appliedReviewRef.current === applicationAiReview)
      return;
    appliedReviewRef.current = applicationAiReview;
    setRevertedApplied({});
    const entries = Object.entries(applicationAiReview.applied ?? {});
    if (entries.length === 0) return;
    setEditableAppData((prev) => {
      const merged = { ...prev };
      for (const [field, change] of entries) merged[field] = change.to;
      onUpdate({ applicationData: { data: merged } });
      return merged;
    });
  }, [applicationAiReview, onUpdate]);

  const openApplied = Object.entries(
    applicationAiReview?.applied ?? {},
  ).filter(([field]) => !revertedApplied[field]);

  const revertApplied = useCallback(
    (field: string) => {
      const change = applicationAiReview?.applied?.[field];
      if (!change) return;
      setEditableAppData((prev) => {
        const merged = { ...prev, [field]: change.from ?? "" };
        onUpdate({ applicationData: { data: merged } });
        return merged;
      });
      setRevertedApplied((prev) => ({ ...prev, [field]: true }));
    },
    [applicationAiReview, onUpdate],
  );

  // Same contract for the EG form (dates): advisory, reviewer decides.
  const [dismissedEgSuggestions, setDismissedEgSuggestions] = useState<
    Record<string, boolean>
  >({});
  const openEgSuggestions = Object.entries(
    egAiReview?.suggestions ?? {},
  ).filter(([field]) => !dismissedEgSuggestions[field]);

  const acceptEgSuggestion = useCallback(
    (field: string, value: any) => {
      setEditableEgData((prev) => {
        const merged = { ...prev, [field]: value };
        onUpdate({ egData: { data: merged } });
        return merged;
      });
      setDismissedEgSuggestions((prev) => ({ ...prev, [field]: true }));
    },
    [onUpdate],
  );

  const dismissEgSuggestion = useCallback((field: string) => {
    setDismissedEgSuggestions((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleEGUpload = useCallback(
    (file: File) => {
      if (!commonTranch.trim()) {
        alert("Please fill in the Tranche field before uploading an EG form.");
        document.getElementById("common-tranch")?.focus();
        return;
      }
      uploadEGForm(file, commonTranch, commonSeason)
        .then((data) => {
          // Automatically set product name to {NO}{NO_R}
          const updates: any = { egData: data };

          if (data?.data?.NO && data?.data?.NO_R) {
            updates.name = `${data.data.NO}${data.data.NO_R}`;
          }

          onUpdate(updates);
        })
        .catch((err) => {
          console.error("Failed to upload EG form:", err);
        });
    },
    [uploadEGForm, onUpdate, commonTranch],
  );

  const handleCatalogueUpload = useCallback(
    (file: File) => {
      handleCatalogueUploadWithData(file);
    },
    [handleCatalogueUploadWithData],
  );

  const handleFileUpload = useCallback(
    (fileType: ProductFile["type"], file: File) => {
      const updatedFiles = product.files.map((f) =>
        f.type === fileType
          ? { ...f, file, name: file.name, status: "uploaded" as const }
          : f,
      );
      onUpdate({ files: updatedFiles });

      // Handle application form upload
      if (fileType === "application") {
        handleApplicationUpload(file);
      }

      // Handle EG form upload
      if (fileType === "eg") {
        handleEGUpload(file);
      }

      // Handle catalogue upload
      if (fileType === "catalogue") {
        handleCatalogueUpload(file);
      }
    },
    [
      product.files,
      onUpdate,
      handleApplicationUpload,
      handleEGUpload,
      handleCatalogueUpload,
    ],
  );

  const handleFileDrop = useCallback(
    (fileType: ProductFile["type"], e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(fileType, file);
    },
    [handleFileUpload],
  );

  const removeFile = useCallback(
    (fileType: ProductFile["type"]) => {
      const updatedFiles = product.files.map((f) =>
        f.type === fileType
          ? { ...f, file: null, name: "", status: "pending" as const }
          : f,
      );
      onUpdate({ files: updatedFiles });
    },
    [product.files, onUpdate],
  );

  const uploadedCount = product.files.filter(
    (f) => f.status === "uploaded",
  ).length;

  console.log("applicationFormData", applicationFormData);
  console.log("egFormData", egFormData);
  console.log("EditableEgData", editableEgData);
  console.log("catalogueData", catalogueData);
  console.log("EditableCatalogueData", editableCatalogueData);
  console.log("edibleAppData", editableAppData);

  return (
    <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow gap-0">
      <CardHeader className="pb-3 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <Input
                value={product.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="Product Name"
                className="font-semibold text-base border-0 p-0 h-auto focus-visible:ring-0 bg-transparent"
              />
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {uploadedCount}/4 files
                </Badge>
                {uploadedCount === 4 && (
                  <Badge className="text-xs bg-success text-success-foreground">
                    Complete
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* One dot per required document, inline in a row that already
                exists: filled = extracted, pulsing = running, hollow = not yet.
                No bar, no divider, no reserved height. */}
            <span
              className="flex items-center gap-1"
              title={docStates
                .map(
                  (d) =>
                    `${d.label}: ${d.running ? "processing…" : d.done ? "done" : "not yet"}`,
                )
                .join("\n")}
            >
              {docStates.map((d) => (
                <span
                  key={d.label}
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    d.running
                      ? "bg-primary animate-pulse"
                      : d.done
                        ? "bg-primary"
                        : "bg-muted-foreground/25",
                  )}
                />
              ))}
              <span
                className={cn(
                  "ml-0.5 text-[11px] tabular-nums",
                  runningWork.length > 0
                    ? "text-primary font-medium"
                    : "text-muted-foreground",
                )}
              >
                {documentsDone}/{documentsExpected}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleExpand}
              className="h-8 w-8"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {fileTypes.map(({ type, label, icon: Icon, accept }) => {
              const fileInfo = product.files.find((f) => f.type === type);
              const isUploaded = fileInfo?.status === "uploaded";
              const isLoading =
                (type === "application" && isUploadingApplication) ||
                (type === "eg" && isUploadingEG) ||
                (type === "catalogue" && isUploadingCatalogue);

              return (
                <div
                  key={type}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleFileDrop(type, e)}
                  className={cn(
                    "relative border-2 border-dashed rounded-lg p-3 transition-all cursor-pointer group",
                    isLoading
                      ? "border-blue-500 bg-blue-50"
                      : isUploaded
                        ? "border-success bg-success/5"
                        : "border-border hover:border-primary/50 hover:bg-primary/5",
                  )}
                >
                  <input
                    type="file"
                    accept={accept}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(type, file);
                    }}
                    disabled={isLoading}
                    className={cn(
                      "absolute inset-0 opacity-0 cursor-pointer",
                      isUploaded && "pointer-events-none",
                    )}
                  />
                  <div className="flex flex-col items-center text-center gap-2">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        isLoading
                          ? "bg-blue-200 animate-pulse"
                          : isUploaded
                            ? "bg-success/20"
                            : "bg-muted",
                      )}
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Icon
                          className={cn(
                            "w-4 h-4",
                            isUploaded
                              ? "text-success"
                              : "text-muted-foreground",
                          )}
                        />
                      )}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {isLoading
                        ? type === "catalogue"
                          ? "Uploading..."
                          : "Processing..."
                        : label}
                    </span>
                    {isUploaded && !isLoading && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-success truncate max-w-[80px]">
                          {fileInfo?.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeFile(type);
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Extract Data Button */}
          {uploadedCount > 0 && (
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleExtractData}
                disabled={isExtracting}
                className="gap-2 bg-transparent"
              >
                {isExtracting ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Extracting Data...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Preview Extracted Data
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Extracted Data Preview Table */}
          {showExtractedPreview && (editableEgData || editableAppData) && (
            <div className="mt-4 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-sm">
                    Extracted Data Preview (Editable)
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowExtractedPreview(false)}
                    className="h-7 text-xs bg-transparent"
                  >
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApplyExtractedData}
                    className="h-7 text-xs gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Apply Data
                  </Button>
                </div>
              </div>

              <div className="rounded-md border overflow-hidden bg-background max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold w-40">
                        Field
                      </TableHead>
                      <TableHead className="text-xs font-semibold">
                        Value
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* EG Form Data */}
                    {editableEgData && (
                      <>
                        <TableRow className="bg-muted/20">
                          <TableCell
                            colSpan={2}
                            className="text-xs font-bold text-primary"
                          >
                            EG Form Data
                          </TableCell>
                        </TableRow>
                        <AiSuggestionRows
                          isReviewing={isEgAiReviewing}
                          suggestions={openEgSuggestions}
                          onAccept={acceptEgSuggestion}
                          onDismiss={dismissEgSuggestion}
                        />
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Application No
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.App_No || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  App_No: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Project Name & Model
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.App_PNam_Mod || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  App_PNam_Mod: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Application Type
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.App_Type || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  App_Type: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Deadline Date
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.D_PlnT_SWD || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  D_PlnT_SWD: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Request Date
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.D_ReqF_SWD || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  D_ReqF_SWD: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            EB_RM
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.EB_RM || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  EB_RM: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            NO
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.NO || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  NO: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            NO_R
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.NO_R || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  NO_R: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Ref
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.Ref || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  Ref: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            SWD_Off_I
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.SWD_Off_I || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  SWD_Off_I: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            SWD_Off_N
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.SWD_Off_N || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  SWD_Off_N: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            SWD_Off_P
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.SWD_Off_P || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  SWD_Off_P: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Tranche
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.Tranche || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  Tranche: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            SWD Reference
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.SWD_Ref || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  SWD_Ref: e.target.value,
                                }))
                              }
                              className="h-6 text-xs font-mono"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Q12a
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.Q12a || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  Q12a: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Q12b Justification
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.Q12b_Jus || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  Q12b_Jus: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Q12c Total Cost
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.Q12c_TotC || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  Q12c_TotC: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Q12d Quotation
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.Q12d_Quo || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  Q12d_Quo: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Q12e Justification Cost
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.Q12e_JCost || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  Q12e_JCost: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Q12f Reject Reason
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.Q12f_RReject || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  Q12f_RReject: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Q12g Justification Remarks
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.Q12g_JRem || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  Q12g_JRem: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Q13a
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.Q13a || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  Q13a: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Q13b
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.Q13b || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  Q13b: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Remarks EGF
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableEgData.Remarks_EGF || ""}
                              onChange={(e) =>
                                setEditableEgData((prev) => ({
                                  ...prev,
                                  Remarks_EGF: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                      </>
                    )}

                    {/* Application Form Data */}
                    {editableAppData && (
                      <>
                        <TableRow className="bg-muted/20">
                          <TableCell
                            colSpan={2}
                            className="text-xs font-bold text-primary"
                          >
                            Application Data
                          </TableCell>
                        </TableRow>

                        {/* AI second opinion. Advisory only: nothing here has
                            been applied to the values above. */}
                        <AiSuggestionRows
                          isReviewing={isApplicationAiReviewing}
                          suggestions={openSuggestions}
                          onAccept={acceptSuggestion}
                          onDismiss={dismissSuggestion}
                          applied={openApplied}
                          onRevert={revertApplied}
                        />

                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Reference
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableAppData.PA_RefL || ""}
                              onChange={(e) =>
                                setEditableAppData((prev) => ({
                                  ...prev,
                                  PA_RefL: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Product Name
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableAppData.PA_PName || ""}
                              onChange={(e) =>
                                setEditableAppData((prev) => ({
                                  ...prev,
                                  PA_PName: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Model Number
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableAppData.PA_Mod_No || ""}
                              onChange={(e) =>
                                setEditableAppData((prev) => ({
                                  ...prev,
                                  PA_Mod_No: e.target.value,
                                }))
                              }
                              className="h-6 text-xs font-mono"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Brand
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableAppData.PA_Brand || ""}
                              onChange={(e) =>
                                setEditableAppData((prev) => ({
                                  ...prev,
                                  PA_Brand: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Category
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableAppData.PA_Cat || ""}
                              onChange={(e) =>
                                setEditableAppData((prev) => ({
                                  ...prev,
                                  PA_Cat: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Disability Type
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableAppData.Typ_Disability || ""}
                              onChange={(e) =>
                                setEditableAppData((prev) => ({
                                  ...prev,
                                  Typ_Disability: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Professional Staff
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableAppData.Prof_Staff || ""}
                              onChange={(e) =>
                                setEditableAppData((prev) => ({
                                  ...prev,
                                  Prof_Staff: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Staff Type
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableAppData.Typ_Staff || ""}
                              onChange={(e) =>
                                setEditableAppData((prev) => ({
                                  ...prev,
                                  Typ_Staff: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Staff Available
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              value={editableAppData.Staff_Avail || ""}
                              onChange={(e) =>
                                setEditableAppData((prev) => ({
                                  ...prev,
                                  Staff_Avail: e.target.value,
                                }))
                              }
                              className="h-6 text-xs"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Disabled Users
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              type="number"
                              value={editableAppData.No_Disable || 0}
                              onChange={(e) =>
                                setEditableAppData((prev) => ({
                                  ...prev,
                                  No_Disable: parseInt(e.target.value) || 0,
                                }))
                              }
                              className="h-6 text-xs font-bold"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Elderly Users
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              type="number"
                              value={editableAppData.No_Elderly || 0}
                              onChange={(e) =>
                                setEditableAppData((prev) => ({
                                  ...prev,
                                  No_Elderly: parseInt(e.target.value) || 0,
                                }))
                              }
                              className="h-6 text-xs font-bold"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Beneficiaries
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              type="number"
                              value={editableAppData.No_Bene || 0}
                              onChange={(e) =>
                                setEditableAppData((prev) => ({
                                  ...prev,
                                  No_Bene: parseInt(e.target.value) || 0,
                                }))
                              }
                              className="h-6 text-xs font-bold"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Total Amount Required
                          </TableCell>
                          <TableCell className="text-xs">
                            <Input
                              type="number"
                              value={editableAppData.TotAmtR || ""}
                              onChange={(e) =>
                                setEditableAppData((prev) => ({
                                  ...prev,
                                  TotAmtR: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="h-6 text-xs font-bold text-green-600"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Justification
                          </TableCell>
                          <TableCell className="text-xs">
                            <textarea
                              value={editableAppData.PA_Justify || ""}
                              onChange={(e) =>
                                setEditableAppData((prev) => ({
                                  ...prev,
                                  PA_Justify: e.target.value,
                                }))
                              }
                              rows={textareaRows(editableAppData.PA_Justify)}
                              className="w-full min-h-20 px-2 py-1 text-xs border rounded resize-y whitespace-pre-wrap"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            Elaborate
                          </TableCell>
                          <TableCell className="text-xs">
                            <textarea
                              value={editableAppData.PA_Elaborate || ""}
                              onChange={(e) =>
                                setEditableAppData((prev) => ({
                                  ...prev,
                                  PA_Elaborate: e.target.value,
                                }))
                              }
                              rows={textareaRows(editableAppData.PA_Elaborate)}
                              className="w-full min-h-20 px-2 py-1 text-xs border rounded resize-y whitespace-pre-wrap"
                            />
                          </TableCell>
                        </TableRow>
                      </>
                    )}

                    {/* Catalogue Data */}
                    {editableCatalogueData && (
                      <>
                        <TableRow className="bg-muted/20">
                          <TableCell
                            colSpan={2}
                            className="text-xs font-bold text-primary"
                          >
                            Catalogue Data
                          </TableCell>
                        </TableRow>
                        {/* {editableCatalogueData.products &&
                          editableCatalogueData.products.length > 0 && ( */}
                        <>
                          <TableRow>
                            <TableCell className="text-xs font-medium text-muted-foreground">
                              Product Name
                            </TableCell>
                            <TableCell className="text-xs">
                              <Input
                                value={editableCatalogueData.product_name || ""}
                                onChange={(e) =>
                                  setEditableCatalogueData((prev) => ({
                                    ...prev,
                                    product_name: e.target.value,
                                  }))
                                }
                                className="h-6 text-xs"
                              />
                            </TableCell>
                          </TableRow>
                          {editableCatalogueData.model && (
                            <TableRow>
                              <TableCell className="text-xs font-medium text-muted-foreground">
                                Model
                              </TableCell>
                              <TableCell className="text-xs">
                                <Input
                                  value={editableCatalogueData.model || ""}
                                  onChange={(e) =>
                                    setEditableCatalogueData((prev) => ({
                                      ...prev,
                                      model: e.target.value,
                                    }))
                                  }
                                  className="h-6 text-xs font-mono"
                                />
                              </TableCell>
                            </TableRow>
                          )}
                          {editableCatalogueData.product_size && (
                            <TableRow>
                              <TableCell className="text-xs font-medium text-muted-foreground">
                                Size
                              </TableCell>
                              <TableCell className="text-xs">
                                <Input
                                  value={
                                    editableCatalogueData.product_size || ""
                                  }
                                  onChange={(e) =>
                                    setEditableCatalogueData((prev) => ({
                                      ...prev,
                                      product_size: e.target.value,
                                    }))
                                  }
                                  className="h-6 text-xs"
                                />
                              </TableCell>
                            </TableRow>
                          )}
                          {editableCatalogueData.usage_capacity && (
                            <TableRow>
                              <TableCell className="text-xs font-medium text-muted-foreground">
                                Usage Capacity
                              </TableCell>
                              <TableCell className="text-xs">
                                <Input
                                  value={
                                    editableCatalogueData.usage_capacity || ""
                                  }
                                  onChange={(e) =>
                                    setEditableCatalogueData((prev) => ({
                                      ...prev,
                                      usage_capacity: e.target.value,
                                    }))
                                  }
                                  className="h-6 text-xs"
                                />
                              </TableCell>
                            </TableRow>
                          )}
                          <TableRow>
                            <TableCell className="text-xs font-medium text-muted-foreground">
                              Description
                            </TableCell>
                            <TableCell className="text-xs">
                              <textarea
                                value={editableCatalogueData.description || ""}
                                onChange={(e) =>
                                  setEditableCatalogueData((prev) => ({
                                    ...prev,
                                    description: e.target.value,
                                  }))
                                }
                                className="w-full h-16 px-2 py-1 text-xs border rounded resize-none"
                              />
                            </TableCell>
                          </TableRow>
                        </>
                        {/* // )} */}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

interface Stage1UploadProps {
  onNext: () => void;
}

export function Stage1Upload({ onNext }: Stage1UploadProps) {
  const {
    products,
    addProduct,
    updateProduct,
    removeProduct,
    commonSeason,
    commonTranch,
    setCommonSeason,
    setCommonTranch,
    applyCommonSeasonAndTranch,
  } = useProductStore();
  const [expandedProducts, setExpandedProducts] = useState<string[]>([]);

  const createNewProduct = useCallback(
    (): Product => ({
      id: `product-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: "",
      sku: "",
      category: "",
      season: commonSeason,
      tranch: commonTranch,
      description: "",
      supplier: "",
      status: "draft",
      createdAt: new Date(),
      files: [
        {
          id: `file-spec-${Date.now()}`,
          name: "",
          type: "application",
          file: null,
          status: "pending",
        },
        {
          id: `file-cert-${Date.now()}`,
          name: "",
          type: "eg",
          file: null,
          status: "pending",
        },
        {
          id: `file-img-${Date.now()}`,
          name: "",
          type: "catalogue",
          file: null,
          status: "pending",
        },
        {
          id: `file-doc-${Date.now()}`,
          name: "",
          type: "quotation",
          file: null,
          status: "pending",
        },
      ],
    }),
    [commonSeason, commonTranch],
  );

  // Auto-apply common season and tranche to all products when they change
  useEffect(() => {
    if (products.length > 0) {
      applyCommonSeasonAndTranch();
    }
  }, [commonSeason, commonTranch]);

  // Tranche is mandatory: it is stamped onto every product, feeds the EG
  // extractor (Ref = "<tranche>_<App_No>"), and the create-case API rejects
  // cases without it. Block product creation until it is filled in.
  const [trancheError, setTrancheError] = useState(false);
  const ensureTranche = useCallback((): boolean => {
    if (commonTranch.trim()) {
      setTrancheError(false);
      return true;
    }
    setTrancheError(true);
    document.getElementById("common-tranch")?.focus();
    return false;
  }, [commonTranch]);

  const handleAddProduct = useCallback(() => {
    if (!ensureTranche()) return;
    const newProduct = createNewProduct();
    addProduct(newProduct);
    setExpandedProducts((prev) => [...prev, newProduct.id]);
  }, [addProduct, createNewProduct, ensureTranche]);

  const handleBatchUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!ensureTranche()) {
        e.target.value = "";
        return;
      }
      const files = Array.from(e.target.files || []);

      // Group files by name pattern (e.g., "product1_spec.pdf", "product1_cert.pdf")
      const productGroups = new Map<string, File[]>();

      files.forEach((file) => {
        const baseName = file.name.split("_")[0] || file.name.split(".")[0];
        const existing = productGroups.get(baseName) || [];
        productGroups.set(baseName, [...existing, file]);
      });

      productGroups.forEach((groupFiles, baseName) => {
        const newProduct = createNewProduct();
        newProduct.name = baseName;

        groupFiles.forEach((file) => {
          const fileName = file.name.toLowerCase();
          let fileType: ProductFile["type"] = "documentation";

          if (fileName.includes("spec")) fileType = "specification";
          else if (fileName.includes("cert")) fileType = "certification";
          else if (/\.(jpg|jpeg|png|webp)$/.test(fileName)) fileType = "image";

          newProduct.files = newProduct.files.map((f) =>
            f.type === fileType && f.status === "pending"
              ? { ...f, file, name: file.name, status: "uploaded" as const }
              : f,
          );
        });

        addProduct(newProduct);
        setExpandedProducts((prev) => [...prev, newProduct.id]);
      });

      e.target.value = "";
    },
    [addProduct, createNewProduct, ensureTranche],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedProducts((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
    );
  }, []);

  // What each card currently has in flight, keyed by product id.
  const [busyByProduct, setBusyByProduct] = useState<Record<string, string[]>>(
    {},
  );

  // Stable identity: a new function each render would re-fire the reporting
  // effect inside every card on every parent render.
  const handleBusyChange = useCallback(
    (productId: string, running: string[]) => {
      setBusyByProduct((prev) => {
        const before = prev[productId] ?? [];
        if (
          before.length === running.length &&
          before.every((v, i) => v === running[i])
        ) {
          return prev; // no change - don't trigger a pointless re-render
        }
        return { ...prev, [productId]: running };
      });
    },
    [],
  );

  // Every product is exactly one of these three, so they sum to the total -
  // which is why a separate "Products" count is redundant.
  const productStats = products.reduce(
    (acc, p) => {
      const isRunning = (busyByProduct[p.id] ?? []).length > 0;
      const isComplete =
        !!p.applicationData?.data &&
        !!p.egData?.data &&
        !!p.catalogueData?.data;
      if (isRunning) acc.inProgress += 1;
      else if (isComplete) acc.completed += 1;
      else acc.pending += 1;
      return acc;
    },
    { inProgress: 0, completed: 0, pending: 0 },
  );

  // Leaving Stage 1 loses every uploaded file and everything extracted from it:
  // nothing here is persisted until cases are created in Step 2.
  const hasUnsavedWork = products.length > 0;
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedWork]);

  // The browser Back button would otherwise silently discard the whole stage.
  // Push a sentinel entry so Back lands here first and can be confirmed.
  useEffect(() => {
    if (!hasUnsavedWork) return;
    window.history.pushState(null, "", window.location.href);
    const onPopState = () => {
      const leave = window.confirm(
        "Leave this page? Your uploaded documents and everything extracted " +
          "from them will be lost — they are only saved once you create cases " +
          "in the next step.",
      );
      if (!leave) {
        window.history.pushState(null, "", window.location.href);
      } else {
        window.history.back();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [hasUnsavedWork]);

  const canProceed =
    products.length > 0 &&
    products.every((p) => {
      const requiredTypes = ["application", "eg", "catalogue"];
      return requiredTypes.every((type) =>
        p.files.find((f) => f.type === type && f.file !== null),
      );
    });

  console.log("Products:", products);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Title only - the old subtitle restated what the stage already says. */}
        <h2 className="text-xl font-bold text-foreground">Upload Products</h2>
        <div className="flex items-center gap-3">
          {products.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span
                className={cn(
                  "flex items-center gap-1.5 tabular-nums",
                  productStats.inProgress > 0
                    ? "text-primary font-medium"
                    : "text-muted-foreground",
                )}
              >
                {productStats.inProgress > 0 && (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                )}
                {productStats.inProgress} in progress
              </span>
              <span className="text-muted-foreground tabular-nums">
                {productStats.completed} complete
              </span>
              <span className="text-muted-foreground tabular-nums">
                {productStats.pending} pending
              </span>
            </div>
          )}
          <Button onClick={handleAddProduct} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Product
          </Button>
        </div>
      </div>
      {/* Labels sit beside their inputs rather than stacked above, which drops
          a whole row. "applies to all products" moves to the tooltip. */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4">
        <div className="flex items-center gap-2">
          <Label
            htmlFor="common-season"
            title="Applies to all products"
            className="w-16 shrink-0 text-xs text-muted-foreground"
          >
            Season
          </Label>
          <Input
            id="common-season"
            value={commonSeason}
            onChange={(e) => setCommonSeason(e.target.value)}
            placeholder="e.g., Spring 2026"
            className="h-8 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="common-tranch"
              title="Applies to all products (required)"
              className="w-16 shrink-0 text-xs text-muted-foreground"
            >
              Tranche <span className="text-destructive">*</span>
            </Label>
            <Input
              id="common-tranch"
              value={commonTranch}
              onChange={(e) => {
                setCommonTranch(e.target.value);
                if (e.target.value.trim()) setTrancheError(false);
              }}
              placeholder="e.g., T13"
              required
              aria-required
              aria-invalid={trancheError}
              className={cn(
                "h-8 text-sm",
                trancheError && "border-destructive focus-visible:ring-destructive",
              )}
            />
          </div>
          {trancheError && (
            <p className="text-xs text-destructive" role="alert">
              Tranche is required before adding products.
            </p>
          )}
        </div>
      </div>

      {/* Common Season and Tranche Section */}
      {/* <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Common Season & Tranche
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Set season and tranche for all products at once
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="common-season">Season</Label>
              <Input
                id="common-season"
                value={commonSeason}
                onChange={(e) => setCommonSeason(e.target.value)}
                placeholder="e.g., Spring 2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="common-tranch">Tranche</Label>
              <Input
                id="common-tranch"
                value={commonTranch}
                onChange={(e) => setCommonTranch(e.target.value)}
                placeholder="e.g., Tranche A"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={applyCommonSeasonAndTranch}
                disabled={!commonSeason && !commonTranch}
                variant="outline"
                className="w-full gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Apply to All Products
              </Button>
            </div>
          </div>
        </CardContent>
      </Card> */}

      {products.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              No products added yet
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Start by adding individual products or use batch upload to add
              multiple products at once
            </p>
            <Button onClick={handleAddProduct} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {products.map((product) => (
            <ProductUploadCard
              key={product.id}
              product={product}
              onUpdate={(updates) => updateProduct(product.id, updates)}
              onRemove={() => removeProduct(product.id)}
              isExpanded={expandedProducts.includes(product.id)}
              onToggleExpand={() => toggleExpand(product.id)}
              commonTranch={commonTranch}
              commonSeason={commonSeason}
              onBusyChange={handleBusyChange}
            />
          ))}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          onClick={handleAddProduct}
          variant="outline"
          size="lg"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Button>
        <Button
          onClick={onNext}
          disabled={!canProceed}
          size="lg"
          className="gap-2"
        >
          Continue to Preview
          <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
        </Button>
      </div>
    </div>
  );
}
