import { NextRequest, NextResponse } from "next/server";
import { NEXT_PUBLIC_API_URL } from "@/lib/utils";
import type { SaveCaseDataDto, SaveCaseDataResponse } from "../../types";

function getAuthHeader(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization");
  if (header) return header;
  const accessToken = request.cookies.get("accessToken")?.value;
  if (accessToken) return `Bearer ${accessToken}`;
  return undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    console.log("Received request to save case data for case ID:", id);
    const body: SaveCaseDataDto = await request.json();

    // Validate that at least one data type is provided
    if (!body.egData && !body.catalogueData && !body.applicationData) {
      return NextResponse.json(
        {
          success: false,
          error:
            "At least one of egData, catalogueData, or applicationData must be provided",
        } as SaveCaseDataResponse,
        { status: 400 },
      );
    }

    console.log(`Saving case ${id} data:`, {
      hasEgData: !!body.egData,
      hasCatalogueData: !!body.catalogueData,
      hasApplicationData: !!body.applicationData,
      categoryId: body.categoryId,
      recdEG: body.recdEG,
    });

    // Forward request to NestJS backend
    const authHeader = getAuthHeader(request);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) headers.Authorization = authHeader;

    const response = await fetch(`${NEXT_PUBLIC_API_URL}/cases/${id}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Backend error:", data);
      return NextResponse.json(
        {
          success: false,
          error: data.message || "Failed to save case data",
        } as SaveCaseDataResponse,
        { status: response.status },
      );
    }

    console.log("Case data saved successfully:", data);

    return NextResponse.json(
      {
        success: true,
        case: data,
        message: "Case data saved successfully",
      } as SaveCaseDataResponse,
      { status: 200 },
    );
  } catch (error) {
    console.error("Error saving case data:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to save case data",
      } as SaveCaseDataResponse,
      { status: 500 },
    );
  }
}
