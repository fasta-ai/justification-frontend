"use client";

import { useState } from "react";
import { useGetCases } from "@/hooks/use-get-cases";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, RefreshCw, Loader2, FileText } from "lucide-react";
import type { StatusType } from "@/app/api/cases/types";
import { CaseAuditLogButton } from "@/components/case-audit-log-dialog";

const statusColors: Record<StatusType, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  approved: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  under_review: "bg-blue-100 text-blue-800 border-blue-300",
};

const statusLabels: Record<StatusType, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  under_review: "Under Review",
};

export function CasesList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusType | "all">("all");
  
  const { cases, isLoading, error, refetch } = useGetCases();

  // Filter cases based on search and status
  const filteredCases = cases.filter((c) => {
    const matchesSearch = c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">All Cases</h2>
          <p className="text-muted-foreground mt-1">
            View and manage all product cases
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isLoading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search by Case Number */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Case Number</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter case number..."
                  className="pl-9"
                />
              </div>
            </div>

            {/* Filter by Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by Status</label>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusType | "all")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cases Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cases</CardTitle>
              <CardDescription>
                {isLoading ? (
                  "Loading cases..."
                ) : (
                  `Showing ${filteredCases.length} of ${cases.length} cases`
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">
              <p className="font-semibold">Error loading cases</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading cases...</span>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No cases found</h3>
              <p className="text-muted-foreground max-w-md">
                {searchQuery || statusFilter !== "all"
                  ? "No cases match your current filters. Try adjusting your search criteria."
                  : "No cases have been created yet. Upload products to create cases."}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Case Number</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Category</TableHead>
                    <TableHead className="font-semibold">EG Received</TableHead>
                    <TableHead className="font-semibold">Created At</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCases.map((caseItem) => (
                    <TableRow key={caseItem.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium font-mono">
                        {caseItem.caseNumber}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColors[caseItem.status]}
                        >
                          {statusLabels[caseItem.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {caseItem.categoryId || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={caseItem.recdEG ? "default" : "secondary"}>
                          {caseItem.recdEG ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {caseItem.createdAt
                          ? new Date(caseItem.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <CaseAuditLogButton
                          caseId={caseItem.id}
                          caseNumber={caseItem.caseNumber}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
