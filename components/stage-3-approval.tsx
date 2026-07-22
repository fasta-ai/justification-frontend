"use client";

import { useState, useCallback, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  X,
  ChevronLeft,
  Sparkles,
  Search,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  FileText,
  RefreshCw,
  History,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Info,
  Replace,
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useProductStore } from "@/lib/store";
import {
  useSimilarMatches,
  type SimilarMatch,
} from "@/hooks/use-similar-matches";
import { useGetCases } from "@/hooks/use-get-cases";
import { StaffSelect } from "@/components/staff-select";
import { Q12aSelect, Q12fRejectSelect } from "@/components/eg-field-select";
import { useUpdateCaseStatus } from "@/hooks/use-update-case-status";
import { useSaveCaseData } from "@/hooks/use-save-case-data";
import { useDeleteCase } from "@/hooks/use-delete-case";
import { useAuth } from "@/lib/auth-context";
import { useReplaceFromSimilar } from "@/hooks/use-replace-from-similar";
import { SimilarCaseReplaceDialog } from "@/components/similar-case-replace-dialog";
import {
  JustificationModal,
  type JustificationInputs,
  type SaveDraftPayload,
  type GenerateResult,
} from "@/components/justification-modal";
import { CaseAuditLogDialog } from "@/components/case-audit-log-dialog";
import { toast } from "sonner";
import type {
  Product,
  SimilarJustification,
  SimilarCaseAnalysis,
} from "@/lib/types";
import type { Case, SaveCaseDataDto } from "@/app/api/cases/types";

// Mock AI justification generation
const generateJustification = async (
  products: Product[],
  decision: "approved" | "rejected",
): Promise<string> => {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const productNames = products.map((p) => p.name).join(", ");

  if (decision === "approved") {
    return `Based on the comprehensive review of ${products.length} product(s) (${productNames}), the following approval justification is provided:

1. Documentation Completeness: All required files including specifications, certifications, product images, and documentation have been verified and meet the organizational standards.

2. Data Integrity: Product information including SKU, pricing, and inventory quantities have been validated against source documents and confirmed accurate.

3. Compliance Check: Products meet regulatory requirements and internal compliance standards based on the certification documents provided.

4. Quality Assessment: Product specifications align with category standards and pricing reflects market positioning appropriately.

Recommendation: APPROVE for listing in the product catalog.`;
  } else {
    return `Based on the review of ${products.length} product(s) (${productNames}), the following rejection justification is provided:

1. Documentation Issues: Some required documentation may be incomplete or require additional verification before approval can be granted.

2. Data Verification Needed: Certain product attributes require clarification or additional supporting documentation.

3. Compliance Concerns: Additional compliance documentation may be needed to meet regulatory requirements.

4. Quality Review: Product specifications need further review to ensure alignment with category standards.

Recommendation: REJECT and return for additional documentation or corrections.`;
  }
};

const getSimilarCases = async (
  products: Product[],
): Promise<SimilarCaseAnalysis> => {
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const categories = [
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ];
  const primaryCategory = categories[0] || "Electronics";

  const cases: SimilarJustification[] = [
    {
      id: "1",
      productName: "Wireless Bluetooth Headphones",
      category: primaryCategory,
      decision: "approved",
      justification:
        "Approved due to complete documentation, verified supplier credentials, and competitive pricing structure.",
      similarity: 0.94,
    },
    {
      id: "2",
      productName: "Smart LED Display Monitor",
      category: primaryCategory,
      decision: "approved",
      justification:
        "Met all compliance requirements with valid certifications and complete technical specifications.",
      similarity: 0.89,
    },
    {
      id: "3",
      productName: "USB-C Charging Hub",
      category: primaryCategory,
      decision: "approved",
      justification:
        "Full documentation package with verified safety certifications and quality assurance reports.",
      similarity: 0.85,
    },
    {
      id: "4",
      productName: "Portable Power Bank",
      category: primaryCategory,
      decision: "rejected",
      justification:
        "Rejected due to missing safety certification documents and incomplete supplier verification.",
      similarity: 0.82,
    },
    {
      id: "5",
      productName: "Wireless Keyboard Set",
      category: primaryCategory,
      decision: "rejected",
      justification:
        "Missing required compliance documentation and product specifications did not match samples.",
      similarity: 0.78,
    },
    {
      id: "6",
      productName: "Digital Camera Module",
      category: primaryCategory,
      decision: "approved",
      justification:
        "Comprehensive documentation with verified quality standards and competitive market positioning.",
      similarity: 0.76,
    },
  ];

  const approvedCount = cases.filter((c) => c.decision === "approved").length;
  const totalCases = cases.length;

  return {
    totalCases,
    approvalRate: Math.round((approvedCount / totalCases) * 100),
    rejectionRate: Math.round(
      ((totalCases - approvedCount) / totalCases) * 100,
    ),
    commonApprovalFactors: [
      "Complete documentation package",
      "Valid safety certifications",
      "Verified supplier credentials",
      "Competitive pricing structure",
      "Quality assurance reports provided",
    ],
    commonRejectionFactors: [
      "Missing certification documents",
      "Incomplete supplier verification",
      "Specification discrepancies",
      "Non-compliant packaging info",
      "Insufficient product images",
    ],
    cases,
  };
};

// Keep existing mock for backward compatibility
const getSimilarJustifications = async (
  products: Product[],
): Promise<SimilarJustification[]> => {
  const analysis = await getSimilarCases(products);
  return analysis.cases.slice(0, 3);
};

interface Stage3ApprovalProps {
  onBack: () => void;
  onComplete: () => void;
}

interface EditingCase {
  id: string;
  egData: Record<string, any>;
  applicationData: Record<string, any>;
  catalogueData: Record<string, any>;
}

const egFields = [
  "SWD_Ref",
  "Ref",
  "App_No",
  "Tranche",
  "EB_RM",
  "NO",
  "NO_R",
  "Staff1",
  "Staff1_Info",
  "Staff2",
  "Staff2_Info",
  "D_ReqF_SWD",
  "D_PlnT_SWD",
  "D_EGF_Out",
  "D_EGF_Dead",
  "SWD_Off_N",
  "SWD_Off_P",
  "SWD_Off_I",
  "App_Type",
  "App_Cat",
  "App_PNam_Mod",
  "Rem_RA",
  "Recd_EGF",
  "Recd_PAF",
  "Recd_Quo",
  "Recd_Cat",
  "Ret_Rept",
  "MRef",
  "Req_I_SWD_YN",
  "D_ReqT_SWD",
  "Req_RepSWD_YN",
  "D_RetF_SWD",
  "Rem_Req",
  "D_WkRep",
  "WkRep_Status",
  "WkRep_Rem",
  "RecdCurrWk_YN",
  "EGF_Ready_YN",
  "EGF_To_EG_YN",
  "D_EGF_T_EG",
  "EG_Reply_YN",
  "D_EG_Reply",
  "Rem_EG",
  "EGF_To_SWD_YN",
  "D_EGF_ASWD",
  "FUF_Comp_YN",
  "DatEntry",
  "Q12a",
  "Q12b_Jus",
  "Q12c_TotC",
  "Q12d_Quo",
  "Q12e_JCost",
  "Q12f_RReject",
  "Q12g_JRem",
  "Q13a",
  "Q13b",
  "Remarks_EGF",
];

const appFields = [
  "PA_RefL",
  "PA_Cat",
  "PA_PName",
  "PA_Brand",
  "PA_Mod_No",
  "TotAmtR",
  "Prof_Staff",
  "Typ_Staff",
  "Staff_Avail",
  "No_Elderly",
  "No_Disable",
  "No_Bene",
  "Typ_Disability",
  "PA_Elaborate",
  "PA_Justify",
];

const catalogueFields = [
  "product_name",
  "model",
  "product_size",
  "usage_capacity",
  "description",
];

// Heuristic: render a field as a multi-line Textarea when its name suggests
// free text, or its current value is long / already multi-line.
const LONG_TEXT_NAME_RE =
  /rem|remark|justif|elaborate|desc|reason|note|_jus$|jrem|rreject|reply|status|comment/i;

function isLongTextField(field: string, value: unknown): boolean {
  const str = value == null ? "" : String(value);
  if (LONG_TEXT_NAME_RE.test(field)) return true;
  if (str.length > 60) return true;
  if (str.includes("\n")) return true;
  return false;
}

// Fields the justification prompt actually cites. Anything else in
// applicationData is prompt bloat — dropped before sending to /api/suggest/justification.
const JUSTIFICATION_APP_FIELDS = [
  "PA_PName",
  "PA_Brand",
  "PA_Mod_No",
  "PA_Cat",
  "PA_RefL",
  "PA_Elaborate",
  "PA_Justify",
  "TotAmtR",
  "No_Bene",
  "No_Elderly",
  "No_Disable",
  "Typ_Disability",
  "Staff_Avail",
  "Prof_Staff",
  "Typ_Staff",
] as const;

const JUSTIFY_MAX_CHARS = 600;

function trimApplicationForPrompt(
  app: Record<string, unknown> | undefined,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of JUSTIFICATION_APP_FIELDS) {
    const v = (app || {})[key];
    if (v != null && v !== "") out[key] = v;
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v != null && v !== "") out[k] = v;
  }
  return out;
}

