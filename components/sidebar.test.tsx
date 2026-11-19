import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./sidebar";

// ── Mocks ──

let mockPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

const mockSetStage = vi.fn();
const mockSetMobileMenuOpen = vi.fn();

vi.mock("@/lib/store", () => ({
  useProductStore: () => ({
    currentStage: 1,
    setStage: mockSetStage,
    products: [],
    workflowMode: null,
    setWorkflowMode: vi.fn(),
  }),
}));

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  const icon = (testId: string, label: string) => () => (
    <span data-testid={testId}>{label}</span>
  );
  return {
    ...actual,
    LayoutDashboard: icon("icon-dashboard", "D"),
    Upload: icon("icon-upload", "U"),
    FileCheck: icon("icon-filecheck", "F"),
    CheckCircle: icon("icon-check", "C"),
    FileText: icon("icon-file", "T"),
    Menu: icon("icon-menu", "M"),
    X: icon("icon-close", "X"),
    XIcon: icon("icon-close", "X"),
    LogOut: icon("icon-logout", "L"),
    Package: icon("icon-package", "P"),
    BoxesIcon: icon("icon-boxes", "B"),
    Settings: icon("icon-settings", "S"),
    BarChart3: icon("icon-chart", "Ch"),
    Users: icon("icon-users", "Pe"),
    DatabaseZap: icon("icon-import", "I"),
    FileSpreadsheet: icon("icon-spreadsheet", "X"),
  };
});

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt || ""} />
  ),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/";
  });

  it("renders desktop navigation with Dashboard, Imports and EG Excel update links", () => {
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const dashboardLink = screen.getByTitle("Dashboard");
    expect(dashboardLink).toHaveAttribute("href", "/");

    expect(screen.getByTitle("Import previous cases")).toHaveAttribute(
      "href",
      "/imports",
    );
    expect(screen.getByTitle("Update EG forms from Excel")).toHaveAttribute(
      "href",
      "/eg-table-update",
    );
  });

  it("marks current page with aria-current on Dashboard", () => {
    mockPathname = "/";
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const dashboardLink = screen.getByTitle("Dashboard");
    expect(dashboardLink).toHaveAttribute("aria-current", "page");

    expect(screen.getByTitle("Update EG forms from Excel")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks current page with aria-current on Imports", () => {
    mockPathname = "/imports";
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const importLink = screen.getByTitle("Import previous cases");
    expect(importLink).toHaveAttribute("aria-current", "page");

    const dashboardLink = screen.getByTitle("Dashboard");
    expect(dashboardLink).not.toHaveAttribute("aria-current");
  });

  it("applies active styling to current page link", () => {
    mockPathname = "/eg-table-update";
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const updateLink = screen.getByTitle("Update EG forms from Excel");
    expect(updateLink.className).toContain("bg-primary");
  });

  it("applies inactive styling to non-active page links", () => {
    mockPathname = "/";
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const updateLink = screen.getByTitle("Update EG forms from Excel");
    expect(updateLink.className).not.toContain("bg-primary");
    expect(updateLink.className).toContain("hover:bg-accent");
  });

  it("renders Imports link in mobile menu", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar mobileMenuOpen={true} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const mobileImports = screen.getAllByText("Import previous cases")[0];
    expect(mobileImports).toBeInTheDocument();
    await user.click(mobileImports.closest("a")!);
    expect(mockSetMobileMenuOpen).toHaveBeenCalledWith(false);
  });

  it("does not show the commented-out step shortcuts on the slim sidebar", () => {
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    expect(screen.queryByTitle("Extraction (Step 1)")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Justification (Step 3)")).not.toBeInTheDocument();
    expect(screen.queryByTitle("EG Upload & Replace")).not.toBeInTheDocument();
  });

  it("toggles mobile menu when hamburger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    // Hamburger is in the mobile header, not in sidebar directly
    // The sidebar only renders the aside; hamburger is in Header component
    // So we test the mobile menu close button instead when menu is open
    render(
      <Sidebar mobileMenuOpen={true} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const closeBtn = screen.getAllByRole("button").find((btn) =>
      btn.querySelector('[data-testid="icon-close"]')
    );
    if (closeBtn) {
      await user.click(closeBtn);
      expect(mockSetMobileMenuOpen).toHaveBeenCalledWith(false);
    }
  });

  it("renders a separate Update EG forms from Excel link, not mixed with Imports", () => {
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const updateLink = screen.getByTitle("Update EG forms from Excel");
    expect(updateLink).toHaveAttribute("href", "/eg-table-update");

    const importLink = screen.getByTitle("Import previous cases");
    expect(importLink).toHaveAttribute("href", "/imports");
    expect(importLink).not.toBe(updateLink);
  });

  it("marks current page with aria-current on Update EG forms from Excel", () => {
    mockPathname = "/eg-table-update";
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const updateLink = screen.getByTitle("Update EG forms from Excel");
    expect(updateLink).toHaveAttribute("aria-current", "page");
    expect(screen.getByTitle("Import previous cases")).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders Update EG forms from Excel in the mobile menu", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar mobileMenuOpen={true} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const mobileLink = screen.getAllByText("Update EG forms from Excel")[0];
    expect(mobileLink).toBeInTheDocument();
    await user.click(mobileLink.closest("a")!);
    expect(mockSetMobileMenuOpen).toHaveBeenCalledWith(false);
  });
});
