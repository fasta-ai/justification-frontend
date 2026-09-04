import { NEXT_PUBLIC_API_URL } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import type { CreateCaseDto, CreateCaseResponse } from "../types";

function getAuthHeader(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization");
  if (header) return header;
  const accessToken = request.cookies.get("accessToken")?.value;
  if (accessToken) return `Bearer ${accessToken}`;
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateCaseDto = await request.json();

    // Validate required fields
    if (!body.caseNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "Case number is required",
        } as CreateCaseResponse,
        { status: 400 },
      );
    }
    if (!body.tranche) {
      return NextResponse.json(
        {
          success: false,
          error: "Tranche is required",
        } as CreateCaseResponse,
        { status: 400 },
      );
    }

    // Validate that at least one data type is provided
    if (!body.catalogueData && !body.egData && !body.applicationData) {
      return NextResponse.json(
        {
          success: false,
          error:
            "At least one of catalogueData, egData, or applicationData must be provided",
        } as CreateCaseResponse,
        { status: 400 },
      );
    }

    console.log("Creating case with data:", {
      caseNumber: body.caseNumber,
      status: body.status,
      hasCatalogueData: !!body.catalogueData,
      hasEgData: !!body.egData,
      hasApplicationData: !!body.applicationData,
    });

    // Forward auth header if present
    const authHeader = getAuthHeader(request);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) headers.Authorization = authHeader;

    // Forward to backend API
    const backendResponse = await fetch(`${NEXT_PUBLIC_API_URL}/cases/create`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    console.log("Backend response status:", backendResponse.status);

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error("Backend API error:", errorText);

      // Surface the backend's own reason (e.g. "Case 2001P already exists in
      // tranche T13") instead of a bare status text.
      let reason = backendResponse.statusText || "Failed to create case";
      try {
        const parsed = JSON.parse(errorText);
        const msg = parsed?.message ?? parsed?.error;
        if (Array.isArray(msg)) reason = msg.join("; ");
        else if (typeof msg === "string" && msg.trim()) reason = msg;
      } catch {
        if (errorText.trim()) reason = errorText.slice(0, 300);
      }

      return NextResponse.json(
        { success: false, error: reason } as CreateCaseResponse,
        { status: backendResponse.status },
      );
    }

    const result = await backendResponse.json();

    return NextResponse.json({
      success: true,
      caseId: result.id || result.caseId,
      message: "Case created successfully",
      ...result,
    } as CreateCaseResponse);
  } catch (error) {
    console.error("Error creating case:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create case",
      } as CreateCaseResponse,
      { status: 500 },
    );
  }
}