// Cost + category + reviewer-note context pulled from the case's own egData
// and catalogueData. Adds ~75 tokens but lets the prompt argue cost math and
// reference-list matches concretely rather than abstractly.
function buildCaseContextForPrompt(
  eg: Record<string, unknown> | undefined,
  catalogue: { description?: string } | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const pick = (k: string) => {
    const v = (eg || {})[k];
    if (v != null && v !== "") out[k] = v;
  };
  pick("Q12c_TotC"); // EG-accepted total cost
  pick("Q12d_Quo"); // number of quotations
  pick("Q12e_JCost"); // cost justification
  pick("Q12g_JRem"); // J-Remarks — sibling of Q12b_Jus
  if (catalogue?.description) out.catalogueDescription = catalogue.description;
  return out;
}

function trimSimilarMatchesForPrompt<
  T extends {
    Justify?: string;
    Prod_Name?: string;
    Desc?: string;
    Category?: string;
    Cost?: string | number;
    RejectReason?: string;
    IsReferenceSeed?: boolean;
    DatasetId?: string;
  },
>(matches: T[]): T[] {
  return matches.map((m) => ({
    ...m,
    // The reference seed must be delivered UNTRIMMED so the model sees the
    // full bullet/paragraph structure. Other matches stay capped for cost.
    Justify:
      m.IsReferenceSeed
        ? m.Justify
        : (m.Justify || "").length > JUSTIFY_MAX_CHARS
          ? `${(m.Justify || "").slice(0, JUSTIFY_MAX_CHARS)}…`
          : m.Justify,
    Desc:
      (m.Desc || "").length > 300
        ? `${(m.Desc || "").slice(0, 300)}…`
        : m.Desc,
    RejectReason:
      (m.RejectReason || "").length > 400
        ? `${(m.RejectReason || "").slice(0, 400)}…`
        : m.RejectReason,
  }));
}

// JustificationEditor removed — replaced by JustificationModal + action panel.

