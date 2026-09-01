import { NEXT_PUBLIC_API_URL } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

function getAuthHeader(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization");
  if (header) return header;
  const accessToken = request.cookies.get("accessToken")?.value;
  if (accessToken) return `Bearer ${accessToken}`;
  return undefined;
}

/**
 * Second-pass extraction: rule-based values reconciled with a Gemini opinion on
 * the fields the parser reads unreliably (beneficiary counts, professional
 * staff). Slower than /api/extract/application because of the model call, so
 * the client fires it in the background once the fast result is already shown.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const backendFormData = new FormData();
    backendFormData.append("file", file, file.name);

    const authHeader = getAuthHeader(request);
    const headers: Record<string, string> = {};
    if (authHeader) headers.Authorization = authHeader;

    const backendResponse = await fetch(
      `${NEXT_PUBLIC_API_URL}/api/extraction/extract-application-ai-review`,
      {
        method: "POST",
        headers,
        body: backendFormData,
      },
    );

    if (!backendResponse.ok) {
      throw new Error(`Backend API error: ${backendResponse.statusText}`);
    }

    return Response.json(await backendResponse.json());
  } catch (error) {
    console.error("Error in application AI review:", error);
    return Response.json(
      { error: "Failed to AI-review application data" },
      { status: 500 },
    );
  }
}
