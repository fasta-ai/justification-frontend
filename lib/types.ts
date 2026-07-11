export interface ProductFile {
  id: string;
  name: string;
  type: "application" | "eg" | "catalogue" | "quotation";
  file: File | null;
  status: "pending" | "uploaded" | "error";
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  season: string;
  tranch: string;
  description: string;
  supplier: string;
  files: ProductFile[];
  status: "draft" | "pending_review" | "approved" | "rejected";
  createdAt: Date;
  egData?: any;
  applicationData?: any;
  catalogueData?: any;
}

export interface ExtractedData {
  productName: string;
  sku: string;
  category: string;
  season: string;
  tranch: string;
  supplier: string;
  description: string;
  confidence: number;
}

export interface ApprovalJustification {
  id: string;
  productId: string;
  decision: "approved" | "rejected";
  justification: string;
  confidence: number;
  timestamp: Date;
}

export interface SimilarJustification {
  id: string;
  productName: string;
  category: string;
  decision: "approved" | "rejected";
  justification: string;
  similarity: number;
  approvalStatus?: string;
  metadata?: any;
  /** Which retrieval tier produced this match: exact token, pg_trgm fuzzy, or pgvector semantic. */
  tier?: "exact" | "fuzzy" | "semantic";
}

export interface SimilarCaseAnalysis {
  totalCases: number;
  approvalRate: number;
  rejectionRate: number;
  commonApprovalFactors: string[];
  commonRejectionFactors: string[];
  cases: SimilarJustification[];
}

export interface CaseAuditLogEntry {
  id: string;
  targetCaseId: string;
  sourceDatasetId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  changedFields: ChangedField[];
  createdAt: string;
}

export interface ChangedField {
  section: ReplacementSection;
  fieldName: string;
  oldValue: any;
  newValue: any;
}

export type ReplacementSection = "eg" | "application" | "catalogue";

export interface FieldReplacement {
  section: ReplacementSection;
  fieldName: string;
  value: any;
}

export type Stage = 1 | 2 | 3;
