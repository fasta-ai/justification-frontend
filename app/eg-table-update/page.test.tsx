import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "./page";

const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  usePathname: () => "/eg-table-update",
}));

vi.mock("@/components/protected-route", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/header", () => ({
  Header: () => <header data-testid="header">Header</header>,
}));

vi.mock("@/components/sidebar", () => ({
  Sidebar: () => <aside data-testid="sidebar">Sidebar</aside>,
}));

const previewOk = {
  applicable: true,
  sourceFileName: "A_EG_Form.xlsx",
  sheetName: "A_EG_Form",
  acceptedRows: [
    {
      excelRowNumber: 2,
      matchKey: {
        Ref: "T12_SWD/RMB/I&TF/1001P",
        Tranche: "T12",
        EB_RM: "RMB",
        NO: 1001,
        NO_R: "P",
      },
      changes: [
        {
          field: "Q12b_Jus",
          oldValue: "Old",
          newValue: "Updated justification from Excel.",
        },
      ],
    },
  ],
  unmatchedRows: [
    {
      excelRowNumber: 3,
      matchKey: {
        Ref: "T12_SWD/RMB/I&TF/9999P",
        Tranche: "T12",
        EB_RM: "RMB",
        NO: 9999,
        NO_R: "P",
      },
      issues: [
        "No matching existing EG form was found. This row will not be inserted as a new case.",
      ],
      kind: "unmatched",
    },
  ],
  issueRows: [
    {
      excelRowNumber: 4,
      matchKey: { Ref: "T12_SWD/RMB/I&TF/1002P", NO: 1002 },
      issues: ["D_ReqF_SWD is not a valid Excel date"],
      kind: "invalid",
    },
  ],
  summary: { totalDataRows: 3, accepted: 1, unmatched: 1, issues: 1 },
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("Update EG forms from Excel page", () => {
  let fetchMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/eg-excel-update/batches") && !url.includes("rollback")) {
        return jsonResponse({ batches: [] });
      }
      return jsonResponse({ error: "unexpected" }, 500);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  async function uploadAndCheck(fileName = "A_EG_Form.xlsx") {
    const user = userEvent.setup();
    render(<Page />);
    const file = new File(["dummy"], fileName, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = await screen.findByLabelText("EG Excel file");
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: "Check file" }));
    return user;
  }

  it("shows a plain-language not-applicable notice and does not offer a preview", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/eg-excel-update/preview")) {
        return jsonResponse({
          applicable: false,
          code: "missing_headers",
          reason:
            "The file is not applicable. Required headers are missing or do not match: Q12b_Jus. No records were changed.",
        });
      }
      return jsonResponse({ batches: [] });
    });

    await uploadAndCheck("wrong-headers.xlsx");

    expect(
      await screen.findByText("This file is not applicable"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Required headers are missing or do not match/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Rows to update")).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("/api/eg-excel-update/apply"),
      ),
    ).toBe(false);
  });

  it("shows a preview after a valid file and does not write until confirm", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/eg-excel-update/preview")) {
        return jsonResponse(previewOk);
      }
      return jsonResponse({ batches: [] });
    });

    await uploadAndCheck();

    expect(await screen.findByText("Preview")).toBeInTheDocument();
    expect(screen.getByText(/Format accepted/)).toBeInTheDocument();
    expect(screen.getByText(/No data has been written yet/)).toBeInTheDocument();
    expect(screen.getByText(/Updated justification from Excel/)).toBeInTheDocument();
    expect(screen.getByText(/will not be inserted/)).toBeInTheDocument();
    expect(screen.getByText(/not a valid Excel date/)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("/api/eg-excel-update/apply"),
      ),
    ).toBe(false);
  });

  it("writes nothing when the preview is cancelled", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/eg-excel-update/preview")) {
        return jsonResponse(previewOk);
      }
      return jsonResponse({ batches: [] });
    });

    const user = await uploadAndCheck();
    expect(await screen.findByText("Preview")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Rows to update")).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("/api/eg-excel-update/apply"),
      ),
    ).toBe(false);
  });

  it("applies the update on confirm and shows a success summary", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/eg-excel-update/preview")) {
        return jsonResponse(previewOk);
      }
      if (url.endsWith("/api/eg-excel-update/apply")) {
        expect(init?.method).toBe("POST");
        return jsonResponse({
          applied: true,
          applicable: true,
          message: "Update applied. 1 record(s) were updated.",
          batchId: "batch-1",
          updatedCount: 1,
          unmatchedCount: 1,
          issueCount: 1,
          snapshotStored: true,
        });
      }
      if (url.includes("/api/eg-excel-update/batches")) {
        return jsonResponse({
          batches: [
            {
              id: "batch-1",
              createdAt: "2026-11-19T03:00:00.000Z",
              sourceFileName: "A_EG_Form.xlsx",
              status: "applied",
              updatedCount: 1,
              userName: "Argus Chan",
            },
          ],
        });
      }
      return jsonResponse({ error: "unexpected" }, 500);
    });

    const user = await uploadAndCheck();
    expect(await screen.findByText("Preview")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm update" }));

    expect(await screen.findByText("Update applied")).toBeInTheDocument();
    expect(
      screen.getByText(/1 record\(s\) were updated/),
    ).toBeInTheDocument();
    expect(screen.getByText(/fallback snapshot has been stored/i)).toBeInTheDocument();
    expect(await screen.findByText("A_EG_Form.xlsx")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Roll back" })).toBeInTheDocument();
  });

  it("tells the client when a confirmed update did not apply", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/eg-excel-update/preview")) {
        return jsonResponse(previewOk);
      }
      if (url.endsWith("/api/eg-excel-update/apply")) {
        return jsonResponse({
          applied: false,
          applicable: true,
          message:
            "The update did not apply and existing data is unchanged.",
          intact: true,
          snapshotStored: false,
        });
      }
      return jsonResponse({ batches: [] });
    });

    const user = await uploadAndCheck();
    await screen.findByText("Preview");
    await user.click(screen.getByRole("button", { name: "Confirm update" }));

    expect(await screen.findByText("The update did not apply")).toBeInTheDocument();
    expect(
      screen.getByText(/existing data is unchanged/i),
    ).toBeInTheDocument();
  });

  it("can roll back a stored batch after confirmation", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/eg-excel-update/batches")) {
        return jsonResponse({
          batches: [
            {
              id: "batch-1",
              createdAt: "2026-11-19T03:00:00.000Z",
              sourceFileName: "A_EG_Form.xlsx",
              status: "applied",
              updatedCount: 1,
              userName: "Argus Chan",
            },
          ],
        });
      }
      if (url.endsWith("/api/eg-excel-update/batches/batch-1/rollback")) {
        expect(init?.method).toBe("POST");
        return jsonResponse({
          rolledBack: true,
          batchId: "batch-1",
          restoredCount: 1,
          message:
            "Batch rolled back. 1 record(s) were restored to their pre-update values.",
          rollbackRecorded: true,
        });
      }
      return jsonResponse({ error: "unexpected" }, 500);
    });

    const user = userEvent.setup();
    render(<Page />);
    const rollback = await screen.findByRole("button", { name: "Roll back" });
    await user.click(rollback);
    expect(
      await screen.findByText("Roll back this update?"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm roll back" }));
    expect(
      await screen.findByText(/restored to their pre-update values/),
    ).toBeInTheDocument();
  });
});
