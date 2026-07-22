import { NEXT_PUBLIC_API_URL } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

function getAuthHeader(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization");
  if (header) return header;
  const accessToken = request.cookies.get("accessToken")?.value;
  if (accessToken) return `Bearer ${accessToken}`;
  return undefined;
}

function backendHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const auth = getAuthHeader(request);
  if (auth) headers.Authorization = auth;
  return headers;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const backendResponse = await fetch(`${NEXT_PUBLIC_API_URL}/staff/${id}`, {
      method: "PATCH",
      headers: backendHeaders(request),
      body: JSON.stringify(body),
    });
    const data = await backendResponse.json();
    if (!backendResponse.ok) {
      return NextResponse.json(
        { success: false, error: data?.message || backendResponse.statusText },
        { status: backendResponse.status },
      );
    }
    return NextResponse.json({ success: true, staff: data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update staff",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const backendResponse = await fetch(`${NEXT_PUBLIC_API_URL}/staff/${id}`, {
      method: "DELETE",
      headers: backendHeaders(request),
    });
    if (!backendResponse.ok) {
      const text = await backendResponse.text();
      return NextResponse.json(
        { success: false, error: text || backendResponse.statusText },
        { status: backendResponse.status },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete staff",
      },
      { status: 500 },
    );
  }
}
