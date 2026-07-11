import { NEXT_PUBLIC_API_URL } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import type { GetCasesResponse, CaseFilters } from "./types";

function getAuthHeader(request: NextRequest): string | undefined {
  const header = request.headers.get("authorization");
  if (header) return header;
  const accessToken = request.cookies.get("accessToken")?.value;
  if (accessToken) return `Bearer ${accessToken}`;
  return undefined;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Build query parameters
        const filters: CaseFilters = {};

        const status = searchParams.get('status');
        const caseNumber = searchParams.get('caseNumber');
        const recdEG = searchParams.get('recdEG');
        const categoryId = searchParams.get('categoryId');
        const userId = searchParams.get('userId');

        if (status) filters.status = status as any;
        if (caseNumber) filters.caseNumber = caseNumber;
        if (recdEG !== null) filters.recdEG = recdEG === 'true';
        if (categoryId) filters.categoryId = categoryId;
        if (userId) filters.userId = userId;

        // Build query string for backend
        const queryString = new URLSearchParams(
            Object.entries(filters).reduce((acc, [key, value]) => {
                if (value !== undefined) {
                    acc[key] = String(value);
                }
                return acc;
            }, {} as Record<string, string>)
        ).toString();

        const url = `${NEXT_PUBLIC_API_URL}/cases${queryString ? `?${queryString}` : ''}`;

        console.log("Fetching cases from:", url);

        // Forward auth header if present
        const authHeader = getAuthHeader(request);
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (authHeader) headers.Authorization = authHeader;

        // Forward to backend API
        const backendResponse = await fetch(url, {
            method: "GET",
            headers,
        });

        console.log("Backend response status:", backendResponse.status);

        if (!backendResponse.ok) {
            const errorText = await backendResponse.text();
            console.error("Backend API error:", errorText);

            return NextResponse.json(
                {
                    success: false,
                    error: `Backend API error: ${backendResponse.statusText}`
                } as GetCasesResponse,
                { status: backendResponse.status }
            );
        }

        const cases = await backendResponse.json();

        console.log(`Fetched ${Array.isArray(cases) ? cases.length : 0} cases`);

        return NextResponse.json({
            success: true,
            cases: Array.isArray(cases) ? cases : [],
        } as GetCasesResponse);

    } catch (error) {
        console.error("Error fetching cases:", error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch cases"
            } as GetCasesResponse,
            { status: 500 }
        );
    }
}
