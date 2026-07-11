import { NextRequest, NextResponse } from "next/server";
import { NEXT_PUBLIC_API_URL } from "@/lib/utils";
import type { GetAuditLogsResponse } from "../../types";

function getAuthHeader(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization");
  if (header) return header;
  const accessToken = request.cookies.get("accessToken")?.value;
  if (accessToken) return `Bearer ${accessToken}`;
  return undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const authHeader = getAuthHeader(request);
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    headers.Authorization = authHeader;

    const response = await fetch(
      `${NEXT_PUBLIC_API_URL}/cases/${id}/audit-logs`,
      {
        method: "GET",
        headers,
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.message || "Failed to fetch audit logs",
        } as GetAuditLogsResponse,
        { status: response.status },
      );
    }

    return NextResponse.json(
      { success: true, logs: data } as GetAuditLogsResponse,
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch audit logs",
      } as GetAuditLogsResponse,
      { status: 500 },
    );
  }
}
