import { NextRequest, NextResponse } from "next/server";
import { NEXT_PUBLIC_API_URL } from "@/lib/utils";
import type { GetCasesResponse } from "../types";

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
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) headers.Authorization = authHeader;

    const response = await fetch(`${NEXT_PUBLIC_API_URL}/cases/${id}`, {
      method: "GET",
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.message || "Failed to fetch case",
        } as GetCasesResponse,
        { status: response.status },
      );
    }

    return NextResponse.json(
      { success: true, cases: [data] } as GetCasesResponse,
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch case",
      } as GetCasesResponse,
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    console.log(`Deleting case ${id}`);

    const authHeader = getAuthHeader(request);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) headers.Authorization = authHeader;

    // Forward request to NestJS backend
    const response = await fetch(`${NEXT_PUBLIC_API_URL}/cases/${id}`, {
      method: "DELETE",
      headers,
    });

    console.log("Backend response status for delete:", response.status);

    // Try to parse JSON if response has content
    let data: any = null;
    const contentType = response.headers.get("content-type");

    if (
      contentType &&
      contentType.includes("application/json") &&
      response.status !== 204
    ) {
      try {
        data = await response.json();
      } catch (parseError) {
        console.warn("Failed to parse JSON response:", parseError);
        data = null;
      }
    }

    if (!response.ok) {
      console.error("Backend error:", data);
      return NextResponse.json(
        {
          success: false,
          error: data?.message || "Failed to delete case",
        },
        { status: response.status },
      );
    }

    console.log("Case deleted successfully");

    return NextResponse.json(
      {
        success: true,
        message: "Case deleted successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting case:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete case",
      },
      { status: 500 },
    );
  }
}
