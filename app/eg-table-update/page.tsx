"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { ProtectedRoute } from "@/components/protected-route";

type MatchKey = {
  Ref: string;
  Tranche: string;
  EB_RM: string;
  NO: number;
  NO_R: string;
};

type FieldChange = {
  field: string;
  oldValue: unknown;
  newValue: unknown;
};

type AcceptedRow = {
  excelRowNumber: number;
  matchKey: MatchKey;
  changes: FieldChange[];
};

type IssueRow = {
  excelRowNumber: number;
  matchKey?: Partial<MatchKey>;
  issues: string[];
  kind: "invalid" | "unmatched" | "duplicate";
};

type PreviewResult = {
  applicable: true;
  sourceFileName: string;
  sheetName: string;
  acceptedRows: AcceptedRow[];
  unmatchedRows: IssueRow[];
  issueRows: IssueRow[];
  summary: {
    totalDataRows: number;
    accepted: number;
    unmatched: number;
    issues: number;
  };
};

type FileRejection = {
  applicable: false;
  reason: string;
  code?: string;
};

type ApplySuccess = {
  applied: true;
  applicable: true;
  message: string;
  batchId: string;
  updatedCount: number;
  unmatchedCount: number;
  issueCount: number;
  snapshotStored: boolean;
};

type ApplyFailure = {
  applied: false;
  applicable?: boolean;
  message: string;
  reason?: string;
  intact?: boolean;
  snapshotStored?: boolean;
};

type Batch = {
  id: string;
  createdAt: string;
  sourceFileName: string;
  status: "applied" | "rolled_back";
  updatedCount: number;
  userName?: string | null;
  userEmail?: string | null;
  rolledBackAt?: string | null;
  rolledBackByName?: string | null;
  rolledBackByEmail?: string | null;
};

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function matchKeyLabel(key?: Partial<MatchKey>): string {
  if (!key) return "—";
  return [key.Ref, key.Tranche, key.EB_RM, key.NO, key.NO_R]
    .filter((part) => part !== undefined && part !== null && part !== "")
    .join(" · ");
}

