"use client";

import { useCallback, useEffect, useState } from "react";
import type { Staff, StaffResponse } from "@/app/api/staff/route";

export type { Staff };

export interface StaffInput {
  name: string;
  position?: string;
  phone?: string;
  email?: string;
}

/**
 * Compose the human-readable Staff1 / Staff2 label:
 *   "Argus Chan (Manager/ITA)"
 * When position is empty, just returns the name.
 */
export function formatStaffLabel(staff: Pick<Staff, "name" | "position">): string {
  if (!staff?.name) return "";
  return staff.position ? `${staff.name} (${staff.position})` : staff.name;
}

/**
 * Compose the Staff1_Info / Staff2_Info value:
 *   "3705 5357 / argus.chan@hkcss.org.hk"
 */
export function formatStaffInfo(staff: Pick<Staff, "phone" | "email">): string {
  const parts = [staff?.phone || "", staff?.email || ""].filter(Boolean);
  return parts.join(" / ");
}

export function useStaff() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/staff", { method: "GET" });
      const body: StaffResponse = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || "Failed to load staff");
      }
      setStaff(body.staff || []);
      return body.staff || [];
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load staff list";
      setError(msg);
      setStaff([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const create = useCallback(
    async (input: StaffInput) => {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || "Failed to create staff");
      }
      await refetch();
      return body.staff?.[0] as Staff | undefined;
    },
    [refetch],
  );

  const update = useCallback(
    async (id: string, input: Partial<StaffInput>) => {
      const res = await fetch(`/api/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || "Failed to update staff");
      }
      await refetch();
      return body.staff as Staff | undefined;
    },
    [refetch],
  );

  const remove = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to delete staff");
      }
      await refetch();
    },
    [refetch],
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    staff,
    isLoading,
    error,
    refetch,
    create,
    update,
    remove,
  };
}
