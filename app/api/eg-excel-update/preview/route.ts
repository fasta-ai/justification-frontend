import { NEXT_PUBLIC_API_URL } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

/**
 * Preview an EG Excel update. The backend verifies the file and returns a
 * preview. Nothing is written and no snapshot is taken.
 */

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
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          applicable: false,
          reason:
            "The file is not applicable. No Excel file was uploaded.",
        },
        { status: 400 },
      );
    }

    const backendFormData = new FormData();
    backendFormData.append("file", file, file.name);

    const authHeader = getAuthHeader(request);
    const headers: Record<string, string> = {};
    if (authHeader) headers.Authorization = authHeader;

    const backendResponse = await fetch(
      `${NEXT_PUBLIC_API_URL}/eg-excel-update/preview`,
      { method: "POST", headers, body: backendFormData },
    );

    const text = await backendResponse.text();
    let body: unknown = { raw: text };
    try {
      body = JSON.parse(text);
    } catch {
      // keep raw
    }
    return NextResponse.json(body, { status: backendResponse.status });
  } catch (error) {
    console.error("Error previewing EG Excel update:", error);
    return NextResponse.json(
      {
        applicable: false,
        reason:
          "The file is not applicable. The preview request failed before any data could be checked.",
      },
      { status: 500 },
    );
  }
}
