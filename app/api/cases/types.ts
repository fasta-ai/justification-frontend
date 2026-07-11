export type StatusType = "pending" | "approved" | "rejected" | "under_review";

export interface CreateCaseDto {
  caseNumber: string;
  userId: string;
  status?: StatusType;
  justification?: string;
  recdEG?: boolean;
  catalogueData?: Record<string, any>;
  egData?: Record<string, any>;
  applicationData?: Record<string, any>;
  categoryId?: string;
  tranche?: string;
}

export interface CreateCaseResponse {
  success: boolean;
  caseId?: string;
  message?: string;
  error?: string;
}

export interface Case {
  id: string;
  caseNumber: string;
  userId: string;
  status: StatusType;
  justification?: string;
  recdEG?: boolean;
  catalogueData?: Record<string, unknown>;
  egData?: Record<string, unknown>;
  applicationData?: Record<string, unknown>;
  categoryId?: string;
  tranche?: string;
  season?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CaseFilters {
  status?: StatusType;
  caseNumber?: string;
  recdEG?: boolean;
  categoryId?: string;
  userId?: string;
}

export interface GetCasesResponse {
  success: boolean;
  cases?: Case[];
  error?: string;
}

export interface UpdateCaseStatusAndJustificationDto {
  status?: "approved" | "rejected";
  justification?: string;
}

export interface UpdateCaseResponse {
  success: boolean;
  case?: Case;
  error?: string;
}

export type ReplacementSection = "eg" | "application" | "catalogue";

export interface FieldReplacement {
  section: ReplacementSection;
  fieldName: string;
  value: any;
}

export interface ReplaceFromSimilarDto {
  sourceDatasetId: string;
  replacements: FieldReplacement[];
  actor?: {
    userId?: string;
    email?: string;
    name?: string;
  };
}

export interface ReplaceFromSimilarResponse {
  success: boolean;
  case?: Case;
  error?: string;
}

export interface CaseAuditLogEntry {
  id: string;
  targetCaseId: string;
  sourceDatasetId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  changedFields: Array<{
    section: "eg" | "application" | "catalogue" | "case";
    fieldName: string;
    oldValue: any;
    newValue: any;
  }>;
  createdAt: string;
}

export interface GetAuditLogsResponse {
  success: boolean;
  logs?: CaseAuditLogEntry[];
  error?: string;
}

export interface SaveCaseDataDto {
  egData?: Record<string, any>;
  catalogueData?: Record<string, any>;
  applicationData?: Record<string, any>;
  categoryId?: string;
  recdEG?: boolean;
}

export interface SaveCaseDataResponse {
  success: boolean;
  case?: Case;
  message?: string;
  error?: string;
}
