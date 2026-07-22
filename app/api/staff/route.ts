import { NEXT_PUBLIC_API_URL } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export interface Staff {
  id: string;
  name: string;
  position: string;
  phone: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffResponse {
  success: boolean;
  staff?: Staff[];
  error?: string;
}

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

export async function GET(request: NextRequest) {
  try {
    // Ask backend for a big flat list. The controller already applies a
    // default sort by name ASC, so we only need to bump the page size.
    const url = `${NEXT_PUBLIC_API_URL}/staff?limit=500`;
    const backendResponse = await fetch(url, {
      method: "GET",
      headers: backendHeaders(request),
    });

    if (!backendResponse.ok) {
      const text = await backendResponse.text();
      return NextResponse.json(
        {
          success: false,
          error: `Backend API error: ${backendResponse.status} ${backendResponse.statusText} ${text}`,
        } as StaffResponse,
        { status: backendResponse.status },
      );
    }

    const raw = await backendResponse.text();
    let body: any = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: `Backend returned non-JSON response: ${raw.slice(0, 500)}`,
        } as StaffResponse,
        { status: 502 },
      );
    }
    // @dataui/crud returns either an array (alwaysPaginate:false, no limit) or { data, count, ... }
    const staff: Staff[] = Array.isArray(body) ? body : (body?.data ?? []);
    return NextResponse.json({ success: true, staff } as StaffResponse);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch staff",
      } as StaffResponse,
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendResponse = await fetch(`${NEXT_PUBLIC_API_URL}/staff`, {
      method: "POST",
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
    return NextResponse.json({ success: true, staff: [data] } as StaffResponse);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create staff",
      },
      { status: 500 },
    );
  }
}
