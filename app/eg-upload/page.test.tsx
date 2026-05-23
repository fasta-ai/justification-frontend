import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EGUploadPage from "./page";

// ── Mocks ──

const mockPush = vi.fn();
const mockBack = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  usePathname: () => "/eg-upload",
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockRefetch = vi.fn();
let mockCases: Array<{
  id: string;
  caseNumber: string;
  status: string;
  tranche?: string;
  season?: string;
  egData?: { data?: Record<string, unknown> };
}> = [];
let mockCasesLoading = false;

vi.mock("@/hooks/use-get-cases", () => ({
  useGetCases: () => ({
    cases: mockCases,
    isLoading: mockCasesLoading,
    refetch: mockRefetch,
  }),
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

// Mock Radix Select to a native select for testability
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, ...props }: any) => (
    <select
      value={value || ""}
      onChange={(e) => onValueChange?.(e.target.value)}
      data-testid={props["data-testid"] || "select"}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => (
    <option value="">{placeholder}</option>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => (
    <option value={value}>{children}</option>
  ),
}));

// Mock fetch globally
global.fetch = vi.fn();

// ── Helpers ──

function createFile(name: string, size: number, type: string): File {
  const blob = new Blob(["x".repeat(size)], { type });
  return new File([blob], name, { type });
}

function uploadFile(input: HTMLElement, file: File) {
  fireEvent.change(input, { target: { files: [file] } });
}

function setupFetchResponse(response: {
  ok: boolean;
  status?: number;
  json?: unknown;
  text?: string;
}) {
  (global.fetch as Mock).mockResolvedValueOnce({
    ok: response.ok,
    status: response.status ?? 200,
    json: async () => response.json ?? {},
    text: async () => response.text ?? "",
  });
}

// ── Tests ──

