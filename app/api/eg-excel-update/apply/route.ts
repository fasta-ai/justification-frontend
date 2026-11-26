import { NEXT_PUBLIC_API_URL } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

/**
 * Confirm an EG Excel update. The backend re-verifies the file, takes a
 * fallback snapshot, and applies accepted rows in one transaction.
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
          applied: false,
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
      `${NEXT_PUBLIC_API_URL}/eg-excel-update/apply`,
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
    console.error("Error applying EG Excel update:", error);
    return NextResponse.json(
      {
        applied: false,
        message:
          "The update did not apply and existing data is unchanged.",
      },
      { status: 500 },
    );
  }
}
