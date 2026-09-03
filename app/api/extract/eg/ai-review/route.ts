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
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Forward to backend API.
    // Only copy a field when it actually has a value: `formData.get()` returns
    // null for a missing field, and appending that forwards the literal string
    // "null", which the extractor would treat as a real tranche/season.
    const backendFormData = new FormData();
    backendFormData.append("file", file, file.name);

    for (const field of ["tranche", "season"] as const) {
      const value = formData.get(field);
      if (typeof value === "string" && value.trim()) {
        backendFormData.append(field, value);
      }
    }

    const authHeader = getAuthHeader(request);
    const headers: Record<string, string> = {};
    if (authHeader) headers.Authorization = authHeader;

    const backendResponse = await fetch(
      `${NEXT_PUBLIC_API_URL}/api/extraction/extract-eg-ai-review`,
      {
        method: "POST",
        headers,
        body: backendFormData,
      },
    );

    if (!backendResponse.ok) {
      throw new Error(`Backend API error: ${backendResponse.statusText}`);
    }

    const result = await backendResponse.text();
    const parsedData = JSON.parse(result);

    return Response.json(parsedData);
  } catch (error) {
    console.error("Error in EG AI review:", error);
    return Response.json(
      { error: "Failed to AI-review EG form data" },
      { status: 500 },
    );
  }
}
