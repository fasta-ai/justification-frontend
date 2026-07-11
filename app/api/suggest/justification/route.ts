import { NEXT_PUBLIC_API_URL, PYTHON_BACKEND_URL } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

function getAuthHeader(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization");
  if (header) return header;
  const accessToken = request.cookies.get("accessToken")?.value;
  if (accessToken) return `Bearer ${accessToken}`;
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { similar_matches, current_case, application_data, action } = body;

    if (!current_case) {
      return NextResponse.json(
        { error: "Missing required field: current_case" },
        { status: 400 },
      );
    }

    // Get backend URL from environment variable
    const backendUrl = PYTHON_BACKEND_URL;
    const endpoint = `${NEXT_PUBLIC_API_URL}/api/extraction/suggest-justification`;

    const authHeader = getAuthHeader(request);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) headers.Authorization = authHeader;

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        similar_matches: similar_matches || [],
        current_case: current_case,
        application_data: application_data || {},
        action: action,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: `Backend error: ${response.statusText}`,
          details: errorData,
        },
        { status: response.status },
      );
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Justification suggestion API error:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to generate justification suggestion",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
