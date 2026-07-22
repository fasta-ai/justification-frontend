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
 * Proxy for the Nest "latest generation" prefill endpoint. The modal calls
 * this on open (and whenever seed / decision changes) so the reviewer sees
 * the last AI result they had for that exact (case, action, seed) instead
 * of a blank textarea.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await params;
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const seedDatasetId = url.searchParams.get("seedDatasetId") || "none";

    if (!caseId) {
      return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
    }
    if (action !== "approved" && action !== "rejected") {
      return NextResponse.json(
        { error: "action must be 'approved' or 'rejected'" },
        { status: 400 },
      );
    }

    const qs = new URLSearchParams({ action, seedDatasetId });
    const endpoint = `${NEXT_PUBLIC_API_URL}/api/extraction/generations/${encodeURIComponent(
      caseId,
    )}/latest?${qs.toString()}`;

    const authHeader = getAuthHeader(request);
    const headers: Record<string, string> = {};
    if (authHeader) headers.Authorization = authHeader;

    const response = await fetch(endpoint, { headers });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: `Backend error: ${response.statusText}`,
          details,
        },
        { status: response.status },
      );
    }
    // Nest returns `null` (empty body) when no cached generation exists.
    // A blank body makes response.json() throw, so read as text first and
    // treat "" as an explicit null. The modal handles null as "nothing
    // cached, keep the blank / stored fallback".
    const raw = await response.text();
    if (!raw) return NextResponse.json(null);
    try {
      return NextResponse.json(JSON.parse(raw));
    } catch {
      return NextResponse.json(null);
    }
  } catch (error) {
    console.error("Latest-generation prefill error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch latest generation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