describe("EG Upload Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCases = [
      {
        id: "case-1",
        caseNumber: "CASE-001",
        status: "pending",
        tranche: "T12",
        season: "2025",
        egData: { data: { Tranche: "T12", Season: "2025" } },
      },
      {
        id: "case-2",
        caseNumber: "CASE-002",
        status: "approved",
        tranche: "T11",
        season: "2024",
      },
    ];
    mockCasesLoading = false;
  });

  describe("rendering", () => {
    it("renders page header and sections", () => {
      render(<EGUploadPage />);
      expect(
        screen.getByRole("heading", { name: /EG Table Upload & Replace/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/1\. Select Case/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. Upload New EG File/i)).toBeInTheDocument();
      expect(
        screen.getByText(/3\. Extracted Data Preview/i)
      ).toBeInTheDocument();
    });

    it("shows loading state when cases are loading", () => {
      mockCasesLoading = true;
      render(<EGUploadPage />);
      expect(screen.getByTestId("cases-loading")).toBeInTheDocument();
      expect(screen.getByText(/Loading cases/i)).toBeInTheDocument();
    });

    it("shows empty state when no cases exist", () => {
      mockCases = [];
      render(<EGUploadPage />);
      expect(screen.getByTestId("no-cases")).toBeInTheDocument();
    });
  });

  describe("case selection", () => {
    it("displays case options in dropdown", () => {
      render(<EGUploadPage />);

      const select = screen.getByTestId("case-select");
      expect(select).toBeInTheDocument();
      expect(screen.getByText("CASE-001 — pending")).toBeInTheDocument();
      expect(screen.getByText("CASE-002 — approved")).toBeInTheDocument();
    });

    it("shows case details when a case is selected", async () => {
      const user = userEvent.setup();
      render(<EGUploadPage />);

      const select = screen.getByTestId("case-select");
      await user.selectOptions(select, "case-1");

      expect(screen.getByText(/Case Number:/i)).toBeInTheDocument();
      // Use getAllByText since CASE-001 appears in both select and detail panel
      expect(screen.getAllByText(/CASE-001/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Existing EG Data:/i)).toBeInTheDocument();
    });

    it("auto-populates tranche and season from selected case", async () => {
      const user = userEvent.setup();
      render(<EGUploadPage />);

      const select = screen.getByTestId("case-select");
      await user.selectOptions(select, "case-1");

      // Tranche and season inputs should NOT show since they're populated from case
      await waitFor(() => {
        expect(
          screen.queryByPlaceholderText(/e\.g\. T12/i)
        ).not.toBeInTheDocument();
      });
    });

    it("shows tranche/season inputs when case lacks them", async () => {
      mockCases = [
        { id: "case-3", caseNumber: "CASE-003", status: "pending" },
      ];
      const user = userEvent.setup();
      render(<EGUploadPage />);

      const select = screen.getByTestId("case-select");
      await user.selectOptions(select, "case-3");

      expect(screen.getByPlaceholderText(/e\.g\. T12/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. 2025/i)).toBeInTheDocument();
    });
  });

  describe("file validation", () => {
    it("rejects files with invalid extension", () => {
      render(<EGUploadPage />);

      const fileInput = screen.getByTestId("file-input");
      const badFile = createFile("test.pdf", 1000, "application/pdf");
      uploadFile(fileInput, badFile);

      expect(
        screen.getByText(/Invalid file type\. Supported: \.doc, \.docx/i)
      ).toBeInTheDocument();
    });

    it("rejects files larger than 10MB", () => {
      render(<EGUploadPage />);

      const fileInput = screen.getByTestId("file-input");
      const bigFile = createFile(
        "test.docx",
        11 * 1024 * 1024,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      uploadFile(fileInput, bigFile);

      expect(
        screen.getByText(/File too large\. Maximum size: 10MB/i)
      ).toBeInTheDocument();
    });

    it("accepts valid .docx files", () => {
      render(<EGUploadPage />);

      const fileInput = screen.getByTestId("file-input");
      const goodFile = createFile(
        "test.docx",
        1000,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      uploadFile(fileInput, goodFile);

      expect(screen.getByText(/test\.docx/i)).toBeInTheDocument();
      expect(screen.getByText(/1000\.0 B/i)).toBeInTheDocument();
      expect(
        screen.queryByText(/Invalid file type/i)
      ).not.toBeInTheDocument();
    });
  });

  describe("extraction flow", () => {
    it("disables extract button when no case is selected", () => {
      render(<EGUploadPage />);

      const fileInput = screen.getByTestId("file-input");
      const goodFile = createFile(
        "test.docx",
        1000,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      uploadFile(fileInput, goodFile);

      const extractBtn = screen.getByTestId("extract-btn");
      expect(extractBtn).toBeDisabled();
      expect(global.fetch as Mock).not.toHaveBeenCalled();
    });

    it("shows error when tranche is empty", async () => {
      mockCases = [
        { id: "case-3", caseNumber: "CASE-003", status: "pending" },
      ];
      const user = userEvent.setup();
      render(<EGUploadPage />);

      // Select case without tranche
      const select = screen.getByTestId("case-select");
      await user.selectOptions(select, "case-3");

      // Fill in file
      const fileInput = screen.getByTestId("file-input");
      const goodFile = createFile(
        "test.docx",
        1000,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      uploadFile(fileInput, goodFile);

      // Try to extract without filling tranche
      const extractBtn = screen.getByTestId("extract-btn");
      await user.click(extractBtn);

      expect(
        screen.getByText(/Tranche is required/i)
      ).toBeInTheDocument();
    });

    it("calls extract API with correct payload", async () => {
      const user = userEvent.setup();
      setupFetchResponse({
        ok: true,
        json: { data: { Field1: "Value1", Field2: "Value2" }, confidence: 0.95 },
      });

      render(<EGUploadPage />);

      // Select case
      const select = screen.getByTestId("case-select");
      await user.selectOptions(select, "case-1");

      // Upload file
      const fileInput = screen.getByTestId("file-input");
      const goodFile = createFile(
        "test.docx",
        1000,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      uploadFile(fileInput, goodFile);

      // Extract
      const extractBtn = screen.getByTestId("extract-btn");
      await user.click(extractBtn);

      await waitFor(() => {
        expect(global.fetch as Mock).toHaveBeenCalledWith(
          "/api/extract/eg",
          expect.objectContaining({
            method: "POST",
            body: expect.any(FormData),
          })
        );
      });

      const call = (global.fetch as Mock).mock.calls[0];
      const formData = call[1].body as FormData;
      expect(formData.get("tranche")).toBe("T12");
      expect(formData.get("season")).toBe("2025");
      expect(formData.get("file")).toBeInstanceOf(File);
    });

    it("displays extracted data preview after successful extraction", async () => {
      const user = userEvent.setup();
      setupFetchResponse({
        ok: true,
        json: { data: { Field1: "Value1", Field2: "Value2" }, confidence: 0.95 },
      });

      render(<EGUploadPage />);

      // Select case
      const select = screen.getByTestId("case-select");
      await user.selectOptions(select, "case-1");

      // Upload file
      const fileInput = screen.getByTestId("file-input");
      const goodFile = createFile(
        "test.docx",
        1000,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      uploadFile(fileInput, goodFile);

      // Extract
      const extractBtn = screen.getByTestId("extract-btn");
      await user.click(extractBtn);

      await waitFor(() => {
        expect(screen.getByText(/Field1/i)).toBeInTheDocument();
        expect(screen.getByText(/Value1/i)).toBeInTheDocument();
        expect(screen.getByText(/Field2/i)).toBeInTheDocument();
        expect(screen.getByText(/Value2/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/2 fields extracted/i)).toBeInTheDocument();
      expect(screen.getByTestId("save-btn")).toBeInTheDocument();
    });

    it("shows error when extraction API fails", async () => {
      const user = userEvent.setup();
      setupFetchResponse({
        ok: false,
        status: 500,
        json: { error: "Server error during extraction" },
      });

      render(<EGUploadPage />);

      // Select case
      const select = screen.getByTestId("case-select");
      await user.selectOptions(select, "case-1");

      // Upload file
      const fileInput = screen.getByTestId("file-input");
      const goodFile = createFile(
        "test.docx",
        1000,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      uploadFile(fileInput, goodFile);

      // Extract
      const extractBtn = screen.getByTestId("extract-btn");
      await user.click(extractBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Server error during extraction/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("save flow", () => {
    it("calls save API and resets state on success", async () => {
      const user = userEvent.setup();

      // Extraction response
      setupFetchResponse({
        ok: true,
        json: { data: { Field1: "Value1" }, confidence: 0.95 },
      });

      // Save response
      setupFetchResponse({
        ok: true,
        json: { success: true },
      });

      render(<EGUploadPage />);

      // Select case
      const select = screen.getByTestId("case-select");
      await user.selectOptions(select, "case-1");

      // Upload file
      const fileInput = screen.getByTestId("file-input");
      const goodFile = createFile(
        "test.docx",
        1000,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      uploadFile(fileInput, goodFile);

      // Extract
      const extractBtn = screen.getByTestId("extract-btn");
      await user.click(extractBtn);

      await waitFor(() => {
        expect(screen.getByText(/Field1/i)).toBeInTheDocument();
      });

      // Save
      const saveBtn = screen.getByTestId("save-btn");
      await user.click(saveBtn);

      await waitFor(() => {
        expect(global.fetch as Mock).toHaveBeenLastCalledWith(
          "/api/cases/case-1/save",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ egData: { Field1: "Value1" } }),
          })
        );
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Saved",
          description: "EG table data has been replaced.",
        })
      );
      expect(mockRefetch).toHaveBeenCalled();
    });

    it("shows error when save API fails", async () => {
      const user = userEvent.setup();

      // Extraction response
      setupFetchResponse({
        ok: true,
        json: { data: { Field1: "Value1" }, confidence: 0.95 },
      });

      // Save response
      setupFetchResponse({
        ok: false,
        status: 400,
        json: { error: "Validation failed" },
      });

      render(<EGUploadPage />);

      // Select case
      const select = screen.getByTestId("case-select");
      await user.selectOptions(select, "case-1");

      // Upload file
      const fileInput = screen.getByTestId("file-input");
      const goodFile = createFile(
        "test.docx",
        1000,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      uploadFile(fileInput, goodFile);

      // Extract
      const extractBtn = screen.getByTestId("extract-btn");
      await user.click(extractBtn);

      await waitFor(() => {
        expect(screen.getByText(/Field1/i)).toBeInTheDocument();
      });

      // Save
      const saveBtn = screen.getByTestId("save-btn");
      await user.click(saveBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Validation failed/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("drag and drop", () => {
    it("handles file drop", () => {
      render(<EGUploadPage />);

      const dropZone = screen.getByTestId("drop-zone");

      const goodFile = createFile(
        "dropped.docx",
        1000,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );

      // Simulate drop via fireEvent since jsdom DataTransfer is limited
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [goodFile],
          types: ["Files"],
        },
      });

      expect(screen.getByText(/dropped\.docx/i)).toBeInTheDocument();
    });

    it("rejects invalid files on drop", () => {
      render(<EGUploadPage />);

      const dropZone = screen.getByTestId("drop-zone");

      const badFile = createFile("bad.pdf", 1000, "application/pdf");

      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [badFile],
          types: ["Files"],
        },
      });

      expect(
        screen.getByText(/Invalid file type\. Supported: \.doc, \.docx/i)
      ).toBeInTheDocument();
    });
  });

  describe("keyboard accessibility", () => {
    it("opens file picker on Enter key", async () => {
      const user = userEvent.setup();
      render(<EGUploadPage />);

      const dropZone = screen.getByTestId("drop-zone");
      await user.type(dropZone, "{enter}");

      // File input should exist and be hidden
      const fileInput = screen.getByTestId("file-input");
      expect(fileInput).toHaveClass("hidden");
    });

    it("opens file picker on Space key", async () => {
      const user = userEvent.setup();
      render(<EGUploadPage />);

      const dropZone = screen.getByTestId("drop-zone");
      await user.type(dropZone, " ");

      const fileInput = screen.getByTestId("file-input");
      expect(fileInput).toHaveClass("hidden");
    });
  });

  describe("back navigation", () => {
    it("calls router.back when back button is clicked", async () => {
      const user = userEvent.setup();
      render(<EGUploadPage />);

      const backBtn = screen.getByRole("button", { name: /Back/i });
      await user.click(backBtn);

      expect(mockBack).toHaveBeenCalled();
    });
  });
});
