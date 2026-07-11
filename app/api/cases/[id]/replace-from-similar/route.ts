import { NextRequest, NextResponse } from "next/server";
import { NEXT_PUBLIC_API_URL } from "@/lib/utils";
import type {
  ReplaceFromSimilarDto,
  ReplaceFromSimilarResponse,
} from "../../types";

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
    const body: ReplaceFromSimilarDto = await request.json();

    if (!body?.sourceDatasetId || !Array.isArray(body?.replacements)) {
      return NextResponse.json(
        { success: false, error: "Missing sourceDatasetId or replacements" },
        { status: 400 },
      );
    }

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
      `${NEXT_PUBLIC_API_URL}/cases/${id}/replace-from-similar`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          sourceDatasetId: body.sourceDatasetId,
          replacements: body.replacements,
        }),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.message || "Failed to replace case fields",
        } as ReplaceFromSimilarResponse,
        { status: response.status },
      );
    }

    return NextResponse.json(
      { success: true, case: data } as ReplaceFromSimilarResponse,
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to replace case fields",
      } as ReplaceFromSimilarResponse,
      { status: 500 },
    );
  }
}
