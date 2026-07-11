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

    // Forward to backend API
    const backendFormData = new FormData();
    backendFormData.append("file", file, file.name);
    console.log("PYTHON_BACKEND_URL", PYTHON_BACKEND_URL);

    const authHeader = getAuthHeader(request);
    const headers: Record<string, string> = {};
    if (authHeader) headers.Authorization = authHeader;

    const backendResponse = await fetch(
      `${NEXT_PUBLIC_API_URL}/api/extraction/extract-application`,
      {
        method: "POST",
        headers,
        body: backendFormData,
      },
    );

    console.log("Backend response status:", backendResponse);

    if (!backendResponse.ok) {
      throw new Error(`Backend API error: ${backendResponse.statusText}`);
    }

    const result = await backendResponse.text();
    const parsedData = JSON.parse(result);

    return Response.json(parsedData);
  } catch (error) {
    console.error("Error in application extraction:", error);
    return Response.json(
      { error: "Failed to extract application data" },
      { status: 500 },
    );
  }
}
