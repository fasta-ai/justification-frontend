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
    const { backendUrl, ...body } = await request.json();
    const url = request.nextUrl.searchParams.get("url");

    if (!backendUrl && !url) {
      return NextResponse.json(
        { error: "Missing backend URL" },
        { status: 400 },
      );
    }

    const finalUrl = backendUrl || url;

    // Get auth token from request headers or cookies
    const authToken = getAuthHeader(request);

    const fetchOptions: RequestInit = {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    // Forward auth token
    if (authToken) {
      (fetchOptions.headers as Record<string, string>).Authorization =
        authToken;
    }

    // Forward body for POST/PUT requests
    if (Object.keys(body).length > 0) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(finalUrl, fetchOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: errorData.error || `Backend error: ${response.statusText}`,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "Missing URL parameter" },
        { status: 400 },
      );
    }

    const authToken = getAuthHeader(request);

    const fetchOptions: RequestInit = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (authToken) {
      (fetchOptions.headers as Record<string, string>).Authorization =
        authToken;
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: errorData.error || `Backend error: ${response.statusText}`,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
