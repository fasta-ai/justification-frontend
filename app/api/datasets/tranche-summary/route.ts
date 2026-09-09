import { NEXT_PUBLIC_API_URL } from "@/lib/utils";
import { normaliseCaseNo, normaliseToken } from "@/lib/case-import/normalise";
import { NextRequest, NextResponse } from "next/server";

/**
 * How many corpus rows already exist per tranche.
 *
 * This is what stops the most likely operator error — re-importing a tranche
 * that is already loaded and doubling it. The corpus rows created before this
 * feature have no stable key, so the check is necessarily by tranche rather
 * than per case.
 *
 * Rows written before this feature carry no `sourceKey`, so their key is
 * reconstructed from the same four columns the join uses. That makes the
 * duplicate check work against the whole existing corpus rather than only
 * against rows this feature wrote.
 */

const CORPUS_TASK = "Justification Creation";
const CORPUS_TYPE = "justification-data";
const PAGE_SIZE = 500;

function getAuthHeader(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization");
  if (header) return header;
  const accessToken = request.cookies.get("accessToken")?.value;
  if (accessToken) return `Bearer ${accessToken}`;
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = getAuthHeader(request);
    const headers: Record<string, string> = {};
    if (authHeader) headers.Authorization = authHeader;

    const counts: Record<string, number> = {};
    const knownKeys = new Set<string>();
    let total = 0;
    let page = 1;

    // @dataui/crud paginates; walk it rather than asking for everything at
    // once. The corpus is a few thousand rows, so this is a handful of calls.
    for (;;) {
      const url =
        `${NEXT_PUBLIC_API_URL}/datasets` +
        `?filter=task||$eq||${encodeURIComponent(CORPUS_TASK)}` +
        `&filter=type||$eq||${encodeURIComponent(CORPUS_TYPE)}` +
        `&fields=id,metadata&limit=${PAGE_SIZE}&page=${page}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        return NextResponse.json(
          {
            error: `Backend returned ${response.status} listing the corpus`,
            counts: {},
            total: 0,
            knownKeys: [],
          },
          { status: response.status },
        );
      }

      const payload = await response.json();
      const rows: { metadata?: Record<string, any> }[] = Array.isArray(payload)
        ? payload
        : (payload?.data ?? []);

      for (const row of rows) {
        total++;
        const metadata = row?.metadata ?? {};
        const tranche = normaliseToken(metadata.Tranche);
        const bucket = tranche || "(untagged)";
        counts[bucket] = (counts[bucket] ?? 0) + 1;

        const stored = metadata.sourceKey;
        if (typeof stored === "string" && stored) {
          knownKeys.add(stored);
          continue;
        }
        // Pre-existing row: rebuild the key the join would have produced.
        const no = normaliseCaseNo(metadata.NO);
        if (tranche && no) {
          knownKeys.add(
            `${tranche}|${normaliseToken(metadata.EB_RM)}|${no}${normaliseToken(metadata.NO_R)}`,
          );
        }
      }

      if (rows.length < PAGE_SIZE) break;
      page++;
      if (page > 40) break; // 20k rows; a guard, not an expected path
    }

    return NextResponse.json({ counts, total, knownKeys: [...knownKeys] });
  } catch (error) {
    console.error("Error reading corpus tranche summary:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to read corpus summary",
        counts: {},
        total: 0,
        knownKeys: [],
      },
      { status: 500 },
    );
  }
}
