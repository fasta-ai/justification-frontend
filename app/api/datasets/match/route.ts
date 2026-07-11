import { NEXT_PUBLIC_API_URL } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

function getAuthHeader(request: NextRequest): string | undefined {
  const header = request.headers.get("Authorization") || request.headers.get("authorization");
  if (header) return header;
  const accessToken = request.cookies.get("accessToken")?.value;
  if (accessToken) return `Bearer ${accessToken}`;
  return undefined;
}

/**
 * Proxy for the tiered similar-case endpoint on the NestJS backend.
 * Body: { productName, modelNo?, brand?, elaborate?, category?, datasetName?, datasetType?, limit? }
 * Returns: { tier, matches, stats } — see backend TieredMatchQueryDto.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body?.productName) {
      return NextResponse.json(
        { error: "Missing required field: productName" },
        { status: 400 },
      );
    }

    const authHeader = getAuthHeader(request);
    const endpoint = `${NEXT_PUBLIC_API_URL}/datasets/match`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) headers.Authorization = authHeader;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}`, details: errorData },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to fetch tiered matches",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
