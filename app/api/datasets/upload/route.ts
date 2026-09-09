import { NEXT_PUBLIC_API_URL } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

/**
 * Commit a batch of previous cases into the corpus.
 *
 * Forwards to the backend's `POST /datasets/import-cases`, which applies the
 * import rules again on its side — a case must come from every required
 * register, must carry a product name and a decision, and is deduplicated on
 * `sourceKey`. The checks on this page are for the person doing the import;
 * the backend's are the ones that actually protect the corpus.
 *
 * Sent one chunk per request rather than a whole tranche: the backend embeds
 * row by row in-process, and a 360-row payload would outrun any sane timeout.
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
    const body = await request.json();
    const { task, type, embeddingFields, requiredRegisters, rows } = body ?? {};

    if (!task || !type) {
      return NextResponse.json(
        { error: "task and type are required" },
        { status: 400 },
      );
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "rows must be a non-empty array" },
        { status: 400 },
      );
    }

    const authHeader = getAuthHeader(request);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) headers.Authorization = authHeader;

    const backendResponse = await fetch(
      `${NEXT_PUBLIC_API_URL}/datasets/import-cases`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          task,
          type,
          embeddingFields,
          requiredRegisters,
          rows,
        }),
      },
    );

    const text = await backendResponse.text();
    if (!backendResponse.ok) {
      return NextResponse.json(
        {
          error: `Backend rejected the chunk (${backendResponse.status})`,
          detail: text.slice(0, 500),
        },
        { status: backendResponse.status },
      );
    }

    return NextResponse.json(JSON.parse(text));
  } catch (error) {
    console.error("Error committing import chunk:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to commit import chunk",
      },
      { status: 500 },
    );
  }
}
