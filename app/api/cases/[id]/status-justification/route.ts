import { NextRequest, NextResponse } from "next/server";
import { NEXT_PUBLIC_API_URL } from "@/lib/utils";

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
    const body = await request.json();

    console.log(`Updating case ${id} status and justification:`, body);

    // Validate status if provided
    if (body.status && !["approved", "rejected"].includes(body.status)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid status. Must be 'approved' or 'rejected'",
        },
        { status: 400 },
      );
    }
    // body.id = id;

    // Forward request to NestJS backend
    const authHeader = getAuthHeader(request);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) headers.Authorization = authHeader;

    const response = await fetch(
      `${NEXT_PUBLIC_API_URL}/cases/${id}/status-justification`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();

    console.log("Backend response for case update:", data);

    if (!response.ok) {
      console.error("Backend error:", data);
      return NextResponse.json(
        {
          success: false,
          error: data.message || "Failed to update case",
        },
        { status: response.status },
      );
    }

    console.log("Case updated successfully:", data);

    return NextResponse.json(
      {
        success: true,
        case: data,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating case status and justification:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update case status and justification",
      },
      { status: 500 },
    );
  }
}
