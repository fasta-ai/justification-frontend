"use client";

import { useState, useCallback, useEffect } from "react";
import { utils, writeFile } from "xlsx";
import {
  Edit2,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileCheck,
  ImageIcon,
  BookOpen,
  Search,
  ArrowUpDown,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useProductStore } from "@/lib/store";
import { useCreateCase } from "@/hooks/use-create-case";
import { useAuth } from "@/lib/auth-context";
import type { Product } from "@/lib/types";

const fileTypeIcons = {
  application: FileText,
  eg: FileCheck,
  catalogue: ImageIcon,
  quotation: BookOpen,
};

interface EditDialogProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Product>) => void;
}

function EditDialog({ product, isOpen, onClose, onSave }: EditDialogProps) {
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [egFormData, setEgFormData] = useState<Record<string, string>>({});
  const [appFormData, setAppFormData] = useState<Record<string, any>>({});
  const [catalogueFormData, setCatalogueFormData] = useState<
    Record<string, any>
  >({});
  const [activeTab, setActiveTab] = useState<
    "eg" | "application" | "catalogue"
  >("eg");

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

  const getData = useCallback((prod: Product, key: string) => {
    if (key == "App_Cat") {
      const egVal = prod.applicationData?.data?.["PA_RefL"];
      if (egVal !== undefined) return egVal;
    }
    if (
      key === "Recd_EGF" ||
      key === "Recd_PAF" ||
      key === "Recd_Quo" ||
      key === "Recd_Cat" ||
      key === "Req_I_SWD_YN" ||
      key === "Req_RepSWD_YN"
    ) {
      return "Yes";
    }
    if (
      key === "Ret_Rept" ||
      key === "RecdCurrWk_YN" ||
      key === "EGF_Ready_YN" ||
      key === "EGF_To_EG_YN" ||
      key === "EG_Reply_YN" ||
      key === "EGF_To_SWD_YN" ||
      key === "FUF_Comp_YN"
    ) {
      return "NO";
    }
    if (key === "DatEntry") {
      return "";
      // return new Date().toLocaleDateString();
    }

    const egVal = prod.egData?.data?.[key];
    if (egVal !== undefined) return egVal;

    const appVal = prod.applicationData?.data?.[key];
    if (appVal !== undefined) return appVal;

    return "/";
  }, []);

  // Initialize form data when dialog opens or product changes
  useEffect(() => {
    if (isOpen && product) {
      console.log("Initializing edit dialog for product:", product);

      const egData: Record<string, string> = {};
      egFields.forEach((field) => {
        egData[field] = getData(product, field);
      });
      setEgFormData(egData);

      // Initialize application data
      const appData: Record<string, any> = {};
      appFields.forEach((field) => {
        appData[field] = product.applicationData?.data?.[field] || "";
      });
      setAppFormData(appData);

      // Initialize catalogue data
      const catData = product.catalogueData?.data?.products?.[0] || {};
      setCatalogueFormData({
        product_name: catData.product_name || product.name || "",
        model: catData.model || "",
        product_size: catData.product_size || "",
        usage_capacity: catData.usage_capacity || "",
        description: catData.description || product.description || "",
      });
    }
  }, [isOpen, product, getData]);

  const handleSave = useCallback(() => {
    const updates: Partial<Product> = {
      ...formData,
      egData: {
        ...product?.egData,
        data: egFormData,
      },
      applicationData: {
        ...product?.applicationData,
        data: appFormData,
      },
      catalogueData: {
        ...product?.catalogueData,
        data: {
          products: [catalogueFormData],
        },
      },
    };
    onSave(updates);
    onClose();
  }, [
    formData,
    egFormData,
    appFormData,
    catalogueFormData,
    product,
    onSave,
    onClose,
  ]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product Details</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b mb-4">
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

        <div className="grid gap-4 py-4">
          {/* EG Form Tab */}
          {activeTab === "eg" && (
            <div className="border-t pt-4">
              <div className="grid grid-cols-3 gap-3">
                {egFields.map((field) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs">{field}</Label>
                    <Input
                      value={egFormData[field] || "/"}
                      onChange={(e) =>
                        setEgFormData((prev) => ({
                          ...prev,
                          [field]: e.target.value,
                        }))
                      }
                      className="text-sm"
                      placeholder="/"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Application Data Tab */}
          {activeTab === "application" && (
            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                {appFields.map((field) => (
                  <div key={field} className="space-y-2">
                    <Label className="text-sm">{field}</Label>
                    {field.includes("Elaborate") ||
                    field.includes("Justify") ? (
                      <Textarea
                        value={appFormData[field] || "/"}
                        onChange={(e) =>
                          setAppFormData((prev) => ({
                            ...prev,
                            [field]: e.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="/"
                      />
                    ) : (
                      <Input
                        value={appFormData[field] || "/"}
                        onChange={(e) =>
                          setAppFormData((prev) => ({
                            ...prev,
                            [field]: e.target.value,
                          }))
                        }
                        placeholder="/"
                      />
                    )}
                  </div>
                ))}
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
                    value={catalogueFormData.product_name || "/"}
                    onChange={(e) =>
                      setCatalogueFormData((prev) => ({
                        ...prev,
                        product_name: e.target.value || "/",
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Input
                    value={catalogueFormData.model || "/"}
                    onChange={(e) =>
                      setCatalogueFormData((prev) => ({
                        ...prev,
                        model: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Product Size</Label>
                  <Input
                    value={catalogueFormData.product_size || "/"}
                    onChange={(e) =>
                      setCatalogueFormData((prev) => ({
                        ...prev,
                        product_size: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Usage Capacity</Label>
                  <Input
                    value={catalogueFormData.usage_capacity || "/"}
                    onChange={(e) =>
                      setCatalogueFormData((prev) => ({
                        ...prev,
                        usage_capacity: e.target.value,
                      }))
                    }
                    placeholder="/"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={catalogueFormData.description || "/"}
                    onChange={(e) =>
                      setCatalogueFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Stage2PreviewProps {
  onNext: () => void;
  onBack: () => void;
}

const egFields = [
  "SWD_Ref",
  "Ref",
  "App_No",
  "Tranche",
  "EB_RM",
  "NO",
  "NO_R",
  "Staff",
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

export function Stage2Preview({ onNext, onBack }: Stage2PreviewProps) {
  const { products, updateProduct, setProducts, removeProduct } =
    useProductStore();
  const {
    createCase,
    isLoading: isCreatingCases,
    error: createCaseError,
  } = useCreateCase();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Product>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmedProducts, setConfirmedProducts] = useState<Set<string>>(
    new Set(),
  );
  const [activeTableTab, setActiveTableTab] = useState<"a_record" | "pa_admin">(
    "a_record",
  );

  const paAdminFields = [
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

  const handleDelete = useCallback(
    (productId: string, productName: string) => {
      if (
        confirm(
          `Are you sure you want to delete "${productName}"? This action cannot be undone.`,
        )
      ) {
        removeProduct(productId);
        // Also remove from confirmed products if it was confirmed
        setConfirmedProducts((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }
    },
    [removeProduct],
  );

  const handleSort = useCallback(
    (field: keyof Product) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField],
  );

  const filteredProducts = products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const modifier = sortDirection === "asc" ? 1 : -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal) * modifier;
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * modifier;
      }
      return 0;
    });

  const handleConfirm = useCallback((id: string) => {
    setConfirmedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleConfirmAll = useCallback(() => {
    if (confirmedProducts.size === products.length) {
      setConfirmedProducts(new Set());
    } else {
      setConfirmedProducts(new Set(products.map((p) => p.id)));
    }
  }, [products, confirmedProducts.size]);

  const handleSaveEdit = useCallback(
    (updates: Partial<Product>) => {
      if (editingProduct) {
        updateProduct(editingProduct.id, updates);
      }
    },
    [editingProduct, updateProduct],
  );

  const handleProceed = useCallback(async () => {
    try {
      // Get all confirmed products
      const confirmedProductsList = products.filter((p) =>
        confirmedProducts.has(p.id),
      );

      if (confirmedProductsList.length === 0) {
        alert("Please confirm at least one product before proceeding.");
        return;
      }

      console.log(
        `Creating cases for ${confirmedProductsList.length} confirmed products...`,
      );

      // Create cases for all confirmed products
      const caseCreationPromises = confirmedProductsList.map(
        async (product) => {
          // Generate case number from product data
          const caseNumber = `${product.egData?.data?.NO}${product.egData?.data?.NO_R}`;

          const caseData = {
            caseNumber,
            userId: user?.id || "unknown",
            status: "pending" as const,
            recdEG: true,
            catalogueData: product.catalogueData?.data || {},
            egData: product.egData?.data || {},
            applicationData: product.applicationData?.data || {},
            categoryId: product.category || undefined,
            tranche: product.tranch || undefined,
          };

          console.log(`Creating case for product ${product.name}:`, caseNumber);
          return createCase(caseData);
        },
      );

      // Wait for all cases to be created
      const results = await Promise.all(caseCreationPromises);

      // Check if any failed
      const failedCases = results.filter((r) => !r || !r.success);

      if (failedCases.length > 0) {
        alert(
          `Warning: ${failedCases.length} case(s) failed to create. Please check the console for details.`,
        );
      } else {
        console.log(`Successfully created ${results.length} cases`);
      }

      // Mark confirmed products as pending_review
      confirmedProductsList.forEach((p) => {
        updateProduct(p.id, { status: "pending_review" });
      });

      // Proceed to next stage
      onNext();
    } catch (error) {
      console.error("Error creating cases:", error);
      alert("An error occurred while creating cases. Please try again.");
    }
  }, [products, confirmedProducts, createCase, updateProduct, onNext]);

  const handleExportExcel = useCallback(() => {
    // Helper function to get data (same logic as table display)
    const getData = (product: Product, key: string) => {
      if (key == "App_Cat") {
        // Special case for App_Cat to fallback to product category
        const egVal = product.applicationData?.data?.["PA_RefL"];
        if (egVal !== undefined && egVal === "Yes") return "Procurement";
        else return "Procurement";
      }
      if (
        key === "Recd_EGF" ||
        key === "Recd_PAF" ||
        key === "Recd_Quo" ||
        key === "Recd_Cat" ||
        key === "Req_I_SWD_YN" ||
        key === "Req_RepSWD_YN"
      ) {
        return "Yes";
      }
      if (
        key === "Ret_Rept" ||
        key === "RecdCurrWk_YN" ||
        key === "EGF_Ready_YN" ||
        key === "EGF_To_EG_YN" ||
        key === "EG_Reply_YN" ||
        key === "EGF_To_SWD_YN" ||
        key === "FUF_Comp_YN"
      ) {
        return "NO";
      }
      if (key === "DatEntry") {
        return "";
      }

      if (
        key === "D_EGF_Out" ||
        key === "D_EGF_Dead" ||
        key === "D_ReqT_SWD" ||
        key === "D_RetF_SWD" ||
        key === "D_WkRep" ||
        key === "D_EGF_T_EG" ||
        key === "D_EG_Reply" ||
        key === "D_EGF_ASWD" ||
        key === "MRef"
      ) {
        const egVal = product.egData?.data?.[key];
        if (egVal !== undefined) return egVal;
        else return "";
      }

      // Check direct property (if strict match), or checks inside data objects
      // Priority: egData > applicationData > product property
      const egVal = product.egData?.data?.[key];
      if (egVal !== undefined) return egVal;

      const appVal = product.applicationData?.data?.[key];
      if (appVal !== undefined) return appVal;

      // Fallback to empty if not found
      return "/";
    };

    // Sheet 1: Main Table Data with EG Fields
    const mainTableData = products.map((p) => {
      const row: Record<string, any> = {};
      egFields.forEach((field) => {
        row[field] = getData(p, field);
      });
      return row;
    });

    // Sheet 2: Application Data
    const applicationData = products
      .filter(
        (p) =>
          p.applicationData?.data &&
          Object.keys(p.applicationData.data).length > 0,
      )
      .map((p) => {
        const appData = p.applicationData.data || {};
        return {
          Ref: getData(p, "Ref") || "",
          Tranche: getData(p, "Tranche") || "",
          EB_RM: getData(p, "EB_RM") || "",
          NO: getData(p, "NO") || "",
          NO_R: getData(p, "NO_R") || "",
          PA_RefL: appData.PA_RefL || "",
          PA_Cat: appData.PA_Cat || "",
          PA_PName: appData.PA_PName || "",
          PA_Brand: appData.PA_Brand || "",
          PA_Mod_No: appData.PA_Mod_No || "",
          TotAmtR: appData.TotAmtR || 0,
          Prof_Staff: appData.Prof_Staff || "No",
          Typ_Staff: appData.Typ_Staff || "/",
          Staff_Avail: appData.Staff_Avail || "No",
          No_Elderly: appData.No_Elderly || 0,
          No_Disable: appData.No_Disable || 0,
          Typ_Disability: appData.Typ_Disability || "/",
          No_Bene: appData.No_Bene || 0,
          PA_Justify: appData.PA_Justify || "",

          PA_Elaborate: appData.PA_Elaborate || "",
        };
      });
    console.log("applicationData", applicationData);
    console.log("mainTableData", mainTableData);
    const workbook = utils.book_new();

    // Add main table sheet (EG Record Admin data)
    if (mainTableData.length > 0) {
      const egSheet = utils.json_to_sheet(mainTableData);
      utils.book_append_sheet(workbook, egSheet, "A_Record_Admin");
    }

    // Add application data sheet
    if (applicationData.length > 0) {
      const appSheet = utils.json_to_sheet(applicationData);
      utils.book_append_sheet(workbook, appSheet, "PA Form");
    }

    // Generate filename
    const filename = `product-data-${new Date().toISOString().split("T")[0]}.xlsx`;

    // Write file
    writeFile(workbook, filename);
  }, [products]);

  const handleExportARecordOnly = useCallback(() => {
    // Helper function to get data (same logic as table display)
    const getData = (product: Product, key: string) => {
      if (key == "App_Cat") {
        // Special case for App_Cat to fallback to product category
        const egVal = product.applicationData?.data?.["PA_RefL"];
        if (egVal !== undefined && egVal === "Yes") return "Procurement";
        else return "Procurement";
      }
      if (
        key === "Recd_EGF" ||
        key === "Recd_PAF" ||
        key === "Recd_Quo" ||
        key === "Recd_Cat" ||
        key === "Req_I_SWD_YN" ||
        key === "Req_RepSWD_YN"
      ) {
        return "Yes";
      }
      if (
        key === "Ret_Rept" ||
        key === "RecdCurrWk_YN" ||
        key === "EGF_Ready_YN" ||
        key === "EGF_To_EG_YN" ||
        key === "EG_Reply_YN" ||
        key === "EGF_To_SWD_YN" ||
        key === "FUF_Comp_YN"
      ) {
        return "NO";
      }
      if (key === "DatEntry") {
        return "";
      }

      if (
        key === "D_EGF_Out" ||
        key === "D_EGF_Dead" ||
        key === "D_ReqT_SWD" ||
        key === "D_RetF_SWD" ||
        key === "D_WkRep" ||
        key === "D_EGF_T_EG" ||
        key === "D_EG_Reply" ||
        key === "D_EGF_ASWD" ||
        key === "MRef"
      ) {
        const egVal = product.egData?.data?.[key];
        if (egVal !== undefined) return egVal;
        else return "";
      }

      const egVal = product.egData?.data?.[key];
      if (egVal !== undefined) return egVal;

      const appVal = product.applicationData?.data?.[key];
      if (appVal !== undefined) return appVal;

      return "/";
    };

    // Main Table Data with EG Fields only
    const mainTableData = products.map((p) => {
      const row: Record<string, any> = {};
      egFields.forEach((field) => {
        row[field] = getData(p, field);
      });
      return row;
    });

    const workbook = utils.book_new();

    // Add only A_Record_Admin sheet
    if (mainTableData.length > 0) {
      const egSheet = utils.json_to_sheet(mainTableData);
      utils.book_append_sheet(workbook, egSheet, "A_Record_Admin");
    }

    // Generate filename
    const filename = `a-record-admin-${new Date().toISOString().split("T")[0]}.xlsx`;

    // Write file
    writeFile(workbook, filename);
  }, [products]);

  // const handleExportCSV = useCallback(() => {
  //   const headers = [
  //     "Name",
  //     "SKU",
  //     "Category",
  //     "Supplier",
  //     "Season",
  //     "Tranch",
  //     "Description",
  //     "Status",
  //     "Files",
  //   ];
  //   const csvRows = [
  //     headers.join(","),
  //     ...products.map((p) => {
  //       const fileNames = p.files
  //         .filter((f) => f.status === "uploaded")
  //         .map((f) => f.name)
  //         .join("; ");
  //       return [
  //         `"${p.name || ""}"`,
  //         `"${p.sku || ""}"`,
  //         `"${p.category || ""}"`,
  //         `"${p.supplier || ""}"`,
  //         `"${p.season || ""}"`,
  //         `"${p.tranch || ""}"`,
  //         `"${(p.description || "").replace(/"/g, '""')}"`,
  //         `"${p.status}"`,
  //         `"${fileNames}"`,
  //       ].join(",");
  //     }),
  //   ];
  //   const csvContent = csvRows.join("\n");
  //   const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  //   const url = URL.createObjectURL(blob);
  //   const link = document.createElement("a");
  //   link.href = url;
  //   link.download = `product-data-${new Date().toISOString().split("T")[0]}.csv`;
  //   link.click();
  //   URL.revokeObjectURL(url);
  // }, [products]);

  // const handleExportJSON = useCallback(() => {
  //   const exportData = products.map((p) => ({
  //     name: p.name,
  //     sku: p.sku,
  //     category: p.category,
  //     supplier: p.supplier,
  //     season: p.season,
  //     tranch: p.tranch,
  //     description: p.description,
  //     status: p.status,
  //     files: p.files
  //       .filter((f) => f.status === "uploaded")
  //       .map((f) => ({
  //         name: f.name,
  //         type: f.type,
  //       })),
  //     createdAt: p.createdAt,
  //   }));
  //   const jsonContent = JSON.stringify(exportData, null, 2);
  //   const blob = new Blob([jsonContent], { type: "application/json" });
  //   const url = URL.createObjectURL(blob);
  //   const link = document.createElement("a");
  //   link.href = url;
  //   link.download = `product-data-${new Date().toISOString().split("T")[0]}.json`;
  //   link.click();
  //   URL.revokeObjectURL(url);
  // }, [products]);

  const allConfirmed =
    confirmedProducts.size === products.length && products.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Preview & Confirm
          </h2>
          <p className="text-muted-foreground mt-1">
            Review product data and confirm before submission
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Check className="w-3 h-3" />
            {confirmedProducts.size}/{products.length} confirmed
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-lg">Product Data</CardTitle>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div> */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  className="gap-1.5 bg-transparent"
                >
                  <Download className="w-4 h-4" />
                  Excel (All)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportARecordOnly}
                  className="gap-1.5 bg-transparent"
                >
                  <Download className="w-4 h-4" />A Record Admin
                </Button>
                {/* <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="gap-1.5 bg-transparent"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportJSON}
                  className="gap-1.5 bg-transparent"
                >
                  <Download className="w-4 h-4" />
                  JSON
                </Button> */}
              </div>
              <Button variant="outline" size="sm" onClick={handleConfirmAll}>
                {allConfirmed ? "Unconfirm All" : "Confirm All"}
              </Button>
            </div>
          </div>

          {/* Table Tabs */}
          <div className="flex gap-2 border-b mt-4">
            <button
              onClick={() => setActiveTableTab("a_record")}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                activeTableTab === "a_record"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Record Admin Table
            </button>
            <button
              onClick={() => setActiveTableTab("pa_admin")}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                activeTableTab === "pa_admin"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              PA Table
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-lg border overflow-hidden overflow-x-auto"
            style={{ width: "1370px" }}
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12 fixed-left sticky left-0 bg-muted/50 z-10"></TableHead>
                  {activeTableTab === "a_record"
                    ? // A_record_admin columns (EG fields)
                      egFields.map((col) => (
                        <TableHead key={col} className="whitespace-nowrap px-4">
                          {col}
                        </TableHead>
                      ))
                    : // PA_admin columns (Application fields)
                      paAdminFields.map((col) => (
                        <TableHead key={col} className="whitespace-nowrap px-4">
                          {col}
                        </TableHead>
                      ))}
                  <TableHead className="text-right sticky right-0 bg-muted/50 z-10">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => {
                  const isConfirmed = confirmedProducts.has(product.id);
                  const getData = (key: string) => {
                    if (key == "App_Cat") {
                      // Special case for App_Cat to fallback to product category
                      const egVal = product.applicationData?.data?.["PA_RefL"];
                      if (egVal !== undefined) return egVal;
                    }
                    if (
                      key === "Recd_EGF" ||
                      key === "Recd_PAF" ||
                      key === "Recd_Quo" ||
                      key === "Recd_Cat" ||
                      key === "Req_I_SWD_YN" ||
                      key === "Req_RepSWD_YN"
                    ) {
                      return "Yes";
                    }
                    if (
                      key === "Ret_Rept" ||
                      key === "RecdCurrWk_YN" ||
                      key === "EGF_Ready_YN" ||
                      key === "EGF_To_EG_YN" ||
                      key === "EG_Reply_YN" ||
                      key === "EGF_To_SWD_YN" ||
                      key === "FUF_Comp_YN"
                    ) {
                      return "NO";
                    }
                    if (key === "DatEntry") {
                      return "";
                    }

                    // Check direct property (if strict match), or checks inside data objects
                    // Priority: egData > applicationData > product property
                    const egVal = product.egData?.data?.[key];
                    if (egVal !== undefined) return egVal;

                    const appVal = product.applicationData?.data?.[key];
                    if (appVal !== undefined) return appVal;

                    // Fallback to empty if not found
                    return "/";
                  };

                  return (
                    <TableRow
                      key={product.id}
                      className={cn(
                        "transition-colors",
                        isConfirmed && "bg-success/5",
                      )}
                    >
                      <TableCell className="sticky left-0 bg-background z-10">
                        <button
                          onClick={() => handleConfirm(product.id)}
                          className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                            isConfirmed
                              ? "bg-success border-success text-success-foreground"
                              : "border-muted-foreground/30 hover:border-primary",
                          )}
                        >
                          {isConfirmed && <Check className="w-3 h-3" />}
                        </button>
                      </TableCell>

                      {activeTableTab === "a_record"
                        ? // A_record_admin data (EG fields)
                          egFields.map((col) => (
                            <TableCell
                              key={col}
                              className="whitespace-nowrap px-4"
                            >
                              {getData(col)}
                            </TableCell>
                          ))
                        : // PA_admin data (Application fields)
                          paAdminFields.map((col) => (
                            <TableCell
                              key={col}
                              className="whitespace-nowrap px-4"
                            >
                              {getData(col)}
                            </TableCell>
                          ))}

                      <TableCell className="text-right sticky right-0 bg-background z-10">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingProduct(product)}
                            className="h-8 w-8"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleDelete(product.id, product.name)
                            }
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No products match your search criteria
            </div>
          )}
        </CardContent>
      </Card>

      <EditDialog
        product={editingProduct}
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        onSave={handleSaveEdit}
      />

      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={onBack}
          className="gap-2 bg-transparent"
          disabled={isCreatingCases}
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Upload
        </Button>
        <Button
          onClick={handleProceed}
          disabled={confirmedProducts.size === 0 || isCreatingCases}
          size="lg"
          className="gap-2"
        >
          {isCreatingCases ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating Cases...
            </>
          ) : (
            <>
              Continue to Approval
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
