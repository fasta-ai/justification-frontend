import { NEXT_PUBLIC_API_URL } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

function getAuthHeader(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization");
  if (header) return header;
  const accessToken = request.cookies.get("accessToken")?.value;
  if (accessToken) return `Bearer ${accessToken}`;
  return undefined;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const authHeader = getAuthHeader(request);
    const headers: Record<string, string> = {};
    if (authHeader) headers.Authorization = authHeader;

    const backendResponse = await fetch(
      `${NEXT_PUBLIC_API_URL}/eg-excel-update/batches/${encodeURIComponent(id)}/rollback`,
      { method: "POST", headers },
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
    console.error("Error rolling back EG Excel update batch:", error);
    return NextResponse.json(
      { error: "Failed to roll back the batch" },
      { status: 500 },
    );
  }
}