export function Stage3Approval({ onBack, onComplete }: Stage3ApprovalProps) {
  const {
    products,
    selectedProducts,
    toggleProductSelection,
    clearSelection,
    updateProduct,
    similarJustifications,
    setSimilarJustifications,
    isGeneratingJustification,
    setIsGeneratingJustification,
  } = useProductStore();

  const {
    matches: _matches,
    tier: similarTier,
    loading: isLoadingSimilarMatches,
    fetchSimilarMatches,
    clearMatches: clearSimilarMatches,
  } = useSimilarMatches();

  // Get current user
  const { user } = useAuth();

  // Fetch cases from API filtered by userId
  const {
    cases,
    setCases,
    isLoading: isLoadingCases,
    error: casesError,
    refetch: refetchCases,
  } = useGetCases(user?.id ? { userId: user.id } : undefined);

  // Update case status and justification
  const { updateCaseStatus, isLoading: isUpdatingCase } = useUpdateCaseStatus();

  // Save case data
  const { saveCaseData, isLoading: isSavingCaseData } = useSaveCaseData();

  // Delete case
  const { deleteCase, isLoading: isDeletingCase } = useDeleteCase();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("pending");
  const [trancheFilter, setTrancheFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const handleSort = useCallback(
    (column: string) => {
      if (sortColumn === column) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortColumn(column);
        setSortDirection("asc");
      }
    },
    [sortColumn],
  );
  const getSortValue = useCallback(
    (caseItem: any, column: string): string | number => {
      switch (column) {
        case "caseNumber":
          return caseItem.caseNumber ?? "";
        case "status":
          return caseItem.status ?? "";
        case "updatedAt":
          return caseItem.updatedAt
            ? new Date(caseItem.updatedAt).getTime()
            : 0;
        case "productName":
          return (
            caseItem.egData?.App_PNam_Mod ||
            caseItem.applicationData?.PA_PName ||
            ""
          );
        case "refNo":
          return caseItem.egData?.Ref || caseItem.egData?.SWD_Ref || "";
        default: {
          const v = caseItem.egData?.[column];
          return v === undefined || v === null ? "" : v;
        }
      }
    },
    [],
  );
  const [generatedJustification, setGeneratedJustification] = useState("");
  const [generationVersion, setGenerationVersion] = useState(0);
  const [pendingDecision, setPendingDecision] = useState<
    "approved" | "rejected" | null
  >(null);
  const [similarCaseAnalysis, setSimilarCaseAnalysis] =
    useState<SimilarCaseAnalysis | null>(null);
  const [isLoadingSimilarCases, setIsLoadingSimilarCases] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<EditingCase | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditDirty, setIsEditDirty] = useState(false);
  const [egFormData, setEgFormData] = useState<Record<string, string>>({});
  const [appFormData, setAppFormData] = useState<Record<string, any>>({});
  const [catalogueFormData, setCatalogueFormData] = useState<
    Record<string, any>
  >({});
  const [activeTab, setActiveTab] = useState<
    "eg" | "application" | "catalogue"
  >("eg");
  const [caseToDelete, setCaseToDelete] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedSimilarCases, setSelectedSimilarCases] = useState<string[]>(
    [],
  );
  const [selectedSimilarCaseDetail, setSelectedSimilarCaseDetail] =
    useState<SimilarJustification | null>(null);
  const [isSimilarCaseModalOpen, setIsSimilarCaseModalOpen] = useState(false);
  const [replaceSimilarCase, setReplaceSimilarCase] =
    useState<SimilarJustification | null>(null);
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false);
  const [auditLogCase, setAuditLogCase] = useState<{
    id: string;
    caseNumber: string;
  } | null>(null);

  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Justification modal state — drives the friendly per-decision workflow.
  const [isJustificationModalOpen, setIsJustificationModalOpen] =
    useState(false);
  const [justificationModalDecision, setJustificationModalDecision] = useState<
    "approved" | "rejected"
  >("approved");
  const [justificationModalSeed, setJustificationModalSeed] =
    useState<SimilarJustification | null>(null);

  const openJustificationModal = useCallback(
    (
      decision: "approved" | "rejected",
      seed: SimilarJustification | null = null,
    ) => {
      setJustificationModalDecision(decision);
      setJustificationModalSeed(seed);
      setPendingDecision(decision);
      setIsJustificationModalOpen(true);
    },
    [],
  );

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleSimilarCase = (caseId: string) => {
    setSelectedSimilarCases((prev) =>
      prev.includes(caseId)
        ? prev.filter((id) => id !== caseId)
        : [...prev, caseId],
    );
  };

  const handleOpenSimilarCaseModal = (caseItem: SimilarJustification) => {
    setSelectedSimilarCaseDetail(caseItem);
    setIsSimilarCaseModalOpen(true);
  };

  const handleOpenReplaceDialog = (caseItem: SimilarJustification) => {
    setReplaceSimilarCase(caseItem);
    setIsReplaceDialogOpen(true);
  };

  const handleReplaceSuccess = async () => {
    toast.success("Case updated from similar case");
    await refetchCases();
  };

  const handleCopySelectedTemplates = () => {
    if (!similarCaseAnalysis?.cases) return;

    const selectedCases = similarCaseAnalysis.cases.filter((c) =>
      selectedSimilarCases.includes(c.id),
    );

    const templates = selectedCases
      .map(
        (caseItem, index) =>
          `Template ${index + 1} (${caseItem.decision}):\n${caseItem.justification}`,
      )
      .join("\n\n---\n\n");

    navigator.clipboard.writeText(templates);
    setCopiedId("templates");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenDeleteConfirm = (caseId: string) => {
    setCaseToDelete(caseId);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!caseToDelete) return;

    try {
      const result = await deleteCase(caseToDelete);

      if (!result.success) {
        alert(`Error deleting case: ${result.error || "Unknown error"}`);
        return;
      }

      // Remove the case from the cases list
      setCases((currentCases) =>
        currentCases.filter((c) => c.id !== caseToDelete),
      );

      setIsDeleteConfirmOpen(false);
      setCaseToDelete(null);
      alert("Case deleted successfully");
    } catch (error) {
      console.error("Error deleting case:", error);
      alert("Error deleting case");
    }
  };

  const handleEditCase = (caseItem: any) => {
    setEditingCase({
      id: caseItem.id,
      egData: caseItem.egData || {},
      applicationData: caseItem.applicationData || {},
      catalogueData: caseItem.catalogueData || {},
    });

    // Initialize form data
    const egData: Record<string, string> = {};
    egFields.forEach((field) => {
      egData[field] = String(caseItem.egData?.[field] || "");
    });
    setEgFormData(egData);

    // Initialize application data
    const appData: Record<string, any> = {};
    appFields.forEach((field) => {
      appData[field] = caseItem.applicationData?.[field] || "";
    });
    setAppFormData(appData);

    // Initialize catalogue data
    const catData = caseItem.catalogueData?.products?.[0] || {};
    setCatalogueFormData({
      product_name: catData.product_name || "",
      model: catData.model || "",
      product_size: catData.product_size || "",
      usage_capacity: catData.usage_capacity || "",
      description: catData.description || "",
    });

    setActiveTab("eg");
    setIsEditDirty(false);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedCase = async () => {
    if (!editingCase) return;

    try {
      // Prepare data to save based on active tab
      const saveData: SaveCaseDataDto = {};

      if (activeTab === "eg") {
        saveData.egData = egFormData;
      } else if (activeTab === "application") {
        saveData.applicationData = appFormData;
      } else if (activeTab === "catalogue") {
        saveData.catalogueData = {
          products: [catalogueFormData],
        };
      }

      // Save to API
      const result = await saveCaseData(editingCase.id, saveData);

      if (!result.success) {
        alert(`Error saving case: ${result.error || "Unknown error"}`);
        return;
      }

      // Update case in the cases list with the returned data
      setCases((currentCases) =>
        currentCases.map((c) =>
          c.id === editingCase.id
            ? {
                ...c,
                ...(activeTab === "eg" && { egData: egFormData }),
                ...(activeTab === "application" && {
                  applicationData: appFormData,
                }),
                ...(activeTab === "catalogue" && {
                  catalogueData: { products: [catalogueFormData] },
                }),
                updatedAt: new Date().toISOString(),
              }
            : c,
        ),
      );

      setIsEditModalOpen(false);
      setIsEditDirty(false);
      setEditingCase(null);
      setEgFormData({});
      setAppFormData({});
      setCatalogueFormData({});
      alert("Case updated successfully");
    } catch (error) {
      console.error("Error saving edited case:", error);
      alert("Error saving case");
    }
  };

  // Clear similar cases data when product selection changes
  useEffect(() => {
    setSimilarCaseAnalysis(null);
    setSimilarJustifications([]);
    setSelectedSimilarCases([]);
    setGeneratedJustification("");
    setPendingDecision(null);
    setIsLoadingSimilarCases(false);
    clearSimilarMatches();
  }, [selectedProducts.join(","), clearSimilarMatches]); // Re-run when selected products change

  const pendingProducts = products.filter((p) => p.status === "pending_review");

  const filteredProducts = pendingProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedProductObjects = products.filter((p) =>
    selectedProducts.includes(p.id),
  );
  const selectedCase = cases.find((caseItem) => caseItem.id === selectedProducts[0]);

  const handleSelectDecision = useCallback(
    (decision: "approved" | "rejected") => {
      setPendingDecision(decision);
    },
    [],
  );

  const handleRetrieveSimilarCases = useCallback(async () => {
    if (selectedProducts.length === 0) return;

    setIsLoadingSimilarCases(true);
    setSimilarCaseAnalysis(null);

    try {
      // Get the first selected case
      const selectedCaseId = selectedProducts[0];
      const selectedCase = cases.find((c) => c.id === selectedCaseId);

      if (!selectedCase) {
        console.error("Selected case not found");
        return;
      }

      console.log("Selected case for similar matches:", selectedCase);

      // Extract application (PA_*) fields — the incoming application form.
      const paPName = selectedCase.applicationData?.PA_PName || "";
      const paModNo = selectedCase.applicationData?.PA_Mod_No || "";
      const paBrand = selectedCase.applicationData?.PA_Brand || "";
      const paElaborate =
        selectedCase.applicationData?.PA_Elaborate ||
        selectedCase.applicationData?.PA_Justify ||
        "";
      // Extract EG-form fields to enrich the semantic query. The dataset rows
      // are embedded as App_PName + catalogueDesc, so feeding the EG name/
      // description pulls the query into the same neighbourhood as the case
      // whose EG form we want to copy.
      const eg = (selectedCase.egData || {}) as Record<string, string>;
      const egName = eg.App_PName || eg.App_PNam_Mod || "";
      const egDesc = eg.catalogueDesc || "";

      console.log("Searching for similar cases with:", {
        paPName,
        paModNo,
        egName,
      });

      // Call the similar matches API and use the returned results directly.
      // Reading the `matches` state here would be stale (it only updates on the
      // next render), which previously caused the previous selection's results
      // to be displayed.
      const { matches: freshMatches } = await fetchSimilarMatches({
        item: {
          PA_PName: paPName,
          PA_Mod_No: paModNo,
          PA_Brand: paBrand,
          PA_Elaborate: paElaborate,
          egName,
          egDesc,
        },
        datasetName: "Justification Creation",
        datasetType: "justification-data",
      });

      console.log("Similar matches found:", freshMatches);

      // Transform API results to similar justifications format
      const transformedCases: SimilarJustification[] = freshMatches.map((match) => {
        const approvalStatus =
          match.approvalStatus ||
          match.metadata?.Q12a ||
          match.metadata?.Q12a_T4 ||
          "";
        console.log("approvalStatus", approvalStatus);
        const decision =
          approvalStatus === "Yes" || approvalStatus === "Y"
            ? ("approved" as const)
            : ("rejected" as const);

        return {
          id: match.id,
          productName: match.name,
          category: match.category,
          decision: decision,
          justification: match.description || "Similar case found in dataset",
          similarity: match.similarity,
          approvalStatus: approvalStatus,
          metadata: match.metadata,
          tier: match.tier,
        };
      });

      setSimilarJustifications(transformedCases);

      // Create case analysis summary
      const approvedCount = transformedCases.filter(
        (c) => c.decision === "approved",
      ).length;
      const analysis: SimilarCaseAnalysis = {
        totalCases: transformedCases.length,
        approvalRate: Math.round(
          (approvedCount / Math.max(transformedCases.length, 1)) * 100,
        ),
        rejectionRate: Math.round(
          ((transformedCases.length - approvedCount) /
            Math.max(transformedCases.length, 1)) *
            100,
        ),
        commonApprovalFactors: [
          "Similar product categories found",
          "Matching dataset records identified",
          "Reference data available",
        ],
        commonRejectionFactors: [],
        cases: transformedCases,
      };

      setSimilarCaseAnalysis(analysis);
    } finally {
      setIsLoadingSimilarCases(false);
    }
  }, [
    selectedProducts,
    cases,
    fetchSimilarMatches,
    setSimilarJustifications,
  ]);

  const handleGenerateJustification = useCallback(
    async (decision: "approved" | "rejected") => {
      if (selectedProducts.length === 0) return;

      setIsGeneratingJustification(true);
      setPendingDecision(decision);
      setGeneratedJustification("");
      setSimilarJustifications([]);

      try {
        const justifications: string[] = [];
        const allSimilarJustifications: SimilarJustification[] = [];

        // Process each selected case
        for (const caseId of selectedProducts) {
          const selectedCase = cases.find((c) => c.id === caseId);
          if (!selectedCase) continue;

          // Extract product information from catalogueData
          // Extract PA_PName and PA_Mod_No from applicationData
          const paPName = selectedCase.applicationData?.PA_PName || "";
          const paModNo = selectedCase.applicationData?.PA_Mod_No || "";
          const eg = (selectedCase.egData || {}) as Record<string, string>;
          const egName = eg.App_PName || eg.App_PNam_Mod || "";
          const egDesc = eg.catalogueDesc || "";

          console.log(
            `Generating justification for case ${selectedCase.caseNumber}:`,
            {
              paPName,
              paModNo,
              egName,
            },
          );

          // Fetch similar matches for this case. Use the returned value rather
          // than the `matches` state, which is stale right after await.
          let fetchedMatches: SimilarMatch[] = [];
          try {
            const result = await fetchSimilarMatches({
              item: {
                PA_PName: paPName,
                PA_Mod_No: paModNo,
                PA_Brand: selectedCase.applicationData?.PA_Brand || "",
                PA_Elaborate:
                  selectedCase.applicationData?.PA_Elaborate ||
                  selectedCase.applicationData?.PA_Justify ||
                  "",
                egName,
                egDesc,
              },
              datasetName: "Justification Creation",
              datasetType: "justification-data",
            });
            fetchedMatches = result.matches;
          } catch (err) {
            console.error(
              `Failed to fetch similar matches for ${paPName}`,
              err,
            );
          }

          // Call justification API for this case
          const similarMatches = trimSimilarMatchesForPrompt(
            fetchedMatches
              ?.filter((c) => c.similarity > 0.5)
              .map((c) => ({
                Justify: c.description || "Similar case found",
                Prod_Name: c.name,
                Status: c.metadata?.Q12a || c.metadata?.Q12a_T4 || "",
                Model_Code: c.metadata?.Model_Code || "",
                Desc: c.metadata?.catalogueDesc || c.metadata?.RefL_Des || "",
                Category: c.metadata?.PA_Cat || "",
                Cost: c.metadata?.Q12c_TotC || "",
                RejectReason: c.metadata?.Q12f_RReject || "",
              })) || [],
          );

          const currentCase = selectedCase.catalogueData?.products;
          const appData = trimApplicationForPrompt(selectedCase.applicationData);
          const caseContext = buildCaseContextForPrompt(
            selectedCase.egData,
            selectedCase.catalogueData,
          );

          try {
            const response = await fetch("/api/suggest/justification", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                similar_matches: similarMatches,
                current_case: currentCase,
                application_data: appData,
                case_context: caseContext,
                current_eg_remarks: selectedCase.egData?.Q12b_Jus || "",
                action: decision,
                case_id: selectedCase.id,
              }),
            });

            if (response.ok) {
              const result = await response.json();
              console.log("Result Justification", result);
              justifications.push(result?.data?.justification || "");
            } else {
              // Fallback to mock if API fails
              // const mockProduct = {
              //   id: selectedCase.id,
              //   name: productName,
              //   sku: selectedCase.caseNumber,
              //   category: category,
              // } as Product;
              // const justification = await generateJustification(
              //   [mockProduct],
              //   decision,
              // );
              // justifications.push(justification);
            }
          } catch (error) {
            console.error(
              `Error generating justification for ${paPName}:`,
              error,
            );
            const mockProduct = {
              id: selectedCase.id,
              name: paPName,
              sku: selectedCase.caseNumber,
              category: selectedCase.categoryId || "",
            } as Product;
            const justification = await generateJustification(
              [mockProduct],
              decision,
            );
            justifications.push(justification);
          }
        }

        // Use justification from first case for display
        setGeneratedJustification(justifications[0] || "");
        setGenerationVersion((version) => version + 1);
      } finally {
        setIsGeneratingJustification(false);
      }
    },
    [
      selectedProducts,
      cases,
      fetchSimilarMatches,
      setIsGeneratingJustification,
      setSimilarJustifications,
    ],
  );

  // Generation entry point used by JustificationModal. Accepts caller-edited
  // input fields plus an optional similar-case seed, calls the same
  // /api/suggest/justification endpoint, and returns the produced string.
  const generateJustificationWithInputs = useCallback(
    async (
      inputs: JustificationInputs,
      decision: "approved" | "rejected",
      seedSimilar?: SimilarJustification | null,
    ): Promise<GenerateResult> => {
      if (!selectedCase) return { text: "" };
      setIsGeneratingJustification(true);
      try {
        // Fetch similar matches using the (possibly edited) inputs so the AI
        // context reflects what the user actually wants.
        let fetchedMatches: SimilarMatch[] = [];
        try {
          const result = await fetchSimilarMatches({
            item: {
              PA_PName: inputs.PA_PName,
              PA_Mod_No: inputs.PA_Mod_No,
              PA_Brand: inputs.PA_Brand,
              PA_Elaborate: inputs.PA_Elaborate,
              egName: inputs.egName,
              egDesc: inputs.egDesc,
            },
            datasetName: "Justification Creation",
            datasetType: "justification-data",
          });
          fetchedMatches = result.matches;
        } catch (err) {
          console.error("Failed to fetch similar matches for modal", err);
        }

        const similarMatches = trimSimilarMatchesForPrompt(
          (fetchedMatches
            ?.filter((c) => c.similarity > 0.5)
            .map((c) => ({
              Justify: c.description || "Similar case found",
              Prod_Name: c.name,
              Status: c.metadata?.Q12a || c.metadata?.Q12a_T4 || "",
              Model_Code: c.metadata?.Model_Code || "",
              Desc: c.metadata?.catalogueDesc || c.metadata?.RefL_Des || "",
              Category: c.metadata?.PA_Cat || "",
              Cost: c.metadata?.Q12c_TotC || "",
              RejectReason: c.metadata?.Q12f_RReject || "",
            })) || []) as Array<{
            Justify: string;
            Prod_Name: string;
            Status: string;
            Model_Code: string;
            Desc: string;
            Category: string;
            Cost: string;
            RejectReason: string;
            IsReferenceSeed?: boolean;
            DatasetId?: string;
          }>,
        );

        // Prepend the explicit seed similar case (if any) so it takes priority
        // in the LLM prompt context. Flag it so the prompt knows to mirror its
        // structure rather than paraphrase.
        if (seedSimilar) {
          similarMatches.unshift({
            Justify: seedSimilar.justification || "Seed similar case",
            Prod_Name: seedSimilar.productName,
            Status: seedSimilar.approvalStatus || "",
            Model_Code: seedSimilar.metadata?.Model_Code || "",
            Desc: (
              seedSimilar.metadata?.catalogueDesc ||
              seedSimilar.metadata?.RefL_Des ||
              ""
            ).slice(0, 300),
            Category: seedSimilar.metadata?.PA_Cat || "",
            Cost: seedSimilar.metadata?.Q12c_TotC || "",
            RejectReason: (seedSimilar.metadata?.Q12f_RReject || "").slice(
              0,
              400,
            ),
            IsReferenceSeed: true,
            DatasetId: seedSimilar.id,
          });
        }

        const currentCase = selectedCase.catalogueData?.products;
        // Trim to prompt-relevant fields, then apply the user's edits from the
        // modal so the AI reflects the modal inputs, not the raw case.
        const appData = trimApplicationForPrompt(selectedCase.applicationData, {
          PA_PName: inputs.PA_PName,
          PA_Brand: inputs.PA_Brand,
          PA_Mod_No: inputs.PA_Mod_No,
          PA_Elaborate: inputs.PA_Elaborate,
        });
        const caseContext = buildCaseContextForPrompt(
          selectedCase.egData,
          selectedCase.catalogueData,
        );

        try {
          const response = await fetch("/api/suggest/justification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              similar_matches: similarMatches,
              current_case: currentCase,
              application_data: appData,
              case_context: caseContext,
              current_eg_remarks: inputs.Q12b_Jus || "",
              action: decision,
              case_id: selectedCase.id,
            }),
          });
          if (response.ok) {
            const result = await response.json();
            return {
              text: result?.data?.justification || "",
              aiDecision: result?.data?.decision,
              aiReasoning: result?.data?.reasoning,
            };
          }
        } catch (error) {
          console.error("Error generating justification (modal):", error);
        }
        return { text: "" };
      } finally {
        setIsGeneratingJustification(false);
      }
    },
    [
      selectedCase,
      fetchSimilarMatches,
      setIsGeneratingJustification,
    ],
  );

  const handleConfirmDecision = useCallback(
    async (justification: string, explicitDecision?: "approved" | "rejected") => {
      const decision = explicitDecision ?? pendingDecision;
      if (!decision || !justification.trim()) return;

      try {
        setIsGeneratingJustification(true);

        console.log(
          `Confirming ${decision} decision for ${selectedProducts.length} case(s)`,
        );

        // Update each selected case with status and justification
        const updatePromises = selectedProducts.map(async (caseId) => {
          const selectedCase = cases.find((c) => c.id === caseId);
          if (!selectedCase) {
            console.warn(`Case ${caseId} not found`);
            return null;
          }

          console.log(`Updating case ${selectedCase.caseNumber}:`, {
            status: decision,
            justification: justification.substring(0, 100) + "...",
          });

          // Mirror the justification into egData.Q12b_Jus so downstream
          // Copy / Edit views see the same text the reviewer confirmed.
          // Fire in parallel with the status update — status endpoint owns
          // the case.justification field; save endpoint owns egData.
          const mergedEg = {
            ...(selectedCase.egData || {}),
            Q12b_Jus: justification,
          };
          const [, statusResult] = await Promise.all([
            saveCaseData(caseId, { egData: mergedEg }).catch((err) => {
              console.error(`egData write failed for ${caseId}`, err);
              return { success: false } as const;
            }),
            updateCaseStatus(caseId, {
              status: decision,
              justification: justification,
            }),
          ]);
          return statusResult;
        });

        const results = await Promise.all(updatePromises);

        // Check for failures
        const failedUpdates = results.filter((r) => !r || !r.success);

        if (failedUpdates.length > 0) {
          // Fallback: Update local state if API failed
          setCases((currentCases) =>
            currentCases.map((c) =>
              selectedProducts.includes(c.id)
                ? {
                    ...c,
                    status: decision,
                    justification: justification,
                  }
                : c,
            ),
          );

          alert(
            `Warning: ${failedUpdates.length} case(s) failed to save to server, but updated locally.`,
          );
        } else {
          console.log(
            `Successfully updated ${results.length} case(s) with ${decision} status`,
          );
          toast.success(
            `Successfully ${decision} ${results.length} case(s) with the provided justification.`,
          );
          // Refresh cases list to ensure sync with server
          await refetchCases();
        }

        // Also update local product statuses for backward compatibility
        selectedProducts.forEach((id) => {
          updateProduct(id, { status: decision });
        });
      } catch (error) {
        console.error("Error confirming decision:", error);

        // Fallback: Update local state on error
        setCases((currentCases) =>
          currentCases.map((c) =>
            selectedProducts.includes(c.id)
              ? {
                  ...c,
                  status: decision,
                  justification: justification,
                }
              : c,
          ),
        );

        alert("Error reaching server. Table updated locally.");
      } finally {
        setIsGeneratingJustification(false);

        // Close modal and clear state
        setIsJustificationModalOpen(false);
        setJustificationModalSeed(null);
        clearSelection();
        setGeneratedJustification("");
        setSimilarJustifications([]);
        setPendingDecision(null);
        setSimilarCaseAnalysis(null);
      }
    },
    [
      pendingDecision,
      selectedProducts,
      cases,
      setCases,
      updateCaseStatus,
      saveCaseData,
      refetchCases,
      updateProduct,
      clearSelection,
      setSimilarJustifications,
      setIsGeneratingJustification,
    ],
  );

  const handleSaveJustificationDraft = useCallback(
    async (payload: SaveDraftPayload) => {
      if (!selectedCase) return;
      const caseId = selectedCase.id;
      setIsSavingDraft(true);
      try {
        // Merge current egData with the incoming patch, then force Q12b_Jus
        // to the payload value — the modal only opens this handler AFTER the
        // reviewer confirmed the override dialog, so we intentionally
        // overwrite whatever was stored. egPatch still carries the other
        // eg-form edits (name, description) so those flow through untouched.
        const mergedEg = {
          ...(selectedCase.egData || {}),
          ...payload.egPatch,
          Q12b_Jus: payload.q12bJus,
        };
        const hasAppPatch = Object.keys(payload.applicationPatch).length > 0;
        const saveDto: SaveCaseDataDto = { egData: mergedEg };
        if (hasAppPatch) {
          saveDto.applicationData = {
            ...(selectedCase.applicationData || {}),
            ...payload.applicationPatch,
          };
        }

        // Fire both writes in parallel — status is intentionally omitted so
        // the case stays in its current lifecycle state.
        const [saveResult, statusResult] = await Promise.all([
          saveCaseData(caseId, saveDto),
          updateCaseStatus(caseId, { justification: payload.justification }),
        ]);

        const saveOk = saveResult?.success !== false;
        const statusOk = statusResult?.success !== false;

        if (!saveOk || !statusOk) {
          // Fallback to local update so the reviewer's work isn't lost.
          setCases((currentCases) =>
            currentCases.map((c) =>
              c.id === caseId
                ? {
                    ...c,
                    egData: mergedEg,
                    ...(hasAppPatch && {
                      applicationData: saveDto.applicationData,
                    }),
                    justification: payload.justification,
                  }
                : c,
            ),
          );
          toast.error("Draft saved locally — server update failed.");
        } else {
          toast.success("Draft saved.");
          await refetchCases();
        }
        setIsJustificationModalOpen(false);
        setJustificationModalSeed(null);
      } catch (err) {
        console.error("Error saving justification draft:", err);
        toast.error("Failed to save draft. Please retry.");
      } finally {
        setIsSavingDraft(false);
      }
    },
    [selectedCase, saveCaseData, updateCaseStatus, refetchCases, setCases],
  );

  const handleSelectAll = useCallback(() => {
    if (selectedProducts.length === filteredProducts.length) {
      clearSelection();
    } else if (filteredProducts.length > 0) {
      clearSelection();
      toggleProductSelection(filteredProducts[0].id);
    }
  }, [
    filteredProducts,
    selectedProducts,
    clearSelection,
    toggleProductSelection,
  ]);

  const handleSelectProduct = useCallback(
    (productId: string) => {
      if (selectedProducts.length === 1 && selectedProducts[0] === productId) {
        clearSelection();
      } else {
        clearSelection();
        toggleProductSelection(productId);
      }
    },
    [selectedProducts, clearSelection, toggleProductSelection],
  );

  const approvedCount = cases.filter((c) => c.status === "approved").length;
  const rejectedCount = cases.filter((c) => c.status === "rejected").length;
  const pendingCount = cases.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Approval Workflow
          </h2>
          <p className="text-muted-foreground mt-1">
            Select a case to review its justification and make a decision
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <CheckCircle2 className="w-3 h-3 text-success" />
            {approvedCount} approved
          </Badge>
          <Badge variant="outline" className="gap-1">
            <XCircle className="w-3 h-3 text-destructive" />
            {rejectedCount} rejected
          </Badge>
          <Badge variant="secondary" className="gap-1">
            {pendingCount} pending
          </Badge>
          <Button
            variant="outline"
            size="icon"
            onClick={refetchCases}
            disabled={isLoadingCases}
            className="h-8 w-8"
            title="Refresh cases"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoadingCases ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cases Selection Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <CardTitle className="text-lg">Cases</CardTitle>
                <div className="flex items-center gap-2 ml-auto overflow-x-auto pb-2">
                  <div className="relative min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search cases..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) =>
                      setStatusFilter(
                        value as "all" | "pending" | "approved" | "rejected",
                      )
                    }
                  >
                    <SelectTrigger className="w-32 h-9">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-slate-500" />
                          All
                        </div>
                      </SelectItem>
                      <SelectItem value="pending">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-yellow-500" />
                          Pending
                        </div>
                      </SelectItem>
                      <SelectItem value="approved">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          Approved
                        </div>
                      </SelectItem>
                      <SelectItem value="rejected">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          Rejected
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={trancheFilter}
                    onValueChange={setTrancheFilter}
                  >
                    <SelectTrigger className="w-32 h-9">
                      <SelectValue placeholder="Tranche" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tranches</SelectItem>
                      {[
                        ...new Set(
                          cases
                            .map((c) => c.egData?.Tranche)
                            .filter(
                              (t) => t !== undefined && t !== null && t !== "",
                            ),
                        ),
                      ].map((tranche) => (
                        <SelectItem
                          key={String(tranche)}
                          value={String(tranche)}
                        >
                          {tranche}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 w-32"
                  />
                  <span className="text-muted-foreground text-sm whitespace-nowrap">
                    to
                  </span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 w-32"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setSearchQuery("");
                      setStartDate("");
                      setEndDate("");
                      setStatusFilter("pending");
                      setTrancheFilter("all");
                      clearSelection();
                      setGeneratedJustification("");
                      setPendingDecision(null);
                      setSimilarCaseAnalysis(null);
                      setSimilarJustifications([]);
                    }}
                    className="h-9 w-9 shrink-0"
                    title="Clear filters"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {casesError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">
                  <p className="font-semibold">Error loading cases</p>
                  <p className="text-sm">{casesError}</p>
                </div>
              )}

              {isLoadingCases ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="ml-3 text-muted-foreground">
                    Loading cases...
                  </span>
                </div>
              ) : cases.length > 0 ? (
                <div className="rounded-lg border overflow-auto max-h-[250px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12 sticky left-0 bg-muted/50 z-10">
                          <Checkbox
                            checked={
                              selectedProducts.length === cases.length &&
                              cases.length > 0
                            }
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        {/* Priority columns first */}
                        <TableHead className="font-semibold whitespace-nowrap px-4 bg-primary/5">
                          <button
                            type="button"
                            onClick={() => handleSort("caseNumber")}
                            className="inline-flex items-center gap-1 hover:text-primary"
                          >
                            Case Number
                            {sortColumn === "caseNumber" ? (
                              sortDirection === "asc" ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : (
                                <ArrowDown className="w-3 h-3" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead className="font-semibold whitespace-nowrap px-4 bg-primary/5">
                          <button
                            type="button"
                            onClick={() => handleSort("status")}
                            className="inline-flex items-center gap-1 hover:text-primary"
                          >
                            Status
                            {sortColumn === "status" ? (
                              sortDirection === "asc" ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : (
                                <ArrowDown className="w-3 h-3" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead className="font-semibold whitespace-nowrap px-4 bg-primary/5">
                          <button
                            type="button"
                            onClick={() => handleSort("updatedAt")}
                            className="inline-flex items-center gap-1 hover:text-primary"
                          >
                            Updated Date
                            {sortColumn === "updatedAt" ? (
                              sortDirection === "asc" ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : (
                                <ArrowDown className="w-3 h-3" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead className="font-semibold whitespace-nowrap px-4 bg-primary/5">
                          <button
                            type="button"
                            onClick={() => handleSort("productName")}
                            className="inline-flex items-center gap-1 hover:text-primary"
                          >
                            Product Name
                            {sortColumn === "productName" ? (
                              sortDirection === "asc" ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : (
                                <ArrowDown className="w-3 h-3" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </button>
                        </TableHead>
                        <TableHead className="font-semibold whitespace-nowrap px-4 bg-primary/5">
                          <button
                            type="button"
                            onClick={() => handleSort("refNo")}
                            className="inline-flex items-center gap-1 hover:text-primary"
                          >
                            Ref No
                            {sortColumn === "refNo" ? (
                              sortDirection === "asc" ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : (
                                <ArrowDown className="w-3 h-3" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </button>
                        </TableHead>
                        {/* Other EG data columns */}
                        {[
                          "App_No",
                          "Tranche",
                          "EB_RM",
                          "NO",
                          "NO_R",
                          "Staff1",
                          "Staff2",
                          "D_ReqF_SWD",
                          "D_PlnT_SWD",
                          "D_EGF_Out",
                          "D_EGF_Dead",
                          "SWD_Off_N",
                          "SWD_Off_P",
                          "SWD_Off_I",
                          "App_Type",
                          "App_Cat",
                          "Rem_RA",
                          "Recd_EGF",
                          "Recd_PAF",
                          "Recd_Quo",
                          "Recd_Cat",
                          "Ret_Rept",
                          "MRef",
                          "Req_I_SWD_YN",
                          "D_ReqT_SWD",
                          "Req_RepSWD_YN",
                          "D_RetF_SWD",
                          "Rem_Req",
                          "D_WkRep",
                          "WkRep_Status",
                          "WkRep_Rem",
                          "RecdCurrWk_YN",
                          "EGF_Ready_YN",
                          "EGF_To_EG_YN",
                          "D_EGF_T_EG",
                          "EG_Reply_YN",
                          "D_EG_Reply",
                          "Rem_EG",
                          "EGF_To_SWD_YN",
                          "D_EGF_ASWD",
                          "FUF_Comp_YN",
                          "DatEntry",
                        ].map((col) => (
                          <TableHead
                            key={col}
                            className="whitespace-nowrap px-4"
                          >
                            <button
                              type="button"
                              onClick={() => handleSort(col)}
                              className="inline-flex items-center gap-1 hover:text-primary"
                            >
                              {col}
                              {sortColumn === col ? (
                                sortDirection === "asc" ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-40" />
                              )}
                            </button>
                          </TableHead>
                        ))}
                        {/* Sticky Actions Column Header */}
                        <TableHead className="sticky right-0 whitespace-nowrap px-4 bg-muted/50 border-l font-semibold w-20 z-10">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cases
                        .filter((caseItem) => {
                          // Filter by search query and status
                          const searchLower = searchQuery.toLowerCase();
                          const productName =
                            caseItem.egData?.App_PNam_Mod ||
                            caseItem.applicationData?.PA_PName ||
                            "";
                          const searchMatch =
                            caseItem.caseNumber
                              .toLowerCase()
                              .includes(searchLower) ||
                            productName.toLowerCase().includes(searchLower);

                          // Filter by status: all, pending, approved, or rejected
                          let statusMatch = true;
                          if (statusFilter === "pending") {
                            statusMatch = caseItem.status === "pending";
                          } else if (statusFilter === "approved") {
                            statusMatch = caseItem.status === "approved";
                          } else if (statusFilter === "rejected") {
                            statusMatch = caseItem.status === "rejected";
                          } else if (statusFilter === "all") {
                            statusMatch = true;
                          }

                          // Filter by date range
                          let dateMatch = true;
                          if (startDate || endDate) {
                            if (caseItem.updatedAt) {
                              const caseDateTime = new Date(
                                caseItem.updatedAt,
                              ).getTime();
                              if (startDate) {
                                const startDateTime = new Date(
                                  startDate,
                                ).getTime();
                                if (caseDateTime < startDateTime) {
                                  dateMatch = false;
                                }
                              }
                              if (endDate) {
                                const endDateTime = new Date(endDate);
                                endDateTime.setHours(23, 59, 59, 999);
                                if (caseDateTime > endDateTime.getTime()) {
                                  dateMatch = false;
                                }
                              }
                            } else {
                              dateMatch = false;
                            }
                          }

                          const trancheMatch =
                            trancheFilter === "all" ||
                            String(caseItem.egData?.Tranche) === trancheFilter;

                          return (
                            searchMatch &&
                            statusMatch &&
                            dateMatch &&
                            trancheMatch
                          );
                        })
                        .sort((a, b) => {
                          if (!sortColumn) return 0;
                          const av = getSortValue(a, sortColumn);
                          const bv = getSortValue(b, sortColumn);
                          let cmp = 0;
                          if (typeof av === "number" && typeof bv === "number") {
                            cmp = av - bv;
                          } else {
                            cmp = String(av).localeCompare(String(bv), undefined, {
                              numeric: true,
                              sensitivity: "base",
                            });
                          }
                          return sortDirection === "asc" ? cmp : -cmp;
                        })
                        .map((caseItem) => {
                          const isSelected = selectedProducts.includes(
                            caseItem.id,
                          );

                          // Extract product name from egData or applicationData
                          const productName =
                            caseItem.egData?.App_PNam_Mod ||
                            caseItem.applicationData?.PA_PName ||
                            "—";

                          // Extract ref number from egData
                          const refNo =
                            caseItem.egData?.Ref ||
                            caseItem.egData?.SWD_Ref ||
                            "—";

                          const getData = (key: string) => {
                            const egVal = caseItem.egData?.[key];
                            if (
                              egVal !== undefined &&
                              egVal !== null &&
                              egVal !== ""
                            )
                              return egVal;
                            return "—";
                          };

                          const statusColors = {
                            pending:
                              "bg-yellow-100 text-yellow-800 border-yellow-300",
                            approved:
                              "bg-green-100 text-green-800 border-green-300",
                            rejected: "bg-red-100 text-red-800 border-red-300",
                            under_review:
                              "bg-blue-100 text-blue-800 border-blue-300",
                          };

                          return (
                            <TableRow
                              key={caseItem.id}
                              className={cn(
                                "cursor-pointer transition-colors",
                                isSelected && "bg-primary/5",
                              )}
                              onClick={() => handleSelectProduct(caseItem.id)}
                            >
                              <TableCell
                                className="sticky left-0 bg-background z-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      handleSelectProduct(caseItem.id);
                                    } else {
                                      clearSelection();
                                    }
                                  }}
                                />
                              </TableCell>
                              {/* Priority columns */}
                              <TableCell className="font-medium font-mono whitespace-nowrap px-4 bg-primary/5">
                                {caseItem.caseNumber}
                              </TableCell>
                              <TableCell className="whitespace-nowrap px-4 bg-primary/5">
                                <Badge
                                  variant="outline"
                                  className={statusColors[caseItem.status]}
                                >
                                  {caseItem.status
                                    .replace("_", " ")
                                    .toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm whitespace-nowrap px-4 bg-primary/5">
                                {caseItem.updatedAt
                                  ? new Date(
                                      caseItem.updatedAt,
                                    ).toLocaleDateString() +
                                    " " +
                                    new Date(
                                      caseItem.updatedAt,
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                              </TableCell>
                              <TableCell className="font-medium whitespace-nowrap px-4 bg-primary/5">
                                <span
                                  className="block max-w-[100px] truncate"
                                  title={String(productName)}
                                >
                                  {productName}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono whitespace-nowrap px-4 bg-primary/5">
                                {refNo}
                              </TableCell>
                              {/* Other EG data columns */}
                              {[
                                "App_No",
                                "Tranche",
                                "EB_RM",
                                "NO",
                                "NO_R",
                                "Staff1",
                                "Staff2",
                                "D_ReqF_SWD",
                                "D_PlnT_SWD",
                                "D_EGF_Out",
                                "D_EGF_Dead",
                                "SWD_Off_N",
                                "SWD_Off_P",
                                "SWD_Off_I",
                                "App_Type",
                                "App_Cat",
                                "Rem_RA",
                                "Recd_EGF",
                                "Recd_PAF",
                                "Recd_Quo",
                                "Recd_Cat",
                                "Ret_Rept",
                                "MRef",
                                "Req_I_SWD_YN",
                                "D_ReqT_SWD",
                                "Req_RepSWD_YN",
                                "D_RetF_SWD",
                                "Rem_Req",
                                "D_WkRep",
                                "WkRep_Status",
                                "WkRep_Rem",
                                "RecdCurrWk_YN",
                                "EGF_Ready_YN",
                                "EGF_To_EG_YN",
                                "D_EGF_T_EG",
                                "EG_Reply_YN",
                                "D_EG_Reply",
                                "Rem_EG",
                                "EGF_To_SWD_YN",
                                "D_EGF_ASWD",
                                "FUF_Comp_YN",
                                "DatEntry",
                              ].map((col) => (
                                <TableCell
                                  key={col}
                                  className="whitespace-nowrap px-4"
                                >
                                  {getData(col)}
                                </TableCell>
                              ))}
                              {/* Sticky Actions Column */}
                              <TableCell className="sticky right-0 whitespace-nowrap px-4 bg-background border-l z-20">
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAuditLogCase({
                                        id: caseItem.id,
                                        caseNumber: caseItem.caseNumber,
                                      });
                                    }}
                                    className="h-8 w-8"
                                    title="Audit Log"
                                  >
                                    <History className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditCase(caseItem);
                                    }}
                                    className="h-8 w-8"
                                    title="Edit Case"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDeleteConfirm(caseItem.id);
                                    }}
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="Delete Case"
                                    disabled={isDeletingCase}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    No pending cases
                  </h3>
                  <p className="text-muted-foreground max-w-md">
                    There are no cases pending review. Upload products in Stage
                    1 to create new cases.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedCase && (
            <div className="mt-4 rounded-lg bg-muted/50 px-4 py-3">
              <p className="text-sm font-medium">
                Selected case: {selectedCase.caseNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                Review and decide this case in the justification panel.
              </p>
            </div>
          )}
          {/* </CardContent>
          </Card> */}

          {isLoadingSimilarCases && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <div>
                    <CardTitle className="text-base">
                      Loading Similar Cases
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Analyzing dataset for similar cases...
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary animate-pulse" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Finding matching cases...
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {similarCaseAnalysis?.cases?.length > 0 && !isLoadingSimilarCases && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-secondary-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        Similar Cases Analysis
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {similarCaseAnalysis?.cases?.length} similar cases found
                        {similarTier && similarTier !== "none" && (
                          <>
                            {" · retrieval tier: "}
                            <span
                              className={cn(
                                "font-medium",
                                similarTier === "exact" && "text-green-700",
                                similarTier === "fuzzy" && "text-amber-700",
                                similarTier === "semantic" && "text-slate-600",
                              )}
                            >
                              {similarTier}
                            </span>
                          </>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSimilarCaseAnalysis(null)}
                    className="text-muted-foreground"
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Statistics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-success" />
                      <span className="text-sm font-medium text-success">
                        Approval Rate
                      </span>
                    </div>
                    <div className="text-3xl font-bold text-success mb-2">
                      {similarCaseAnalysis?.approvalRate}%
                    </div>
                    <Progress
                      value={similarCaseAnalysis?.approvalRate}
                      className="h-2 bg-success/20"
                    />
                  </div>
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="w-4 h-4 text-destructive" />
                      <span className="text-sm font-medium text-destructive">
                        Rejection Rate
                      </span>
                    </div>
                    <div className="text-3xl font-bold text-destructive mb-2">
                      {similarCaseAnalysis?.rejectionRate}%
                    </div>
                    <Progress
                      value={similarCaseAnalysis?.rejectionRate}
                      className="h-2 bg-destructive/20"
                    />
                  </div>
                </div>

                {/* Common Factors */}
                {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-success">
                      <CheckCircle2 className="w-4 h-4" />
                      Common Approval Factors
                    </div>
                    <ul className="space-y-1.5">
                      {similarCaseAnalysis.commonApprovalFactors.map(
                        (factor, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-muted-foreground flex items-start gap-2 p-2 rounded bg-success/5 border border-success/10"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-success mt-1 shrink-0" />
                            {factor}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <XCircle className="w-4 h-4" />
                      Common Rejection Factors
                    </div>
                    <ul className="space-y-1.5">
                      {similarCaseAnalysis.commonRejectionFactors.map(
                        (factor, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-muted-foreground flex items-start gap-2 p-2 rounded bg-destructive/5 border border-destructive/10"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1 shrink-0" />
                            {factor}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </div> */}

                {/* Individual Cases */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-foreground">
                      Individual Cases
                    </div>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {similarCaseAnalysis.cases.map((caseItem) => (
                      <div
                        key={caseItem.id}
                        className="p-3 rounded-lg border bg-card transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedSimilarCases.includes(
                                caseItem.id,
                              )}
                              onCheckedChange={() =>
                                handleToggleSimilarCase(caseItem.id)
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4"
                            />
                            <span className="font-medium text-sm">
                              {caseItem.productName}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSimilarCaseModal(caseItem);
                              }}
                              title="View details"
                            >
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {Math.round(caseItem.similarity * 100)}% match
                            </span>
                            {caseItem.tier && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  caseItem.tier === "exact" &&
                                    "bg-green-50 border-green-300 text-green-800",
                                  caseItem.tier === "fuzzy" &&
                                    "bg-amber-50 border-amber-300 text-amber-800",
                                  caseItem.tier === "semantic" &&
                                    "bg-slate-50 border-slate-300 text-slate-700",
                                )}
                                title={
                                  caseItem.tier === "exact"
                                    ? "All product-name tokens matched in the corpus"
                                    : caseItem.tier === "fuzzy"
                                      ? "Matched via trigram fuzzy similarity"
                                      : "Matched via embedding similarity (weakest tier)"
                                }
                              >
                                {caseItem.tier}
                              </Badge>
                            )}
                            <Badge
                              variant={
                                caseItem.decision === "approved"
                                  ? "default"
                                  : "destructive"
                              }
                              className={cn(
                                "text-xs",
                                caseItem.decision === "approved" &&
                                  "bg-success text-success-foreground",
                              )}
                            >
                              {caseItem.decision}
                            </Badge>
                            {caseItem.approvalStatus && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-blue-50 border-blue-200 text-blue-700"
                              >
                                Q12a: {caseItem.approvalStatus}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {caseItem.justification}
                        </p>
                        <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                          <div className="flex items-center gap-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {caseItem.category}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {caseItem.metadata.Tranche}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {caseItem.metadata.fid}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 gap-1"
                              onClick={() => handleOpenReplaceDialog(caseItem)}
                              title="Copy fields from this case into the current case"
                            >
                              <Replace className="h-3.5 w-3.5" />
                              Copy
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 gap-1"
                              onClick={() =>
                                openJustificationModal(
                                  caseItem.decision,
                                  caseItem,
                                )
                              }
                              title="Open justification workspace seeded with this case"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              Justification
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Justification and Decision Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Justification</CardTitle>
                  <CardDescription className="text-xs">
                    Edit existing text, write manually, or generate with AI
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedCase ? (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          Case {selectedCase.caseNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedCase.justification?.trim()
                            ? "Existing justification saved for this case."
                            : "No justification saved yet."}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {selectedCase.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Choose an action to proceed.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRetrieveSimilarCases}
                      disabled={
                        isLoadingSimilarCases || isLoadingSimilarMatches
                      }
                      className="gap-2"
                    >
                      {isLoadingSimilarCases || isLoadingSimilarMatches ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <History className="w-4 h-4" />
                      )}
                      Similar Cases
                    </Button>
                    <Button
                      type="button"
                      onClick={() => openJustificationModal("approved")}
                      disabled={isUpdatingCase || isGeneratingJustification}
                      className="gap-2 bg-success hover:bg-success/90 text-success-foreground"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => openJustificationModal("rejected")}
                      disabled={isUpdatingCase || isGeneratingJustification}
                      className="gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Approve or Reject opens the justification workspace where
                    you can review inputs, generate with AI, edit, and confirm.
                    Similar Cases loads matching records with Copy and
                    Justification actions on each row.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">
                    Select a case to enter justification
                  </p>
                  <p className="text-xs mt-1">
                    You can write your own or use AI to generate one
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Similar Justifications Quick View */}
          {similarJustifications.length > 0 && !similarCaseAnalysis && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Similar Decisions</CardTitle>
                <CardDescription className="text-xs">
                  Based on product category and attributes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {similarJustifications.map((similar) => (
                  <div
                    key={similar.id}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleOpenReplaceDialog(similar)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {similar.productName}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSimilarCaseModal(similar);
                          }}
                          title="View details"
                        >
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                      <Badge
                        variant={
                          similar.decision === "approved"
                            ? "default"
                            : "destructive"
                        }
                        className={cn(
                          "text-xs",
                          similar.decision === "approved" &&
                            "bg-success text-success-foreground",
                        )}
                      >
                        {similar.decision}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {similar.justification}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {similar.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(similar.similarity * 100)}% match
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={onBack}
          className="gap-2 bg-transparent"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Preview
        </Button>
        <Button
          onClick={onComplete}
          disabled={pendingProducts.length > 0}
          size="lg"
          className="gap-2"
        >
          Complete Workflow
          <CheckCircle2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Edit Case Modal */}
      {editingCase && (
        <Dialog
          open={isEditModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              if (
                isEditDirty &&
                !window.confirm("Discard unsaved changes?")
              ) {
                return;
              }
              setIsEditDirty(false);
            }
            setIsEditModalOpen(open);
          }}
        >
          <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-6 pt-6 pb-3 border-b">
              <div className="flex items-center justify-between gap-3">
                <DialogTitle>Edit Case Details</DialogTitle>
                {isEditDirty && (
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                    Unsaved changes
                  </span>
                )}
              </div>
            </DialogHeader>

            {/* Custom Tabs */}
            <div className="flex gap-2 border-b px-6">
              <button
                onClick={() => setActiveTab("eg")}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === "eg"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                EG Form
              </button>
              <button
                onClick={() => setActiveTab("application")}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === "application"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Application
              </button>
              <button
                onClick={() => setActiveTab("catalogue")}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === "catalogue"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Catalogue
              </button>
            </div>

            <div className="grid gap-4 py-4 px-6 overflow-y-auto flex-1">
              {/* EG Form Tab */}
              {activeTab === "eg" && (
                <div className="border-t pt-4">
                  <div className="grid grid-cols-3 gap-3">
                    {egFields.map((field) => {
                      const val = egFormData[field] || "";
                      const long = isLongTextField(field, val);
                      const isStaffLabel =
                        field === "Staff1" || field === "Staff2";
                      const isStaffInfo =
                        field === "Staff1_Info" || field === "Staff2_Info";
                      // Selecting either half auto-fills the sibling field so
                      // Staff1 <-> Staff1_Info stay in sync with the roster.
                      const siblingField = isStaffLabel
                        ? `${field}_Info`
                        : isStaffInfo
                          ? field.replace("_Info", "")
                          : null;
                      return (
                        <div
                          key={field}
                          className={cn(
                            "space-y-1",
                            long && "col-span-3",
                          )}
                        >
                          <Label className="text-xs">{field}</Label>
                          {isStaffLabel || isStaffInfo ? (
                            <StaffSelect
                              mode={isStaffLabel ? "label" : "info"}
                              value={val}
                              onSelect={({ label, info }) => {
                                setIsEditDirty(true);
                                setEgFormData((prev) => ({
                                  ...prev,
                                  [field]: isStaffLabel ? label : info,
                                  ...(siblingField
                                    ? {
                                        [siblingField]: isStaffLabel
                                          ? info
                                          : label,
                                      }
                                    : {}),
                                }));
                              }}
                              onChange={(raw) => {
                                setIsEditDirty(true);
                                setEgFormData((prev) => ({
                                  ...prev,
                                  [field]: raw,
                                }));
                              }}
                            />
                          ) : field === "Q12a" ? (
                            <Q12aSelect
                              value={val}
                              onChange={(next) => {
                                setIsEditDirty(true);
                                setEgFormData((prev) => ({
                                  ...prev,
                                  [field]: next,
                                }));
                              }}
                            />
                          ) : field === "Q12f_RReject" ? (
                            <Q12fRejectSelect
                              value={val}
                              onChange={(next) => {
                                setIsEditDirty(true);
                                setEgFormData((prev) => ({
                                  ...prev,
                                  [field]: next,
                                }));
                              }}
                            />
                          ) : long ? (
                            <Textarea
                              value={val}
                              onChange={(e) => {
                                setIsEditDirty(true);
                                setEgFormData((prev) => ({
                                  ...prev,
                                  [field]: e.target.value,
                                }));
                              }}
                              className="text-sm"
                              rows={3}
                              placeholder="/"
                            />
                          ) : (
                            <Input
                              value={val}
                              onChange={(e) => {
                                setIsEditDirty(true);
                                setEgFormData((prev) => ({
                                  ...prev,
                                  [field]: e.target.value,
                                }));
                              }}
                              className="text-sm"
                              placeholder="/"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Application Data Tab */}
              {activeTab === "application" && (
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    {appFields.map((field) => {
                      const val = appFormData[field] || "";
                      const long = isLongTextField(field, val);
                      return (
                        <div
                          key={field}
                          className={cn(
                            "space-y-2",
                            long && "col-span-2",
                          )}
                        >
                          <Label className="text-sm">{field}</Label>
                          {long ? (
                            <Textarea
                              value={val}
                              onChange={(e) => {
                                setIsEditDirty(true);
                                setAppFormData((prev) => ({
                                  ...prev,
                                  [field]: e.target.value,
                                }));
                              }}
                              rows={3}
                              placeholder="/"
                            />
                          ) : (
                            <Input
                              value={val}
                              onChange={(e) => {
                                setIsEditDirty(true);
                                setAppFormData((prev) => ({
                                  ...prev,
                                  [field]: e.target.value,
                                }));
                              }}
                              placeholder="/"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Catalogue Data Tab */}
              {activeTab === "catalogue" && (
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Product Name</Label>
                      <Input
                        value={catalogueFormData.product_name || ""}
                        onChange={(e) => {
                          setIsEditDirty(true);
                          setCatalogueFormData((prev) => ({
                            ...prev,
                            product_name: e.target.value,
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Model</Label>
                      <Input
                        value={catalogueFormData.model || ""}
                        onChange={(e) => {
                          setIsEditDirty(true);
                          setCatalogueFormData((prev) => ({
                            ...prev,
                            model: e.target.value,
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Product Size</Label>
                      <Input
                        value={catalogueFormData.product_size || ""}
                        onChange={(e) => {
                          setIsEditDirty(true);
                          setCatalogueFormData((prev) => ({
                            ...prev,
                            product_size: e.target.value,
                          }));
                        }}
                        placeholder="/"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Usage Capacity</Label>
                      <Input
                        value={catalogueFormData.usage_capacity || ""}
                        onChange={(e) => {
                          setIsEditDirty(true);
                          setCatalogueFormData((prev) => ({
                            ...prev,
                            usage_capacity: e.target.value,
                          }));
                        }}
                        placeholder="/"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Description</Label>
                      <Textarea
                        value={catalogueFormData.description || ""}
                        onChange={(e) => {
                          setIsEditDirty(true);
                          setCatalogueFormData((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }));
                        }}
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-background">
              <Button
                variant="outline"
                onClick={() => {
                  if (
                    isEditDirty &&
                    !window.confirm("Discard unsaved changes?")
                  ) {
                    return;
                  }
                  setIsEditDirty(false);
                  setIsEditModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveEditedCase} disabled={!isEditDirty}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Similar Case Replacement Dialog */}
      <SimilarCaseReplaceDialog
        open={isReplaceDialogOpen}
        onOpenChange={setIsReplaceDialogOpen}
        originalCase={
          selectedProducts.length === 1
            ? cases.find((c) => c.id === selectedProducts[0]) || null
            : null
        }
        similarCase={replaceSimilarCase}
        onSuccess={handleReplaceSuccess}
      />

      {/* Justification Modal — friendly per-decision workspace */}
      <JustificationModal
        open={isJustificationModalOpen}
        onOpenChange={(open) => {
          setIsJustificationModalOpen(open);
          if (!open) {
            setJustificationModalSeed(null);
          }
        }}
        selectedCase={selectedCase || null}
        initialDecision={justificationModalDecision}
        seedSimilarCase={justificationModalSeed}
        isGenerating={isGeneratingJustification}
        isUpdating={isUpdatingCase}
        isSavingDraft={isSavingDraft}
        onGenerate={generateJustificationWithInputs}
        onConfirm={handleConfirmDecision}
        onSaveDraft={handleSaveJustificationDraft}
      />

      {/* Audit Log Dialog */}
      <CaseAuditLogDialog
        caseId={auditLogCase?.id ?? ""}
        caseNumber={auditLogCase?.caseNumber ?? ""}
        open={!!auditLogCase}
        onOpenChange={(open) => {
          if (!open) setAuditLogCase(null);
        }}
      />

      {/* Delete Case Confirmation Dialog */}
      <AlertDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Case</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this case? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <DialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={isDeletingCase}
            >
              {isDeletingCase ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </DialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Similar Case Detail Modal */}
      {selectedSimilarCaseDetail && (
        <Dialog
          open={isSimilarCaseModalOpen}
          onOpenChange={setIsSimilarCaseModalOpen}
        >
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-4">
                <div>
                  <DialogTitle className="text-lg">
                    {selectedSimilarCaseDetail.productName}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Similar case details
                  </p>
                </div>
                <Badge
                  variant={
                    selectedSimilarCaseDetail.decision === "approved"
                      ? "default"
                      : "destructive"
                  }
                  className={cn(
                    "text-xs",
                    selectedSimilarCaseDetail.decision === "approved" &&
                      "bg-success text-success-foreground",
                  )}
                >
                  {selectedSimilarCaseDetail.decision.toUpperCase()}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {/* Similarity Score */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-1">
                    Similarity Score
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {Math.round(selectedSimilarCaseDetail.similarity * 100)}%
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-1">Category</p>
                  <p className="text-sm font-medium">
                    {selectedSimilarCaseDetail.category}
                  </p>
                </div>
              </div>

              {/* Approval Status */}
              {selectedSimilarCaseDetail.approvalStatus && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-xs text-blue-600 font-medium mb-1">
                    Approval Status
                  </p>
                  <p className="text-sm text-blue-900">
                    Q12a: {selectedSimilarCaseDetail.approvalStatus}
                  </p>
                </div>
              )}

              {/* Q12 Fields */}
              {selectedSimilarCaseDetail.metadata && (
                <div className="space-y-4 p-4 rounded-lg bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-100">
                  <p className="text-sm font-semibold text-slate-900">
                    Procurement Details
                  </p>

                  {/* Short fields grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* {selectedSimilarCaseDetail.metadata.Q12a && (
                      <div className="bg-white p-3 rounded border border-blue-100">
                        <p className="text-xs font-medium text-slate-600 mb-1">
                          Q12a - Approval
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {selectedSimilarCaseDetail.metadata.Q12a}
                        </p>
                      </div>
                    )} */}
                    {selectedSimilarCaseDetail.metadata.Q12c_TotC !==
                      undefined && (
                      <div className="bg-white p-3 rounded border border-blue-100">
                        <p className="text-xs font-medium text-slate-600 mb-1">
                          Q12c - Total Cost
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {selectedSimilarCaseDetail.metadata.Q12c_TotC}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Full-width long-form fields */}
                  {/* {selectedSimilarCaseDetail.metadata.Q12b_Jus && (
                    <div className="bg-white p-3 rounded border border-blue-100">
                      <p className="text-xs font-medium text-slate-600 mb-2">
                        Q12b - Justification
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {selectedSimilarCaseDetail.metadata.Q12b_Jus}
                      </p>
                    </div>
                  )} */}

                  {selectedSimilarCaseDetail.metadata.Q12d_Quo && (
                    <div className="bg-white p-3 rounded border border-blue-100">
                      <p className="text-xs font-medium text-slate-600 mb-2">
                        Q12d - Quotation Details
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {selectedSimilarCaseDetail.metadata.Q12d_Quo}
                      </p>
                    </div>
                  )}

                  {selectedSimilarCaseDetail.metadata.Q12e_JCost && (
                    <div className="bg-white p-3 rounded border border-blue-100">
                      <p className="text-xs font-medium text-slate-600 mb-2">
                        Q12e - Justification Cost
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {selectedSimilarCaseDetail.metadata.Q12e_JCost}
                      </p>
                    </div>
                  )}

                  {selectedSimilarCaseDetail.metadata.Q12f_RReject && (
                    <div className="bg-white p-3 rounded border border-red-100 bg-red-50/30">
                      <p className="text-xs font-medium text-red-700 mb-2">
                        Q12f - Reason for Rejection
                      </p>
                      <p className="text-sm text-red-900 leading-relaxed">
                        {selectedSimilarCaseDetail.metadata.Q12f_RReject}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Justification */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Justification</Label>
                <div className="p-4 rounded-lg bg-muted/50 border min-h-24 max-h-40 overflow-y-auto">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {selectedSimilarCaseDetail.justification}
                  </p>
                </div>
              </div>

              {/* Metadata */}
              {selectedSimilarCaseDetail.metadata && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Additional Metadata
                  </Label>
                  <div className="p-3 rounded-lg bg-muted/30 border max-h-40 overflow-y-auto">
                    {Object.entries(selectedSimilarCaseDetail.metadata).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="flex justify-between gap-4 py-1 text-xs border-b last:border-b-0"
                        >
                          <span className="font-medium text-muted-foreground">
                            {key}:
                          </span>
                          <span className="text-right text-foreground">
                            {String(value)}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsSimilarCaseModalOpen(false)}
                className="gap-2"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