function EgTableUpdatePage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [rejection, setRejection] = useState<FileRejection | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [success, setSuccess] = useState<ApplySuccess | null>(null);
  const [failure, setFailure] = useState<ApplyFailure | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<Batch | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackMessage, setRollbackMessage] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/eg-excel-update/batches");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBatchesError("Could not load previous update batches.");
        return;
      }
      setBatches(Array.isArray(body.batches) ? body.batches : []);
      setBatchesError(null);
    } catch {
      setBatchesError("Could not load previous update batches.");
    }
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  function resetResult() {
    setRejection(null);
    setPreview(null);
    setSuccess(null);
    setFailure(null);
    setRollbackMessage(null);
  }

  function onPickFile(next: File | null) {
    setFile(next);
    resetResult();
  }

  async function checkFile() {
    if (!file) return;
    resetResult();
    setIsChecking(true);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const res = await fetch("/api/eg-excel-update/preview", {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (body && body.applicable === false) {
        setRejection({
          applicable: false,
          reason:
            body.reason ||
            "The file is not applicable. It could not be used to update EG forms.",
          code: body.code,
        });
        return;
      }
      if (!res.ok || !body || body.applicable !== true) {
        setRejection({
          applicable: false,
          reason:
            body.reason ||
            "The file is not applicable. It could not be checked.",
        });
        return;
      }
      setPreview(body as PreviewResult);
    } catch {
      setRejection({
        applicable: false,
        reason:
          "The file is not applicable. The preview request failed before any data could be checked.",
      });
    } finally {
      setIsChecking(false);
    }
  }

  function cancelPreview() {
    setPreview(null);
    setRejection(null);
  }

  async function confirmUpdate() {
    if (!file || !preview) return;
    setIsApplying(true);
    setFailure(null);
    setSuccess(null);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const res = await fetch("/api/eg-excel-update/apply", {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (body && body.applicable === false) {
        setPreview(null);
        setRejection({
          applicable: false,
          reason:
            body.reason ||
            "The file is not applicable. No records were changed.",
          code: body.code,
        });
        return;
      }
      if (body && body.applied === true) {
        setSuccess(body as ApplySuccess);
        setPreview(null);
        await loadBatches();
        return;
      }
      setFailure({
        applied: false,
        message:
          body.message ||
          "The update did not apply and existing data is unchanged.",
        reason: body.reason,
        intact: body.intact,
        snapshotStored: body.snapshotStored,
      });
    } catch {
      setFailure({
        applied: false,
        message: "The update did not apply and existing data is unchanged.",
      });
    } finally {
      setIsApplying(false);
    }
  }

  async function confirmRollback() {
    if (!rollbackTarget) return;
    setIsRollingBack(true);
    try {
      const res = await fetch(
        `/api/eg-excel-update/batches/${encodeURIComponent(rollbackTarget.id)}/rollback`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.rolledBack) {
        setRollbackMessage(
          body.message ||
            body.error ||
            "The rollback could not be completed. Existing data was left as it is.",
        );
      } else {
        setRollbackMessage(body.message);
        await loadBatches();
      }
    } catch {
      setRollbackMessage(
        "The rollback could not be completed. Existing data was left as it is.",
      );
    } finally {
      setIsRollingBack(false);
      setRollbackTarget(null);
    }
  }

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
            <h1 className="text-2xl font-semibold tracking-tight">
              Update EG forms from Excel
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Update existing EG form records from an Excel file in the confirmed
              Access / system export format. This is not the Imports function:
              unmatched rows are not added as new cases, and the similar-case
              search bank is not changed. A fallback snapshot is taken before
              every confirmed update.
            </p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Upload an EG table
              </CardTitle>
              <CardDescription>
                Choose an .xlsx or .xls file. The file is checked first. Nothing
                is written until you confirm the preview.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                aria-label="EG Excel file"
                onChange={(event) => onPickFile(event.target.files?.[0] ?? null)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void checkFile()}
                  disabled={!file || isChecking || isApplying}
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Checking file
                    </>
                  ) : (
                    "Check file"
                  )}
                </Button>
                {file && (
                  <p className="text-sm text-muted-foreground self-center">
                    Selected: {file.name}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {rejection && (
            <Alert variant="destructive" className="mb-6" role="alert">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>This file is not applicable</AlertTitle>
              <AlertDescription>{rejection.reason}</AlertDescription>
            </Alert>
          )}

          {failure && (
            <Alert variant="destructive" className="mb-6" role="alert">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>The update did not apply</AlertTitle>
              <AlertDescription>
                {failure.message}
                {failure.intact ? " Existing data is unchanged." : ""}
                {failure.reason ? ` (${failure.reason})` : ""}
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-6" role="status">
              <CheckCircle2 className="w-4 h-4" />
              <AlertTitle>Update applied</AlertTitle>
              <AlertDescription>
                {success.message} A fallback snapshot has been stored for this
                batch, so an authorised user can roll it back later.
              </AlertDescription>
            </Alert>
          )}

          {rollbackMessage && !failure && (
            <Alert className="mb-6" role="status">
              <CheckCircle2 className="w-4 h-4" />
              <AlertTitle>Rollback</AlertTitle>
              <AlertDescription>{rollbackMessage}</AlertDescription>
            </Alert>
          )}

          {preview && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Preview</CardTitle>
                <CardDescription>
                  Format accepted from {preview.sourceFileName} (sheet{" "}
                  {preview.sheetName}). {preview.summary.accepted} row
                  {preview.summary.accepted === 1 ? "" : "s"} can be updated,{" "}
                  {preview.summary.unmatched} unmatched,{" "}
                  {preview.summary.issues} with row-level issues. No data has
                  been written yet.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <section>
                  <h2 className="font-medium mb-2">Rows to update</h2>
                  {preview.acceptedRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No accepted rows to update.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Excel row</TableHead>
                          <TableHead>Match key</TableHead>
                          <TableHead>Changes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.acceptedRows.map((row) => (
                          <TableRow key={`ok-${row.excelRowNumber}`}>
                            <TableCell>{row.excelRowNumber}</TableCell>
                            <TableCell>{matchKeyLabel(row.matchKey)}</TableCell>
                            <TableCell>
                              {row.changes.length === 0
                                ? "No field changes"
                                : row.changes
                                    .map(
                                      (change) =>
                                        `${change.field}: ${formatCell(change.oldValue)} → ${formatCell(change.newValue)}`,
                                    )
                                    .join("; ")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </section>

                <section>
                  <h2 className="font-medium mb-2">Unmatched rows</h2>
                  {preview.unmatchedRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      None. Unmatched rows are not inserted as new live EG forms.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Excel row</TableHead>
                          <TableHead>Match key</TableHead>
                          <TableHead>Why it will not be updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.unmatchedRows.map((row) => (
                          <TableRow key={`un-${row.excelRowNumber}`}>
                            <TableCell>{row.excelRowNumber}</TableCell>
                            <TableCell>{matchKeyLabel(row.matchKey)}</TableCell>
                            <TableCell>{row.issues.join("; ")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </section>

                <section>
                  <h2 className="font-medium mb-2">Row-level issues</h2>
                  {preview.issueRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      None.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Excel row</TableHead>
                          <TableHead>Match key</TableHead>
                          <TableHead>Why this row is not applicable</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.issueRows.map((row) => (
                          <TableRow key={`iss-${row.excelRowNumber}`}>
                            <TableCell>{row.excelRowNumber}</TableCell>
                            <TableCell>{matchKeyLabel(row.matchKey)}</TableCell>
                            <TableCell>{row.issues.join("; ")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </section>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void confirmUpdate()}
                    disabled={isApplying || preview.acceptedRows.length === 0}
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Updating
                      </>
                    ) : (
                      "Confirm update"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelPreview}
                    disabled={isApplying}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Previous update batches</CardTitle>
              <CardDescription>
                Every successful update keeps a fallback snapshot. An authorised
                user can roll a batch back to the values stored in that
                snapshot.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {batchesError && (
                <p className="text-sm text-muted-foreground">{batchesError}</p>
              )}
              {!batchesError && batches.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No update batches have been stored yet.
                </p>
              )}
              {batches.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Who</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell>
                          {batch.createdAt
                            ? new Date(batch.createdAt).toLocaleString("en-HK", {
                                timeZone: "Asia/Hong_Kong",
                              })
                            : "—"}
                        </TableCell>
                        <TableCell>{batch.sourceFileName}</TableCell>
                        <TableCell>
                          {batch.userName || batch.userEmail || "—"}
                        </TableCell>
                        <TableCell>{batch.updatedCount}</TableCell>
                        <TableCell>
                          {batch.status === "rolled_back"
                            ? "Rolled back"
                            : "Applied"}
                        </TableCell>
                        <TableCell>
                          {batch.status === "applied" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRollbackTarget(batch)}
                            >
                              Roll back
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <Dialog
        open={!!rollbackTarget}
        onOpenChange={(open) => {
          if (!open && !isRollingBack) setRollbackTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Roll back this update?</DialogTitle>
            <DialogDescription>
              {rollbackTarget
                ? `This will restore ${rollbackTarget.updatedCount} record(s) from the fallback snapshot taken for ${rollbackTarget.sourceFileName}. The rollback itself will be recorded.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRollbackTarget(null)}
              disabled={isRollingBack}
            >
              Keep the update
            </Button>
            <Button onClick={() => void confirmRollback()} disabled={isRollingBack}>
              {isRollingBack ? "Rolling back" : "Confirm roll back"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Page() {
  return (
    <ProtectedRoute>
      <EgTableUpdatePage />
    </ProtectedRoute>
  );
}
