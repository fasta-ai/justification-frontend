"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollText, Loader2 } from "lucide-react";
import { useCaseAuditLogs } from "@/hooks/use-case-audit-logs";
import type { CaseAuditLogEntry } from "@/app/api/cases/types";

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value === "" ? "(empty)" : value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function FieldChange({ entry }: { entry: CaseAuditLogEntry }) {
  return (
    <div className="space-y-3">
      {entry.changedFields.map((field, idx) => (
        <div
          key={`${field.section}-${field.fieldName}-${idx}`}
          className="rounded-lg border p-3 space-y-2"
        >
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-xs rounded bg-muted px-1.5 py-0.5">
              {field.section}
            </span>
            <span className="font-semibold">{field.fieldName}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="rounded bg-red-50 border border-red-100 p-2">
              <div className="text-xs font-medium text-red-700 mb-1">Old</div>
              <div className="font-mono whitespace-pre-wrap break-words text-red-900">
                {formatValue(field.oldValue)}
              </div>
            </div>
            <div className="rounded bg-green-50 border border-green-100 p-2">
              <div className="text-xs font-medium text-green-700 mb-1">New</div>
              <div className="font-mono whitespace-pre-wrap break-words text-green-900">
                {formatValue(field.newValue)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface CaseAuditLogDialogProps {
  caseId: string;
  caseNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CaseAuditLogDialog({
  caseId,
  caseNumber,
  open,
  onOpenChange,
}: CaseAuditLogDialogProps) {
  const { logs, isLoading, error, fetchAuditLogs } = useCaseAuditLogs();

  useEffect(() => {
    if (open && caseId) {
      fetchAuditLogs(caseId);
    }
  }, [open, caseId, fetchAuditLogs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="w-5 h-5" />
            Audit Log — {caseNumber}
          </DialogTitle>
          <DialogDescription>
            Change history for this case, newest first.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading logs…</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No audit entries yet.
          </p>
        ) : (
          <div className="space-y-6">
            {logs.map((entry) => (
              <div key={entry.id} className="space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground border-b pb-2">
                  <span className="font-medium text-foreground">
                    {new Date(entry.createdAt).toLocaleString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  {entry.userName || entry.userEmail ? (
                    <span>
                      by {entry.userName ?? entry.userEmail}
                      {entry.userName && entry.userEmail
                        ? ` (${entry.userEmail})`
                        : ""}
                    </span>
                  ) : (
                    <span>by Unknown</span>
                  )}
                </div>
                <FieldChange entry={entry} />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface CaseAuditLogButtonProps {
  caseId: string;
  caseNumber: string;
}

export function CaseAuditLogButton({
  caseId,
  caseNumber,
}: CaseAuditLogButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <ScrollText className="w-4 h-4" />
        Log
      </Button>
      <CaseAuditLogDialog
        caseId={caseId}
        caseNumber={caseNumber}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
